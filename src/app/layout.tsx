import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ヒイラギ｜欲しいものの販売状況を見張るツール",
  description:
    "欲しい商品と販売ページを登録しておくと、在庫の復活や希望価格への値下がりをアプリ内でお知らせします。購入手続きはご自身で行ってください。",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1f6b45",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
