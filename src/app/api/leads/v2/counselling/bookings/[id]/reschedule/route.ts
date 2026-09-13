import { handleRescheduleCounselling } from "@/lib/leads/application/counselling-http";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return handleRescheduleCounselling(id, request);
}
