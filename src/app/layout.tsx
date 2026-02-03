// src/app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import ReminderEngine from "@/components/ReminderEngine";

export const metadata: Metadata = {
  title: "RoutineLand",
  description: "סדר בראש · התקדמות בפועל · שקט נפשי",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icon-192.png" }],
  },
};

// ✅ Next רוצה themeColor פה (ולא בתוך metadata)
export const viewport = {
  themeColor: "#0ea5e9",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body>
        <ReminderEngine />
        {children}
      </body>
    </html>
  );
}
