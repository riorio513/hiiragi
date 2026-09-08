"use client";

import { useActionState } from "react";
import SubmitButton from "@/components/SubmitButton";
import { addProductUrlAction, type FormState } from "@/server/actions/products";

const initial: FormState = {};

export default function AddUrlForm({
  productId,
  stores,
}: {
  productId: string;
  stores: { id: string; name: string }[];
}) {
  const [state, action] = useActionState(addProductUrlAction, initial);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="productId" value={productId} />
      <div>
        <label className="label" htmlFor="url">
          商品ページのURL
        </label>
        <input
          id="url"
          name="url"
          type="url"
          inputMode="url"
          required
          className="field"
          placeholder="https://item.rakuten.co.jp/shop/item-code/"
        />
        <p className="hint">
          販売ページのアドレスをそのまま貼り付けてください。貼り付け後すぐに1回確認します。
        </p>
      </div>
      {stores.length > 0 && (
        <div>
          <label className="label" htmlFor="storeId">
            販売場所
          </label>
          <select id="storeId" name="storeId" className="field" defaultValue="">
            <option value="">URLのドメインから自動で作る</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="label" htmlFor="label">
          メモ（任意）
        </label>
        <input id="label" name="label" className="field" placeholder="例：単品ページ" />
      </div>
      {state.error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-berry-600">{state.error}</p>
      )}
      {state.ok && (
        <p className="rounded-xl bg-holly-50 px-3 py-2 text-sm text-holly-700">{state.ok}</p>
      )}
      <SubmitButton className="btn-primary w-full" pendingLabel="確認しています…">
        このページの監視をはじめる
      </SubmitButton>
    </form>
  );
}
