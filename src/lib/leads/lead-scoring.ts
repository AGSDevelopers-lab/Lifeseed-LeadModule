import {
  LeadDonorSubType,
  LeadPersonType,
  LeadSource,
  LeadTier,
} from "@prisma/client";

export type LeadScoreInput = {
  personType: LeadPersonType;
  donorSubType?: LeadDonorSubType | null;
  source: LeadSource;
  ageGroup?: string | null;
  city?: string | null;
  state?: string | null;
  preferredLanguage?: string | null;
  email?: string | null;
  phone?: string | null;
  fullName?: string | null;
  pincode?: string | null;
  /** Hours from capture to first response; null if not yet responded */
  responseHours?: number | null;
};

export type LeadScoreResult = {
  score: number;
  breakdown: Record<string, number>;
  tier: LeadTier;
};

const SOURCE_POINTS: Record<LeadSource, number> = {
  REFERRAL: 20,
  CLINIC_REFERRAL: 18,
  WALK_IN: 15,
  WEB_FORM: 10,
  WHATSAPP_BOT: 10,
  PHONE_INBOUND: 8,
  SOCIAL_FACEBOOK: 5,
  SOCIAL_INSTAGRAM: 5,
  SOCIAL_GOOGLE_ADS: 5,
  PARTNER_HOSPITAL: 15,
  OTHER: 2,
};

const SERVICE_AREAS = new Set([
  "wb",
  "westbengal",
  "tg",
  "telangana",
  "del",
  "delhi",
  "mum",
  "mumbai",
  "blr",
  "bangalore",
  "bengaluru",
  "hyd",
  "hyderabad",
  "kol",
  "kolkata",
]);

const SUPPORTED_LANGS = new Set(["english", "hindi", "bengali", "telugu"]);

function ageContribution(
  personType: LeadPersonType,
  donorSubType: LeadDonorSubType | null | undefined,
  ageGroup: string | null | undefined,
): number {
  if (personType === LeadPersonType.RECIPIENT) return 15; // no age gate
  if (!ageGroup) return 5;
  const m = ageGroup.match(/(\d+)\s*[-–]\s*(\d+)/);
  const mid = m ? (Number(m[1]) + Number(m[2])) / 2 : Number(ageGroup);
  if (!Number.isFinite(mid)) return 5;

  if (donorSubType === LeadDonorSubType.OOCYTE) {
    if (mid >= 23 && mid <= 35) return 20;
    if (mid >= 21 && mid <= 37) return 12;
    return 4;
  }
  // SEMEN default
  if (mid >= 21 && mid <= 40) return 20;
  if (mid >= 18 && mid <= 45) return 12;
  return 4;
}

function responseContribution(hours: number | null | undefined): number {
  if (hours == null) return 0;
  if (hours <= 1) return 10;
  if (hours <= 6) return 5;
  if (hours <= 24) return 2;
  return 0;
}

function completenessContribution(input: LeadScoreInput): number {
  const fields = [
    input.fullName,
    input.phone,
    input.email,
    input.city,
    input.state,
    input.pincode,
    input.ageGroup,
    input.preferredLanguage,
  ];
  const filled = fields.filter((f) => f != null && String(f).trim() !== "").length;
  return Math.round((filled / fields.length) * 20);
}

function locationContribution(city?: string | null, state?: string | null): number {
  const keys = [city, state]
    .filter(Boolean)
    .map((s) => s!.trim().toLowerCase().replace(/\s+/g, ""));
  if (keys.some((k) => SERVICE_AREAS.has(k))) return 10;
  return keys.length ? 3 : 0;
}

function languageContribution(lang?: string | null): number {
  if (!lang) return 0;
  return SUPPORTED_LANGS.has(lang.trim().toLowerCase()) ? 5 : 0;
}

export function deriveLeadTier(score: number): LeadTier {
  if (score >= 75) return LeadTier.HOT;
  if (score >= 55) return LeadTier.WARM;
  if (score >= 30) return LeadTier.COLD;
  return LeadTier.ARCHIVED;
}

export function scoreLead(input: LeadScoreInput): LeadScoreResult {
  const breakdown: Record<string, number> = {
    age: ageContribution(input.personType, input.donorSubType, input.ageGroup),
    source: SOURCE_POINTS[input.source] ?? 2,
    responseSpeed: responseContribution(input.responseHours),
    completeness: completenessContribution(input),
    location: locationContribution(input.city, input.state),
    language: languageContribution(input.preferredLanguage),
  };
  const raw = Object.values(breakdown).reduce((a, b) => a + b, 0);
  const score = Math.max(0, Math.min(100, raw));
  return { score, breakdown, tier: deriveLeadTier(score) };
}
