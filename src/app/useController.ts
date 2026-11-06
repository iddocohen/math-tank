/** React bridge to the BattleController (research R4): re-renders on every new RoundState. */
import { useCallback, useSyncExternalStore } from 'react';
import type { BattleController } from '../core/battle/controller';
import type { RoundState } from '../core/types';

export function useRoundState(controller: BattleController): RoundState {
  const subscribe = useCallback((onChange: () => void) => controller.subscribe(onChange), [controller]);
  const getSnapshot = useCallback(() => controller.getState(), [controller]);
  return useSyncExternalStore(subscribe, getSnapshot);
}
