import type { Campaign } from "../entities/Campaign";
import type { AttributionTouch } from "../value-objects/AttributionTouch";

export interface CampaignPort {
  byId(id: string): Promise<Campaign | null>;
  byCode(code: string): Promise<Campaign | null>;
  resolveFirstTouch(input: Record<string, unknown>): Promise<AttributionTouch | null>;
}
