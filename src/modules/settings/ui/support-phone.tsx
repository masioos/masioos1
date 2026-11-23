import { formatPhone } from "../rules";
import { getSupportPhone } from "../service";

/** The support number for shoppers, or a note when staff have not set it yet. */
export async function SupportPhone() {
  const phone = await getSupportPhone();
  if (!phone) return <span className="text-muted-foreground">(شماره پشتیبانی هنوز ثبت نشده است)</span>;
  return (
    <a href={`tel:${phone}`} dir="ltr" className="text-primary inline-block font-bold">
      {formatPhone(phone)}
    </a>
  );
}
