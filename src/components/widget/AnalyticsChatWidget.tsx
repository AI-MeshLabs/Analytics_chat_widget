"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";

/** Integers, decimals, and thousands like 1,234 — shown bold in assistant replies. */
const NUMERIC_TOKEN =
  /^\d{1,3}(?:,\d{3})*(?:\.\d+)?$|^\d+(?:\.\d+)?$/;

function assistantContentWithBoldNumbers(text: string): ReactNode {
  const parts = text.split(/(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)/g);
  return parts.map((part, i) => {
    if (!part) return null;
    if (NUMERIC_TOKEN.test(part)) {
      return (
        <strong key={i} className="font-bold">
          {part}
        </strong>
      );
    }
    return (
      <span key={i} className="font-normal">
        {part}
      </span>
    );
  });
}

/** Renders `**phrase**` from the API as bold; other text still gets numeric emphasis. */
function assistantContentWithFormatting(text: string): ReactNode {
  const segments = text.split(/(\*\*[\s\S]*?\*\*)/g);
  return segments.map((seg, i) => {
    if (!seg) return null;
    const boldMatch = seg.match(/^\*\*([\s\S]*?)\*\*$/);
    if (boldMatch) {
      return (
        <strong key={i} className="font-bold">
          {boldMatch[1]}
        </strong>
      );
    }
    return <span key={i}>{assistantContentWithBoldNumbers(seg)}</span>;
  });
}

type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: number;
  role: ChatRole;
  content: string;
};

type AnalyticsQueryApiResponse = {
  answer: string;
  data?: Array<Record<string, unknown>>;
};

const starterMessages: ChatMessage[] = [
  {
    id: 1,
    role: "assistant",
    content:
      "Hi, I am your call analytics assistant. I can summarize call activity, average durations, unsuccessful calls, and trends.",
  },
];

const CHAT_FETCH_MS = 45_000;

function timeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(ms);
  }
  const c = new AbortController();
  window.setTimeout(() => c.abort(), ms);
  return c.signal;
}

export function AnalyticsChatWidget() {
  /** Panel starts minimized (FAB only); user opens by tapping the launcher. */
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(starterMessages);
  const [isLoading, setIsLoading] = useState(false);

  const sendQuestion = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now(),
      role: "user",
      content: trimmed,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    try {
      setIsLoading(true);

      const response = await fetch("/api/analytics-chat/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question: trimmed }),
        signal: timeoutSignal(CHAT_FETCH_MS),
      });

      if (!response.ok) {
        throw new Error("Request failed");
      }

      const payload = (await response.json()) as AnalyticsQueryApiResponse;
      const assistantMessage: ChatMessage = {
        id: Date.now() + 1,
        role: "assistant",
        content: payload.answer ?? "No response available.",
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: unknown) {
      const timedOut =
        (err instanceof Error || err instanceof DOMException) && (err as Error).name === "AbortError";
      const errorMessage: ChatMessage = {
        id: Date.now() + 1,
        role: "assistant",
        content: timedOut
          ? "That request took too long (server or database may be slow). Please try a shorter date range or try again."
          : "Sorry, I could not fetch analytics right now. Please try again.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = (event: FormEvent) => {
    event.preventDefault();
    void sendQuestion(input);
  };

  const clearChat = () => {
    setMessages(starterMessages);
    setInput("");
    setIsLoading(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {isOpen ? (
        <section
          className={`max-w-[calc(100vw-2rem)] flex flex-col overflow-hidden rounded-[22px] border border-slate-200/90 bg-white/95 shadow-[0_24px_60px_rgba(15,23,42,0.18)] backdrop-blur-sm transition-[width,height] duration-200 ease-out ${
            isExpanded
              ? "h-[min(90dvh,800px)] w-[min(560px,calc(100vw-2rem))]"
              : "h-[560px] w-[380px]"
          }`}
          aria-label="OnePoint Analytics Assistant"
        >
          <header className="flex items-start justify-between gap-3 bg-gradient-to-r from-slate-900 to-blue-700 px-4 py-4 text-white">
            <div>
              <h2 className="text-sm font-bold sm:text-base">OnePoint Analytics Assistant</h2>
              <p className="mt-1 text-xs text-blue-100">
                Ask questions about call volume, durations, unsuccessful calls, and daily trends.
              </p>
            </div>
            <div className="flex shrink-0 flex-row items-start gap-1.5">
              <button
                type="button"
                onClick={() => setIsExpanded((v) => !v)}
                aria-expanded={isExpanded}
                title={isExpanded ? "Collapse panel" : "Expand panel"}
                className="rounded-lg border border-white/25 bg-white/15 px-2.5 py-1.5 text-[11px] font-semibold hover:bg-white/25"
              >
                {isExpanded ? "Collapse" : "Expand"}
              </button>
              <button
                type="button"
                onClick={clearChat}
                className="rounded-lg border border-white/25 bg-white/15 px-2.5 py-1.5 text-[11px] font-semibold hover:bg-white/25"
              >
                Clear
              </button>
            </div>
          </header>

          <div className="flex min-h-0 flex-1 flex-col bg-gradient-to-b from-sky-50 to-white">
            <div className="flex flex-wrap gap-2 border-b border-slate-200 bg-white/90 px-4 py-2.5">
              <button
                type="button"
                onClick={() => void sendQuestion("Tell me the number of calls made today")}
                className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isLoading}
              >
                Calls today
              </button>
              <button
                type="button"
                onClick={() => void sendQuestion("Tell me the average call duration for today")}
                className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isLoading}
              >
                Average duration
              </button>
              <button
                type="button"
                onClick={() => void sendQuestion("Tell me the unsuccessful calls for today")}
                className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isLoading}
              >
                Unsuccessful calls
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm font-normal leading-relaxed shadow-sm ${
                    message.role === "user"
                      ? "ml-auto rounded-br-md bg-blue-700 text-white"
                      : "rounded-bl-md border border-slate-200 bg-white text-slate-800"
                  }`}
                >
                  {message.role === "user"
                    ? message.content
                    : assistantContentWithFormatting(message.content)}
                </div>
              ))}
              {isLoading ? (
                <div className="max-w-[88%] rounded-2xl rounded-bl-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm">
                  Assistant is typing...
                </div>
              ) : null}
            </div>

            <form onSubmit={sendMessage} className="border-t border-slate-200 bg-white/95 px-4 py-3">
              <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2">
                <input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Ask about today's calls, average duration, failed calls, trends..."
                  className="h-10 flex-1 bg-transparent px-2 text-sm text-slate-800 outline-none"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  className="h-10 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-lg hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={isLoading}
                >
                  {isLoading ? "Sending..." : "Send"}
                </button>
              </div>
              <p className="mt-2 text-center text-[11px] leading-relaxed text-slate-500">
                Powered by AI MESHLABS
                <br />
                ©2026 OnePoint Health. All rights reserved.
              </p>
            </form>
          </div>
        </section>
      ) : null}

      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-label={isOpen ? "Minimize analytics assistant" : "Open analytics assistant"}
        className="group relative h-[62px] w-[62px] rounded-[20px] bg-gradient-to-r from-blue-600 to-slate-900 text-2xl font-bold text-white shadow-[0_16px_40px_rgba(15,23,42,0.24)] hover:opacity-95"
      >
        <span className="absolute -left-[110px] bottom-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-medium text-white opacity-95">
          Analytics AI
        </span>
        ✦
      </button>
    </div>
  );
}
