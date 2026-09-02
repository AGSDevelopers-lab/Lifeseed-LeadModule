import Link from "next/link";
import { redirect } from "next/navigation";
import { ChakraType, DonorType } from "@prisma/client";

import { PublishRubricButton } from "@/app/(portals)/admin/config/seedscore/publish-button";
import { ToggleActiveButton } from "@/app/(portals)/admin/config/seedscore/toggle-active";
import { Button } from "@/components/ui/primitives";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { prisma } from "@/lib/db";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";
import {
  CHAKRA_LABEL,
  CHAKRA_ORDER,
} from "@/lib/seedscore/constants";
import { cn } from "@/lib/utils";

type SearchParams = Promise<{
  chakra?: string;
  type?: string;
}>;

export default async function SeedScoreRubricPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const perms = permissionsForRoles(session.roles);
  if (
    !permissionGranted(perms, "seedscore.rubric.author") &&
    !permissionGranted(perms, "seedscore.view")
  ) {
    redirect("/admin");
  }

  const sp = await searchParams;
  const chakra = (sp.chakra as ChakraType) || ChakraType.ROOT;
  const donorType = (sp.type as DonorType) || DonorType.SEMEN;
  const activeChakra = CHAKRA_ORDER.includes(chakra) ? chakra : ChakraType.ROOT;

  const [questions, activeVersion] = await Promise.all([
    prisma.chakraQuestion.findMany({
      where: { chakra: activeChakra, donorType },
      include: { options: { orderBy: { orderIndex: "asc" } } },
      orderBy: { orderIndex: "asc" },
    }),
    prisma.rubricVersion.findFirst({
      where: { isActive: true },
      orderBy: { versionNumber: "desc" },
    }),
  ]);

  const canAuthor = permissionGranted(perms, "seedscore.question.author");
  const canPublish = permissionGranted(perms, "seedscore.rubric.publish");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">
            SeedScore Rubric
          </h1>
          <p className="text-sm text-stone-600">
            7-Chakra question bank · active rubric{" "}
            {activeVersion ? `v${activeVersion.versionNumber}` : "(none published)"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/config/seedscore/versions">
            <Button variant="outline">Versions</Button>
          </Link>
          {canAuthor && (
            <Link
              href={`/admin/config/seedscore/questions/new?chakra=${activeChakra}&type=${donorType}`}
            >
              <Button>Add Question</Button>
            </Link>
          )}
          {canPublish && <PublishRubricButton />}
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-stone-200 pb-px">
        {CHAKRA_ORDER.map((c) => (
          <Link
            key={c}
            href={`/admin/config/seedscore?chakra=${c}&type=${donorType}`}
            className={cn(
              "rounded-t-md px-3 py-2 text-sm",
              activeChakra === c
                ? "bg-white font-medium text-emerald-900 ring-1 ring-stone-200"
                : "text-stone-600 hover:bg-stone-100",
            )}
          >
            {CHAKRA_LABEL[c]}
          </Link>
        ))}
      </div>

      <div className="flex gap-2">
        {([DonorType.SEMEN, DonorType.OOCYTE] as const).map((t) => (
          <Link
            key={t}
            href={`/admin/config/seedscore?chakra=${activeChakra}&type=${t}`}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm",
              donorType === t
                ? "bg-emerald-50 font-medium text-emerald-900"
                : "bg-stone-100 text-stone-600",
            )}
          >
            {t}
          </Link>
        ))}
      </div>

      <div className="rounded-xl border border-stone-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Question</TableHead>
              <TableHead>Sub-dimension</TableHead>
              <TableHead>Options</TableHead>
              <TableHead>Active</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {questions.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-stone-500">
                  No questions yet for {CHAKRA_LABEL[activeChakra]} / {donorType}.
                </TableCell>
              </TableRow>
            )}
            {questions.map((q) => (
              <TableRow key={q.id}>
                <TableCell>{q.orderIndex}</TableCell>
                <TableCell className="font-mono text-xs">{q.questionCode}</TableCell>
                <TableCell className="max-w-md text-sm">{q.questionText}</TableCell>
                <TableCell className="text-xs">{q.subDimension ?? "—"}</TableCell>
                <TableCell className="text-xs">{q.options.length}</TableCell>
                <TableCell>
                  {canAuthor ? (
                    <ToggleActiveButton
                      questionId={q.id}
                      isActive={q.isActive}
                    />
                  ) : (
                    <span className="text-xs">{q.isActive ? "Yes" : "No"}</span>
                  )}
                </TableCell>
                <TableCell>
                  {canAuthor && (
                    <Link
                      href={`/admin/config/seedscore/questions/${q.id}/edit`}
                      className="text-sm text-emerald-900 hover:underline"
                    >
                      Edit
                    </Link>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
