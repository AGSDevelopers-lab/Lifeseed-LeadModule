import { handleGetCounsellingBooking } from "@/lib/leads/application/counselling-http";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return handleGetCounsellingBooking(id);
}
