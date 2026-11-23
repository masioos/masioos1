import { Button } from "@/components/ui/button";
import { setProductFlagAction } from "../actions";

/** A one-click switch for «فعال» or «ناموجود». Works without JavaScript (plain form post). */
export function FlagButton({
  id,
  flag,
  value,
}: {
  id: string;
  flag: "isActive" | "isUnavailable";
  value: boolean;
}) {
  const label =
    flag === "isActive" ? (value ? "فعال" : "غیرفعال") : value ? "ناموجود" : "موجود";
  const on = flag === "isActive" ? value : !value;
  return (
    <form action={setProductFlagAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="flag" value={flag} />
      <input type="hidden" name="value" value={String(!value)} />
      <Button
        type="submit"
        size="xs"
        variant={on ? "secondary" : "destructive"}
        title="برای تغییر کلیک کنید"
        aria-label={label}
      >
        {label}
      </Button>
    </form>
  );
}
