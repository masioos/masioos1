"use client";

import { usePathname, useRouter } from "next/navigation";
import { useRef, useTransition, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";

/** How long typing must pause before the list updates (ms). */
const PAUSE_MS = 350;

/**
 * Searches with the whole form (text and filters) by changing the URL only: back to page 1,
 * no «جست‌وجو» or Enter needed, and the box being typed in keeps focus.
 */
function useLiveSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const search = (form: HTMLFormElement | null, delay: number) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (!form) return;
      const params = new URLSearchParams();
      for (const [k, v] of new FormData(form)) {
        if (typeof v === "string" && v.trim() !== "" && k !== "page") params.set(k, v.trim());
      }
      const target = new URL(form.action, window.location.href).pathname || pathname;
      start(() => router.replace(params.size > 0 ? `${target}?${params}` : target, { scroll: false }));
    }, delay);
  };
  return { pending, search };
}

/** The search box: the list updates a moment after typing stops. */
export function LiveSearchInput(props: Omit<ComponentProps<typeof Input>, "onChange">) {
  const { pending, search } = useLiveSearch();
  return <Input {...props} aria-busy={pending} onChange={(e) => search(e.currentTarget.form, PAUSE_MS)} />;
}

/** A filter (car, category, brand, country): the list updates as soon as one is picked. */
export function LiveFilterSelect(props: Omit<ComponentProps<"select">, "onChange">) {
  const { pending, search } = useLiveSearch();
  return <select {...props} aria-busy={pending} onChange={(e) => search(e.currentTarget.form, 0)} />;
}
