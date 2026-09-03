"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/primitives";

export function FavoritesList({
  items,
}: {
  items: Array<{ id: string; displayName: string; reportId: string; href: string }>;
}) {
  const router = useRouter();

  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-stone-300 bg-stone-50 px-4 py-8 text-sm text-stone-600">
        No favorites yet — star a report to save it here with its filters.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
      {items.map((f) => (
        <li key={f.id} className="flex items-center justify-between px-4 py-3">
          <div>
            <Link href={f.href} className="font-medium text-stone-900 hover:underline">
              {f.displayName}
            </Link>
            <div className="text-xs text-stone-500">{f.reportId}</div>
          </div>
          <Button
            variant="ghost"
            onClick={async () => {
              try {
                const res = await fetch(`/api/reports/favorites/${f.id}`, {
                  method: "DELETE",
                  credentials: "include",
                });
                if (!res.ok) throw new Error("delete failed");
                toast.success("Removed from favorites");
                router.refresh();
              } catch (e) {
                console.error("[reports] favorite DELETE failed", e);
                toast.error("Could not save — please retry");
              }
            }}
          >
            Remove
          </Button>
        </li>
      ))}
    </ul>
  );
}
