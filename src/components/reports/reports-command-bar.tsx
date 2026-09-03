"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";

import { fuzzyMatchReports } from "@/lib/reports/catalog";

export function ReportsCommandBar() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const results = useMemo(() => fuzzyMatchReports(query), [query]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[15vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Search reports"
      onClick={() => setOpen(false)}
    >
      <Command
        className="w-full max-w-lg overflow-hidden rounded-lg border border-stone-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <Command.Input
          value={query}
          onValueChange={setQuery}
          placeholder="Search reports… (name, category, description)"
          className="w-full border-b border-stone-200 px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
          aria-label="Report search"
        />
        <Command.List className="max-h-72 overflow-auto p-2">
          <Command.Empty className="px-3 py-6 text-center text-sm text-stone-500">
            No matching reports
          </Command.Empty>
          {results.map((r) => (
            <Command.Item
              key={r.id}
              value={`${r.name} ${r.category}`}
              onSelect={() => {
                setOpen(false);
                router.push(r.href);
              }}
              className="cursor-pointer rounded-md px-3 py-2 text-sm aria-selected:bg-emerald-50"
            >
              <div className="font-medium text-stone-900">{r.name}</div>
              <div className="text-xs text-stone-500">
                {r.category} · {r.description}
              </div>
            </Command.Item>
          ))}
        </Command.List>
        <div className="border-t border-stone-100 px-3 py-2 text-xs text-stone-400">
          Esc to close · Enter to open
        </div>
      </Command>
    </div>
  );
}
