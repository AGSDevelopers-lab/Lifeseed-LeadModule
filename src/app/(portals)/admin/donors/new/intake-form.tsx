"use client";

import { DonorType } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { createDonorIntake } from "@/app/(portals)/admin/donors/actions";
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
  computeBmi,
  maskPanClient,
  sha256HexBrowser,
} from "@/lib/pii-client";

const formSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  dob: z.string().min(1, "Date of birth is required"),
  gender: z.enum(["M", "F", "O"]),
  type: z.nativeEnum(DonorType),
  siteId: z.string().min(1, "Site is required"),
  phone: z.string().min(10, "Valid phone required"),
  email: z.string().email().optional().or(z.literal("")),
  addressLine: z.string().optional(),
  city: z.string().optional(),
  stateCode: z.string().optional(),
  pincode: z.string().optional(),
  maritalStatus: z.string().optional(),
  hasLivingChild: z.boolean().optional(),
  aadhaar: z
    .string()
    .regex(/^[2-9]\d{11}$/, "Enter a 12-digit Aadhaar number"),
  pan: z.string().optional(),
  height: z.string().optional(),
  weight: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export function DonorIntakeForm({
  sites,
}: {
  sites: Array<{ id: string; code: string; name: string }>;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: "",
      dob: "",
      gender: "M",
      type: DonorType.SEMEN,
      siteId: sites[0]?.id ?? "",
      phone: "",
      email: "",
      addressLine: "",
      city: "",
      stateCode: "",
      pincode: "",
      maritalStatus: "",
      hasLivingChild: false,
      aadhaar: "",
      pan: "",
      height: "",
      weight: "",
    },
  });

  const height = form.watch("height");
  const weight = form.watch("weight");
  const type = form.watch("type");
  const heightNum = height ? Number(height) : undefined;
  const weightNum = weight ? Number(weight) : undefined;
  const bmi = useMemo(() => {
    if (!heightNum || !weightNum || Number.isNaN(heightNum) || Number.isNaN(weightNum)) {
      return null;
    }
    return computeBmi(heightNum, weightNum);
  }, [heightNum, weightNum]);

  async function onSubmit(values: FormValues) {
    setLoading(true);
    try {
      // Aadhaar hashed in-browser — raw value never submitted to the server.
      const aadhaarHash = await sha256HexBrowser(values.aadhaar);
      const panMasked = values.pan ? maskPanClient(values.pan) : undefined;
      const h = values.height ? Number(values.height) : undefined;
      const w = values.weight ? Number(values.weight) : undefined;

      const result = await createDonorIntake({
        fullName: values.fullName,
        dob: values.dob,
        gender: values.gender,
        type: values.type,
        siteId: values.siteId,
        phone: values.phone,
        email: values.email,
        addressLine: values.addressLine,
        city: values.city,
        stateCode: values.stateCode,
        pincode: values.pincode,
        maritalStatus: values.maritalStatus,
        hasLivingChild: values.hasLivingChild,
        aadhaarHash,
        panMasked,
        height: h && !Number.isNaN(h) ? h : undefined,
        weight: w && !Number.isNaN(w) ? w : undefined,
        bmi: bmi ?? undefined,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Donor intake recorded");
      router.push(`/admin/donors/${result.id}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Intake failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>Phase 0 · Donor intake</CardTitle>
        <CardDescription>
          Register a prospective donor. Aadhaar is hashed in the browser before
          submission; the raw number is never transmitted.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={form.handleSubmit(onSubmit)}>
          <Field label="Full name" error={form.formState.errors.fullName?.message}>
            <Input {...form.register("fullName")} />
          </Field>
          <Field label="Date of birth" error={form.formState.errors.dob?.message}>
            <Input type="date" {...form.register("dob")} />
          </Field>
          <Field label="Gender">
            <select
              className="flex h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm"
              {...form.register("gender")}
            >
              <option value="M">Male</option>
              <option value="F">Female</option>
              <option value="O">Other</option>
            </select>
          </Field>
          <Field label="Donor type">
            <select
              className="flex h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm"
              {...form.register("type")}
            >
              <option value={DonorType.SEMEN}>Semen</option>
              <option value={DonorType.OOCYTE}>Oocyte</option>
            </select>
          </Field>
          <Field label="Site" error={form.formState.errors.siteId?.message}>
            <select
              className="flex h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm"
              {...form.register("siteId")}
            >
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Phone" error={form.formState.errors.phone?.message}>
            <Input {...form.register("phone")} />
          </Field>
          <Field label="Email" error={form.formState.errors.email?.message}>
            <Input type="email" {...form.register("email")} />
          </Field>
          <Field label="Marital status">
            <Input {...form.register("maritalStatus")} placeholder="MARRIED / UNMARRIED" />
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
          <Field label="PIN code">
            <Input {...form.register("pincode")} />
          </Field>
          <Field
            label="Aadhaar (12 digits)"
            error={form.formState.errors.aadhaar?.message}
          >
            <Input
              inputMode="numeric"
              autoComplete="off"
              {...form.register("aadhaar")}
            />
          </Field>
          <Field label="PAN (masked before save)">
            <Input {...form.register("pan")} autoComplete="off" />
          </Field>
          <Field label="Height (cm)">
            <Input type="number" {...form.register("height")} />
          </Field>
          <Field label="Weight (kg)">
            <Input type="number" {...form.register("weight")} />
          </Field>
          <div className="sm:col-span-2 flex items-center justify-between gap-4 rounded-md bg-stone-50 px-3 py-2 text-sm">
            <span className="text-stone-600">
              BMI (auto):{" "}
              <strong className="text-stone-900">{bmi ?? "—"}</strong>
            </span>
            <label className="flex items-center gap-2 text-stone-700">
              <input type="checkbox" {...form.register("hasLivingChild")} />
              Has living child
              {type === DonorType.OOCYTE && (
                <span className="text-xs text-amber-700">(required for oocyte)</span>
              )}
            </label>
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/admin/donors")}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving…" : "Create donor"}
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
