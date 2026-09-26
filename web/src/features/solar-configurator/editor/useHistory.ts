'use client';

import { useCallback, useRef, useState } from 'react';
import { HistorySnapshot, createHistory } from '@solar/shared';

/**
 * Minimal undo/redo history over a single state value (the placements array).
 *
 * Reusable editor infrastructure: one committed `set()` call per logical
 * operation (drag end, rotate, duplicate, delete, …) — never per pointer move.
 * The pure state machine lives in `@solar/shared` (createHistory).
 */
export function useHistory<T>(initial: T, limit = 100) {
  const core = useRef(createHistory<T>(initial, limit));
  const [snapshot, setSnapshot] = useState<HistorySnapshot<T>>(() => core.current.get());

  const sync = useCallback(() => setSnapshot(core.current.get()), []);

  const set = useCallback(
    (next: T) => {
      core.current.commit(next);
      sync();
    },
    [sync],
  );

  const reset = useCallback(
    (next: T) => {
      core.current.reset(next);
      sync();
    },
    [sync],
  );

  const undo = useCallback(() => {
    core.current.undo();
    sync();
  }, [sync]);

  const redo = useCallback(() => {
    core.current.redo();
    sync();
  }, [sync]);

  return {
    present: snapshot.present,
    canUndo: snapshot.past.length > 0,
    canRedo: snapshot.future.length > 0,
    set,
    reset,
    undo,
    redo,
  };
}

