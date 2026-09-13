import {
  CrmOperation,
  CrmSyncStatus,
  type Prisma,
} from "@prisma/client";

import { prisma } from "@/lib/db";
import type { CrmEnqueueInput, CrmPort } from "../../domain/ports/CrmPort";

async function salesforceSession(): Promise<{ token: string; instanceUrl: string }> {
  const clientId = process.env.SALESFORCE_CLIENT_ID;
  const clientSecret = process.env.SALESFORCE_CLIENT_SECRET;
  const username = process.env.SALESFORCE_USERNAME;
  const password = process.env.SALESFORCE_PASSWORD;
  const instanceUrl = process.env.SALESFORCE_INSTANCE_URL;
  if (!clientId || !clientSecret || !username || !password || !instanceUrl) {
    throw new Error("Salesforce CRM credentials are not configured");
  }
  const body = new URLSearchParams({
    grant_type: "password",
    client_id: clientId,
    client_secret: clientSecret,
    username,
    password,
  });
  const res = await fetch(`${instanceUrl}/services/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Salesforce token HTTP ${res.status}`);
  const json = (await res.json()) as { access_token?: string; instance_url?: string };
  if (!json.access_token) throw new Error("Salesforce token missing access_token");
  return { token: json.access_token, instanceUrl: json.instance_url ?? instanceUrl };
}

function sfFields(payload: Record<string, unknown>): Record<string, unknown> {
  const name = String(payload.fullName ?? "Lead");
  const parts = name.split(" ");
  return {
    LastName: parts.slice(1).join(" ") || name,
    FirstName: parts.length > 1 ? parts[0] : undefined,
    Email: payload.email ?? undefined,
    Phone: payload.phone ?? undefined,
    Company: payload.leadCode ?? "LifeSeed",
    Status: payload.status ?? undefined,
    Description: payload.eventType ?? undefined,
  };
}

async function sfUpsert(
  token: string,
  instanceUrl: string,
  payload: Record<string, unknown>,
  existingExternalId: string | null,
): Promise<string> {
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  const base = `${instanceUrl}/services/data/v59.0/sobjects/Lead`;
  if (existingExternalId) {
    const res = await fetch(`${base}/${existingExternalId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(sfFields(payload)),
    });
    if (!res.ok) throw new Error(`Salesforce update HTTP ${res.status}`);
    return existingExternalId;
  }
  const res = await fetch(base, {
    method: "POST",
    headers,
    body: JSON.stringify(sfFields(payload)),
  });
  if (!res.ok) throw new Error(`Salesforce create HTTP ${res.status}`);
  const json = (await res.json()) as { id?: string };
  if (!json.id) throw new Error("Salesforce create did not return an id");
  return json.id;
}

export class SalesforceCrmAdapter implements CrmPort {
  async enqueue(input: CrmEnqueueInput): Promise<string | null> {
    const row = await prisma.crmSyncQueue.create({
      data: {
        entityType: "LEAD",
        entityId: input.entityId,
        syncTarget: "SALESFORCE",
        payload: input.payload as Prisma.InputJsonValue,
        status: CrmSyncStatus.PENDING,
        operation: input.operation as CrmOperation,
      },
    });
    return row.id;
  }

  async sync(jobId: string): Promise<void> {
    const job = await prisma.crmSyncQueue.findUnique({ where: { id: jobId } });
    if (!job) throw new Error(`CrmSyncQueue job not found: ${jobId}`);
    const payload = (job.payload ?? {}) as Record<string, unknown>;
    const session = await salesforceSession();
    const externalId = await sfUpsert(
      session.token,
      session.instanceUrl,
      payload,
      job.externalId,
    );
    await prisma.crmSyncQueue.update({
      where: { id: jobId },
      data: {
        status: CrmSyncStatus.SYNCED,
        externalId,
        attempts: { increment: 1 },
        lastAttemptAt: new Date(),
        succeededAt: new Date(),
        lastError: null,
        lastAttemptError: null,
      },
    });
  }

  async status(jobId: string): Promise<string | null> {
    const job = await prisma.crmSyncQueue.findUnique({ where: { id: jobId } });
    return job?.status ?? null;
  }
}

export const salesforceCrmAdapter = new SalesforceCrmAdapter();
