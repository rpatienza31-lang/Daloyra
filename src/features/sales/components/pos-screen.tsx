"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  FileText,
  Minus,
  PackagePlus,
  Plus,
  Printer,
  Search,
  ShoppingCart,
  Trash2,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select-native";
import { FormField, FormMessage, describedBy } from "@/components/forms/form-field";
import { CashReceived } from "@/components/money/cash-received";
import { MethodChips } from "@/components/money/method-chips";
import { PersonFormSheet } from "@/features/people/components/person-form-sheet";
import type { ProductOption } from "@/features/products/schema";
import { copy } from "@/lib/copy";
import {
  addQuantity,
  compareMoney,
  formatMoney,
  parseMoneyInput,
  parseQuantityInput,
  subtractMoney,
} from "@/lib/money";
import type { PaymentMethod } from "@/lib/payment-methods";
import { cn } from "@/lib/utils";
import { createSale } from "../actions";
import {
  PAID_OPTIONS,
  createSaleSchema,
  previewTotals,
  type CreateSaleInput,
  type PaidOption,
} from "../schema";

const p = copy.pos;
const s = copy.sales;

interface CartLine {
  key: string;
  productId: string;
  description: string;
  quantity: string;
  unitPrice: string;
}

interface Done {
  saleId: string;
  total: string;
  change: string | null;
}

interface Props {
  products: ProductOption[];
  customers: { id: string; name: string }[];
  currencyCode: string;
  today: string;
  canAddCustomer: boolean;
}

/**
 * The POS sale screen (Phase 10, D66): product tiles and a cart, then the payment with cash
 * received and change. It saves through the same createSale action and database function as
 * the regular sale form; every figure shown before saving is a preview.
 */
export function PosScreen({
  products,
  customers: initialCustomers,
  currencyCode,
  today,
  canAddCustomer,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saleId, setSaleId] = useState(() => crypto.randomUUID());
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState("");
  const [paid, setPaid] = useState<PaidOption>("full");
  const [paidAmount, setPaidAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [amountReceived, setAmountReceived] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [customers, setCustomers] = useState(initialCustomers);
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const money = (value: string) => formatMoney(value, currencyCode);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? products.filter((x) => x.name.toLowerCase().includes(q)) : products;
  }, [products, query]);

  const items = cart.map(({ productId, description, quantity, unitPrice }) => ({
    productId,
    description,
    quantity,
    unitPrice,
  }));
  const totals = previewTotals(items, discount);
  const paying = paid === "full" ? (totals?.total ?? null) : parseMoneyInput(paidAmount);
  const inCart = (productId: string) =>
    cart
      .filter((l) => l.productId === productId)
      .reduce((sum, l) => addQuantity(sum, parseQuantityInput(l.quantity) ?? "0"), "0");

  function addProduct(product: ProductOption) {
    setCart((lines) => {
      const existing = lines.find((l) => l.productId === product.id);
      if (existing) {
        return lines.map((l) =>
          l === existing
            ? { ...l, quantity: addQuantity(parseQuantityInput(l.quantity) ?? "0", "1") }
            : l,
        );
      }
      return [
        ...lines,
        {
          key: crypto.randomUUID(),
          productId: product.id,
          description: product.name,
          quantity: "1",
          unitPrice: product.sellingPrice,
        },
      ];
    });
  }

  function addOther() {
    setCart((lines) => [
      ...lines,
      { key: crypto.randomUUID(), productId: "", description: "", quantity: "1", unitPrice: "" },
    ]);
  }

  function update(key: string, change: Partial<CartLine>) {
    setCart((lines) => lines.map((l) => (l.key === key ? { ...l, ...change } : l)));
  }

  function step(line: CartLine, by: "1" | "-1") {
    const next = addQuantity(parseQuantityInput(line.quantity) ?? "1", by);
    if (compareMoney(next, "0") <= 0) return;
    update(line.key, { quantity: next });
  }

  function reset() {
    setSaleId(crypto.randomUUID());
    setCart([]);
    setDiscount("");
    setPaid("full");
    setPaidAmount("");
    setMethod("cash");
    setAmountReceived("");
    setCustomerId("");
    setDueDate("");
    setErrors({});
    setFormError(null);
    setDone(null);
    setQuery("");
  }

  function charge() {
    setFormError(null);
    const input: CreateSaleInput = {
      id: saleId,
      customerId,
      saleDate: today,
      referenceNo: "",
      items,
      discount,
      dueDate: paid === "full" ? "" : dueDate,
      notes: "",
      paid,
      paidAmount,
      method,
      amountReceived: method === "cash" ? amountReceived : "",
    };
    const parsed = createSaleSchema.safeParse(input);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".");
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      setFormError(parsed.error.issues[0]?.message ?? copy.common.unexpectedError);
      return;
    }
    setErrors({});
    // Shown on the done screen; the database saves the same figure on the payment.
    const received = parseMoneyInput(amountReceived);
    const change =
      method === "cash" &&
      paid !== "none" &&
      paying &&
      received &&
      compareMoney(received, paying) >= 0
        ? subtractMoney(received, paying)
        : null;
    startTransition(async () => {
      const result = await createSale(input);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      setDone({ saleId, total: totals?.total ?? "0.00", change });
      router.refresh();
    });
  }

  if (done) {
    return (
      <section
        aria-labelledby="pos-done"
        className="mx-auto flex max-w-md flex-col items-center gap-5 rounded-card border border-border bg-card p-8 text-center shadow-soft"
      >
        <CheckCircle2 aria-hidden className="size-14 text-money-in" />
        <div>
          <h2 id="pos-done" className="text-2xl font-bold">
            {p.doneTitle}
          </h2>
        </div>
        <dl className="grid w-full grid-cols-2 gap-4">
          <div className="rounded-card bg-muted/50 p-4">
            <dt className="text-sm text-muted-foreground">{p.total}</dt>
            <dd className="text-xl font-bold amount">{money(done.total)}</dd>
          </div>
          <div className="rounded-card bg-profit-tint p-4">
            <dt className="text-sm text-muted-foreground">{p.change}</dt>
            <dd data-testid="done-change" className="text-xl font-bold text-money-in amount">
              {done.change ? money(done.change) : "—"}
            </dd>
          </div>
        </dl>
        <div className="flex w-full flex-col gap-2">
          <Button asChild size="lg">
            <Link href={`/receipts/${done.saleId}?size=58`} target="_blank">
              <Printer aria-hidden />
              {p.receiptSmall}
            </Link>
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button asChild variant="outline">
              <Link href={`/receipts/${done.saleId}?size=a4`} target="_blank">
                <FileText aria-hidden />
                {p.receiptFull}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/sales/${done.saleId}`}>{p.viewSale}</Link>
            </Button>
          </div>
          <Button variant="secondary" size="lg" onClick={reset}>
            <Plus aria-hidden />
            {p.newSale}
          </Button>
        </div>
      </section>
    );
  }

  const count = cart.length;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_400px] lg:items-start">
      {/* Products */}
      <section aria-label={copy.products.title} className="flex flex-col gap-4">
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            aria-label={p.search}
            placeholder={p.search}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-9"
          />
        </div>
        {products.length === 0 ? (
          <p className="rounded-card border border-dashed border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
            {p.noProducts}
          </p>
        ) : shown.length === 0 ? (
          <p className="text-sm text-muted-foreground">{p.noMatch}</p>
        ) : null}
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {shown.map((product) => {
            const qty = inCart(product.id);
            const left = addQuantity(product.onHand, `-${qty}`);
            const out = compareMoney(left, "0") <= 0;
            return (
              <li key={product.id}>
                <button
                  type="button"
                  onClick={() => addProduct(product)}
                  className={cn(
                    "relative flex h-full min-h-28 w-full flex-col justify-between gap-2 rounded-card border bg-card p-3 text-left shadow-soft transition hover:border-primary/60 hover:bg-primary/5 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none active:scale-[0.98]",
                    qty !== "0" ? "border-primary ring-1 ring-primary" : "border-border",
                  )}
                >
                  <span className="line-clamp-2 font-medium">{product.name}</span>
                  <span className="flex items-end justify-between gap-2">
                    <span className="text-lg font-bold text-sales-ink amount">
                      {money(product.sellingPrice)}
                    </span>
                    <span
                      className={cn(
                        "text-xs font-medium whitespace-nowrap amount",
                        out ? "text-warning-ink" : "text-muted-foreground",
                      )}
                    >
                      {p.stock(product.onHand, product.unit)}
                    </span>
                  </span>
                  {qty !== "0" ? (
                    <span className="absolute -top-2 -right-2 flex min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground amount">
                      {qty}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={addOther}
              className="flex h-full min-h-28 w-full flex-col items-start justify-between gap-2 rounded-card border border-dashed border-border bg-card/60 p-3 text-left hover:border-primary/60 hover:bg-primary/5 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <PackagePlus aria-hidden className="size-5 text-primary" />
              <span>
                <span className="block font-medium">{p.otherItem}</span>
                <span className="block text-xs text-muted-foreground">{p.otherItemHint}</span>
              </span>
            </button>
          </li>
        </ul>
      </section>

      {/* Cart and payment */}
      <section
        id="cart"
        aria-labelledby="cart-heading"
        className="flex scroll-mt-6 flex-col gap-4 rounded-card border border-border bg-card p-4 shadow-soft lg:sticky lg:top-6"
      >
        <div className="flex items-center justify-between">
          <h2 id="cart-heading" className="flex items-center gap-2 text-lg font-semibold">
            <ShoppingCart aria-hidden className="size-5" />
            {p.cart}
          </h2>
          {count > 0 ? (
            <button
              type="button"
              onClick={() => setCart([])}
              className="min-h-11 text-sm font-medium text-muted-foreground hover:text-destructive"
            >
              {p.clear}
            </button>
          ) : null}
        </div>

        {formError ? <FormMessage>{formError}</FormMessage> : null}

        {count === 0 ? (
          <p className="rounded-card bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
            {p.cartEmpty}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {cart.map((line, index) => {
              const name = line.description || p.otherItem;
              const lineTotal = totals?.lines[index];
              const qtyError = errors[`items.${index}.quantity`];
              const priceError = errors[`items.${index}.unitPrice`];
              return (
                <li key={line.key} className="flex flex-col gap-2 py-3">
                  <div className="flex items-start justify-between gap-2">
                    {line.productId ? (
                      <p className="font-medium">{line.description}</p>
                    ) : (
                      <Input
                        aria-label={p.itemName}
                        placeholder={p.itemName}
                        value={line.description}
                        onChange={(event) => update(line.key, { description: event.target.value })}
                        className="h-10"
                      />
                    )}
                    <button
                      type="button"
                      aria-label={p.remove(name)}
                      onClick={() => setCart((lines) => lines.filter((l) => l.key !== line.key))}
                      className="flex size-11 shrink-0 items-center justify-center rounded-control text-muted-foreground hover:bg-muted hover:text-destructive"
                    >
                      <Trash2 aria-hidden className="size-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center rounded-control border border-border">
                      <button
                        type="button"
                        aria-label={p.less(name)}
                        onClick={() => step(line, "-1")}
                        className="flex size-11 items-center justify-center hover:bg-muted"
                      >
                        <Minus aria-hidden className="size-4" />
                      </button>
                      <input
                        aria-label={`${s.quantity} ${name}`}
                        inputMode="decimal"
                        value={line.quantity}
                        onChange={(event) => update(line.key, { quantity: event.target.value })}
                        aria-invalid={Boolean(qtyError)}
                        className="h-11 w-14 border-x border-border bg-transparent text-center font-semibold amount outline-none focus-visible:bg-muted/50"
                      />
                      <button
                        type="button"
                        aria-label={p.more(name)}
                        onClick={() => step(line, "1")}
                        className="flex size-11 items-center justify-center hover:bg-muted"
                      >
                        <Plus aria-hidden className="size-4" />
                      </button>
                    </div>
                    <span className="text-sm text-muted-foreground">×</span>
                    <Input
                      aria-label={`${s.unitPrice} ${name}`}
                      inputMode="decimal"
                      placeholder="0.00"
                      value={line.unitPrice}
                      onChange={(event) => update(line.key, { unitPrice: event.target.value })}
                      aria-invalid={Boolean(priceError)}
                      className="h-11 w-24 amount"
                    />
                    <span className="ml-auto font-semibold amount">
                      {lineTotal ? money(lineTotal) : "—"}
                    </span>
                  </div>
                  {qtyError || priceError ? (
                    <p className="text-sm text-destructive">{qtyError ?? priceError}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex flex-col gap-1 border-t border-border pt-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="pos-discount" className="text-muted-foreground">
              {s.discount}
            </label>
            <Input
              id="pos-discount"
              inputMode="decimal"
              placeholder="0.00"
              value={discount}
              onChange={(event) => setDiscount(event.target.value)}
              aria-invalid={Boolean(errors.discount)}
              aria-describedby={describedBy("pos-discount", errors.discount)}
              className="h-10 w-28 text-right amount"
            />
          </div>
          {errors.discount ? (
            <p id="pos-discount-error" className="text-right text-sm text-destructive">
              {errors.discount}
            </p>
          ) : null}
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-base font-semibold">{s.total}</span>
            <span data-testid="pos-total" className="text-3xl font-bold amount">
              {money(totals?.total ?? "0.00")}
            </span>
          </div>
          {errors.total ? <p className="text-sm text-destructive">{errors.total}</p> : null}
        </div>

        <fieldset className="flex flex-col gap-3">
          <legend className="sr-only">{s.didTheyPay}</legend>
          <div
            role="radiogroup"
            aria-label={s.didTheyPay}
            className="grid grid-cols-3 gap-1 rounded-control border border-border bg-background p-1"
          >
            {PAID_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={paid === option}
                onClick={() => setPaid(option)}
                className={cn(
                  "min-h-11 rounded-[8px] px-2 text-sm font-medium focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                  paid === option
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {option === "full" ? s.paidFull : option === "part" ? s.paidPart : s.paidNone}
              </button>
            ))}
          </div>

          {paid === "part" ? (
            <FormField id="pos-paid" label={s.amountReceived} error={errors.paidAmount}>
              <Input
                id="pos-paid"
                inputMode="decimal"
                placeholder="0.00"
                value={paidAmount}
                onChange={(event) => setPaidAmount(event.target.value)}
                aria-invalid={Boolean(errors.paidAmount)}
                aria-describedby={describedBy("pos-paid", errors.paidAmount)}
                className="amount"
              />
            </FormField>
          ) : null}

          {paid !== "none" ? (
            <MethodChips id="pos-method" label={s.howPaid} value={method} onChange={setMethod} />
          ) : null}

          {paid !== "none" && method === "cash" ? (
            <CashReceived
              id="pos-received"
              value={amountReceived}
              onChange={setAmountReceived}
              paying={paying}
              currencyCode={currencyCode}
              error={errors.amountReceived}
            />
          ) : null}

          {paid !== "full" ? (
            <>
              <FormField id="pos-customer" label={s.customer} error={errors.customerId}>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <NativeSelect
                      id="pos-customer"
                      value={customerId}
                      onChange={(event) => setCustomerId(event.target.value)}
                      aria-invalid={Boolean(errors.customerId)}
                      aria-describedby={describedBy("pos-customer", errors.customerId)}
                    >
                      <option value="">{s.walkIn}</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                  {canAddCustomer ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={s.newCustomer}
                      onClick={() => setAddingCustomer(true)}
                    >
                      <UserPlus aria-hidden />
                    </Button>
                  ) : null}
                </div>
              </FormField>
              <FormField id="pos-due" label={s.dueDate} optional error={errors.dueDate}>
                <Input
                  id="pos-due"
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                />
              </FormField>
            </>
          ) : null}
        </fieldset>

        <Button
          type="button"
          size="lg"
          disabled={pending || count === 0}
          onClick={charge}
          className="h-14 text-lg"
        >
          {pending ? copy.common.saving : p.charge(money(totals?.total ?? "0.00"))}
        </Button>
      </section>

      {count > 0 ? (
        <a
          href="#cart"
          className="fixed inset-x-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 flex min-h-12 items-center justify-center rounded-full bg-primary px-5 text-base font-semibold text-primary-foreground shadow-lg md:bottom-4 lg:hidden"
        >
          {p.viewCart(count, money(totals?.total ?? "0.00"))}
        </a>
      ) : null}

      {canAddCustomer ? (
        <PersonFormSheet
          kind="customer"
          open={addingCustomer}
          onOpenChange={setAddingCustomer}
          onSaved={(person) => {
            setCustomers((list) => [...list, person].sort((a, b) => a.name.localeCompare(b.name)));
            setCustomerId(person.id);
          }}
        />
      ) : null}
    </div>
  );
}
