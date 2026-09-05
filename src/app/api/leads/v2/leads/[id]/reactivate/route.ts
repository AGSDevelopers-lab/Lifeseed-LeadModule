import { handleLeadTransition } from "@/lib/leads/application/http";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return handleLeadTransition(id, "reactivate", request);
}
