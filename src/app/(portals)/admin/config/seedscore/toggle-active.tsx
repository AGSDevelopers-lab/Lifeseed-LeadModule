"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { toggleQuestionActive } from "@/app/(portals)/admin/config/seedscore/actions";

export function ToggleActiveButton({
  questionId,
  isActive,
}: {
  questionId: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onToggle() {
    setPending(true);
    const result = await toggleQuestionActive(questionId, !isActive);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={onToggle}
      className="text-xs text-emerald-900 underline disabled:opacity-50"
    >
      {isActive ? "On" : "Off"}
    </button>
  );
}
