"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ChakraType } from "@prisma/client";
import { toast } from "sonner";

import { computeDonorSeedScore } from "@/app/(portals)/admin/config/seedscore/actions";
import { Button } from "@/components/ui/primitives";
import { CHAKRA_LABEL } from "@/lib/seedscore/constants";

type Q = {
  id: string;
  questionCode: string;
  questionText: string;
  subDimension: string | null;
  options: Array<{ id: string; optionText: string; scoreValue: number }>;
  selectedOptionId: string | null;
};

export function AnswerForm({
  donorId,
  groups,
}: {
  donorId: string;
  groups: Array<{ chakra: ChakraType; questions: Q[] }>;
}) {
  const router = useRouter();
  const allQs = useMemo(
    () => groups.flatMap((g) => g.questions),
    [groups],
  );
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const q of allQs) {
      if (q.selectedOptionId) init[q.id] = q.selectedOptionId;
    }
    return init;
  });
  const [loading, setLoading] = useState(false);

  const answeredCount = Object.keys(answers).filter((k) => answers[k]).length;
  const complete = answeredCount === allQs.length && allQs.length > 0;

  async function onCompute() {
    if (!complete) {
      toast.error("Answer all questions before computing");
      return;
    }
    setLoading(true);
    const result = await computeDonorSeedScore({
      donorId,
      answers: Object.entries(answers).map(([questionId, selectedOptionId]) => ({
        questionId,
        selectedOptionId,
      })),
    });
    setLoading(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(
      `Score ${result.totalScore} · ${result.tier}`,
    );
    router.push(`/admin/donors/${donorId}?tab=seedscore`);
    router.refresh();
  }

  function onSaveDraft() {
    toast.message(
      `Draft kept in session (${answeredCount}/${allQs.length}). Use Compute Score to persist.`,
    );
  }

  return (
    <div className="space-y-8">
      {groups.map((g) => {
        const bySub = new Map<string, Q[]>();
        for (const q of g.questions) {
          const key = q.subDimension ?? "_";
          if (!bySub.has(key)) bySub.set(key, []);
          bySub.get(key)!.push(q);
        }
        return (
          <section key={g.chakra} className="space-y-4">
            <h2 className="text-lg font-semibold text-stone-900">
              {CHAKRA_LABEL[g.chakra]}
            </h2>
            {[...bySub.entries()].map(([sub, qs]) => (
              <div key={sub} className="space-y-4">
                {sub !== "_" && (
                  <h3 className="text-xs font-medium uppercase tracking-wide text-stone-500">
                    {sub}
                  </h3>
                )}
                {qs.map((q) => (
                  <fieldset
                    key={q.id}
                    className="rounded-xl border border-stone-200 bg-white p-4"
                  >
                    <legend className="px-1 text-sm font-medium text-stone-900">
                      {q.questionCode}: {q.questionText}
                    </legend>
                    <div className="mt-3 space-y-2">
                      {q.options.map((o) => (
                        <label
                          key={o.id}
                          className="flex cursor-pointer items-start gap-2 text-sm"
                        >
                          <input
                            type="radio"
                            name={q.id}
                            className="mt-1"
                            checked={answers[q.id] === o.id}
                            onChange={() =>
                              setAnswers((prev) => ({
                                ...prev,
                                [q.id]: o.id,
                              }))
                            }
                          />
                          <span>
                            {o.optionText}{" "}
                            <span className="text-xs text-stone-500">
                              ({o.scoreValue})
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ))}
              </div>
            ))}
          </section>
        );
      })}

      {allQs.length === 0 && (
        <p className="text-sm text-stone-600">
          No active rubric questions for this donor type. Author questions under
          Config → SeedScore Rubric.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={onSaveDraft}>
          Save Draft ({answeredCount}/{allQs.length})
        </Button>
        <Button
          type="button"
          disabled={loading || !complete}
          onClick={onCompute}
        >
          {loading ? "Computing…" : "Compute Score"}
        </Button>
      </div>
    </div>
  );
}
