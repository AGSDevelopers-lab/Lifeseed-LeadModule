import { handleBookCounselling } from "@/lib/leads/application/counselling-http";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return handleBookCounselling(id, request);
}
