"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { publishRubricVersion } from "@/app/(portals)/admin/config/seedscore/actions";
import { Button } from "@/components/ui/primitives";

export function PublishRubricButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setLoading(true);
    const result = await publishRubricVersion();
    setLoading(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Rubric version published — donors flagged for recalc");
    router.refresh();
  }

  return (
    <Button variant="outline" onClick={onClick} disabled={loading}>
      {loading ? "Publishing…" : "Publish New Rubric Version"}
    </Button>
  );
}
