"use client";

import { useEffect } from "react";

type Props = {
  apiBase: string;
  useBackend: boolean;
  webhookUrl: string;
};

export function WidgetConfigInit({ apiBase, useBackend, webhookUrl }: Props) {
  useEffect(() => {
    window.AnalyticsWidgetConfig = {
      ...window.AnalyticsWidgetConfig,
      apiBase:
        window.AnalyticsWidgetConfig?.apiBase ||
        apiBase ||
        window.location.origin,
      useBackend,
      webhookUrl: webhookUrl || window.AnalyticsWidgetConfig?.webhookUrl || "",
    };
  }, [apiBase, useBackend, webhookUrl]);

  return null;
}
