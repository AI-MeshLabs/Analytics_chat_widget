"use client";

import { useEffect, useState } from "react";
import { AnalyticsChatWidget as WidgetPanel } from "./AnalyticsChatWidget";

/**
 * Renders the widget only after mount so SSR HTML matches the client (no hydration mismatch
 * on assistant message formatting). Uses inline import — not `next/dynamic` — so production
 * does not depend on a separate `/_next/static/chunks/...` request (which often 404s behind
 * misconfigured reverse proxies on VPS).
 */
export function AnalyticsChatWidget() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setMounted(true);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  if (!mounted) {
    return (
      <div
        className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3"
        aria-hidden
      >
        <div className="h-[62px] w-[62px] shrink-0 rounded-[20px] border border-slate-200/80 bg-white/80 shadow-sm" />
      </div>
    );
  }

  return <WidgetPanel />;
}
