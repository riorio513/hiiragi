"use client";

import { useActionState, useState } from "react";
import SubmitButton from "@/components/SubmitButton";
import { updateSettingsAction, type FormState } from "@/server/actions/catalog";

const initial: FormState = {};

export default function SettingsForm({
  quietEnabled,
  quietStart,
  quietEnd,
  timezone,
}: {
  quietEnabled: boolean;
  quietStart: string;
  quietEnd: string;
  timezone: string;
}) {
  const [state, action] = useActionState(updateSettingsAction, initial);
  const [enabled, setEnabled] = useState(quietEnabled);
  const [start, setStart] = useState(quietStart);
  const [end, setEnd] = useState(quietEnd);

  return (
    <form action={action} className="space-y-3">
      <label className="flex items-center gap-2 text-sm font-bold">
        <input
          type="checkbox"
          name="quietEnabled"
          className="size-4"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        お休み時間を使う
      </label>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <label className="label" htmlFor="quietStart">
            開始
          </label>
          <input
            id="quietStart"
            name="quietStart"
            type="time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="field"
          />
        </div>
        <div className="flex-1">
          <label className="label" htmlFor="quietEnd">
            終了
          </label>
          <input
            id="quietEnd"
            name="quietEnd"
            type="time"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="field"
          />
        </div>
      </div>
      <p className="hint">
        タイムゾーン：{timezone}（日本時間）。
        {enabled
          ? `いまの設定だと ${start} 〜 ${end} は確認の間隔を3時間まで広げます。それ以外の時間は通常どおり30分ごと（販売開始が近いときは最短30秒）に確認します。`
          : "いまはお休み時間なし。1日中、通常どおりの間隔で確認します。"}
      </p>
      {state.error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-berry-600">{state.error}</p>
      )}
      {state.ok && (
        <p className="rounded-xl bg-holly-50 px-3 py-2 text-sm text-holly-700">{state.ok}</p>
      )}
      <SubmitButton className="btn-primary w-full">保存する</SubmitButton>
    </form>
  );
}
