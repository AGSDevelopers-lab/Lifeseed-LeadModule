import { MatchLevel } from "../enums";
import type { ConfigPort } from "../ports/ConfigPort";
import { CONFIG_KEYS } from "../../config/keys";
import { DEFAULT_DUPLICATE_MATCH_RULES } from "../../config/defaults";

export type DuplicateMatchRules = {
  phoneExact: boolean;
  emailExact: boolean;
  namePhoneFuzzy: boolean;
  nameEmailFuzzy: boolean;
};

/** Fixed constants — not probabilities, not learned scores. */
export const MATCH_SCORE_BY_LEVEL = {
  [MatchLevel.EXACT]: 100,
  [MatchLevel.PROBABLE]: 70,
} as const;

export type LeadMatchContact = {
  id: string;
  fullName: string | null;
  phone: string | null;
  email: string | null;
};

export type DuplicateMatchResult = {
  matchLevel: typeof MatchLevel.EXACT | typeof MatchLevel.PROBABLE;
  matchScore: number;
  matchSignals: {
    phoneExact: boolean;
    emailExact: boolean;
    namePhoneFuzzy: boolean;
    nameEmailFuzzy: boolean;
  };
};

/** Strip every non-digit character; compare the remaining digit strings. */
export function normalizePhoneDigits(phone: string | null | undefined): string {
  if (!phone) return "";
  return phone.replace(/\D/g, "");
}

export function normalizeEmailExact(email: string | null | undefined): string {
  if (!email) return "";
  return email.trim().toLowerCase();
}

/** Lowercase, trim, collapse whitespace, strip punctuation. */
export function normalizeName(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ");
}

export async function loadDuplicateMatchRules(
  config: ConfigPort,
): Promise<DuplicateMatchRules> {
  const payload = await config.getActive<DuplicateMatchRules>(
    CONFIG_KEYS.DUPLICATE_MATCH_RULES_V1,
  );
  return {
    phoneExact: payload?.phoneExact ?? DEFAULT_DUPLICATE_MATCH_RULES.phoneExact,
    emailExact: payload?.emailExact ?? DEFAULT_DUPLICATE_MATCH_RULES.emailExact,
    namePhoneFuzzy: payload?.namePhoneFuzzy ?? DEFAULT_DUPLICATE_MATCH_RULES.namePhoneFuzzy,
    nameEmailFuzzy: payload?.nameEmailFuzzy ?? DEFAULT_DUPLICATE_MATCH_RULES.nameEmailFuzzy,
  };
}

export function matchLeadPair(
  left: LeadMatchContact,
  right: LeadMatchContact,
  rules: DuplicateMatchRules,
): DuplicateMatchResult | null {
  if (left.id === right.id) return null;

  const phoneEqual =
    Boolean(normalizePhoneDigits(left.phone)) &&
    normalizePhoneDigits(left.phone) === normalizePhoneDigits(right.phone);
  const emailEqual =
    Boolean(normalizeEmailExact(left.email)) &&
    normalizeEmailExact(left.email) === normalizeEmailExact(right.email);
  const nameEqual =
    Boolean(normalizeName(left.fullName)) &&
    normalizeName(left.fullName) === normalizeName(right.fullName);

  const phoneExact = Boolean(rules.phoneExact && phoneEqual);
  const emailExact = Boolean(rules.emailExact && emailEqual);
  const namePhoneFuzzy = Boolean(rules.namePhoneFuzzy && nameEqual && phoneEqual);
  const nameEmailFuzzy = Boolean(rules.nameEmailFuzzy && nameEqual && emailEqual);

  if (!phoneExact && !emailExact && !namePhoneFuzzy && !nameEmailFuzzy) {
    return null;
  }

  const matchLevel =
    phoneExact || emailExact ? MatchLevel.EXACT : MatchLevel.PROBABLE;

  return {
    matchLevel,
    matchScore: MATCH_SCORE_BY_LEVEL[matchLevel],
    matchSignals: {
      phoneExact,
      emailExact,
      namePhoneFuzzy,
      nameEmailFuzzy,
    },
  };
}
