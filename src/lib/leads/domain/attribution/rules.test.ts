import { CampaignStatus } from "../enums";
import {
  canonicalSource,
  historyTouchType,
  isLegalCampaignTransition,
  isLegalPatchStatus,
  preserveUtm,
  resolveCampaignIdRule,
} from "./rules";
import { LeadSource, TouchType } from "../enums";
import { describe, expect, it } from "vitest";

describe("B15 attribution domain rules", () => {
  it("preserves raw utm.campaign even when unmatched", () => {
    const blob = preserveUtm({ campaign: "NO_SUCH_CODE", term: "kw" });
    expect(blob.campaign).toBe("NO_SUCH_CODE");
    expect(blob.term).toBe("kw");
  });

  it("resolves campaign by supplied id or exact code match only", () => {
    expect(
      resolveCampaignIdRule({ campaignId: "c1", matchedCodeId: "c1" }),
    ).toBe("c1");
    expect(
      resolveCampaignIdRule({ utmCampaign: "WB_OCT", matchedCodeId: "c9" }),
    ).toBe("c9");
    expect(
      resolveCampaignIdRule({ utmCampaign: "WB_OCT", matchedCodeId: null }),
    ).toBeNull();
    expect(resolveCampaignIdRule({})).toBeNull();
  });

  it("marks first history FIRST and later SUBSEQUENT", () => {
    expect(historyTouchType(true)).toBe(TouchType.FIRST);
    expect(historyTouchType(false)).toBe(TouchType.SUBSEQUENT);
  });

  it("keeps typed LeadSource when raw UTM source is not an enum member", () => {
    expect(canonicalSource(LeadSource.WEB_FORM, "instagram")).toBe(LeadSource.WEB_FORM);
    expect(canonicalSource(LeadSource.WEB_FORM, LeadSource.API)).toBe(LeadSource.API);
  });
});

describe("B15 campaign lifecycle matrix", () => {
  it("allows the four legal transitions", () => {
    expect(isLegalCampaignTransition("activate", CampaignStatus.DRAFT)).toBe(true);
    expect(isLegalPatchStatus(CampaignStatus.ACTIVE, CampaignStatus.PAUSED)).toBe(true);
    expect(isLegalCampaignTransition("activate", CampaignStatus.PAUSED)).toBe(true);
    expect(isLegalCampaignTransition("end", CampaignStatus.ACTIVE)).toBe(true);
  });

  it("rejects illegal transitions including arbitrary PATCH status", () => {
    expect(isLegalCampaignTransition("activate", CampaignStatus.ENDED)).toBe(false);
    expect(isLegalPatchStatus(CampaignStatus.ENDED, CampaignStatus.PAUSED)).toBe(false);
    expect(isLegalCampaignTransition("end", CampaignStatus.DRAFT)).toBe(false);
    expect(isLegalPatchStatus(CampaignStatus.DRAFT, CampaignStatus.PAUSED)).toBe(false);
    expect(isLegalPatchStatus(CampaignStatus.ACTIVE, CampaignStatus.ENDED)).toBe(false);
    expect(isLegalPatchStatus(CampaignStatus.ACTIVE, CampaignStatus.ACTIVE)).toBe(false);
    expect(isLegalPatchStatus(CampaignStatus.PAUSED, CampaignStatus.DRAFT)).toBe(false);
  });
});
