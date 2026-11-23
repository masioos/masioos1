import { staffAlertCounts, staffAttentionCount } from "../service";
import { StaffAlert } from "./alerts";
import { fa } from "./format";

/** Admin menu link «درخواست‌ها (n)» plus the sound alerts. Place inside <Suspense>. */
export async function RequestsMenuBadge() {
  const [n, counts] = await Promise.all([staffAttentionCount(), staffAlertCounts()]);
  return (
    <>
      {n > 0 && <span className="ms-1 rounded-full bg-amber-500 px-2 text-xs text-white">{fa(n)}</span>}
      <StaffAlert initial={counts} />
    </>
  );
}
