import { getGatewayTaxPercent, getSupportPhone } from "../service";
import { GatewayTaxForm, SettingsForm } from "./settings-form";

export async function SettingsEditor() {
  const [phone, tax] = await Promise.all([getSupportPhone(), getGatewayTaxPercent()]);
  return (
    <div className="flex flex-col gap-10">
      <SettingsForm supportPhone={phone ?? ""} />
      <GatewayTaxForm percent={tax} />
    </div>
  );
}
