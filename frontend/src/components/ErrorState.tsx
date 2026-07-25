import React from 'react';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = "Connection Error",
  message = "We encountered a problem loading this content. Please check your connection and try again.",
  onRetry,
}) => {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 max-w-md mx-auto my-12 bg-[#181818] border border-white/10 rounded-2xl shadow-2xl space-y-4 animate-scaleIn">
      <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500">
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h3 className="font-extrabold text-lg text-white uppercase tracking-wide">{title}</h3>
      <p className="text-xs text-neutral-400 leading-relaxed">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 px-6 py-3 bg-brand-accent hover:bg-blue-600 text-white text-xs font-bold rounded-xl transition-all transform hover:scale-105 active:scale-95 cursor-pointer shadow-lg shadow-brand-accent/25 min-h-[44px]"
        >
          Try Again
        </button>
      )}
    </div>
  );
};
