import { describe, expect, it } from "vitest";

import { MatchLevel } from "../enums";
import {
  DEFAULT_DUPLICATE_MATCH_RULES,
} from "../../config/defaults";
import {
  matchLeadPair,
  MATCH_SCORE_BY_LEVEL,
  normalizeEmailExact,
  normalizeName,
  normalizePhoneDigits,
} from "./match-rules";

const rulesAll = DEFAULT_DUPLICATE_MATCH_RULES;
const combinedOnly = {
  phoneExact: false,
  emailExact: false,
  namePhoneFuzzy: true,
  nameEmailFuzzy: true,
};

describe("B14 deterministic match rules", () => {
  it("normalizes phone by stripping non-digits only", () => {
    expect(normalizePhoneDigits("+91-98765 43210")).toBe("919876543210");
  });

  it("normalizes email lowercase+trim", () => {
    expect(normalizeEmailExact("  A@B.COM ")).toBe("a@b.com");
  });

  it("normalizes name lowercase/trim/collapse/strip punctuation", () => {
    expect(normalizeName("  Jane,   Doe. ")).toBe("jane doe");
  });

  it("phone exact alone → EXACT with fixed score 100", () => {
    const result = matchLeadPair(
      { id: "a", fullName: "Alice", phone: "(999) 111-2222", email: "a@x.com" },
      { id: "b", fullName: "Bob", phone: "9991112222", email: "b@y.com" },
      rulesAll,
    );
    expect(result?.matchLevel).toBe(MatchLevel.EXACT);
    expect(result?.matchScore).toBe(MATCH_SCORE_BY_LEVEL.EXACT);
    expect(result?.matchScore).toBe(100);
    expect(result?.matchSignals.phoneExact).toBe(true);
  });

  it("email exact alone → EXACT", () => {
    const result = matchLeadPair(
      { id: "a", fullName: "Alice", phone: "111", email: "Same@Mail.com" },
      { id: "b", fullName: "Bob", phone: "222", email: "same@mail.com" },
      rulesAll,
    );
    expect(result?.matchLevel).toBe(MatchLevel.EXACT);
    expect(result?.matchSignals.emailExact).toBe(true);
  });

  it("name+phone combined (phoneExact off) → PROBABLE score 70", () => {
    const result = matchLeadPair(
      { id: "a", fullName: "Jane Doe", phone: "9991112222", email: null },
      { id: "b", fullName: "jane  doe", phone: "999-111-2222", email: null },
      combinedOnly,
    );
    expect(result?.matchLevel).toBe(MatchLevel.PROBABLE);
    expect(result?.matchScore).toBe(70);
    expect(result?.matchSignals.namePhoneFuzzy).toBe(true);
  });

  it("name+email combined (emailExact off) → PROBABLE", () => {
    const result = matchLeadPair(
      { id: "a", fullName: "Jane Doe", phone: "1", email: "j@x.com" },
      { id: "b", fullName: "jane doe", phone: "2", email: "j@x.com" },
      combinedOnly,
    );
    expect(result?.matchLevel).toBe(MatchLevel.PROBABLE);
    expect(result?.matchSignals.nameEmailFuzzy).toBe(true);
  });

  it("never returns POSSIBLE", () => {
    const result = matchLeadPair(
      { id: "a", fullName: "Jane Doe", phone: "999", email: "j@x.com" },
      { id: "b", fullName: "jane doe", phone: "999", email: "j@x.com" },
      rulesAll,
    );
    expect(result?.matchLevel).not.toBe(MatchLevel.POSSIBLE);
  });
});
