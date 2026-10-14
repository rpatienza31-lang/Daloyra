import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Receipt, RECEIPT_SIZES, type ReceiptSize } from "@/features/sales/components/receipt";
import { ReceiptToolbar } from "@/features/sales/components/receipt-toolbar";
import { getSale } from "@/features/sales/queries";
import { getBusinessSettings, getCurrentBusiness, getLogoUrl } from "@/features/business/queries";
import { copy } from "@/lib/copy";
import { isUuid } from "@/lib/uuid";

export const metadata: Metadata = { title: `${copy.receipt.title} · ${copy.brand.name}` };

/**
 * A printable receipt for one sale (Phase 10), outside the app frame so only the receipt
 * prints. Row Level Security decides who may see the sale, as on the sale page.
 */
export default async function ReceiptPage({ params, searchParams }: PageProps<"/receipts/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  const business = await getCurrentBusiness();
  if (!business || !isUuid(id)) notFound();
  const size: ReceiptSize = RECEIPT_SIZES.find((s) => s === query.size) ?? "58";

  const [found, settings] = await Promise.all([
    getSale(business.id, id),
    getBusinessSettings(business.id),
  ]);
  if (!found || !settings) notFound();
  const logoUrl = await getLogoUrl(settings.logoPath);

  return (
    <main className="min-h-full bg-background py-6 print:bg-white print:py-0">
      <ReceiptToolbar saleId={id} size={size} />
      <div className="px-4 print:px-0">
        <div className="mx-auto w-fit max-w-full overflow-x-auto shadow-soft ring-1 ring-border print:shadow-none print:ring-0">
          <Receipt
            size={size}
            business={{
              name: settings.name,
              address: settings.address,
              contactNumber: settings.contactNumber,
              email: settings.email,
              logoUrl,
              currencyCode: settings.currencyCode,
            }}
            sale={found.sale}
            items={found.items}
            payments={found.payments}
          />
        </div>
      </div>
    </main>
  );
}
