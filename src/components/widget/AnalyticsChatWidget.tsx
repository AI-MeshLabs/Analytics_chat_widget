"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    AnalyticsWidgetConfig?: {
      apiBase?: string;
      useBackend?: boolean;
      webhookUrl?: string;
      widgetSecret?: string;
    };
    __OnePointAnalyticsWidgetLoaded?: boolean;
  }
}

const WIDGET_SCRIPT_ID = "onepoint-analytics-widget-script";
const WIDGET_ROOT_ID = "onepoint-analytics-widget-root";
/** Bump when public/analytics-widget.js changes so browsers fetch the latest asset. */
const WIDGET_SCRIPT_VERSION = "20260529-backend";
const WIDGET_DEV_RELOAD = process.env.NODE_ENV === "development";
const USE_BACKEND = process.env.NEXT_PUBLIC_WIDGET_USE_BACKEND === "true";
const PUBLIC_WEBHOOK_URL = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL ?? "";
const PUBLIC_WIDGET_SECRET = process.env.NEXT_PUBLIC_WIDGET_SECRET ?? "";

function applyWidgetConfig() {
  if (typeof window === "undefined") return;
  window.AnalyticsWidgetConfig = {
    ...window.AnalyticsWidgetConfig,
    apiBase: window.AnalyticsWidgetConfig?.apiBase || window.location.origin,
    useBackend: USE_BACKEND,
    webhookUrl: PUBLIC_WEBHOOK_URL || window.AnalyticsWidgetConfig?.webhookUrl || "",
    widgetSecret: PUBLIC_WIDGET_SECRET || window.AnalyticsWidgetConfig?.widgetSecret || "",
  };
}

function teardownWidget() {
  document.getElementById(WIDGET_SCRIPT_ID)?.remove();
  document.getElementById(WIDGET_ROOT_ID)?.remove();
  delete window.__OnePointAnalyticsWidgetLoaded;
}

/**
 * Use the same embeddable script in-app and on external hosts so
 * UI behavior/style remains identical across environments.
 */
export function AnalyticsChatWidget() {
  useEffect(() => {
    applyWidgetConfig();

    const existingScript = document.getElementById(WIDGET_SCRIPT_ID) as HTMLScriptElement | null;
    if (
      !WIDGET_DEV_RELOAD &&
      existingScript?.dataset.version === WIDGET_SCRIPT_VERSION
    ) {
      return;
    }

    teardownWidget();

    const script = document.createElement("script");
    script.id = WIDGET_SCRIPT_ID;
    script.dataset.version = WIDGET_SCRIPT_VERSION;
    if (USE_BACKEND) {
      script.setAttribute("data-use-backend", "true");
    } else {
      script.removeAttribute("data-use-backend");
    }
    if (PUBLIC_WEBHOOK_URL) script.setAttribute("data-webhook-url", PUBLIC_WEBHOOK_URL);
    if (PUBLIC_WIDGET_SECRET) script.setAttribute("data-widget-secret", PUBLIC_WIDGET_SECRET);
    script.src = WIDGET_DEV_RELOAD
      ? `/analytics-widget.js?t=${Date.now()}`
      : `/analytics-widget.js?v=${encodeURIComponent(WIDGET_SCRIPT_VERSION)}`;
    script.async = true;
    document.body.appendChild(script);

    return () => {
      teardownWidget();
    };
  }, []);

  return null;
}
