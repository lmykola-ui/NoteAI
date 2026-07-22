import type { Metadata, Viewport } from "next";
import { AnalyticsInitializer } from "@/components/app-shell/AnalyticsInitializer";
import { OfflineInitializer } from "@/components/app-shell/OfflineInitializer";
import "./globals.css";

export const metadata: Metadata = {
  title: "NoteAI",
  description: "Український AI-нотатник для щоденних задач",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="uk">
      <body>
        {children}
        <OfflineInitializer />
        <AnalyticsInitializer />
      </body>
    </html>
  );
}
