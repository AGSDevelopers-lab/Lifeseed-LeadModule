import "server-only";

import { Resend } from "resend";

export type SendReportEmailInput = {
  to: string;
  subject: string;
  bodyHtml: string;
  attachmentUrl?: string | null;
};

export type SendReportEmailResult = {
  dryRun: boolean;
  id?: string;
};

export async function sendReportEmail(
  input: SendReportEmailInput,
): Promise<SendReportEmailResult> {
  const key = process.env.RESEND_API_KEY;
  const linkBlock = input.attachmentUrl
    ? `<p><a href="${input.attachmentUrl}">Download report</a> (link expires in 24h)</p>`
    : "";
  const html = `
    <div style="font-family: system-ui, sans-serif; color: #1c1917;">
      <h2 style="color:#064e3b;">LifeSeed Reports</h2>
      ${input.bodyHtml}
      ${linkBlock}
      <p style="font-size:12px;color:#78716c;">This message may contain regulated health data. Handle per DPDP Act 2023.</p>
    </div>
  `;

  if (!key) {
    console.info("[reports] email dry-run", {
      to: input.to,
      subject: input.subject,
      attachmentUrl: input.attachmentUrl ?? null,
    });
    return { dryRun: true };
  }

  const resend = new Resend(key);
  const from =
    process.env.REPORTS_EMAIL_FROM ?? "LifeSeed Reports <reports@lifeseed.in>";
  const { data, error } = await resend.emails.send({
    from,
    to: input.to,
    subject: input.subject,
    html,
  });
  if (error) {
    throw new Error(error.message);
  }
  return { dryRun: false, id: data?.id };
}
