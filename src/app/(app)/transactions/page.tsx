import type { Metadata } from "next";
import { getCurrentBusiness, hasMoneyRecords } from "@/features/business/queries";
import { TransactionsList } from "@/features/transactions/components/transactions-list";
import {
  TRANSACTIONS_LIMIT,
  listPartyOptions,
  listTransactions,
} from "@/features/transactions/queries";
import { parseTransactionFilters } from "@/features/transactions/schema";
import { getUserId } from "@/lib/auth";
import { copy } from "@/lib/copy";
import { can } from "@/lib/permissions";

export const metadata: Metadata = { title: `${copy.transactions.title} · ${copy.brand.name}` };

export default async function TransactionsPage({ searchParams }: PageProps<"/transactions">) {
  const business = await getCurrentBusiness();
  if (!business) return null;
  const filters = parseTransactionFilters(await searchParams);
  // Staff see only their own entries (SPEC 8).
  const createdBy = can(business.role, "dashboard.viewTotals")
    ? undefined
    : ((await getUserId()) ?? undefined);

  const [transactions, parties, hasAny] = await Promise.all([
    listTransactions(business.id, filters, { createdBy }),
    listPartyOptions(business.id),
    hasMoneyRecords(business.id),
  ]);

  return (
    <TransactionsList
      transactions={transactions}
      filters={filters}
      parties={parties}
      currencyCode={business.currencyCode}
      hasAny={hasAny}
      capped={transactions.length >= TRANSACTIONS_LIMIT ? TRANSACTIONS_LIMIT : null}
    />
  );
}
