"use client";

import { useEffect } from "react";

type Props = {
  apiBase: string;
  useBackend: boolean;
  webhookUrl: string;
  widgetSecret: string;
};

export function WidgetConfigInit({ apiBase, useBackend, webhookUrl, widgetSecret }: Props) {
  useEffect(() => {
    window.AnalyticsWidgetConfig = {
      ...window.AnalyticsWidgetConfig,
      apiBase:
        window.AnalyticsWidgetConfig?.apiBase ||
        apiBase ||
        window.location.origin,
      useBackend,
      webhookUrl: webhookUrl || window.AnalyticsWidgetConfig?.webhookUrl || "",
      widgetSecret: widgetSecret || window.AnalyticsWidgetConfig?.widgetSecret || "",
    };
  }, [apiBase, useBackend, webhookUrl, widgetSecret]);

  return null;
}
