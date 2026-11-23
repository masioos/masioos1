"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { TableRow } from "@/components/ui/table";

/** A table row that opens `href` when clicked anywhere on it (links inside still work as links). */
export function ClickableRow({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <TableRow
      className={`hover:bg-muted/60 cursor-pointer ${className ?? ""}`}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a, button")) return;
        router.push(href);
      }}
    >
      {children}
    </TableRow>
  );
}
