// Adapted from https://animate-ui.com/r/hooks-use-controlled-state.json
// License: ../LICENSE
import { useCallback, useEffect, useState } from 'react';

interface CommonControlledStateProps<T> {
  value?: T;
  defaultValue?: T;
}

export function useControlledState<T, Rest extends unknown[] = []>(
  { value, defaultValue, onChange }: CommonControlledStateProps<T> & {
    onChange?: (value: T, ...args: Rest) => void;
  },
): readonly [T, (next: T, ...args: Rest) => void] {
  const [state, setInternalState] = useState<T>(
    value !== undefined ? value : (defaultValue as T),
  );

  useEffect(() => {
    if (value !== undefined) setInternalState(value);
  }, [value]);

  const setState = useCallback((next: T, ...args: Rest) => {
    setInternalState(next);
    onChange?.(next, ...args);
  }, [onChange]);

  return [state, setState] as const;
}
