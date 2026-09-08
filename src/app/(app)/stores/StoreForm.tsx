"use client";

import { useActionState } from "react";
import SubmitButton from "@/components/SubmitButton";
import { createStoreAction, type FormState } from "@/server/actions/catalog";
import { STORE_KINDS } from "@/lib/types";

const initial: FormState = {};

export default function StoreForm() {
  const [state, action] = useActionState(createStoreAction, initial);

  return (
    <form action={action} className="space-y-3">
      <div>
        <label className="label" htmlFor="name">
          店舗名
        </label>
        <input id="name" name="name" required className="field" placeholder="例：〇〇公式オンラインストア" />
      </div>
      <div>
        <label className="label" htmlFor="url">
          店舗URL（任意）
        </label>
        <input id="url" name="url" type="url" className="field" placeholder="https://example.com" />
        <p className="hint">入力例：https://example.com ／ https://store.example.jp/shop</p>
      </div>
      <div>
        <label className="label" htmlFor="kind">
          店舗種別
        </label>
        <select id="kind" name="kind" className="field" defaultValue="official_shop">
          {STORE_KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isOfficial" className="size-4" />
        公式のお店として扱う
      </label>
      <div>
        <label className="label" htmlFor="note">
          メモ（任意）
        </label>
        <input id="note" name="note" className="field" />
      </div>
      {state.error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-berry-600">{state.error}</p>
      )}
      {state.ok && (
        <p className="rounded-xl bg-holly-50 px-3 py-2 text-sm text-holly-700">{state.ok}</p>
      )}
      <SubmitButton className="btn-primary w-full">追加する</SubmitButton>
    </form>
  );
}
