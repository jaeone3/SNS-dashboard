"use client";

import { useToastStore } from "@/stores/toast-store";
import { X, CheckCircle2, AlertCircle, Info } from "lucide-react";

const iconMap = {
  success: <CheckCircle2 size={16} className="text-green-500" />,
  error: <AlertCircle size={16} className="text-red-500" />,
  info: <Info size={16} className="text-blue-500" />,
};

const bgMap = {
  success: "border-green-200 bg-green-50",
  error: "border-red-200 bg-red-50",
  info: "border-blue-200 bg-blue-50",
};

export const ToastContainer = () => {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-2 rounded-lg border px-4 py-3 shadow-md animate-in slide-in-from-right-5 ${bgMap[t.type]}`}
        >
          {iconMap[t.type]}
          <span className="text-sm font-medium text-neutral-800">
            {t.message}
          </span>
          <button
            onClick={() => removeToast(t.id)}
            className="ml-2 text-neutral-400 hover:text-neutral-600"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};
