# Module: settings

Shop-wide settings staff edit in `/admin/settings` (#5). Table `settings` (key → value).
Now: `support_phone`, shown on the forgot-password page (`SupportPhone`).
Add a key with a getter/setter in `service.ts` and a field in `ui/settings-form.tsx`.
- `isaco_warehouse_id` (#8): the one warehouse whose prices come from ISACO's price file; chosen in the «قیمت ایساکو» section of «انبارها» (catalog) (`getIsacoWarehouseId` / `setIsacoWarehouseId`).
