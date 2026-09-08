"use client";

import { useActionState } from "react";
import SubmitButton from "@/components/SubmitButton";
import { signUpAction, type FormState } from "@/server/actions/auth";

const initial: FormState = {};

export default function SignupForm({
  invite,
  inviteRequired,
}: {
  invite: string;
  inviteRequired: boolean;
}) {
  const [state, action] = useActionState(signUpAction, initial);

  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="displayName">
          呼び名（任意）
        </label>
        <input
          id="displayName"
          name="displayName"
          className="field"
          placeholder="りお"
          maxLength={40}
        />
        <p className="hint">画面の右上に表示されるだけの名前です。</p>
      </div>
      <div>
        <label className="label" htmlFor="email">
          メールアドレス
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="field"
          placeholder="you@example.com"
        />
      </div>
      <div>
        <label className="label" htmlFor="password">
          パスワード
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="field"
        />
        <p className="hint">8文字以上で、英字と数字を両方入れてください。</p>
      </div>
      {inviteRequired && (
        <div>
          <label className="label" htmlFor="invite">
            招待コード
          </label>
          <input id="invite" name="invite" className="field" defaultValue={invite} required />
        </div>
      )}
      {!inviteRequired && <input type="hidden" name="invite" value={invite} />}
      {state.error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-berry-600">{state.error}</p>
      )}
      <SubmitButton className="btn-primary w-full" pendingLabel="作成しています…">
        アカウントを作る
      </SubmitButton>
      <p className="hint">
        パスワードはそのままの形では保存しません。安全な形に変換して保存します。
      </p>
    </form>
  );
}
