import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "MyCRM - Instagram Outreach Command Center",
  description: "Minimal personal Instagram outreach CRM and follow-up command center.",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
