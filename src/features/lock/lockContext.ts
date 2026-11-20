import { createContext, useContext } from 'react';

export interface AppLockApi {
  /** True when the lock is switched on in Settings. */
  enabled: boolean;
  /** Lock the app immediately. */
  lockNow: () => void;
}

export const AppLockContext = createContext<AppLockApi>({ enabled: false, lockNow: () => {} });

export const useAppLock = () => useContext(AppLockContext);

export const IDLE_MS = 10 * 60 * 1000;
