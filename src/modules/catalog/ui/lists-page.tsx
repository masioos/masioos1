import { listItems } from "../service";
import { ListManager } from "./list-manager";

// Admin: the lists staff define once (cars, brands, countries, categories, part groups).
export async function CatalogLists() {
  const [cars, brands, countries, categories, partGroups] = await Promise.all([
    listItems("cars"),
    listItems("brands"),
    listItems("countries"),
    listItems("categories"),
    listItems("partGroups"),
  ]);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ListManager kind="cars" title="خودروها" items={cars} />
      <ListManager kind="brands" title="برندها" items={brands} />
      <ListManager kind="countries" title="کشورهای سازنده" items={countries} />
      <ListManager kind="categories" title="دسته‌ها" items={categories} />
      <ListManager kind="partGroups" title="گروه‌های قطعه (مدل‌های دیگر)" items={partGroups} />
    </div>
  );
}
