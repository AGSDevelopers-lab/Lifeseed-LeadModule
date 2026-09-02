"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { addToDnc } from "@/app/(portals)/leads/actions";
import { Button, Input } from "@/components/ui/primitives";

export function DncForm() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const result = await addToDnc({ phone, email: email || undefined, reason });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Added to DNC");
    setPhone("");
    setEmail("");
    setReason("");
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-wrap items-end gap-3 rounded-xl border border-stone-200 bg-white p-4"
    >
      <Input
        required
        placeholder="Phone"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className="max-w-[160px]"
      />
      <Input
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="max-w-[200px]"
      />
      <Input
        required
        placeholder="Reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="max-w-[240px]"
      />
      <Button type="submit" disabled={pending}>
        Add to DNC
      </Button>
    </form>
  );
}
