import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatProfitPercent } from "../rules";
import { listWarehouses } from "../service";
import { CardForm } from "./card-form";
import { ProfitForm } from "./profit-form";
import { SheetModeSelect } from "./sheet-mode-select";

// Server Component: reads the list straight from the service.
export async function WarehouseTable() {
  const rows = await listWarehouses();
  if (rows.length === 0) return <p>هنوز انباری ثبت نشده است.</p>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>نام انبار</TableHead>
          <TableHead>صاحب انبار</TableHead>
          <TableHead>شماره کارت و نام صاحب کارت</TableHead>
          <TableHead>درصد سود</TableHead>
          <TableHead>فایل اکسل موجودی</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((w) => (
          <TableRow key={w.id}>
            <TableCell>{w.name}</TableCell>
            <TableCell>{w.ownerName}</TableCell>
            <TableCell>
              <CardForm id={w.id} cardNumber={w.cardNumber} cardHolder={w.cardHolder} />
            </TableCell>
            <TableCell>
              <ProfitForm id={w.id} percent={formatProfitPercent(w.profitBp)} />
            </TableCell>
            <TableCell>
              <SheetModeSelect id={w.id} mode={w.sheetMode} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
