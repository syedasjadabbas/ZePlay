import React, { createContext, useContext, useState } from 'react';

interface ModalConfig {
  title: string;
  message: string;
  type: 'info' | 'success' | 'danger';
  isConfirm: boolean;
  confirmText?: string;
  cancelText?: string;
  resolve: (value: boolean) => void;
}

interface ModalContextProps {
  showAlert: (title: string, message: string, type?: 'info' | 'success' | 'danger') => Promise<void>;
  showConfirm: (title: string, message: string, type?: 'info' | 'success' | 'danger', confirmText?: string, cancelText?: string) => Promise<boolean>;
}

const ModalContext = createContext<ModalContextProps | undefined>(undefined);

export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
};

export const ModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [modal, setModal] = useState<ModalConfig | null>(null);

  const showAlert = (
    title: string,
    message: string,
    type: 'info' | 'success' | 'danger' = 'info'
  ): Promise<void> => {
    return new Promise((resolve) => {
      setModal({
        title,
        message,
        type,
        isConfirm: false,
        confirmText: 'Dismiss',
        resolve: () => {
          setModal(null);
          resolve();
        },
      });
    });
  };

  const showConfirm = (
    title: string,
    message: string,
    type: 'info' | 'success' | 'danger' = 'info',
    confirmText = 'Confirm',
    cancelText = 'Cancel'
  ): Promise<boolean> => {
    return new Promise((resolve) => {
      setModal({
        title,
        message,
        type,
        isConfirm: true,
        confirmText,
        cancelText,
        resolve: (result: boolean) => {
          setModal(null);
          resolve(result);
        },
      });
    });
  };

  return (
    <ModalContext.Provider value={{ showAlert, showConfirm }}>
      {children}

      {modal && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fadeIn"
          onClick={() => modal.resolve(false)}
        >
          <div
            className="w-full max-w-md bg-[#0B1535] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-[0_25px_60px_rgba(0,0,0,0.85)] space-y-6 text-left transform animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shrink-0 ${
                modal.type === 'danger'
                  ? 'bg-red-500/10 border-red-500/20 text-red-500'
                  : modal.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                  : 'bg-brand-accent/10 border-brand-accent/20 text-brand-accent'
              }`}>
                {modal.type === 'danger' ? (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                ) : modal.type === 'success' ? (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>
              <div className="space-y-1.5 flex-1 min-w-0">
                <h3 className="text-xl font-extrabold font-display text-white tracking-wide leading-snug">
                  {modal.title}
                </h3>
                <p className="text-xs text-brand-textMuted leading-relaxed">
                  {modal.message}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              {modal.isConfirm && (
                <button
                  type="button"
                  onClick={() => modal.resolve(false)}
                  className="px-5 py-2.5 rounded-xl border border-white/10 text-neutral-300 hover:text-white hover:bg-white/5 text-xs font-bold transition-all btn-premium select-none cursor-pointer"
                >
                  {modal.cancelText || 'Cancel'}
                </button>
              )}
              <button
                type="button"
                onClick={() => modal.resolve(true)}
                className={`px-6 py-2.5 rounded-xl text-xs font-bold text-white shadow-lg transition-all btn-premium select-none cursor-pointer ${
                  modal.type === 'danger'
                    ? 'bg-red-600 hover:bg-red-500 shadow-red-600/20'
                    : 'bg-brand-accent hover:bg-blue-600 shadow-brand-accent/20'
                }`}
              >
                {modal.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ModalContext.Provider>
  );
};
export default ModalProvider;
