export type SlaScheduleRequest = {
  entityType: string;
  entityId: string;
  stageKey: string;
  startAt: Date;
};

export interface SlaPort {
  schedule(request: SlaScheduleRequest): Promise<string>;
  complete(entityType: string, entityId: string, stageKey?: string): Promise<void>;
}
