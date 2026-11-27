"use client";

import { useState, useTransition } from "react";
import { setSheetModeAction } from "../actions";
import { SHEET_MODES, type SheetMode } from "../rules";

const selectClass = "border-input bg-background h-9 rounded-md border px-2 text-sm";

/** Per warehouse: what its Excel stock sheet may change. Saves as soon as it is picked. */
export function SheetModeSelect({ id, mode }: { id: string; mode: SheetMode }) {
  const [value, setValue] = useState<SheetMode>(mode);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  return (
    <span className="flex flex-wrap items-center gap-2">
      <select
        aria-label="فایل اکسل این انبار"
        className={selectClass}
        value={value}
        disabled={pending}
        onChange={(e) => {
          const next = e.currentTarget.value as SheetMode;
          const before = value;
          setValue(next);
          setSaved(false);
          setError(undefined);
          const fd = new FormData();
          fd.set("id", id);
          fd.set("sheetMode", next);
          start(async () => {
            const res = await setSheetModeAction(fd);
            if (res.error) {
              setValue(before);
              setError(res.error);
            } else setSaved(true);
          });
        }}
      >
        {(Object.keys(SHEET_MODES) as SheetMode[]).map((m) => (
          <option key={m} value={m}>
            {SHEET_MODES[m]}
          </option>
        ))}
      </select>
      {saved && !pending && <span className="text-xs text-green-700">✓ ذخیره شد</span>}
      {error && <span className="text-destructive text-xs">{error}</span>}
    </span>
  );
}
