import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WorldEx",
  description: "用 6 种颜色记录你的世界旅行状态。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
