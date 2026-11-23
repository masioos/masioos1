import { getSupportPhone } from "../service";
import { SettingsForm } from "./settings-form";

export async function SettingsEditor() {
  return <SettingsForm supportPhone={(await getSupportPhone()) ?? ""} />;
}
