"use client";

import { useActionState, useState } from "react";
import SubmitButton from "@/components/SubmitButton";
import { updateProductAction, type FormState } from "@/server/actions/products";

const initial: FormState = {};

type Product = {
  id: string;
  name: string;
  description: string;
  image_url: string;
  target_price: number | null;
  sale_starts_at: string;
  sale_ends_at: string;
  sale_note: string;
};

export default function EditProductForm({
  product,
  nowMs,
}: {
  product: Product;
  /** 画面を開いた時点のサーバー時刻。過去日時の注意書きの判定に使う。 */
  nowMs: number;
}) {
  const [state, action] = useActionState(updateProductAction, initial);
  const [startsAt, setStartsAt] = useState(product.sale_starts_at);
  const past = startsAt !== "" && new Date(startsAt).getTime() < nowMs;

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="productId" value={product.id} />
      <div>
        <label className="label" htmlFor="name">
          商品名
        </label>
        <input id="name" name="name" required defaultValue={product.name} className="field" />
      </div>
      <div>
        <label className="label" htmlFor="targetPrice">
          希望価格（円）
        </label>
        <input
          id="targetPrice"
          name="targetPrice"
          inputMode="numeric"
          defaultValue={product.target_price ?? ""}
          className="field"
          placeholder="例：3000"
        />
        <p className="hint">空にすると価格の通知はしません。</p>
      </div>
      <div>
        <label className="label" htmlFor="saleStartsAt">
          販売開始予定（日本時間）
        </label>
        <div className="flex gap-2">
          <input
            id="saleStartsAt"
            name="saleStartsAt"
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className="field"
          />
          <button type="button" className="btn-ghost shrink-0" onClick={() => setStartsAt("")}>
            未設定に戻す
          </button>
        </div>
        {past && (
          <p className="mt-1 text-xs text-amber-700">
            過去の日時です。販売開始が近づいたときの通知は行われません。
          </p>
        )}
        <p className="hint">時刻はすべて日本時間（JST）です。入力例：2026-09-10 12:00</p>
      </div>
      <div>
        <label className="label" htmlFor="saleEndsAt">
          販売終了予定（日本時間）
        </label>
        <input
          id="saleEndsAt"
          name="saleEndsAt"
          type="datetime-local"
          defaultValue={product.sale_ends_at}
          className="field"
        />
      </div>
      <div>
        <label className="label" htmlFor="saleNote">
          販売予定メモ
        </label>
        <input id="saleNote" name="saleNote" defaultValue={product.sale_note} className="field" />
      </div>
      <div>
        <label className="label" htmlFor="description">
          商品メモ
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={product.description}
          className="field"
        />
      </div>
      <div>
        <label className="label" htmlFor="imageUrl">
          商品画像URL
        </label>
        <input
          id="imageUrl"
          name="imageUrl"
          type="url"
          defaultValue={product.image_url}
          className="field"
        />
      </div>
      {state.error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-berry-600">{state.error}</p>
      )}
      <SubmitButton className="btn-primary w-full" pendingLabel="保存しています…">
        保存する
      </SubmitButton>
    </form>
  );
}
