import { handleConvertEligibility } from "@/lib/leads/application/convert-http";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return handleConvertEligibility(id);
}
