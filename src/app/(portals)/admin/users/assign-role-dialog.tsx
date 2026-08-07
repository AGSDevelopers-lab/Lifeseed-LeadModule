"use client";

import { UserRole } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button, Input, Label } from "@/components/ui/primitives";

const schema = z.object({
  userId: z.string().min(1),
  role: z.nativeEnum(UserRole),
  scopeType: z.enum(["global", "site", "clinic"]),
  scopeId: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const ROLE_OPTIONS = Object.values(UserRole);

export function AssignRoleDialog({
  users,
}: {
  users: Array<{ id: string; email: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      userId: users[0]?.id ?? "",
      role: UserRole.BANK_ANDROLOGY_TECH,
      scopeType: "site",
      scopeId: "",
    },
  });

  const scopeType = form.watch("scopeType");

  async function onSubmit(values: FormValues) {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/user-roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: values.userId,
          role: values.role,
          scopeType: values.scopeType,
          scopeId:
            values.scopeType === "global"
              ? null
              : values.scopeId?.trim() || null,
        }),
      });

      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(body.error ?? `Failed (${res.status})`);
        return;
      }

      toast.success("Role assigned");
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>Assign Role</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign role</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <div className="space-y-2">
              <Label htmlFor="userId">User</Label>
              <select
                id="userId"
                className="flex h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm"
                {...form.register("userId")}
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.email}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <select
                id="role"
                className="flex h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm"
                {...form.register("role")}
              >
                {ROLE_OPTIONS.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="scopeType">Scope</Label>
              <select
                id="scopeType"
                className="flex h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm"
                {...form.register("scopeType")}
              >
                <option value="global">global</option>
                <option value="site">site</option>
                <option value="clinic">clinic</option>
              </select>
            </div>

            {scopeType !== "global" && (
              <div className="space-y-2">
                <Label htmlFor="scopeId">Scope ID (site or clinic cuid)</Label>
                <Input id="scopeId" {...form.register("scopeId")} />
              </div>
            )}

            <DialogFooter>
              <DialogCloseButton onClick={() => setOpen(false)} />
              <Button type="submit" disabled={loading}>
                {loading ? "Saving…" : "Assign"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
