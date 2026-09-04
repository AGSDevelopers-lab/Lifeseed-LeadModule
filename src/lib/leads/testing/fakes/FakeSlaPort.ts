import type { SlaPort, SlaScheduleRequest } from "../../domain/ports/SlaPort";

export class FakeSlaPort implements SlaPort {
  scheduled: SlaScheduleRequest[] = [];
  completed: Array<{ entityType: string; entityId: string; stageKey?: string }> = [];

  async schedule(request: SlaScheduleRequest): Promise<string> {
    this.scheduled.push(request);
    return `sla-${this.scheduled.length}`;
  }

  async complete(entityType: string, entityId: string, stageKey?: string): Promise<void> {
    this.completed.push({ entityType, entityId, stageKey });
  }
}
