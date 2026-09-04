import type { Campaign } from "../../domain/entities/Campaign";
import type { CampaignPort } from "../../domain/ports/CampaignPort";
import type { AttributionTouch } from "../../domain/value-objects/AttributionTouch";

export class FakeCampaignPort implements CampaignPort {
  constructor(private readonly campaigns: Campaign[] = []) {}

  async byId(id: string): Promise<Campaign | null> {
    return this.campaigns.find((c) => c.id === id) ?? null;
  }

  async byCode(code: string): Promise<Campaign | null> {
    return this.campaigns.find((c) => c.code === code) ?? null;
  }

  async resolveFirstTouch(): Promise<AttributionTouch | null> {
    return null;
  }
}
