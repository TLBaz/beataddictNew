import { useToast } from '../../hooks/use-toast';
import { X, CheckCircle2, AlertCircle } from 'lucide-react';

export const Toaster = () => {
  const { toasts } = useToast();

  return (
    <div className="fixed bottom-6 left-6 z-50 flex flex-col gap-2 max-w-md">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`
            glass-panel rounded-lg p-4 shadow-xl animate-slide-in
            ${toast.variant === 'destructive' ? 'border-red-500/50' : 'border-neon-purple/50'}
          `}
        >
          <div className="flex items-start gap-3">
            {toast.variant === 'destructive' ? (
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-neon-purple flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <div className="font-semibold">{toast.title}</div>
              {toast.description && (
                <div className="text-sm text-muted-foreground mt-1">{toast.description}</div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
