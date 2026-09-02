"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ChakraType, DonorType } from "@prisma/client";
import { toast } from "sonner";

import {
  createChakraQuestion,
  updateChakraQuestion,
} from "@/app/(portals)/admin/config/seedscore/actions";
import { Button, Input, Label } from "@/components/ui/primitives";
import {
  CHAKRA_LABEL,
  CHAKRA_ORDER,
  SUB_DIMENSIONS_PER_CHAKRA,
} from "@/lib/seedscore/constants";

type OptionRow = {
  optionCode: string;
  optionText: string;
  scoreValue: number;
  orderIndex: number;
};

type Props = {
  mode: "create" | "edit";
  questionId?: string;
  initial?: {
    chakra: ChakraType;
    donorType: DonorType;
    questionCode: string;
    questionText: string;
    orderIndex: number;
    subDimension: string | null;
    isActive: boolean;
    options: OptionRow[];
  };
};

export function QuestionEditorForm({ mode, questionId, initial }: Props) {
  const router = useRouter();
  const [chakra, setChakra] = useState<ChakraType>(
    initial?.chakra ?? ChakraType.ROOT,
  );
  const [donorType, setDonorType] = useState<DonorType>(
    initial?.donorType ?? DonorType.SEMEN,
  );
  const [questionCode, setQuestionCode] = useState(initial?.questionCode ?? "");
  const [questionText, setQuestionText] = useState(initial?.questionText ?? "");
  const [orderIndex, setOrderIndex] = useState(initial?.orderIndex ?? 0);
  const [subDimension, setSubDimension] = useState(initial?.subDimension ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [options, setOptions] = useState<OptionRow[]>(
    initial?.options ?? [
      { optionCode: "A", optionText: "", scoreValue: 10, orderIndex: 0 },
      { optionCode: "B", optionText: "", scoreValue: 5, orderIndex: 1 },
    ],
  );
  const [loading, setLoading] = useState(false);

  const subDims = useMemo(
    () => SUB_DIMENSIONS_PER_CHAKRA[chakra] ?? [],
    [chakra],
  );

  function updateOption(i: number, patch: Partial<OptionRow>) {
    setOptions((prev) =>
      prev.map((o, idx) => (idx === i ? { ...o, ...patch } : o)),
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const payload = {
      chakra,
      donorType,
      questionCode,
      questionText,
      orderIndex,
      subDimension: subDimension || null,
      options,
    };
    const result =
      mode === "create"
        ? await createChakraQuestion(payload)
        : await updateChakraQuestion({
            ...payload,
            id: questionId!,
            isActive,
          });
    setLoading(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(mode === "create" ? "Question created" : "Question updated");
    router.push(
      `/admin/config/seedscore?chakra=${chakra}&type=${donorType}`,
    );
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5 rounded-xl border border-stone-200 bg-white p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Chakra</Label>
          <select
            className="flex h-10 w-full rounded-md border border-stone-300 px-3 text-sm"
            value={chakra}
            onChange={(e) => setChakra(e.target.value as ChakraType)}
          >
            {CHAKRA_ORDER.map((c) => (
              <option key={c} value={c}>
                {CHAKRA_LABEL[c]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Donor type</Label>
          <select
            className="flex h-10 w-full rounded-md border border-stone-300 px-3 text-sm"
            value={donorType}
            onChange={(e) => setDonorType(e.target.value as DonorType)}
          >
            <option value={DonorType.SEMEN}>SEMEN</option>
            <option value={DonorType.OOCYTE}>OOCYTE</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Question code</Label>
          <Input
            value={questionCode}
            onChange={(e) => setQuestionCode(e.target.value)}
            required
            placeholder="ROOT_Q01"
          />
        </div>
        <div className="space-y-2">
          <Label>Order index</Label>
          <Input
            type="number"
            value={orderIndex}
            onChange={(e) => setOrderIndex(Number(e.target.value))}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Question text</Label>
        <Input
          value={questionText}
          onChange={(e) => setQuestionText(e.target.value)}
          required
        />
      </div>

      {subDims.length > 0 && (
        <div className="space-y-2">
          <Label>Sub-dimension</Label>
          <select
            className="flex h-10 w-full rounded-md border border-stone-300 px-3 text-sm"
            value={subDimension}
            onChange={(e) => setSubDimension(e.target.value)}
          >
            <option value="">—</option>
            {subDims.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      )}

      {mode === "edit" && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          Active
        </label>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Rubric options (score 0–10)</Label>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setOptions((prev) => [
                ...prev,
                {
                  optionCode: String.fromCharCode(65 + prev.length),
                  optionText: "",
                  scoreValue: 0,
                  orderIndex: prev.length,
                },
              ])
            }
          >
            Add option
          </Button>
        </div>
        {options.map((o, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-4">
            <Input
              placeholder="Code"
              value={o.optionCode}
              onChange={(e) => updateOption(i, { optionCode: e.target.value })}
              required
            />
            <Input
              className="sm:col-span-2"
              placeholder="Option text"
              value={o.optionText}
              onChange={(e) => updateOption(i, { optionText: e.target.value })}
              required
            />
            <Input
              type="number"
              min={0}
              max={10}
              value={o.scoreValue}
              onChange={(e) =>
                updateOption(i, { scoreValue: Number(e.target.value) })
              }
              required
            />
          </div>
        ))}
      </div>

      <Button type="submit" disabled={loading}>
        {loading ? "Saving…" : mode === "create" ? "Create question" : "Save"}
      </Button>
    </form>
  );
}
