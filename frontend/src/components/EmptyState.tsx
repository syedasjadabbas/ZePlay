import React from 'react';
import { useNavigate } from 'react-router-dom';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionText?: string;
  actionPath?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionText,
  actionPath,
  onAction,
}) => {
  const navigate = useNavigate();

  const handleAction = () => {
    if (onAction) onAction();
    else if (actionPath) navigate(actionPath);
  };

  return (
    <div className="flex flex-col items-center justify-center text-center p-8 md:p-12 max-w-md mx-auto my-8 space-y-4 animate-fadeIn">
      <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-neutral-400">
        {icon ? (
          icon
        ) : (
          <svg className="w-8 h-8 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h18M3 16h18" />
          </svg>
        )}
      </div>
      <h3 className="font-extrabold text-lg md:text-xl text-white tracking-wide font-display">{title}</h3>
      <p className="text-xs md:text-sm text-neutral-400 leading-relaxed">{description}</p>
      {actionText && (
        <button
          onClick={handleAction}
          className="mt-2 px-6 py-3 bg-brand-accent hover:bg-blue-600 text-white text-xs font-bold rounded-xl transition-all transform hover:scale-105 active:scale-95 cursor-pointer shadow-lg shadow-brand-accent/25 min-h-[44px]"
        >
          {actionText}
        </button>
      )}
    </div>
  );
};
