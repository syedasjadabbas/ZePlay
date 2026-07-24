import React from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  type?: 'danger' | 'info' | 'success';
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  isLoading?: boolean;
  children?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  type = 'info',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  isLoading = false,
  children,
}) => {
  if (!isOpen) return null;

  const isDanger = type === 'danger';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
      <div 
        className="relative w-full max-w-md bg-[#0b1329]/95 border border-white/10 rounded-3xl p-6 sm:p-8 shadow-[0_25px_60px_rgba(0,0,0,0.9)] space-y-6 text-left transform transition-all duration-300 scale-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border ${
              isDanger 
                ? 'bg-red-500/10 border-red-500/30 text-red-400' 
                : 'bg-brand-accent/10 border-brand-accent/30 text-brand-accent'
            }`}>
              {isDanger ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>
            <div>
              <h3 className="text-xl font-extrabold font-display text-white tracking-wide">{title}</h3>
              {description && (
                <p className="text-xs text-neutral-400 mt-1 leading-relaxed">{description}</p>
              )}
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-neutral-500 hover:text-white p-1 rounded-xl hover:bg-white/5 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Custom Body */}
        {children && <div>{children}</div>}

        {/* Actions */}
        {(onConfirm !== undefined || onClose !== undefined) && (
          <div className="flex items-center justify-end gap-3 pt-2">
            {cancelText && (
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="px-5 py-2.5 rounded-xl border border-white/10 text-neutral-300 hover:text-white hover:bg-white/5 text-xs font-bold transition-all"
              >
                {cancelText}
              </button>
            )}
            {onConfirm && (
              <button
                type="button"
                onClick={onConfirm}
                disabled={isLoading}
                className={`px-6 py-2.5 rounded-xl text-xs font-bold text-white shadow-lg transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2 ${
                  isDanger
                    ? 'bg-red-600 hover:bg-red-500 shadow-red-600/30'
                    : 'bg-brand-accent hover:bg-blue-600 shadow-brand-accent/30'
                }`}
              >
                {isLoading && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                <span>{confirmText}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
