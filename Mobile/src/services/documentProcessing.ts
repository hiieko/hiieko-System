import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';

/**
 * Document image processing for the HIIEKO scanning workflow (spec §2).
 *
 * Runs on-device with expo-image-manipulator (maintained, Expo Go compatible,
 * no native development build required). The ORIGINAL captured image is never
 * modified: processing always produces a NEW file in durable storage, so the
 * original stays preserved for secure upload alongside the processed copy.
 *
 * Supported operations (real, testable on any device):
 *   - rotation correction (90° steps)
 *   - manual crop (rectangle in source-image pixels)
 *   - OCR readability upscale (small images enlarged to a minimum width)
 *
 * NOT supported in the current managed-Expo architecture (see report):
 * automatic edge detection, perspective correction, automatic crop and glare
 * reduction all require native frame processing (react-native-vision-camera /
 * react-native-skia / ML Kit document scanner), which needs a development
 * build that this project does not use.
 */

export interface CropRect {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

export interface DocumentProcessingOptions {
  /** Clockwise rotation in degrees (90 / 180 / 270). */
  rotateDegrees?: number;
  /** Crop rectangle in the (post-rotation) source-image pixel space. */
  crop?: CropRect;
  /** Upscale images narrower than this width (px) for better OCR reading. */
  minWidthPx?: number;
}

export interface ProcessedDocument {
  uri: string;
  width: number;
  height: number;
}

const SCAN_DIR_NAME = 'expense-scans/';

function getScanDir(): string | null {
  return FileSystem.documentDirectory ? FileSystem.documentDirectory + SCAN_DIR_NAME : null;
}

/** Probe the pixel dimensions of an image (re-encodes a copy; no-op actions). */
export async function getImageSize(
  uri: string
): Promise<{ width: number; height: number }> {
  const res = await ImageManipulator.manipulateAsync(uri, [], {
    compress: 1,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return { width: res.width, height: res.height };
}

/**
 * Apply rotation / crop / upscale to a copy of the image.
 * The source file is left untouched; the result is persisted to durable app
 * storage so it survives restarts and offline use.
 */
export async function processDocumentImage(
  uri: string,
  opts: DocumentProcessingOptions = {}
): Promise<ProcessedDocument> {
  const actions: ImageManipulator.Action[] = [];

  // Source dimensions (needed to clamp the crop rect in the rotated space).
  const { width: srcW, height: srcH } = await getImageSize(uri);
  let w = srcW;
  let h = srcH;

  if (opts.rotateDegrees && opts.rotateDegrees % 90 === 0) {
    actions.push({ rotate: opts.rotateDegrees });
    if (opts.rotateDegrees % 180 !== 0) {
      const t = w;
      w = h;
      h = t;
    }
  }

  if (opts.crop) {
    const c = opts.crop;
    const ox = Math.max(0, Math.min(w - 1, Math.round(c.originX)));
    const oy = Math.max(0, Math.min(h - 1, Math.round(c.originY)));
    const cw = Math.max(1, Math.min(w - ox, Math.round(c.width)));
    const ch = Math.max(1, Math.min(h - oy, Math.round(c.height)));
    actions.push({ crop: { originX: ox, originY: oy, width: cw, height: ch } });
    w = cw;
    h = ch;
  }

  if (opts.minWidthPx && w < opts.minWidthPx) {
    actions.push({ resize: { width: opts.minWidthPx } });
  }

  const res = await ImageManipulator.manipulateAsync(uri, actions, {
    compress: 0.9,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  // Persist a durable copy so the processed image survives (original kept).
  const dir = getScanDir();
  if (!dir) return { uri: res.uri, width: res.width, height: res.height };
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const dest = `${dir}proc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
  await FileSystem.copyAsync({ from: res.uri, to: dest });
  return { uri: dest, width: res.width, height: res.height };
}