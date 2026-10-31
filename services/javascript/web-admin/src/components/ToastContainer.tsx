import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { useToastStore } from '../state/toast.store';

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl shadow-xl border text-sm font-medium transition-all transform translate-y-0 opacity-100 ${
            toast.type === 'success'
              ? 'bg-emerald-900/95 border-emerald-700 text-white shadow-emerald-950/40'
              : toast.type === 'error'
              ? 'bg-rose-900/95 border-rose-700 text-white shadow-rose-950/40'
              : 'bg-slate-900/95 border-slate-700 text-white shadow-slate-950/40'
          }`}
        >
          {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />}
          {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />}
          {toast.type === 'info' && <Info className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />}

          <div className="flex-1 min-w-0">
            <p className="text-xs leading-relaxed">{toast.message}</p>
          </div>

          <button
            onClick={() => removeToast(toast.id)}
            className="text-white/60 hover:text-white transition-colors p-0.5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
