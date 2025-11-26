import { useEffect } from 'react';
import { X, AlertCircle, CheckCircle, Info } from 'lucide-react';

interface ToastProps {
  message: string;
  type?: 'error' | 'success' | 'info';
  onClose: () => void;
  duration?: number;
}

export function Toast({ message, type = 'info', onClose, duration = 5000 }: ToastProps) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const config = {
    error: {
      icon: AlertCircle,
      bgColor: 'bg-red-50/90 backdrop-blur-sm',
      borderColor: 'border-red-200',
      textColor: 'text-red-800',
      iconColor: 'text-red-600',
    },
    success: {
      icon: CheckCircle,
      bgColor: 'bg-emerald-50/90 backdrop-blur-sm',
      borderColor: 'border-emerald-200',
      textColor: 'text-emerald-800',
      iconColor: 'text-emerald-600',
    },
    info: {
      icon: Info,
      bgColor: 'bg-teal-50/90 backdrop-blur-sm',
      borderColor: 'border-teal-200',
      textColor: 'text-teal-800',
      iconColor: 'text-teal-600',
    },
  };

  const { icon: Icon, bgColor, borderColor, textColor, iconColor } = config[type];

  return (
    <div className={`fixed top-6 right-6 z-50 max-w-md ${bgColor} ${borderColor} border rounded-xl shadow-lg p-4 flex items-start gap-3 animate-slide-in`}>
      <Icon className={`w-5 h-5 ${iconColor} flex-shrink-0 mt-0.5`} />
      <p className={`flex-1 ${textColor} text-sm font-medium`}>{message}</p>
      <button onClick={onClose} className={`${textColor} hover:opacity-60 transition-opacity flex-shrink-0`}>
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
