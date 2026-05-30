import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { WidgetConfigInit } from "@/components/widget/WidgetConfigInit";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Analytics Chat Widget",
  description: "Standalone OnePoint analytics chat widget application.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <WidgetConfigInit
          apiBase=""
          useBackend={process.env.NEXT_PUBLIC_WIDGET_USE_BACKEND === "true"}
          webhookUrl={process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL?.trim() ?? ""}
        />
        {children}
      </body>
    </html>
  );
}
