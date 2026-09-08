"use client";

import { useFormStatus } from "react-dom";

type Props = {
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
  confirm?: string;
  name?: string;
  value?: string;
};

/** 送信中は押せなくなるボタン。confirm を渡すと確認ダイアログを出す。 */
export default function SubmitButton({
  children,
  className = "btn-primary",
  pendingLabel = "処理中…",
  confirm,
  name,
  value,
}: Props) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      className={className}
      disabled={pending}
      onClick={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
