import { createContext, useContext } from 'react';

export interface ConfirmOptions {
  title: string;
  body?: string;
  confirmLabel?: string;
  /** Destructive actions get the danger colour. */
  danger?: boolean;
}

export interface FeedbackApi {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  toast: (message: string, tone?: 'info' | 'error') => void;
}

export const FeedbackContext = createContext<FeedbackApi | null>(null);

function useFeedback(): FeedbackApi {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('Feedback hooks must be used inside <FeedbackProvider>');
  return ctx;
}

/** Ask before anything destructive: `if (await confirm({...})) ...` */
export const useConfirm = () => useFeedback().confirm;
export const useToast = () => useFeedback().toast;
