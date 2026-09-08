"use client";

import { useActionState } from "react";
import SubmitButton from "@/components/SubmitButton";
import { signInAction, type FormState } from "@/server/actions/auth";

const initial: FormState = {};

export default function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(signInAction, initial);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
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
          autoComplete="current-password"
          required
          className="field"
        />
      </div>
      {state.error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-berry-600">{state.error}</p>
      )}
      <SubmitButton className="btn-primary w-full" pendingLabel="確認しています…">
        ログイン
      </SubmitButton>
    </form>
  );
}
