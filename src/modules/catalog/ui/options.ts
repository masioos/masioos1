// Small display helpers for drop-downs. No DB, safe in client components.

type Category = { id: string; name: string; parentId?: string | null };

/** Categories in tree order with "Main › Sub" labels: main ones first, each followed by its subs. */
export function categoryOptions(categories: Category[]): { id: string; label: string }[] {
  const mains = categories.filter((c) => !c.parentId);
  const out: { id: string; label: string }[] = [];
  for (const m of mains) {
    out.push({ id: m.id, label: m.name });
    for (const s of categories.filter((c) => c.parentId === m.id)) {
      out.push({ id: s.id, label: `${m.name} › ${s.name}` });
    }
  }
  return out;
}

export const selectClass =
  "h-8 w-full rounded-lg border border-input bg-background px-2 text-sm focus-visible:ring-3 focus-visible:ring-ring/50 outline-none";
