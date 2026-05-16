"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    AnalyticsWidgetConfig?: {
      apiBase?: string;
      token?: string;
    };
    __OnePointAnalyticsWidgetLoaded?: boolean;
  }
}

const WIDGET_SCRIPT_ID = "onepoint-analytics-widget-script";
const WIDGET_ROOT_ID = "onepoint-analytics-widget-root";
/** Bump when public/analytics-widget.js changes so browsers fetch the latest asset. */
const WIDGET_SCRIPT_VERSION = "20260516-responsive";
const WIDGET_DEV_RELOAD = process.env.NODE_ENV === "development";

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
    window.AnalyticsWidgetConfig = {
      ...window.AnalyticsWidgetConfig,
      apiBase: window.location.origin,
      token: window.AnalyticsWidgetConfig?.token ?? "",
    };

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
