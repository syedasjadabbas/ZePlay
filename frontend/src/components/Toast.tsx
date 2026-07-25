import React, { createContext, useContext, useCallback, useState, useRef } from 'react';

export type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  visible: boolean;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export const useToast = () => useContext(ToastContext);

let toastIdCounter = 0;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, visible: false } : t));
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 400);
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info', duration = 4000) => {
    // Prevent duplicate toasts for the same message within 2s
    setToasts(prev => {
      const recent = prev.find(t => t.message === message && t.type === type && t.visible);
      if (recent) return prev;
      const id = `toast-${++toastIdCounter}`;
      timers.current[id] = setTimeout(() => {
        removeToast(id);
        delete timers.current[id];
      }, duration);
      return [...prev.slice(-4), { id, type, message, visible: true }];
    });
  }, [removeToast]);

  const handleDismiss = (id: string) => {
    if (timers.current[id]) {
      clearTimeout(timers.current[id]);
      delete timers.current[id];
    }
    removeToast(id);
  };

  const iconMap: Record<ToastType, React.ReactNode> = {
    success: (
      <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    ),
    error: (
      <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    info: (
      <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };

  const colorMap: Record<ToastType, string> = {
    success: 'text-emerald-400 border-emerald-500/30',
    error: 'text-red-400 border-red-500/30',
    info: 'text-blue-400 border-blue-500/30',
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2.5 pointer-events-none"
        style={{ maxWidth: '360px' }}
      >
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`
              pointer-events-auto
              flex items-start gap-3 px-4 py-3 rounded-xl
              bg-[#161b26]/95 backdrop-blur-xl border
              shadow-[0_8px_32px_rgba(0,0,0,0.6)]
              ${colorMap[toast.type]}
            `}
            style={{
              willChange: 'transform, opacity',
              transition: 'opacity 0.35s cubic-bezier(0.16,1,0.3,1), transform 0.35s cubic-bezier(0.16,1,0.3,1)',
              opacity: toast.visible ? 1 : 0,
              transform: toast.visible ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.96)',
            }}
          >
            <span className={`mt-0.5 ${colorMap[toast.type]}`}>{iconMap[toast.type]}</span>
            <p className="flex-1 text-sm font-medium text-white leading-snug">{toast.message}</p>
            <button
              onClick={() => handleDismiss(toast.id)}
              className="text-neutral-500 hover:text-white transition-colors mt-0.5 flex-shrink-0 cursor-pointer"
              aria-label="Dismiss"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export default ToastProvider;
