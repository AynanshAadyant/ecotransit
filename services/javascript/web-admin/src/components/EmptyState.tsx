import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  children?: ReactNode;
}

export default function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  children,
}: EmptyStateProps) {
  const ActionIcon = action?.icon;

  return (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-900/40 border border-slate-800/80 rounded-2xl my-4">
      <div className="w-14 h-14 bg-slate-800/60 rounded-2xl flex items-center justify-center text-slate-400 mb-4 border border-slate-700/40">
        <Icon className="w-7 h-7 text-slate-400" />
      </div>
      <h3 className="text-base font-bold text-white tracking-tight">{title}</h3>
      <p className="text-xs text-slate-400 max-w-sm mt-1 leading-relaxed">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
        >
          {ActionIcon && <ActionIcon className="w-4 h-4" />}
          {action.label}
        </button>
      )}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
