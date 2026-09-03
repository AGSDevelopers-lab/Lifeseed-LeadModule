import { Suspense } from "react";

import SchedulesClient from "./schedules-client";

export default function SchedulesPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-stone-500">Loading schedules…</div>
      }
    >
      <SchedulesClient />
    </Suspense>
  );
}
