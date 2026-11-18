"use client";
import { useState, useTransition } from "react";
import { setEmailRemindersAction } from "@/app/actions/notifications";

export function EmailRemindersToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <label className="check">
      <input
        type="checkbox"
        checked={on}
        disabled={pending}
        onChange={(e) => {
          const v = e.target.checked;
          setOn(v);
          start(() => setEmailRemindersAction(v));
        }}
      />
      <span>Email me deadline reminders (90, 30, 7 and 1 days before). Reminders mention the deadline, never your scores or documents.</span>
    </label>
  );
}
