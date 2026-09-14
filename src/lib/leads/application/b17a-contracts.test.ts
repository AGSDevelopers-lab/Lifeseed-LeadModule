import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { holdsLeadViewPermission } from "@/lib/rbac-permissions";
import { TOUCH_RECORD_SCHEMA_MAPPING } from "./lead-attribution-mapping";
import { compareTimelineKeys } from "./lead-timeline-cursor";
import { LeadTierBadge } from "@/components/leads/lead360/semantic-badges";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

describe("B17-A contracts from source", () => {
  it("maps every TouchRecord field to live schema names", () => {
    expect(TOUCH_RECORD_SCHEMA_MAPPING).toEqual({
      source: "LeadAttribution.firstTouchSource | lastTouchSource",
      medium: "LeadAttribution.firstTouchMedium | lastTouchMedium",
      campaignCode: "Campaign.code via firstTouchCampaignId | lastTouchCampaignId",
      term: "LeadAttribution.firstTouchUtm.term | utm_term",
      content: "LeadAttribution.firstTouchUtm.content | utm_content",
      landingPage: "LeadAttribution.firstTouchLandingUrl | lastTouchLandingUrl",
      creative: "LeadAttribution.firstTouchCreativeRef | lastTouchCreativeRef",
      referralPartner:
        "LeadAttribution.firstTouchReferralPartnerId | lastTouchReferralPartnerId",
      capturedAt: "LeadAttribution.firstTouchAt | lastTouchAt",
    });
    const schema = readFileSync(path.join(root, "prisma/schema.prisma"), "utf8");
    expect(schema).toMatch(/model LeadAttribution/);
    expect(schema).toMatch(/firstTouchSource/);
    expect(schema).toMatch(/firstTouchMedium/);
    expect(schema).toMatch(/firstTouchLandingUrl/);
    expect(schema).toMatch(/firstTouchCreativeRef/);
    expect(schema).toMatch(/firstTouchReferralPartnerId/);
    expect(schema).toMatch(/firstTouchUtm/);
    expect(schema).toMatch(/firstTouchAt/);
    expect(schema).toMatch(/code\s+String\s+@unique/);
  });

  it("authorizes lead detail via holdsLeadViewPermission including lead.list", () => {
    const src = readFileSync(
      path.join(root, "src/lib/leads/application/lead-detail-read-auth.ts"),
      "utf8",
    );
    expect(src).toMatch(/holdsLeadViewPermission\(actor\.roles\)/);
    expect(src).toMatch(/prismaLeadRepository\.byId/);
    expect(holdsLeadViewPermission(["BANK_SUPER_ADMIN"])).toBe(true);
    expect(holdsLeadViewPermission(["TELECALLER"])).toBe(true);
    expect(holdsLeadViewPermission(["COUNSELLOR"])).toBe(true);
    expect(holdsLeadViewPermission(["OPS_MANAGER"])).toBe(true);
    expect(holdsLeadViewPermission(["CRM_ADMIN"])).toBe(false);
    expect(holdsLeadViewPermission(["BANK_MEDICAL_DIRECTOR"])).toBe(false);
    const rbac = readFileSync(path.join(root, "src/lib/rbac-permissions.ts"), "utf8");
    expect(rbac).toMatch(/lead\.view\.any/);
    expect(rbac).toMatch(/lead\.view\.own/);
    expect(rbac).toMatch(/lead\.view\.assigned_for_counselling/);
    expect(rbac).toMatch(/lead\.view\.for_own_clinic/);
    expect(rbac).toMatch(/lead\.view"/);
    expect(rbac).toMatch(/lead\.list/);
  });

  it("timeline sourceType is a required ordering tie-break", () => {
    const t = new Date("2026-09-14T00:00:00.000Z");
    const a = { occurredAt: t, sourceType: "activity" as const, id: "z" };
    const h = { occurredAt: t, sourceType: "status_history" as const, id: "a" };
    expect(compareTimelineKeys(h, a)).toBeLessThan(0);
  });

  it("Lead 360 tier label is Current Tier, never Tier at capture", () => {
    const html = renderToStaticMarkup(createElement(LeadTierBadge, { tier: "WARM" }));
    expect(html).toContain("Current Tier");
    expect(html).not.toContain("Tier at capture");
    const page = readFileSync(
      path.join(root, "src/app/(portals)/admin/leads/[id]/page.tsx"),
      "utf8",
    );
    expect(page).not.toMatch(/Tier at capture/);
  });
});
