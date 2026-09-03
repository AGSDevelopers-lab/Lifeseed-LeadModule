import "server-only";

import { randomUUID } from "crypto";

import { createClient } from "@supabase/supabase-js";

const BUCKET = process.env.REPORTS_EXPORT_BUCKET ?? "reports-exports";
const SIGNED_TTL_MIN =
  Number(process.env.REPORTS_EXPORT_SIGNED_URL_TTL_MINUTES ?? 1440) * 60;

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type UploadExportResult = {
  path: string;
  signedUrl: string | null;
  dryRun: boolean;
};

export async function uploadExport(
  userId: string,
  reportId: string,
  format: "CSV" | "XLSX" | "PDF" | "JSON",
  buffer: Buffer,
): Promise<UploadExportResult> {
  const ext =
    format === "CSV"
      ? "csv"
      : format === "XLSX"
        ? "xlsx"
        : format === "PDF"
          ? "pdf"
          : "json";
  const day = new Date().toISOString().slice(0, 10);
  const path = `${userId}/${reportId}/${day}/${randomUUID()}.${ext}`;

  const client = adminClient();
  if (!client) {
    console.info(
      `[reports] storage dry-run upload path=${path} bytes=${buffer.length}`,
    );
    return { path, signedUrl: null, dryRun: true };
  }

  const contentType =
    format === "CSV"
      ? "text/csv"
      : format === "XLSX"
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : format === "PDF"
          ? "application/pdf"
          : "application/json";

  const { error } = await client.storage.from(BUCKET).upload(path, buffer, {
    contentType,
    upsert: false,
  });
  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  const { data, error: signErr } = await client.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_TTL_MIN);
  if (signErr) {
    throw new Error(`Signed URL failed: ${signErr.message}`);
  }

  return { path, signedUrl: data.signedUrl, dryRun: false };
}
