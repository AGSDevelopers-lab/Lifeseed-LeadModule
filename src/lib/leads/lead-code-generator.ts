const CITY_CODES: Record<string, string> = {
  kolkata: "KOL",
  kol: "KOL",
  hyderabad: "HYD",
  hyd: "HYD",
  delhi: "DEL",
  newdelhi: "DEL",
  mumbai: "MUM",
  bombay: "MUM",
  bangalore: "BLR",
  bengaluru: "BLR",
  chennai: "CHN",
  pune: "PUN",
  ahmedabad: "AHM",
};

export function cityToCode(city: string | null | undefined): string {
  if (!city) return "OTH";
  const key = city.trim().toLowerCase().replace(/\s+/g, "");
  return CITY_CODES[key] ?? "OTH";
}

/**
 * LED-{CITY_CODE}-{YYYYMMDD}-{XXXX} — sequential XXXX per city per day.
 * Pass `nextSeq` from DB lookup (count+1 for that city+day).
 */
export function generateLeadCode(
  city: string | null | undefined,
  capturedAt: Date,
  nextSeq: number,
): string {
  const cityCode = cityToCode(city);
  const ymd = capturedAt.toISOString().slice(0, 10).replace(/-/g, "");
  const seq = String(Math.max(1, nextSeq)).padStart(4, "0");
  return `LED-${cityCode}-${ymd}-${seq}`;
}

export function leadCodePrefix(city: string | null | undefined, capturedAt: Date): string {
  const cityCode = cityToCode(city);
  const ymd = capturedAt.toISOString().slice(0, 10).replace(/-/g, "");
  return `LED-${cityCode}-${ymd}-`;
}
