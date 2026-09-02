"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { updateDonorProfile } from "@/app/(portals)/admin/donors/actions";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@/components/ui/primitives";
import {
  aadhaarOptionalSchema,
  computeBmi,
  maskPanClient,
  sha256HexBrowser,
} from "@/lib/pii-client";

const formSchema = z.object({
  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile"),
  email: z.string().email().optional().or(z.literal("")),
  addressLine: z.string().optional(),
  city: z.string().optional(),
  stateCode: z.string().optional(),
  pincode: z.union([
    z.literal(""),
    z.string().regex(/^\d{6}$/, "PIN must be 6 digits"),
  ]),
  maritalStatus: z.string().optional(),
  hasLivingChild: z.boolean().optional(),
  height: z.string().optional(),
  weight: z.string().optional(),
  aadhaar: aadhaarOptionalSchema,
  pan: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export type EditDonorDefaults = {
  phone: string;
  email: string | null;
  addressLine: string | null;
  city: string | null;
  stateCode: string | null;
  pincode: string | null;
  maritalStatus: string | null;
  hasLivingChild: boolean | null;
  height: number | null;
  weight: number | null;
  panMasked: string | null;
  aadhaarHash: string | null;
};

export function EditDonorForm({
  donorId,
  donorCode,
  defaults,
}: {
  donorId: string;
  donorCode: string;
  defaults: EditDonorDefaults;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    defaultValues: {
      phone: defaults.phone,
      email: defaults.email ?? "",
      addressLine: defaults.addressLine ?? "",
      city: defaults.city ?? "",
      stateCode: defaults.stateCode ?? "",
      pincode: defaults.pincode ?? "",
      maritalStatus: defaults.maritalStatus ?? "",
      hasLivingChild: defaults.hasLivingChild ?? false,
      height: defaults.height != null ? String(defaults.height) : "",
      weight: defaults.weight != null ? String(defaults.weight) : "",
      aadhaar: "",
      pan: "",
    },
  });

  const height = form.watch("height");
  const weight = form.watch("weight");
  const heightNum = height ? Number(height) : undefined;
  const weightNum = weight ? Number(weight) : undefined;
  const bmi = useMemo(() => {
    if (
      !heightNum ||
      !weightNum ||
      Number.isNaN(heightNum) ||
      Number.isNaN(weightNum)
    ) {
      return null;
    }
    return computeBmi(heightNum, weightNum);
  }, [heightNum, weightNum]);

  async function onSubmit(values: FormValues) {
    setLoading(true);
    try {
      const h = values.height ? Number(values.height) : undefined;
      const w = values.weight ? Number(values.weight) : undefined;
      const aadhaarHash =
        values.aadhaar && values.aadhaar.length === 12
          ? await sha256HexBrowser(values.aadhaar)
          : undefined;
      const panMasked = values.pan ? maskPanClient(values.pan) : undefined;

      const result = await updateDonorProfile({
        donorId,
        phone: values.phone,
        email: values.email ?? "",
        addressLine: values.addressLine ?? "",
        city: values.city ?? "",
        stateCode: values.stateCode ?? "",
        pincode: values.pincode ?? "",
        maritalStatus: values.maritalStatus ?? "",
        hasLivingChild: values.hasLivingChild,
        height: h && !Number.isNaN(h) ? h : null,
        weight: w && !Number.isNaN(w) ? w : null,
        bmi: bmi ?? null,
        panMasked,
        aadhaarHash,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Donor profile updated");
      router.push(`/admin/donors/${donorId}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>Edit donor · {donorCode}</CardTitle>
        <CardDescription>
          Update contact and physical profile fields. Donor code, type, site,
          DOB, and phase/status cannot be changed here. Leave Aadhaar/PAN blank
          to keep existing values.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <Field label="Phone" error={form.formState.errors.phone?.message}>
            <Input {...form.register("phone")} inputMode="tel" />
          </Field>
          <Field label="Email" error={form.formState.errors.email?.message}>
            <Input type="email" {...form.register("email")} />
          </Field>
          <Field label="Address">
            <Input {...form.register("addressLine")} />
          </Field>
          <Field label="City">
            <Input {...form.register("city")} />
          </Field>
          <Field label="State code">
            <Input {...form.register("stateCode")} placeholder="WB / TG" />
          </Field>
          <Field label="PIN code" error={form.formState.errors.pincode?.message}>
            <Input {...form.register("pincode")} inputMode="numeric" />
          </Field>
          <Field label="Marital status">
            <Input
              {...form.register("maritalStatus")}
              placeholder="MARRIED / UNMARRIED"
            />
          </Field>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input type="checkbox" {...form.register("hasLivingChild")} />
              Has living child
            </label>
          </div>
          <Field label="Height (cm)">
            <Input type="number" {...form.register("height")} />
          </Field>
          <Field label="Weight (kg)">
            <Input type="number" {...form.register("weight")} />
          </Field>
          <div className="sm:col-span-2 rounded-md bg-stone-50 px-3 py-2 text-sm text-stone-600">
            BMI (auto):{" "}
            <strong className="text-stone-900">{bmi ?? "—"}</strong>
          </div>
          <Field
            label="Aadhaar (leave blank to keep)"
            error={form.formState.errors.aadhaar?.message}
          >
            <Input
              inputMode="numeric"
              autoComplete="off"
              placeholder={
                defaults.aadhaarHash
                  ? `On file: ${defaults.aadhaarHash.slice(0, 12)}…`
                  : "12-digit Aadhaar"
              }
              {...form.register("aadhaar")}
            />
          </Field>
          <Field label="PAN (leave blank to keep)">
            <Input
              autoComplete="off"
              placeholder={defaults.panMasked ?? "Enter PAN to remask"}
              {...form.register("pan")}
            />
          </Field>
          <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(`/admin/donors/${donorId}`)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
