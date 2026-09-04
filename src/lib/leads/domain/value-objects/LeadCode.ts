import { LeadInvariantViolationError } from "../errors";

const LEAD_CODE_RE = /^LED-([A-Z]{3})-(\d{8})-(\d{4})$/;

export class LeadCode {
  private constructor(
    readonly value: string,
    readonly cityCode: string,
    readonly yyyymmdd: string,
    readonly seq: string,
  ) {}

  static isValid(raw: string): boolean {
    return LEAD_CODE_RE.test(raw);
  }

  static parse(raw: string): LeadCode {
    const trimmed = raw.trim();
    const m = LEAD_CODE_RE.exec(trimmed);
    if (!m) {
      throw new LeadInvariantViolationError("Invalid lead code", { raw });
    }
    return new LeadCode(trimmed, m[1], m[2], m[3]);
  }

  toString(): string {
    return this.value;
  }
}
