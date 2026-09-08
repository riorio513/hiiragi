"use client";

import { useActionState } from "react";
import SubmitButton from "@/components/SubmitButton";
import { changePasswordAction, type FormState } from "@/server/actions/catalog";

const initial: FormState = {};

export default function PasswordForm() {
  const [state, action] = useActionState(changePasswordAction, initial);

  return (
    <form action={action} className="space-y-3">
      <div>
        <label className="label" htmlFor="currentPassword">
          いまのパスワード
        </label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          className="field"
        />
      </div>
      <div>
        <label className="label" htmlFor="newPassword">
          新しいパスワード
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="field"
        />
        <p className="hint">8文字以上で、英字と数字を両方入れてください。</p>
      </div>
      {state.error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-berry-600">{state.error}</p>
      )}
      {state.ok && (
        <p className="rounded-xl bg-holly-50 px-3 py-2 text-sm text-holly-700">{state.ok}</p>
      )}
      <SubmitButton className="btn-ghost w-full">パスワードを変更する</SubmitButton>
    </form>
  );
}
