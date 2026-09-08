"use client";

import { useActionState, useState } from "react";
import SubmitButton from "@/components/SubmitButton";
import { createProductAction, type FormState } from "@/server/actions/products";

const initial: FormState = {};

export default function NewProductForm({ stores }: { stores: { id: string; name: string }[] }) {
  const [state, action] = useActionState(createProductAction, initial);
  const [showSchedule, setShowSchedule] = useState(false);

  return (
    <form action={action} className="space-y-5">
      <div>
        <label className="label" htmlFor="name">
          商品名 <span className="text-berry-600">必須</span>
        </label>
        <input
          id="name"
          name="name"
          required
          maxLength={120}
          className="field"
          placeholder="例：Mellojoy ぬいぐるみ／Nintendo Switch 2／〇〇フィギュア"
        />
        <p className="hint">あとから変更できます。自分が分かる名前で大丈夫です。</p>
      </div>

      <div>
        <label className="label" htmlFor="firstUrl">
          商品ページのURL（任意）
        </label>
        <input
          id="firstUrl"
          name="firstUrl"
          type="url"
          inputMode="url"
          className="field"
          placeholder="https://item.rakuten.co.jp/shop/item-code/"
        />
        <p className="hint">
          販売ページを開いて、アドレス欄をコピーして貼り付けてください。
          <br />
          例：https://item.rakuten.co.jp/… ／ https://store.shopping.yahoo.co.jp/… ／ 公式通販のURL
          <br />
          Amazon・メルカリは各サイトの規約で自動巡回が禁止されているため登録できません。
        </p>
      </div>

      {stores.length > 0 && (
        <div>
          <label className="label" htmlFor="storeId">
            販売場所（任意）
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
        <label className="label" htmlFor="targetPrice">
          希望価格（任意）
        </label>
        <input
          id="targetPrice"
          name="targetPrice"
          inputMode="numeric"
          className="field"
          placeholder="例：3000"
        />
        <p className="hint">
          この金額以下になったら通知します（円）。価格を読み取れないサイトでは通知されません。
        </p>
      </div>

      <button
        type="button"
        onClick={() => setShowSchedule((v) => !v)}
        className="text-sm font-bold text-holly-600 underline"
      >
        {showSchedule ? "販売予定・メモを閉じる" : "販売開始予定やメモを入れる（任意）"}
      </button>

      {showSchedule && (
        <div className="space-y-4 rounded-xl bg-gray-50 p-3">
          <div>
            <label className="label" htmlFor="saleStartsAt">
              販売開始予定（日本時間）
            </label>
            <input
              id="saleStartsAt"
              name="saleStartsAt"
              type="datetime-local"
              className="field"
            />
            <p className="hint">
              入力例：2026-09-10 12:00。時刻はすべて日本時間（JST）で扱います。
              販売開始が近づくと、確認する間隔を自動的に短くします。
            </p>
          </div>
          <div>
            <label className="label" htmlFor="saleEndsAt">
              販売終了予定（日本時間）
            </label>
            <input id="saleEndsAt" name="saleEndsAt" type="datetime-local" className="field" />
          </div>
          <div>
            <label className="label" htmlFor="saleNote">
              販売予定メモ
            </label>
            <input
              id="saleNote"
              name="saleNote"
              className="field"
              placeholder="例：公式Xで9/10正午に発売告知あり"
            />
          </div>
          <div>
            <label className="label" htmlFor="description">
              商品メモ
            </label>
            <textarea id="description" name="description" rows={3} className="field" />
          </div>
          <div>
            <label className="label" htmlFor="imageUrl">
              商品画像URL
            </label>
            <input id="imageUrl" name="imageUrl" type="url" className="field" />
          </div>
        </div>
      )}

      {state.error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-berry-600">{state.error}</p>
      )}

      <SubmitButton className="btn-primary w-full" pendingLabel="登録して確認しています…">
        登録して監視をはじめる
      </SubmitButton>
    </form>
  );
}
