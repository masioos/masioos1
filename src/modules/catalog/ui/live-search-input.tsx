"use client";

import { usePathname, useRouter } from "next/navigation";
import { useRef, useTransition, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";

/** How long typing must pause before the list updates (ms). */
const PAUSE_MS = 350;

/**
 * A search box that searches while typing: after a short pause the page's list updates with the
 * whole form (filters too), without pressing «جست‌وجو» or Enter. Back to page 1 on every change.
 * The box keeps focus and what was typed, because only the URL changes.
 */
export function LiveSearchInput(props: Omit<ComponentProps<typeof Input>, "onChange">) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  return (
    <Input
      {...props}
      aria-busy={pending}
      onChange={(e) => {
        const form = e.currentTarget.form;
        clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          if (!form) return;
          const params = new URLSearchParams();
          for (const [k, v] of new FormData(form)) {
            if (typeof v === "string" && v.trim() !== "" && k !== "page") params.set(k, v.trim());
          }
          const target = new URL(form.action, window.location.href).pathname || pathname;
          start(() => router.replace(params.size > 0 ? `${target}?${params}` : target, { scroll: false }));
        }, PAUSE_MS);
      }}
    />
  );
}
