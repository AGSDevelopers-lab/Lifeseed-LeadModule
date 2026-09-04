import type { CrmEnqueueInput, CrmPort } from "../../domain/ports/CrmPort";

export class FakeCrmPort implements CrmPort {
  jobs = new Map<string, { status: string; input: CrmEnqueueInput }>();

  async enqueue(input: CrmEnqueueInput): Promise<string | null> {
    const id = `crm-${this.jobs.size + 1}`;
    this.jobs.set(id, { status: "PENDING", input });
    return id;
  }

  async sync(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (job) job.status = "SYNCED";
  }

  async status(jobId: string): Promise<string | null> {
    return this.jobs.get(jobId)?.status ?? null;
  }
}
