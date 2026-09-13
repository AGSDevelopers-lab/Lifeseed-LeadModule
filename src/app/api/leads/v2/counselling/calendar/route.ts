import { handleCounsellingCalendar } from "@/lib/leads/application/counselling-http";

export async function GET(request: Request) {
  return handleCounsellingCalendar(request);
}
