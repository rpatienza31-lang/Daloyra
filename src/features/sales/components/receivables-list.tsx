"use client";

import { useMemo } from "react";
import { DataTable } from "@/components/data-table/data-table";
import { copy } from "@/lib/copy";
import type { SaleSummary } from "../queries";
import { SaleCard, saleColumns } from "./sale-columns";

/** The To Collect table (SPEC Section 10). */
export function ReceivablesList({
  sales,
  currencyCode,
}: {
  sales: SaleSummary[];
  currencyCode: string;
}) {
  const columns = useMemo(() => saleColumns(currencyCode, "receivables"), [currencyCode]);
  return (
    <DataTable
      columns={columns}
      data={sales}
      getRowId={(x) => x.id}
      searchPlaceholder={copy.sales.searchPlaceholder}
      rowHref={(x) => `/sales/${x.id}`}
      renderCard={(x) => <SaleCard sale={x} currencyCode={currencyCode} showDue />}
    />
  );
}
