import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { strings } from '../../i18n/strings.pt-BR';

interface ConfirmOptions {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface AlertOptions {
  title?: string;
  okLabel?: string;
}

interface DialogState {
  kind: 'confirm' | 'alert';
  message: ReactNode;
  title?: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface DialogContextValue {
  confirm: (message: ReactNode, options?: ConfirmOptions) => Promise<boolean>;
  alert: (message: ReactNode, options?: AlertOptions) => Promise<void>;
  isOpen: boolean;
}

const DialogContext = createContext<DialogContextValue | null>(null);

// Substitui window.confirm/alert nativos (pop-ups do SO que destoam do tema
// escuro do app, mesma categoria do bug do <select> branco) por um diálogo
// no próprio design system. Interface imperativa (await confirm(...)) para
// trocar cada call site com o mínimo de reestruturação.
export function DialogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DialogState | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const close = useCallback((result: boolean) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setState(null);
  }, []);

  // Se já houver um diálogo pendente (ex.: tecla Delete pressionada duas
  // vezes antes do primeiro confirm() renderizar), resolve o anterior como
  // cancelado em vez de sobrescrever o resolver e deixar a primeira Promise
  // pendurada para sempre.
  const open = useCallback((newState: DialogState, resolve: (value: boolean) => void) => {
    resolverRef.current?.(false);
    resolverRef.current = resolve;
    setState(newState);
  }, []);

  const confirm = useCallback(
    (message: ReactNode, options?: ConfirmOptions) => {
      return new Promise<boolean>((resolve) => {
        open(
          {
            kind: 'confirm',
            message,
            title: options?.title,
            confirmLabel: options?.confirmLabel ?? strings.common.delete,
            cancelLabel: options?.cancelLabel ?? strings.common.cancel,
            danger: options?.danger ?? true,
          },
          resolve,
        );
      });
    },
    [open],
  );

  const alertFn = useCallback(
    (message: ReactNode, options?: AlertOptions) => {
      return new Promise<void>((resolve) => {
        open(
          {
            kind: 'alert',
            message,
            title: options?.title,
            confirmLabel: options?.okLabel ?? strings.common.ok,
          },
          () => resolve(),
        );
      });
    },
    [open],
  );

  useEffect(() => {
    if (!state) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') close(false);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state, close]);

  return (
    <DialogContext.Provider value={{ confirm, alert: alertFn, isOpen: state !== null }}>
      {children}
      {state && (
        <div className="dialog-overlay" onMouseDown={() => close(false)}>
          <div className="dialog" role="alertdialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
            {state.title && <h3 className="dialog__title">{state.title}</h3>}
            <p className="dialog__message">{state.message}</p>
            <div className="dialog__actions">
              {state.kind === 'confirm' && (
                // Ação destrutiva nunca recebe o foco automático — um Enter
                // reflexo não pode disparar uma exclusão sem clique deliberado.
                <button type="button" className="btn-secondary" onClick={() => close(false)} autoFocus={state.danger}>
                  {state.cancelLabel}
                </button>
              )}
              <button type="button" className={state.danger ? 'btn-danger' : undefined} onClick={() => close(true)} autoFocus={!state.danger}>
                {state.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}

export function useDialog(): DialogContextValue {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog deve ser usado dentro de DialogProvider');
  return ctx;
}
