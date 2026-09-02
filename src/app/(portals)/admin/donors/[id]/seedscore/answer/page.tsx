import { notFound, redirect } from "next/navigation";

import { AnswerForm } from "@/app/(portals)/admin/donors/[id]/seedscore/answer/answer-form";
import { prisma } from "@/lib/db";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";
import { CHAKRA_ORDER } from "@/lib/seedscore/constants";

type Params = Promise<{ id: string }>;

export default async function SeedScoreAnswerPage({
  params,
}: {
  params: Params;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (
    !permissionGranted(
      permissionsForRoles(session.roles),
      "seedscore.recalc.manual",
    )
  ) {
    redirect("/admin/donors");
  }

  const { id } = await params;
  const donor = await prisma.donor.findUnique({
    where: { id },
    include: {
      seedScore: { include: { answers: true } },
    },
  });
  if (!donor) notFound();

  const questions = await prisma.chakraQuestion.findMany({
    where: { donorType: donor.type, isActive: true },
    include: {
      options: { where: { isActive: true }, orderBy: { orderIndex: "asc" } },
    },
    orderBy: [{ chakra: "asc" }, { orderIndex: "asc" }],
  });

  const existing = new Map(
    (donor.seedScore?.answers ?? []).map((a) => [
      a.questionId,
      a.selectedOptionId,
    ]),
  );

  const grouped = CHAKRA_ORDER.map((chakra) => ({
    chakra,
    questions: questions
      .filter((q) => q.chakra === chakra)
      .map((q) => ({
        id: q.id,
        questionCode: q.questionCode,
        questionText: q.questionText,
        subDimension: q.subDimension,
        options: q.options.map((o) => ({
          id: o.id,
          optionText: o.optionText,
          scoreValue: o.scoreValue,
        })),
        selectedOptionId: existing.get(q.id) ?? null,
      })),
  })).filter((g) => g.questions.length > 0);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">
          SeedScore answers
        </h1>
        <p className="text-sm text-stone-600">
          {donor.donorCode} · {donor.fullName} · {donor.type}
        </p>
      </div>
      <AnswerForm donorId={donor.id} groups={grouped} />
    </div>
  );
}
