"use client";

import { useEffect } from "react";

export default function Toast({
  message,
  onClose,
}: {
  message: string | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(onClose, 1800);
    return () => window.clearTimeout(t);
  }, [message, onClose]);

  if (!message) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
      <div className="rounded-2xl border border-white/10 bg-zinc-900/90 px-4 py-2 text-sm text-zinc-100 shadow-lg">
        {message}
      </div>
    </div>
  );
}
