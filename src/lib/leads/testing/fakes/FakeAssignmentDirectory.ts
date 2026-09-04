import type {
  AssignmentDirectory,
  TelecallerAvailability,
} from "../../domain/ports/AssignmentDirectory";

export class FakeAssignmentDirectory implements AssignmentDirectory {
  constructor(private readonly telecallers: TelecallerAvailability[] = []) {}

  async listAvailableTelecallers(siteId?: string | null): Promise<TelecallerAvailability[]> {
    if (!siteId) return [...this.telecallers];
    return this.telecallers.filter((t) => t.siteId === siteId || t.siteId == null);
  }
}
