import { handleLeadTransition } from "@/lib/leads/application/http";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; event: string }> },
) {
  const { id, event } = await context.params;
  return handleLeadTransition(id, event, request);
}
