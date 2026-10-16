import { copy } from "@/lib/copy";
import { formatDate } from "@/lib/dates";
import { compareMoney, formatMoney, formatQuantity } from "@/lib/money";
import { paymentMethodLabel } from "@/lib/payment-methods";
import { cn } from "@/lib/utils";
import type { SaleItem, SalePayment, SaleSummary } from "../queries";

export const RECEIPT_SIZES = ["58", "80", "a4"] as const;
export type ReceiptSize = (typeof RECEIPT_SIZES)[number];

const r = copy.receipt;

/** Paper width on screen and in print; the thermal widths leave the printer's margins. */
const WIDTH: Record<ReceiptSize, string> = { "58": "48mm", "80": "72mm", a4: "180mm" };

export interface ReceiptBusiness {
  name: string;
  address: string | null;
  contactNumber: string | null;
  email: string | null;
  logoUrl: string | null;
  currencyCode: string;
}

/**
 * A sale as a receipt: a narrow thermal slip (58 or 80 mm) or a full page that can be saved
 * as a PDF. Every figure comes from the database; nothing is added up here.
 */
export function Receipt({
  size,
  business,
  sale,
  items,
  payments,
}: {
  size: ReceiptSize;
  business: ReceiptBusiness;
  sale: SaleSummary;
  items: SaleItem[];
  payments: SalePayment[];
}) {
  const money = (value: string) => formatMoney(value, business.currencyCode);
  const thermal = size !== "a4";
  const active = payments.filter((p) => p.voidedAt === null);
  const owes = compareMoney(sale.balance, "0") > 0;

  return (
    <article
      data-testid="receipt"
      style={{ width: WIDTH[size] }}
      className={cn(
        "mx-auto bg-white text-black",
        thermal ? "px-1 py-3 font-mono text-[11px] leading-snug" : "p-10 text-sm",
      )}
    >
      <style>{`@media print { @page { ${
        thermal ? `size: ${size}mm auto; margin: 0` : "size: A4; margin: 12mm"
      } } }`}</style>

      <header className={cn("text-center", thermal ? "mb-2" : "mb-6")}>
        {business.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed storage URL, printed as is
          <img
            src={business.logoUrl}
            alt=""
            className={cn("mx-auto mb-1 object-contain", thermal ? "h-10" : "h-16")}
          />
        ) : null}
        <p className={cn("font-bold", thermal ? "text-[13px]" : "text-xl")}>{business.name}</p>
        {business.address ? <p>{business.address}</p> : null}
        {business.contactNumber || business.email ? (
          <p>{[business.contactNumber, business.email].filter(Boolean).join(" · ")}</p>
        ) : null}
        <p className={cn("font-semibold uppercase", thermal ? "mt-2" : "mt-4 text-base")}>
          {r.heading}
        </p>
        {sale.voidedAt ? <p className="mt-1 font-bold">{r.voided}</p> : null}
      </header>

      <dl className={cn("grid grid-cols-[auto_1fr] gap-x-2", thermal ? "mb-2" : "mb-6")}>
        <dt>{r.reference}</dt>
        <dd className="text-right">{sale.referenceNo}</dd>
        <dt>{r.date}</dt>
        <dd className="text-right">{formatDate(sale.saleDate)}</dd>
        <dt>{r.customer}</dt>
        <dd className="text-right">{sale.customerName ?? copy.sales.walkIn}</dd>
      </dl>

      {thermal ? (
        <ul className="border-y border-dashed border-black py-1">
          {items.map((item, i) => (
            <li key={i} className="py-0.5">
              <p className="break-words">{item.description}</p>
              <p className="flex justify-between">
                <span>
                  {formatQuantity(item.quantity)} × {money(item.unitPrice)}
                </span>
                <span>{money(item.lineTotal)}</span>
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-black text-left">
              <th className="py-2">{r.item}</th>
              <th className="py-2 text-right">{r.qty}</th>
              <th className="py-2 text-right">{r.price}</th>
              <th className="py-2 text-right">{r.amount}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className="border-b border-black/20">
                <td className="py-2 pr-2">{item.description}</td>
                <td className="py-2 text-right">{formatQuantity(item.quantity)}</td>
                <td className="py-2 text-right">{money(item.unitPrice)}</td>
                <td className="py-2 text-right">{money(item.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <dl
        className={cn(
          "ml-auto grid grid-cols-[1fr_auto] gap-x-3 amount",
          thermal ? "mt-1" : "mt-4 w-72 gap-y-1",
        )}
      >
        {sale.discount !== "0.00" ? (
          <>
            <dt>{r.subtotal}</dt>
            <dd className="text-right">{money(sale.subtotal)}</dd>
            <dt>{r.discount}</dt>
            <dd className="text-right">−{money(sale.discount)}</dd>
          </>
        ) : null}
        <dt className={cn("font-bold", !thermal && "text-base")}>{r.total}</dt>
        <dd className={cn("text-right font-bold", !thermal && "text-base")}>{money(sale.total)}</dd>
        {active.map((p) => (
          <ReceiptPayment key={p.id} payment={p} money={money} />
        ))}
        {owes ? (
          <>
            <dt className="font-bold">{r.balance}</dt>
            <dd className="text-right font-bold">{money(sale.balance)}</dd>
            {sale.dueDate ? (
              <>
                <dt>{r.dueDate}</dt>
                <dd className="text-right">{formatDate(sale.dueDate)}</dd>
              </>
            ) : null}
          </>
        ) : null}
      </dl>

      <footer className={cn("text-center", thermal ? "mt-3" : "mt-10")}>
        <p className="font-semibold">{r.thanks}</p>
        <p className={cn("mt-1", thermal ? "text-[10px]" : "text-xs")}>{r.notOfficial}</p>
      </footer>
    </article>
  );
}

function ReceiptPayment({
  payment: p,
  money,
}: {
  payment: SalePayment;
  money: (value: string) => string;
}) {
  return (
    <>
      <dt>{r.paid(paymentMethodLabel(p.method))}</dt>
      <dd className="text-right">{money(p.amount)}</dd>
      {p.amountReceived && p.change ? (
        <>
          <dt>{r.cashReceived}</dt>
          <dd className="text-right">{money(p.amountReceived)}</dd>
          <dt className="font-bold">{r.change}</dt>
          <dd className="text-right font-bold">{money(p.change)}</dd>
        </>
      ) : null}
    </>
  );
}
