import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NoteAI",
  description: "Український AI-нотатник для щоденних задач",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="uk">
      <body>
        {children}
        {process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === "true" ? <Analytics /> : null}
      </body>
    </html>
  );
}
