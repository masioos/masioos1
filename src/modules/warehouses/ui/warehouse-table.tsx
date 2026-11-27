import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getIsacoWarehouseId } from "@/modules/settings";
import { formatProfitPercent } from "../rules";
import { listWarehouses } from "../service";
import { WarehouseRow } from "./warehouse-row";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** The selected warehouse (`?w=<id>`) whose panel is open, or null. */
export async function selectedWarehouse(searchParams: SearchParams): Promise<string | null> {
  const w = (await searchParams).w;
  const id = Array.isArray(w) ? w[0] : w;
  return id && (await listWarehouses()).some((x) => x.id === id) ? id : null;
}

// Server Component: reads the list straight from the service; each row edits itself.
export async function WarehouseTable({ searchParams }: { searchParams: SearchParams }) {
  const [rows, isacoId, selected] = await Promise.all([listWarehouses(), getIsacoWarehouseId(), selectedWarehouse(searchParams)]);
  if (rows.length === 0) return <p>هنوز انباری ثبت نشده است.</p>;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted-foreground text-xs">
        هر خانه را مستقیم عوض کنید؛ خودش ذخیره می‌شود. با دکمه‌ی کنار هر انبار، پنل آن انبار (موجودی و قیمت) باز می‌شود.
      </p>
      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">پنل</TableHead>
              <TableHead>
                <span className="grid grid-cols-[1fr_1fr_15rem_9rem_5rem_6rem] gap-2">
                  <span>نام انبار</span>
                  <span>صاحب انبار</span>
                  <span>شماره کارت و نام صاحب کارت</span>
                  <span>درصد سود</span>
                  <span title="برای کد کالاهای لیست قیمت، مثل RF.PR.012">کد انگلیسی</span>
                  <span />
                </span>
              </TableHead>
              <TableHead className="w-14">جابه‌جا</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((w, i) => (
              <WarehouseRow
                key={w.id}
                selected={w.id === selected}
                first={i === 0}
                last={i === rows.length - 1}
                w={{
                  id: w.id,
                  name: w.name,
                  ownerName: w.ownerName,
                  cardNumber: w.cardNumber,
                  cardHolder: w.cardHolder,
                  profit: formatProfitPercent(w.profitBp),
                  codePrefix: w.codePrefix ?? "",
                  isIsaco: w.id === isacoId,
                }}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
