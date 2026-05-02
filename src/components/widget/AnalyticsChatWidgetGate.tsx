"use client";

import dynamic from "next/dynamic";

/** Client-only load avoids SSR/client HTML mismatch in chat bubbles (numeric bold split). */
export const AnalyticsChatWidget = dynamic(
  () => import("./AnalyticsChatWidget").then((m) => m.AnalyticsChatWidget),
  {
    ssr: false,
    loading: () => (
      <div
        className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3"
        aria-hidden
      >
        <div className="h-[62px] w-[62px] shrink-0 rounded-[20px] bg-transparent" />
      </div>
    ),
  },
);
