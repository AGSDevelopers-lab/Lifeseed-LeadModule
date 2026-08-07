"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { saveCategoryRules } from "@/app/(portals)/admin/config/actions";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
} from "@/components/ui/primitives";

const DEFAULT_RULES = {
  premium: {
    minGrade: "A",
    donorPhenotype: "TOP_TIER",
    packageEligibility: ["PREMIUM"],
  },
  standard: {
    minGrades: ["A", "B"],
    packageEligibility: ["PREMIUM", "STANDARD"],
  },
  economy: {
    maxGrade: "C",
    packageEligibility: ["BASIC", "ECONOMY"],
  },
};

type Tank = { id: string; tankCode: string; name: string; isQuarantine: boolean };

export function CategoriesForm({
  siteId,
  initialRulesJson,
  initialTankMapping,
  tanks,
}: {
  siteId: string;
  initialRulesJson: string;
  initialTankMapping: Record<string, string>;
  tanks: Tank[];
}) {
  const router = useRouter();
  const [rulesJson, setRulesJson] = useState(initialRulesJson);
  const [premiumTank, setPremiumTank] = useState(
    initialTankMapping.PREMIUM ?? "",
  );
  const [standardTank, setStandardTank] = useState(
    initialTankMapping.STANDARD ?? "",
  );
  const [economyTank, setEconomyTank] = useState(
    initialTankMapping.ECONOMY ?? "",
  );
  const [quarantineTank, setQuarantineTank] = useState(
    initialTankMapping.QUARANTINE ??
      tanks.find((t) => t.isQuarantine)?.id ??
      "",
  );
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const tankMappingJson = JSON.stringify({
        PREMIUM: premiumTank || null,
        STANDARD: standardTank || null,
        ECONOMY: economyTank || null,
        QUARANTINE: quarantineTank || null,
      });
      const result = await saveCategoryRules({
        siteId,
        rulesJson,
        tankMappingJson,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Category rules saved");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Composite rules</CardTitle>
          <CardDescription>
            Grade + donor phenotype + package eligibility → PREMIUM / STANDARD /
            ECONOMY. Grade downgrade does not auto-change category.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label>Rules JSON</Label>
          <textarea
            className="min-h-[220px] w-full rounded-md border border-stone-300 bg-white p-3 font-mono text-xs"
            value={rulesJson}
            onChange={(e) => setRulesJson(e.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setRulesJson(JSON.stringify(DEFAULT_RULES, null, 2))
            }
          >
            Reset to defaults
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Category → tank mapping</CardTitle>
          <CardDescription>
            Default dewar assignment after QC-A6 clearance / cryo load.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <TankSelect
            label="PREMIUM (PRM)"
            value={premiumTank}
            onChange={setPremiumTank}
            tanks={tanks}
          />
          <TankSelect
            label="STANDARD (STD)"
            value={standardTank}
            onChange={setStandardTank}
            tanks={tanks}
          />
          <TankSelect
            label="ECONOMY (ECN)"
            value={economyTank}
            onChange={setEconomyTank}
            tanks={tanks}
          />
          <TankSelect
            label="QUARANTINE dewar"
            value={quarantineTank}
            onChange={setQuarantineTank}
            tanks={tanks}
            preferQuarantine
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={loading}>
          {loading ? "Saving…" : "Save category config"}
        </Button>
      </div>
    </form>
  );
}

function TankSelect({
  label,
  value,
  onChange,
  tanks,
  preferQuarantine,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  tanks: Tank[];
  preferQuarantine?: boolean;
}) {
  const options = preferQuarantine
    ? [...tanks].sort((a, b) => Number(b.isQuarantine) - Number(a.isQuarantine))
    : tanks;
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <select
        className="flex h-10 w-full rounded-md border border-stone-300 px-2 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">— Select tank —</option>
        {options.map((t) => (
          <option key={t.id} value={t.id}>
            {t.tankCode} — {t.name}
            {t.isQuarantine ? " (quarantine)" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
