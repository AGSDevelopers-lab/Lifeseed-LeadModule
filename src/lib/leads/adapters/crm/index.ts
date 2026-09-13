import type { CrmPort } from "../../domain/ports/CrmPort";
import { salesforceCrmAdapter } from "./salesforce-adapter";
import { zohoCrmAdapter } from "./zoho-adapter";

export { ZohoCrmAdapter, zohoCrmAdapter } from "./zoho-adapter";
export { SalesforceCrmAdapter, salesforceCrmAdapter } from "./salesforce-adapter";

export function crmAdapterFor(target: "ZOHO" | "SALESFORCE"): CrmPort {
  return target === "SALESFORCE" ? salesforceCrmAdapter : zohoCrmAdapter;
}
