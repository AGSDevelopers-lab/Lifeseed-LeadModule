import Link from "next/link";
import { redirect } from "next/navigation";
import { ChakraType, DonorType } from "@prisma/client";

import { QuestionEditorForm } from "@/app/(portals)/admin/config/seedscore/question-form";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";

type SearchParams = Promise<{ chakra?: string; type?: string }>;

export default async function NewChakraQuestionPage({
  searchParams,
}: {
  searchParams: SearchParams;
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

  const sp = await searchParams;
  const chakra = (sp.chakra as ChakraType) || ChakraType.ROOT;
  const donorType = (sp.type as DonorType) || DonorType.SEMEN;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/admin/config/seedscore"
          className="text-sm text-emerald-900 hover:underline"
        >
          ← Rubric
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Add Chakra Question</h1>
      </div>
      <QuestionEditorForm
        mode="create"
        initial={{
          chakra,
          donorType,
          questionCode: "",
          questionText: "",
          orderIndex: 0,
          subDimension: null,
          isActive: true,
          options: [
            { optionCode: "A", optionText: "", scoreValue: 10, orderIndex: 0 },
            { optionCode: "B", optionText: "", scoreValue: 5, orderIndex: 1 },
            { optionCode: "C", optionText: "", scoreValue: 0, orderIndex: 2 },
          ],
        }}
      />
    </div>
  );
}
