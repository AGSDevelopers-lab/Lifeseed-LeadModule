export class Consent {
  constructor(
    readonly marketing: boolean,
    readonly screening: boolean,
    readonly dataProcessing: boolean,
    readonly version: string | null,
    readonly ip: string | null,
    readonly userAgent: string | null,
  ) {}
}
