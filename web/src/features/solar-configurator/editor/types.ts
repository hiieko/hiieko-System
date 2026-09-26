/** Shared editor UI types for the Solar 2D editor. */
import { Point2D } from '@solar/shared';

export type EditorTool = 'select' | 'pan' | 'measure';

/** Logical (viewBox) pixel dimensions of the 2D plan canvas. */
export const PLAN_VIEW_W = 800;
export const PLAN_VIEW_H = 520;

export interface MeasureState {
  p1: Point2D | null;
  p2: Point2D | null;
}

export const EMPTY_MEASURE: MeasureState = { p1: null, p2: null };
