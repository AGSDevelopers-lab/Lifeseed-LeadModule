import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { QuestionEditorForm } from "@/app/(portals)/admin/config/seedscore/question-form";
import { prisma } from "@/lib/db";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";

type Params = Promise<{ id: string }>;

export default async function EditChakraQuestionPage({
  params,
}: {
  params: Params;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (
    !permissionGranted(
      permissionsForRoles(session.roles),
      "seedscore.question.author",
    )
  ) {
    redirect("/admin/config/seedscore");
  }

  const { id } = await params;
  const q = await prisma.chakraQuestion.findUnique({
    where: { id },
    include: { options: { orderBy: { orderIndex: "asc" } } },
  });
  if (!q) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/admin/config/seedscore"
          className="text-sm text-emerald-900 hover:underline"
        >
          ← Rubric
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Edit Question</h1>
        <p className="text-sm text-stone-600">{q.questionCode}</p>
      </div>
      <QuestionEditorForm
        mode="edit"
        questionId={q.id}
        initial={{
          chakra: q.chakra,
          donorType: q.donorType,
          questionCode: q.questionCode,
          questionText: q.questionText,
          orderIndex: q.orderIndex,
          subDimension: q.subDimension,
          isActive: q.isActive,
          options: q.options.map((o) => ({
            optionCode: o.optionCode,
            optionText: o.optionText,
            scoreValue: o.scoreValue,
            orderIndex: o.orderIndex,
          })),
        }}
      />
    </div>
  );
}
