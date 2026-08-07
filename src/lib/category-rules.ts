import { SampleCategory, SampleGrade } from "@prisma/client";

import { prisma } from "@/lib/db";

export type CategoryRuleSet = {
  premium?: {
    minGrade?: string;
    donorPhenotype?: string;
    packageEligibility?: string[];
  };
  standard?: {
    minGrades?: string[];
    packageEligibility?: string[];
  };
  economy?: {
    maxGrade?: string;
    packageEligibility?: string[];
  };
};

/**
 * Resolve SampleCategory from grade + donor phenotype tier + package eligibility
 * using site CategoryRuleConfig (falls back to STANDARD).
 */
export function resolveCategory(input: {
  grade: SampleGrade | null | undefined;
  donorPhenotypeTier?: string | null;
  packageEligibility?: string | null;
  rules?: CategoryRuleSet | null;
}): SampleCategory {
  const rules = input.rules ?? {};
  const grade = input.grade;
  const phenotype = input.donorPhenotypeTier ?? "";
  const pkg = input.packageEligibility ?? "";

  const premium = rules.premium;
  if (
    premium &&
    grade === SampleGrade.A &&
    (!premium.donorPhenotype || phenotype === premium.donorPhenotype) &&
    (!premium.packageEligibility?.length ||
      premium.packageEligibility.includes(pkg))
  ) {
    return SampleCategory.PREMIUM;
  }

  const standard = rules.standard;
  const gradeOkForStandard =
    !!grade &&
    (standard?.minGrades
      ? standard.minGrades.includes(grade)
      : grade === SampleGrade.A || grade === SampleGrade.B);

  if (
    gradeOkForStandard &&
    (!standard?.packageEligibility?.length ||
      !pkg ||
      standard.packageEligibility.includes(pkg))
  ) {
    return SampleCategory.STANDARD;
  }

  return SampleCategory.ECONOMY;
}

export async function loadSiteCategoryRules(
  siteId: string,
): Promise<CategoryRuleSet | null> {
  const row = await prisma.categoryRuleConfig.findUnique({
    where: { siteId },
  });
  if (!row) return null;
  return row.rulesJson as CategoryRuleSet;
}
