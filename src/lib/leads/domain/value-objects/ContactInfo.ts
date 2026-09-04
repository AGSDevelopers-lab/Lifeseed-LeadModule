export class ContactInfo {
  constructor(
    readonly fullName: string | null,
    readonly phone: string | null,
    readonly email: string | null,
    readonly city: string | null,
    readonly state: string | null,
    readonly pincode: string | null,
    readonly preferredLanguage: string | null,
  ) {}
}
