// Public surface of the settings module. Server-only.
export { SettingsEditor } from "./ui/settings-page";
export { SupportPhone } from "./ui/support-phone";
// ISACO warehouse (#8): read and set by catalog's «قیمت ایساکو» page.
export { getGatewayTaxPercent, getIsacoWarehouseId, getSupportPhone, setIsacoWarehouseId } from "./service";
