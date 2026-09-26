/**
 * Minimal pure undo/redo history (no React). The web `useHistory` hook wraps
 * this; the pure core is unit-testable in the backend suite.
 */
export interface HistorySnapshot<T> {
  past: T[];
  present: T;
  future: T[];
}

export interface History<T> {
  get: () => HistorySnapshot<T>;
  commit: (next: T) => void;
  reset: (next: T) => void;
  undo: () => void;
  redo: () => void;
}

export function createHistory<T>(initial: T, limit = 100): History<T> {
  let state: HistorySnapshot<T> = { past: [], present: initial, future: [] };

  return {
    get: () => state,
    commit: (next: T) => {
      state = {
        past: [...state.past.slice(-(limit - 1)), state.present],
        present: next,
        future: [],
      };
    },
    reset: (next: T) => {
      state = { past: [], present: next, future: [] };
    },
    undo: () => {
      const prev = state.past[state.past.length - 1];
      if (prev === undefined) return;
      state = {
        past: state.past.slice(0, -1),
        present: prev,
        future: [state.present, ...state.future],
      };
    },
    redo: () => {
      const next = state.future[0];
      if (next === undefined) return;
      state = {
        past: [...state.past, state.present],
        present: next,
        future: state.future.slice(1),
      };
    },
  };
}
