/**
 * HIIEKO — Daily Planning: supervisor "Site Readiness" reads
 *
 * The right rail answers one question with real project data only: can the
 * selected day's plan be executed? Every row is backed by an existing endpoint
 * and every failure is fail-closed (row shows "Unavailable"), never a fake
 * green state.
 *
 * Endpoints (all existing, none added by this feature):
 *   GET /api/attendance/today?projectId=   AttendanceController.getTodaySummary
 *   GET /api/inventory/stock?projectId=    InventoryController.listBalances
 *   GET /api/issues?projectId=             IssuesController.findAll
 *
 * DATA SCOPE: worker/technician must never issue project-wide reads, so
 * `canReadProjectReadiness()` gates every call — the rail is not rendered for
 * field roles, and this module refuses to read for them even if it were.
 *
 * HONESTY NOTES:
 *   - attendance is TODAY-only: the endpoint takes no date, so the rail needs
 *     `/api/attendance/today` (there is no historical summary read).
 *   - "below minimum" reuses the exact Control Tower rule
 *     (`control-tower.service.ts`: `current_quantity < (min_stock_threshold || 0)`),
 *     so the rail can never disagree with the Control Tower.
 *   - no readiness score/percentage is computed: there is no such field.
 */

import { apiClient } from '../../lib/api-client';
import { getTodaySummary } from '../attendance/api';
import type { TodaySummary } from '../attendance/types';
import { isActiveBlocker, sortIssues } from '../issues/constants';
import { getIssues } from '../issues/api';
import type { Issue } from '../issues/types';
import { isFieldPlanRole } from './types';

// ── Stock shapes (Prisma StockBalance + `include: { material: true }`) ──

export interface StockMaterialRef {
  id: string;
  code: string;
  name: string;
  /** Prisma `Material.unit` — the only unit column on the model. */
  unit: string;
  /** Prisma Decimal/string — the threshold the Control Tower compares against. */
  min_stock_threshold?: number | string | null;
}

export interface StockBalanceRow {
  id: string;
  material_id: string;
  project_id: string | null;
  warehouse_id: string | null;
  /** Prisma Decimal serialised as a string (or a raw number). */
  current_quantity: number | string;
  material?: StockMaterialRef | null;
}

export interface LowStockItem {
  materialId: string;
  code: string;
  name: string;
  unit: string;
  current: number;
  threshold: number;
  deficit: number;
}

export interface MaterialsSnapshot {
  /** Stock balance rows returned for the project. */
  tracked: number;
  /** Rows below their material minimum (same rule as the Control Tower). */
  lowStock: LowStockItem[];
}

/** Per-row read result — a failed read stays visibly unavailable. */
export interface ReadResult<T> {
  data: T | null;
  error: string | null;
}

export interface ReadinessSnapshot {
  attendance: ReadResult<TodaySummary>;
  materials: ReadResult<MaterialsSnapshot>;
  issues: ReadResult<Issue[]>;
}

// ── Role gate ────────────────────────────────────────────────────────

/**
 * Only supervisor roles may read project-wide readiness data. worker /
 * technician use GET /api/daily-plans/my-tasks only (their own scope).
 */
export function canReadProjectReadiness(role: string | null | undefined): boolean {
  return !isFieldPlanRole(role);
}

// ── Pure derivations ─────────────────────────────────────────────────

function toNumber(value: number | string | null | undefined): number {
  if (value == null) return 0;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Rows whose current quantity is below the material's own minimum threshold.
 * Identical rule to Control Tower (`current < (min_stock_threshold || 0)`), so
 * a zero/quota-less material is never reported as low stock.
 */
export function deriveLowStock(rows: StockBalanceRow[] | null | undefined): LowStockItem[] {
  const low: LowStockItem[] = [];
  for (const row of rows ?? []) {
    const material = row.material;
    if (!material) continue;
    const current = toNumber(row.current_quantity);
    const threshold = toNumber(material.min_stock_threshold);
    if (current < threshold) {
      low.push({
        materialId: row.material_id,
        code: material.code,
        name: material.name,
        unit: material.unit,
        current,
        threshold,
        deficit: threshold - current,
      });
    }
  }
  return low;
}

export function deriveMaterialsSnapshot(
  rows: StockBalanceRow[] | null | undefined,
): MaterialsSnapshot {
  return { tracked: (rows ?? []).length, lowStock: deriveLowStock(rows) };
}

/** Real active blockers, severity-ordered (OPEN / INVESTIGATING / PROPOSED only). */
export function deriveActiveBlockers(issues: Issue[] | null | undefined): Issue[] {
  return sortIssues(issues ?? []).filter(isActiveBlocker);
}

// ── Reads (never throw) ──────────────────────────────────────────────

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function readAttendance(projectId: string): Promise<ReadResult<TodaySummary>> {
  try {
    const res = await getTodaySummary(projectId);
    if (res.error || !res.data) return { data: null, error: res.error ?? 'unavailable' };
    return { data: res.data, error: null };
  } catch (err) {
    return { data: null, error: errorMessage(err) };
  }
}

async function readStock(projectId: string): Promise<ReadResult<MaterialsSnapshot>> {
  try {
    const res = await apiClient.get<StockBalanceRow[]>('/api/inventory/stock', { projectId });
    if (res.error || !Array.isArray(res.data)) {
      return { data: null, error: res.error ?? 'unavailable' };
    }
    return { data: deriveMaterialsSnapshot(res.data), error: null };
  } catch (err) {
    return { data: null, error: errorMessage(err) };
  }
}

async function readIssues(projectId: string): Promise<ReadResult<Issue[]>> {
  try {
    const res = await getIssues(projectId);
    if (res.error || !Array.isArray(res.data)) {
      return { data: null, error: res.error ?? 'unavailable' };
    }
    return { data: res.data, error: null };
  } catch (err) {
    return { data: null, error: errorMessage(err) };
  }
}

/**
 * Load the three readiness sources in parallel. Never throws: each source
 * reports its own error so the rail can degrade one row at a time.
 */
export async function loadProjectReadiness(projectId: string): Promise<ReadinessSnapshot> {
  const [attendance, materials, issues] = await Promise.all([
    readAttendance(projectId),
    readStock(projectId),
    readIssues(projectId),
  ]);
  return { attendance, materials, issues };
}

/** An empty snapshot — used before the first load and for field roles. */
export function emptyReadinessSnapshot(): ReadinessSnapshot {
  return {
    attendance: { data: null, error: null },
    materials: { data: null, error: null },
    issues: { data: null, error: null },
  };
}