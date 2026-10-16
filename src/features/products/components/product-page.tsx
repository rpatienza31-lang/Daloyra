import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, History } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { InfoTip } from "@/components/ui/info-tip";
import { getCurrentBusiness } from "@/features/business/queries";
import { copy } from "@/lib/copy";
import { formatDate, todayIn } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { isUuid } from "@/lib/uuid";
import { getProduct, listStockMovements } from "../queries";
import type { StockMovement } from "../schema";
import { ProductActions } from "./product-actions";
import { StockBadge } from "./stock-badge";
import { VoidAdjustmentButton } from "./void-adjustment-button";

const t = copy.products;

/** Server side of /products/[id]. */
export async function ProductPage({ id }: { id: string }) {
  const business = await getCurrentBusiness();
  if (!business || !isUuid(id)) notFound();
  const product = await getProduct(business.id, id);
  if (!product) notFound();
  const canManage = can(business.role, "products.manage");
  const movements = canManage ? await listStockMovements(business.id, id) : [];
  const money = (value: string) => formatMoney(value, business.currencyCode);
  const today = todayIn(business.timezone);

  const figures = [
    { label: t.columns.inStock, value: <StockBadge onHand={product.onHand} unit={product.unit} /> },
    { label: t.fields.sellingPrice, value: money(product.sellingPrice) },
    ...(canManage
      ? [
          {
            label: t.currentCost,
            tip: t.currentCostHint,
            value: money(product.currentCost),
          },
          {
            label: t.margin,
            value: (
              <span className={cn(product.unitProfit.startsWith("-") && "text-money-out")}>
                {money(product.unitProfit)}
              </span>
            ),
          },
          { label: t.columns.received, value: `${product.received} ${product.unit}` },
          { label: t.columns.sold, value: `${product.sold} ${product.unit}` },
          {
            label: t.columns.adjusted,
            value: product.adjusted === "0" ? "—" : `${product.adjusted} ${product.unit}`,
          },
          { label: t.columns.costReceived, value: money(product.costReceived) },
          {
            label: t.columns.averageCost,
            value: product.averageCost ? money(product.averageCost) : "—",
          },
        ]
      : []),
    { label: t.columns.currentValue, value: money(product.currentValue) },
  ];

  return (
    <>
      <Link
        href="/products"
        className="mb-4 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary hover:underline"
      >
        <ChevronLeft aria-hidden className="size-4" />
        {t.back}
      </Link>
      <PageHeader
        title={product.name}
        actions={canManage ? <ProductActions product={product} today={today} /> : null}
      />
      {product.archivedAt ? (
        <Badge variant="muted" className="-mt-3 mb-6">
          {copy.common.archived}
        </Badge>
      ) : null}

      <dl
        data-testid="product-figures"
        className="mb-6 grid grid-cols-2 gap-4 rounded-card border border-border bg-card p-5 shadow-soft sm:grid-cols-4"
      >
        {figures.map((f) => (
          <div key={f.label}>
            <dt className="flex items-center gap-1 text-sm text-muted-foreground">
              {f.label}
              {"tip" in f && f.tip ? <InfoTip label={f.label}>{f.tip}</InfoTip> : null}
            </dt>
            <dd className="mt-1 text-lg font-semibold amount">{f.value}</dd>
          </div>
        ))}
      </dl>

      {canManage ? (
        <section aria-labelledby="stock-history">
          <h2 id="stock-history" className="mb-3 text-lg font-semibold">
            {t.history}
          </h2>
          {movements.length === 0 ? (
            <EmptyState icon={History} title={t.history} body={t.historyEmpty} />
          ) : (
            <ul className="flex flex-col gap-2">
              {movements.map((m) => (
                <MovementRow
                  key={`${m.kind}-${m.id}`}
                  movement={m}
                  productId={product.id}
                  unit={product.unit}
                  money={money}
                />
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </>
  );
}

function MovementRow({
  movement: m,
  productId,
  unit,
  money,
}: {
  movement: StockMovement;
  productId: string;
  unit: string;
  money: (value: string) => string;
}) {
  const title =
    m.kind === "adjustment"
      ? (t.reasons[m.reason ?? ""] ?? t.movement.adjustment)
      : `${t.movement[m.kind]} ${m.reference ?? ""}`;
  const href =
    m.kind === "sale"
      ? `/sales/${m.documentId}`
      : m.kind === "purchase"
        ? `/purchases/${m.documentId}`
        : null;
  const positive = !m.quantity.startsWith("-");

  const body = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className={cn("font-medium", m.voided && "line-through")}>{title}</p>
        <p className="text-sm text-muted-foreground">
          {formatDate(m.date)}
          {m.unitAmount ? ` · ${money(m.unitAmount)}` : ""}
          {m.voided ? ` · ${t.voided}` : ""}
        </p>
        {m.notes ? <p className="text-sm break-words text-muted-foreground">{m.notes}</p> : null}
      </div>
      <p
        className={cn(
          "shrink-0 font-semibold amount",
          m.voided
            ? "text-muted-foreground line-through"
            : positive
              ? "text-money-in"
              : "text-money-out",
        )}
      >
        {positive ? "+" : ""}
        {m.quantity} {unit}
      </p>
    </div>
  );

  return (
    <li className="rounded-card border border-border bg-card">
      {href ? (
        <Link
          href={href}
          className="block min-h-11 rounded-card px-4 py-3 hover:bg-muted/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {body}
        </Link>
      ) : (
        <div className="px-4 py-3">
          {body}
          {m.voided ? null : (
            <VoidAdjustmentButton
              productId={productId}
              entryId={m.id}
              summary={`${title}: ${m.quantity} ${unit}, ${formatDate(m.date)}`}
            />
          )}
        </div>
      )}
    </li>
  );
}
