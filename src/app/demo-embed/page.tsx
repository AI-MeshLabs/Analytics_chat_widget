import Script from "next/script";

export default function DemoEmbedPage() {
  return (
    <div className="min-h-screen bg-slate-100">
      <main className="mx-auto max-w-7xl px-6 py-8">
        <header className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">Demo Embed Host Dashboard</h1>
          <p className="mt-2 text-sm text-slate-600">
            This test page simulates another application embedding the analytics widget using the public script.
          </p>
        </header>

        <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Total Calls</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">12,480</p>
            <p className="mt-1 text-sm text-emerald-600">+8.2% vs last month</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Average Duration</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">3m 09s</p>
            <p className="mt-1 text-sm text-slate-600">Across all active agents</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Unsuccessful Calls</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">314</p>
            <p className="mt-1 text-sm text-amber-600">2.6% of total call volume</p>
          </article>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Embedding Pattern Used</h2>
          <p className="mt-2 text-sm text-slate-600">
            This page injects `window.AnalyticsWidgetConfig` and loads `/analytics-widget.js` exactly like an external host
            app would.
          </p>
          <pre className="mt-4 overflow-auto rounded-xl bg-slate-900 p-4 text-xs text-slate-100">
            {`<script>
  window.AnalyticsWidgetConfig = {
    apiBase: "http://your-domain.com",
    token: ""
  };
</script>
<script src="http://your-domain.com/analytics-widget.js"></script>`}
          </pre>
        </section>
      </main>

      <Script id="analytics-widget-config" strategy="afterInteractive">
        {`
          window.AnalyticsWidgetConfig = {
            apiBase: window.location.origin,
            token: ""
          };
        `}
      </Script>
      <Script
        src="/analytics-widget.js?v=20260516-responsive"
        strategy="afterInteractive"
      />
    </div>
  );
}
