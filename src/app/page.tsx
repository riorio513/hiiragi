import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import UsageGuideModal from "@/components/UsageGuideModal";

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <main className="mx-auto max-w-md px-5 pb-16 pt-12">
      <p className="text-sm font-bold text-holly-600">欲しいものを、見張る。</p>
      <h1 className="mt-2 text-3xl font-bold leading-snug">ヒイラギ</h1>
      <p className="mt-3 text-sm leading-relaxed text-gray-600">
        欲しい商品と、その商品が売られているページを登録しておくと、
        在庫の復活や希望価格への値下がりを定期的に確認して、アプリの中でお知らせします。
      </p>

      <div className="mt-3">
        <UsageGuideModal />
      </div>

      <div className="card mt-6">
        <h2 className="text-base font-bold">できること</h2>
        <ul className="mt-3 space-y-2 text-sm text-gray-700">
          <li>・欲しい商品を登録する（Mellojoy でも、ゲーム機でも、フィギュアでも）</li>
          <li>・販売ページのURLを貼るだけで監視をはじめる</li>
          <li>・在庫が復活したら、アプリ内の通知でお知らせ</li>
          <li>・希望価格を決めておくと、値下がりもお知らせ</li>
          <li>・販売開始予定の日時が近づいたらお知らせ</li>
        </ul>
      </div>

      <div className="card mt-4 bg-amber-50 ring-amber-200">
        <h2 className="text-base font-bold text-amber-800">できないこと</h2>
        <p className="mt-2 text-sm leading-relaxed text-amber-900">
          自動での購入・カート投入・決済は行いません。
          このアプリの役割は「買えるようになったことを、できるだけ早くお知らせする」ところまでです。
          購入手続きはご自身で商品ページから行ってください。
        </p>
      </div>

      <div className="mt-8 space-y-3">
        <Link href="/signup" className="btn-primary w-full">
          はじめる（アカウント作成）
        </Link>
        <Link href="/login" className="btn-ghost w-full">
          ログイン
        </Link>
      </div>

      <p className="mt-8 text-center text-xs text-gray-400">
        個人利用のための小さな道具です。無料の範囲だけで動いています。
      </p>
    </main>
  );
}
