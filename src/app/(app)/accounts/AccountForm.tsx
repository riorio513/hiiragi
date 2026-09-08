"use client";

import { useActionState } from "react";
import SubmitButton from "@/components/SubmitButton";
import { createAccountAction, type FormState } from "@/server/actions/catalog";
import { SNS_PLATFORMS } from "@/lib/types";

const initial: FormState = {};

export default function AccountForm({ stores }: { stores: { id: string; name: string }[] }) {
  const [state, action] = useActionState(createAccountAction, initial);

  return (
    <form action={action} className="space-y-3">
      <div>
        <label className="label" htmlFor="name">
          アカウント名
        </label>
        <input id="name" name="name" required className="field" placeholder="例：〇〇公式" />
      </div>
      <div>
        <label className="label" htmlFor="platform">
          種類
        </label>
        <select id="platform" name="platform" className="field" defaultValue="x">
          {SNS_PLATFORMS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="url">
          アカウントURL（任意）
        </label>
        <input
          id="url"
          name="url"
          type="url"
          className="field"
          placeholder="https://x.com/example"
        />
        <p className="hint">入力例：https://x.com/example ／ https://www.instagram.com/example</p>
      </div>
      {stores.length > 0 && (
        <div>
          <label className="label" htmlFor="storeId">
            関連するお店（任意）
          </label>
          <select id="storeId" name="storeId" className="field" defaultValue="">
            <option value="">選ばない</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isOfficial" defaultChecked className="size-4" />
        公式アカウントとして扱う
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
