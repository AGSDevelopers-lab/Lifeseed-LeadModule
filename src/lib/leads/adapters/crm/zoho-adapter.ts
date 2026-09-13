import {
  CrmOperation,
  CrmSyncStatus,
  type Prisma,
} from "@prisma/client";

import { prisma } from "@/lib/db";
import type { CrmEnqueueInput, CrmPort } from "../../domain/ports/CrmPort";

type ZohoToken = { access_token: string; api_domain?: string };

async function zohoAccessToken(): Promise<{ token: string; apiDomain: string }> {
  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Zoho CRM credentials are not configured");
  }
  const accounts = process.env.ZOHO_ACCOUNTS_URL ?? "https://accounts.zoho.com";
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });
  const res = await fetch(`${accounts}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Zoho token HTTP ${res.status}`);
  }
  const json = (await res.json()) as ZohoToken;
  if (!json.access_token) throw new Error("Zoho token missing access_token");
  return {
    token: json.access_token,
    apiDomain: json.api_domain ?? process.env.ZOHO_API_DOMAIN ?? "https://www.zohoapis.com",
  };
}

function leadFields(payload: Record<string, unknown>): Record<string, unknown> {
  return {
    Last_Name: payload.fullName ?? payload.lastName ?? "Lead",
    Email: payload.email ?? undefined,
    Phone: payload.phone ?? undefined,
    Lead_Status: payload.status ?? payload.eventType ?? undefined,
    Description: payload.leadCode ?? payload.eventType ?? undefined,
  };
}

async function zohoUpsert(
  token: string,
  apiDomain: string,
  payload: Record<string, unknown>,
  existingExternalId: string | null,
): Promise<string> {
  const account = process.env.ZOHO_ACCOUNT_ID;
  const headers: Record<string, string> = {
    Authorization: `Zoho-oauthtoken ${token}`,
    "Content-Type": "application/json",
  };
  if (account) headers["X-ZOHO-ACCOUNT-ID"] = account;

  if (existingExternalId) {
    const res = await fetch(`${apiDomain}/crm/v2/Leads/${existingExternalId}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ data: [leadFields(payload)] }),
    });
    if (!res.ok) throw new Error(`Zoho update HTTP ${res.status}`);
    return existingExternalId;
  }

  const res = await fetch(`${apiDomain}/crm/v2/Leads/upsert`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      data: [leadFields(payload)],
      duplicate_check_fields: ["Email", "Phone"],
    }),
  });
  if (!res.ok) throw new Error(`Zoho upsert HTTP ${res.status}`);
  const json = (await res.json()) as {
    data?: Array<{ details?: { id?: string }; id?: string }>;
  };
  const id = json.data?.[0]?.details?.id ?? json.data?.[0]?.id;
  if (!id) throw new Error("Zoho upsert did not return an id");
  return id;
}

export class ZohoCrmAdapter implements CrmPort {
  async enqueue(input: CrmEnqueueInput): Promise<string | null> {
    const row = await prisma.crmSyncQueue.create({
      data: {
        entityType: "LEAD",
        entityId: input.entityId,
        syncTarget: "ZOHO",
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
    const { token, apiDomain } = await zohoAccessToken();
    const externalId = await zohoUpsert(token, apiDomain, payload, job.externalId);
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

export const zohoCrmAdapter = new ZohoCrmAdapter();
