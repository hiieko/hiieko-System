import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Modal,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, CameraCapturedPicture } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import {
  Project,
  OcrResult,
  ExpenseCategory,
  PaymentMethod,
  getLowConfidenceFields,
  CAMERA_TIPS_KEYS,
  t,
} from '@solar/shared';
import {
  runOcrExtraction,
} from '../services/ocr';
import {
  ReceiptDraft,
  SubmitOutcome,
  saveCapturedImage,
  submitReceiptDraft,
} from '../services/expenseDocuments';
import {
  processDocumentImage,
  ProcessedDocument,
} from '../services/documentProcessing';

const CATS: ExpenseCategory[] = [
  'fuel', 'accommodation', 'food', 'transport', 'parking', 'tolls',
  'materials', 'tools', 'equipment', 'phone_internet', 'other',
];
const CAT_LABELS: Record<string, string> = {
  fuel: 'Combustibil', accommodation: 'Cazare', food: 'Mancare', transport: 'Transport',
  parking: 'Parcare', tolls: 'Taxe drum', materials: 'Materiale', tools: 'Scule',
  equipment: 'Echipamente', phone_internet: 'Telefon', other: 'Altele',
};
const PAYS: { v: PaymentMethod; l: string }[] = [
  { v: 'personal', l: 'Platit personal' },
  { v: 'company_card', l: 'Card companie' },
  { v: 'company_cash', l: 'Cash avans' },
  { v: 'other', l: 'Alta' },
];

type Step = 'capture' | 'preview' | 'review' | 'done';

interface ReviewFields {
  supplier: string;
  cui: string;
  docNumber: string;
  docDate: string;
  total: string;
  vat: string;
  currency: string;
  category: ExpenseCategory;
  projectId: string;
  purpose: string;
  paymentMethod: PaymentMethod;
}

export interface ReceiptScanFlowProps {
  visible: boolean;
  onClose: () => void;
  onComplete: (draft: ReceiptDraft, outcome: SubmitOutcome) => void;
  userId: string;
  projects: Project[];
  defaultProjectId?: string;
  locale?: 'ro' | 'en';
}

export function ReceiptScanFlow({
  visible,
  onClose,
  onComplete,
  userId,
  projects,
  defaultProjectId,
  locale = 'ro',
}: ReceiptScanFlowProps) {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const [step, setStep] = useState<Step>('capture');
  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const [localUris, setLocalUris] = useState<string[]>([]);
  const [processedUri, setProcessedUri] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [ocr, setOcr] = useState<OcrResult | null>(null);
  const [ocrNotConfigured, setOcrNotConfigured] = useState(false);
  const [ocrMsg, setOcrMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [doneMessage, setDoneMessage] = useState('');

  const [fields, setFields] = useState<ReviewFields>({
    supplier: '', cui: '', docNumber: '', docDate: '', total: '', vat: '',
    currency: 'RON', category: 'fuel', projectId: defaultProjectId ?? projects[0]?.id ?? '',
    purpose: '', paymentMethod: 'personal',
  });

  const reset = () => {
    setStep('capture');
    setFlash('off');
    setLocalUris([]);
    setProcessedUri(null);
    setRotation(0);
    setPreviewUri(null);
    setProcessing(false);
    setOcr(null);
    setOcrNotConfigured(false);
    setOcrMsg('');
    setSubmitting(false);
    setDoneMessage('');
    setFields({
      supplier: '', cui: '', docNumber: '', docDate: '', total: '', vat: '',
      currency: 'RON', category: 'fuel', projectId: defaultProjectId ?? projects[0]?.id ?? '',
      purpose: '', paymentMethod: 'personal',
    });
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  /**
   * Apply the currently selected rotation to the first captured page and
   * persist a processed copy. Originals stay in `localUris` (always uploaded).
   */
  const applyRotation = async () => {
    if (localUris.length === 0) return;
    const next = (rotation + 90) % 360;
    setRotation(next);
    try {
      const processed: ProcessedDocument = await processDocumentImage(localUris[0], {
        rotateDegrees: next,
        minWidthPx: 1200,
      });
      setProcessedUri(processed.uri);
    } catch (err) {
      setOcrMsg(t('err.scan_failed', locale));
    }
  };

  const capture = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 1,
        skipProcessing: false,
      });
      if (!photo) return;
      const saved = await saveCapturedImage(photo.uri);
      if (!saved) return;
      setLocalUris((prev) => [...prev, saved]);
      setPreviewUri(photo.uri);
      setStep('preview');
    } catch (err: any) {
      setOcrMsg(t('err.scan_failed', locale));
    }
  };

  const retake = () => {
    setPreviewUri(null);
    setStep('capture');
  };

  const runOcr = async () => {
    if (localUris.length === 0) return;
    setProcessing(true);
    try {
      // If the user rotated the image on the preview step, OCR the
      // processed copy (the original is still preserved in localUris and
      // is uploaded unchanged for archival / RLS-controlled access).
      const ocrSourceUri = processedUri ?? localUris[0];
      const b64 = await FileSystem.readAsStringAsync(ocrSourceUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const outcome = await runOcrExtraction(b64, 'image/jpeg');
      if (outcome.ok && outcome.ocr) {
        setOcr(outcome.ocr);
        setOcrNotConfigured(false);
        setOcrMsg('');
        const o = outcome.ocr;
        setFields((f) => ({
          ...f,
          supplier: o.merchant_name ?? f.supplier,
          cui: o.merchant_cui ?? f.cui,
          docNumber: o.document_number ?? f.docNumber,
          docDate: o.document_date ?? f.docDate,
          total: o.total !== undefined ? String(o.total) : f.total,
          vat: o.vat !== undefined ? String(o.vat) : f.vat,
          currency: o.currency ?? f.currency,
          paymentMethod:
            o.payment_method === 'card' ? 'company_card' : o.payment_method === 'cash' ? 'personal' : f.paymentMethod,
        }));
      } else {
        setOcr(null);
        setOcrNotConfigured(!!outcome.notConfigured);
        setOcrMsg(outcome.message || '');
      }
    } catch (err: any) {
      setOcr(null);
      setOcrNotConfigured(false);
      setOcrMsg(err?.message || t('err.ocr_failed', locale));
    } finally {
      setProcessing(false);
      setStep('review');
    }
  };

  const submit = async () => {
    if (!fields.total || Number(fields.total) <= 0) {
      setOcrMsg(t('err.expense_incomplete', locale));
      return;
    }
    setSubmitting(true);
    const draft: ReceiptDraft = {
      id: `draft_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      userId,
      projectId: fields.projectId,
      localUris,
      documentType: ocr?.document_type === 'FACTURA' ? 'factura' : 'bon_fiscal',
      ocr: ocr ?? undefined,
      ocrStatus: ocr ? 'done' : ocrNotConfigured ? 'not_configured' : 'none',
      expense: {
        category: fields.category,
        payment_method: fields.paymentMethod,
        amount: Number(fields.total) || 0,
        currency: fields.currency || 'RON',
        description: fields.purpose || fields.supplier || '',
        notes: fields.supplier ? `Furnizor: ${fields.supplier}` : undefined,
      },
      createdAt: new Date().toISOString(),
    };
    const outcome = await submitReceiptDraft(draft);
    setSubmitting(false);
    setDoneMessage(
      outcome.submitted
        ? t('general.success', locale)
        : outcome.queued
        ? t('status.saved_offline', locale)
        : t('general.error', locale)
    );
    setStep('done');
    onComplete(draft, outcome);
  };

  const lowConfidence = getLowConfidenceFields(ocr);
  const isLow = (key: string) => lowConfidence.includes(key as never);

  const renderCapture = () => {
    if (!permission?.granted) {
      return (
        <View style={styles.center}>
          <Text style={styles.msg}>{t('scan.permission_denied', locale)}</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission} accessibilityRole="button">
            <Text style={styles.primaryBtnText}>{t('general.retry', locale)}</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={{ flex: 1 }}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" flash={flash} />
        <View style={styles.tipsBox}>
          {CAMERA_TIPS_KEYS.map((k) => (
            <Text key={k} style={styles.tip}>• {t(k, locale)}</Text>
          ))}
        </View>
        <View style={styles.controls}>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => setFlash((f) => (f === 'on' ? 'off' : 'on'))}
            accessibilityRole="button"
            accessibilityLabel={t('scan.flash', locale)}
          >
            <Text style={styles.secondaryBtnText}>{t('scan.flash', locale)}: {flash === 'on' ? 'ON' : 'OFF'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.captureBtn} onPress={capture} accessibilityRole="button">
            <Text style={styles.captureText}>{t('scan.capture', locale)}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderPreview = () => (
    <View style={{ flex: 1 }}>
      {previewUri ? <Image source={{ uri: previewUri }} style={StyleSheet.absoluteFill} resizeMode="contain" /> : null}
      <View style={styles.previewBadge}>
        <Text style={styles.previewBadgeText}>
          {t('scan.preview', locale)} — {localUris.length} {t('scan.pageCount', locale)}
          {processedUri ? `  •  ${t('scan.rotated', locale)} (${rotation}°)` : ''}
        </Text>
      </View>
      <View style={styles.controls}>
        <TouchableOpacity style={styles.secondaryBtn} onPress={retake} accessibilityRole="button">
          <Text style={styles.secondaryBtnText}>{t('scan.retake', locale)}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={applyRotation} accessibilityRole="button">
          <Text style={styles.secondaryBtnText}>{t('scan.rotate', locale)}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.captureBtn} onPress={capture} accessibilityRole="button">
          <Text style={styles.captureText}>{t('scan.add_page', locale)}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryBtn} onPress={runOcr} disabled={processing} accessibilityRole="button">
          <Text style={styles.primaryBtnText}>
            {processing ? t('ocr.processing', locale) : t('scan.process', locale)}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderReview = () => (
    <ScrollView contentContainerStyle={styles.reviewContainer}>
      {ocrMsg ? <Text style={styles.warnMsg}>{ocrMsg}</Text> : null}
      {ocrNotConfigured ? <Text style={styles.warnMsg}>{t('ocr.not_configured', locale)}</Text> : null}
      {lowConfidence.length > 0 ? <Text style={styles.warnMsg}>⚠ {t('ocr.low_confidence', locale)}</Text> : null}
      <Text style={styles.reviewHint}>{t('ocr.review_prompt', locale)}</Text>

      <Field label={t('ocr.field.merchant_name', locale)} value={fields.supplier} low={isLow('merchant_name')}
        onChange={(v) => setFields((f) => ({ ...f, supplier: v }))} />
      <Field label={t('ocr.field.merchant_cui', locale)} value={fields.cui} low={isLow('merchant_cui')}
        onChange={(v) => setFields((f) => ({ ...f, cui: v }))} />
      <Field label={t('ocr.field.document_number', locale)} value={fields.docNumber} low={isLow('document_number')}
        onChange={(v) => setFields((f) => ({ ...f, docNumber: v }))} />
      <Field label={t('ocr.field.document_date', locale)} value={fields.docDate} low={isLow('document_date')}
        onChange={(v) => setFields((f) => ({ ...f, docDate: v }))} />
      <Field label={t('ocr.field.total', locale)} value={fields.total} low={isLow('total')} numeric
        onChange={(v) => setFields((f) => ({ ...f, total: v }))} />
      <Field label={t('ocr.field.vat', locale)} value={fields.vat} low={isLow('vat')} numeric
        onChange={(v) => setFields((f) => ({ ...f, vat: v }))} />
      <Field label={t('ocr.field.currency', locale)} value={fields.currency} low={isLow('currency')}
        onChange={(v) => setFields((f) => ({ ...f, currency: v }))} />

      <Text style={styles.sectionLabel}>{t('expenses.category', locale)}</Text>
      <View style={styles.chips}>
        {CATS.map((c) => (
          <TouchableOpacity key={c} style={[styles.chip, fields.category === c && styles.chipActive]}
            onPress={() => setFields((f) => ({ ...f, category: c }))} accessibilityRole="button">
            <Text style={[styles.chipText, fields.category === c && styles.chipTextActive]}>{CAT_LABELS[c]}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionLabel}>{t('expenses.Project', locale)}</Text>
      <View style={styles.chips}>
        {projects.map((st) => (
          <TouchableOpacity key={st.id} style={[styles.chip, fields.projectId === st.id && styles.chipActive]}
            onPress={() => setFields((f) => ({ ...f, projectId: st.id }))} accessibilityRole="button">
            <Text style={[styles.chipText, fields.projectId === st.id && styles.chipTextActive]}>{st.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionLabel}>{t('expenses.payment', locale)}</Text>
      <View style={styles.chips}>
        {PAYS.map((p) => (
          <TouchableOpacity key={p.v} style={[styles.chip, fields.paymentMethod === p.v && styles.chipActive]}
            onPress={() => setFields((f) => ({ ...f, paymentMethod: p.v }))} accessibilityRole="button">
            <Text style={[styles.chipText, fields.paymentMethod === p.v && styles.chipTextActive]}>{p.l}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Field label={t('help.purpose', locale)} value={fields.purpose} low={false} multiline
        onChange={(v) => setFields((f) => ({ ...f, purpose: v }))} />

      <TouchableOpacity style={styles.submitBtn} onPress={submit} disabled={submitting} accessibilityRole="button">
        {submitting ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.submitText}>{t('scan.submit', locale)}</Text>}
      </TouchableOpacity>
    </ScrollView>
  );

  const renderDone = () => (
    <View style={styles.center}>
      <Text style={styles.doneTitle}>{doneMessage}</Text>
      <TouchableOpacity style={styles.primaryBtn} onPress={handleClose} accessibilityRole="button">
        <Text style={styles.primaryBtnText}>{t('general.close', locale)}</Text>
      </TouchableOpacity>
    </View>
  );

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('scan.open', locale)}</Text>
          <TouchableOpacity onPress={handleClose} accessibilityRole="button" accessibilityLabel={t('scan.cancel', locale)}>
            <Text style={styles.cancel}>{t('scan.cancel', locale)}</Text>
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1 }}>
          {step === 'capture' && renderCapture()}
          {step === 'preview' && renderPreview()}
          {step === 'review' && renderReview()}
          {step === 'done' && renderDone()}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function Field({
  label,
  value,
  onChange,
  low,
  numeric,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  low: boolean;
  numeric?: boolean;
  multiline?: boolean;
}) {
  return (
    <View style={[styles.fieldWrap, low && styles.fieldLow]}>
      <Text style={styles.fieldLabel}>{label}{low ? ' ⚠' : ''}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChange}
        keyboardType={numeric ? 'decimal-pad' : 'default'}
        placeholderTextColor="#64748b"
        multiline={multiline}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0f172a' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  title: { color: '#f59e0b', fontSize: 16, fontWeight: '800' },
  cancel: { color: '#94a3b8', fontSize: 14, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  msg: { color: '#e2e8f0', fontSize: 14, textAlign: 'center', marginBottom: 16, lineHeight: 20 },
  primaryBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  tipsBox: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(15,23,42,0.85)',
    borderRadius: 10,
    padding: 12,
  },
  tip: { color: '#cbd5e1', fontSize: 12, lineHeight: 18 },
  controls: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  secondaryBtn: {
    backgroundColor: '#334155',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  secondaryBtnText: { color: '#e2e8f0', fontWeight: '700', fontSize: 12 },
  captureBtn: {
    backgroundColor: '#f59e0b',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 50,
    alignItems: 'center',
  },
  captureText: { color: '#0f172a', fontWeight: '800', fontSize: 14 },
  previewBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(15,23,42,0.85)',
    borderRadius: 10,
    padding: 10,
  },
  previewBadgeText: { color: '#f59e0b', fontWeight: '700', fontSize: 12, textAlign: 'center' },
  reviewContainer: { padding: 16, backgroundColor: '#0f172a', flexGrow: 1 },
  warnMsg: {
    color: '#fde68a',
    backgroundColor: '#78350f',
    borderRadius: 10,
    padding: 10,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 10,
    lineHeight: 17,
  },
  reviewHint: { color: '#94a3b8', fontSize: 12, marginBottom: 14, lineHeight: 17 },
  sectionLabel: {
    color: '#f59e0b',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 14,
    marginBottom: 8,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#334155' },
  chipActive: { backgroundColor: '#f59e0b' },
  chipText: { fontSize: 12, fontWeight: '600', color: '#cbd5e1' },
  chipTextActive: { color: '#0f172a', fontWeight: '800' },
  submitBtn: {
    backgroundColor: '#10b981',
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  submitText: { color: '#0f172a', fontWeight: '800', fontSize: 15 },
  fieldWrap: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  fieldLow: { borderColor: '#f59e0b' },
  fieldLabel: { color: '#94a3b8', fontSize: 11, fontWeight: '600', marginBottom: 6 },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  inputMultiline: { minHeight: 64, textAlignVertical: 'top' },
  doneTitle: { color: '#4ade80', fontSize: 18, fontWeight: '800', marginBottom: 20, textAlign: 'center' },
});





