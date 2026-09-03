"use client";

import { useEffect } from "react";

export function PrintAutoTrigger() {
  useEffect(() => {
    const t = window.setTimeout(() => window.print(), 300);
    return () => window.clearTimeout(t);
  }, []);
  return null;
}
