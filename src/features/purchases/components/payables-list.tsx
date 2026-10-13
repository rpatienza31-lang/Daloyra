"use client";

import { useMemo } from "react";
import { DataTable } from "@/components/data-table/data-table";
import { copy } from "@/lib/copy";
import type { PurchaseSummary } from "../queries";
import { PurchaseCard, purchaseColumns } from "./purchase-columns";

/** The To Collect table (SPEC Section 10). */
export function PayablesList({
  purchases,
  currencyCode,
}: {
  purchases: PurchaseSummary[];
  currencyCode: string;
}) {
  const columns = useMemo(() => purchaseColumns(currencyCode, "payables"), [currencyCode]);
  return (
    <DataTable
      columns={columns}
      data={purchases}
      getRowId={(x) => x.id}
      searchPlaceholder={copy.purchases.searchPlaceholder}
      rowHref={(x) => `/purchases/${x.id}`}
      renderCard={(x) => <PurchaseCard purchase={x} currencyCode={currencyCode} showDue />}
    />
  );
}
