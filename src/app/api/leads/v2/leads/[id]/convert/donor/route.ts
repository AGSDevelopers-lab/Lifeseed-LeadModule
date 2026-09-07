import { handleConvertDonor } from "@/lib/leads/application/convert-http";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return handleConvertDonor(id, request);
}
