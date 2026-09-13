import { handleRecordOutcome } from "@/lib/leads/application/counselling-http";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return handleRecordOutcome(id, request);
}
