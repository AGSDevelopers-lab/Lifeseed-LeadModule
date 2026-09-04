import type { CrmOperation } from "../enums";

export type CrmEnqueueInput = {
  entityId: string;
  operation: CrmOperation;
  payload: Record<string, unknown>;
};

export interface CrmPort {
  enqueue(input: CrmEnqueueInput): Promise<string | null>;
  sync(jobId: string): Promise<void>;
  status(jobId: string): Promise<string | null>;
}
