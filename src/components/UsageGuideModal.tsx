"use client";

import { useEffect, useRef, useState } from "react";

/**
 * トップ画面の「使い方はこちら」から開く小窓。
 * 友人に渡すときの案内文を、そのままここに埋め込んでいる。
 */
export default function UsageGuideModal() {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    // 開いた瞬間に背景のスクロールを止める
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = original;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-bold text-holly-600 underline underline-offset-2"
      >
        使い方はこちら
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="usage-guide-title"
            className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 id="usage-guide-title" className="text-lg font-bold">
                ヒイラギの使い方
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="閉じる"
                className="-mr-1 -mt-1 flex size-9 shrink-0 items-center justify-center rounded-full text-xl text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            <div className="mt-4 space-y-5 text-sm leading-relaxed text-gray-700">
              <section>
                <h3 className="mb-2 text-sm font-bold text-holly-700">はじめかた</h3>
                <ol className="list-decimal space-y-1.5 pl-5">
                  <li>「はじめる（アカウント作成）」を押す</li>
                  <li>メールアドレスとパスワード（8文字以上・英数字混じり）を入れて登録する</li>
                  <li>確認メールは届きません。そのまま使えます</li>
                </ol>
              </section>

              <section>
                <h3 className="mb-2 text-sm font-bold text-holly-700">商品を登録する</h3>
                <ol className="list-decimal space-y-1.5 pl-5">
                  <li>画面下の「＋ 商品を追加」を押す</li>
                  <li>商品名を入れる（例：Mellojoy ぬいぐるみ）</li>
                  <li>販売ページを開いて、アドレス（https://…）をコピーして貼り付ける</li>
                  <li>欲しければ「希望価格」も入れる（この金額以下で通知が来ます）</li>
                  <li>「登録して監視をはじめる」を押す</li>
                </ol>
                <p className="mt-2 text-xs text-gray-500">
                  → その場で1回目の在庫チェックが走り、結果がすぐ表示されます。
                </p>
              </section>

              <section>
                <h3 className="mb-2 text-sm font-bold text-holly-700">通知が来たら</h3>
                <ul className="list-disc space-y-1.5 pl-5">
                  <li>画面下の「🔔 通知」に「在庫が復活しました」などが届きます</li>
                  <li>通知の「商品ページを開く」を押すと販売ページに飛べます</li>
                  <li>
                    購入手続きはこのアプリではなく、開いた販売ページで自分で行ってください
                    （自動購入・自動カート投入は一切しません）
                  </li>
                </ul>
              </section>

              <section>
                <h3 className="mb-2 text-sm font-bold text-holly-700">その他</h3>
                <ul className="list-disc space-y-1.5 pl-5">
                  <li>
                    使い方を先に試したい場合は「設定」→「デモデータを用意する」
                    （実在しない練習用ショップで、通知が届く流れを体験できます）
                  </li>
                  <li>
                    通常は30分おきに確認します。販売開始予定を登録しておくと、
                    開始が近づくにつれて自動的に確認間隔が短くなります
                  </li>
                  <li>Amazon・メルカリは規約上の理由で登録できません</li>
                </ul>
              </section>

              <p className="border-t border-gray-100 pt-4 text-xs text-gray-400">
                無料で使えます。困ったことがあれば、渡してくれた人に伝えてください。
              </p>
            </div>

            <button type="button" onClick={() => setOpen(false)} className="btn-secondary mt-5 w-full">
              閉じる
            </button>
          </div>
        </div>
      )}
    </>
  );
}
