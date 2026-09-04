import type { AttributionTouch } from "../value-objects/AttributionTouch";

export interface LeadAttribution {
  id: string;
  leadId: string;
  firstTouch: AttributionTouch;
  lastTouch: AttributionTouch;
  createdAt: Date;
  updatedAt: Date;
}
