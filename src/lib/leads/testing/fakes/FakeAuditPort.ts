import type { AuditAppendInput, AuditPort } from "../../domain/ports/AuditPort";

export class FakeAuditPort implements AuditPort {
  entries: AuditAppendInput[] = [];

  async append(input: AuditAppendInput): Promise<void> {
    this.entries.push(input);
  }
}
