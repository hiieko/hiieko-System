/**
 * HIIEKO — Shared common types for the Web frontend
 *
 * Base types used across all feature modules.
 */

/** Generic paginated response shape */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Sort direction */
export type SortDirection = 'asc' | 'desc';

/** Generic sort state */
export interface SortState {
  field: string;
  direction: SortDirection;
}

/** Generic filter state */
export interface FilterState {
  search?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  [key: string]: string | undefined;
}

/** Base entity with timestamps */
export interface BaseEntity {
  id: string;
  created_at: string;
  updated_at?: string;
}

/** Option for select/combobox components */
export interface SelectOption<T = string> {
  value: T;
  label: string;
  disabled?: boolean;
}

/** Tab definition for tab navigation */
export interface TabDef {
  key: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  href?: string;
  badge?: number;
  disabled?: boolean;
}
