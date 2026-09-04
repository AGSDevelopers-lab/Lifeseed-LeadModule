import type { LeadSource } from "../enums";

export class AttributionTouch {
  constructor(
    readonly at: Date,
    readonly source: LeadSource,
    readonly campaignId: string | null,
    readonly medium: string | null,
    readonly channel: string | null,
    readonly creativeRef: string | null,
    readonly landingUrl: string | null,
    readonly referralPartnerId: string | null,
    readonly utm: Record<string, unknown> | null,
  ) {}
}
