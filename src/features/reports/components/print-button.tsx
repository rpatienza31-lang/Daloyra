"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";

export function PrintButton() {
  return (
    <Button variant="outline" onClick={() => window.print()}>
      <Printer aria-hidden />
      {copy.reports.print}
    </Button>
  );
}
