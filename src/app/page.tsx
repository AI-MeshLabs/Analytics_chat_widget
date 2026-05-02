import { AnalyticsChatWidget } from "@/components/widget/AnalyticsChatWidgetGate";

export default function Home() {
  return (
    <div className="relative min-h-screen bg-slate-100">
      <main className="mx-auto flex min-h-screen w-full max-w-6xl items-start justify-center px-6 py-10">
        <div className="w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">Analytics Chat Widget Demo</h1>
          <p className="mt-2 text-sm text-slate-600">
            This standalone app hosts the floating OnePoint analytics assistant widget for dashboard embedding.
          </p>
        </div>
      </main>
      <AnalyticsChatWidget />
    </div>
  );
}
