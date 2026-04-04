"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

type ToastTone = "success" | "error" | "info";

type ToastInput = {
  title: string;
  message?: string;
  tone?: ToastTone;
  durationMs?: number;
};

type ToastRecord = Required<Pick<ToastInput, "title" | "tone" | "durationMs">> &
  Pick<ToastInput, "message"> & {
    id: string;
  };

type ToastApi = {
  show: (toast: ToastInput) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

function toneClass(tone: ToastTone): string {
  if (tone === "success") {
    return "border-emerald-200/85 bg-emerald-50/90 text-emerald-950 dark:border-emerald-900/70 dark:bg-emerald-950/25 dark:text-emerald-100";
  }

  if (tone === "error") {
    return "border-red-200/85 bg-red-50/90 text-red-950 dark:border-red-900/70 dark:bg-red-950/25 dark:text-red-100";
  }

  return "border-gray-200/90 bg-white/95 text-gray-900 dark:border-[#2a2a2a] dark:bg-[#080808]/96 dark:text-[#ececec]";
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const timeoutMap = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const remove = useCallback((id: string) => {
    const timeoutId = timeoutMap.current.get(id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutMap.current.delete(id);
    }
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    ({ title, message, tone = "info", durationMs = 2600 }: ToastInput) => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, title, message, tone, durationMs }]);

      const timeoutId = setTimeout(() => remove(id), durationMs);
      timeoutMap.current.set(id, timeoutId);
    },
    [remove],
  );

  useEffect(() => {
    const activeTimeouts = timeoutMap.current;
    return () => {
      for (const timeoutId of activeTimeouts.values()) {
        clearTimeout(timeoutId);
      }
      activeTimeouts.clear();
    };
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (title, message) => show({ title, message, tone: "success" }),
      error: (title, message) => show({ title, message, tone: "error", durationMs: 3600 }),
      info: (title, message) => show({ title, message, tone: "info" }),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-3 right-3 z-[80] flex w-[min(90vw,22rem)] flex-col gap-2 sm:bottom-4 sm:right-4">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-xl border px-3.5 py-2.5 shadow-lg backdrop-blur-sm ${toneClass(toast.tone)}`}
            role="status"
            aria-live={toast.tone === "error" ? "assertive" : "polite"}
          >
            <p className="text-sm font-semibold tracking-tight leading-snug">{toast.title}</p>
            {toast.message && (
              <p className="mt-1 text-xs leading-relaxed opacity-90">{toast.message}</p>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
