import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Smart Document Platform",
  description: "MVP console for smart docs",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
