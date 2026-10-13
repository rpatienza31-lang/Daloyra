import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { PurchaseForm } from "@/features/purchases/components/purchase-form";
import { getPurchase, listSupplierOptions } from "@/features/purchases/queries";
import { getCurrentBusiness } from "@/features/business/queries";
import { copy } from "@/lib/copy";
import { formatQuantity } from "@/lib/money";
import { can } from "@/lib/permissions";
import { isUuid } from "@/lib/uuid";

export const metadata: Metadata = { title: `${copy.purchases.editTitle} · ${copy.brand.name}` };

export default async function EditPurchasePage({ params }: PageProps<"/purchases/[id]/edit">) {
  const { id } = await params;
  const business = await getCurrentBusiness();
  if (!business || !isUuid(id)) notFound();
  if (!can(business.role, "money.edit")) redirect(`/purchases/${id}`);

  const [found, suppliers] = await Promise.all([
    getPurchase(business.id, id),
    listSupplierOptions(business.id),
  ]);
  if (!found) notFound();
  const { purchase, items } = found;
  if (purchase.voidedAt) redirect(`/purchases/${id}`);

  // Keep the purchase's current supplier selectable even if it was archived since.
  const options =
    purchase.supplierId && !suppliers.some((c) => c.id === purchase.supplierId)
      ? [...suppliers, { id: purchase.supplierId, name: purchase.supplierName ?? "" }]
      : suppliers;

  return (
    <>
      <PageHeader title={`${copy.purchases.editTitle} ${purchase.referenceNo}`} />
      <PurchaseForm
        mode="edit"
        currencyCode={business.currencyCode}
        suppliers={options}
        canAddSupplier={can(business.role, "people.add")}
        defaults={{
          id: purchase.id,
          supplierId: purchase.supplierId ?? "",
          purchaseDate: purchase.purchaseDate,
          referenceNo: purchase.referenceNo,
          items: items.map((i) => ({
            description: i.description,
            quantity: formatQuantity(i.quantity),
            unitCost: i.unitCost,
          })),
          discount: purchase.discount === "0.00" ? "" : purchase.discount,
          dueDate: purchase.dueDate ?? "",
          notes: purchase.notes ?? "",
          paid: "full",
          paidAmount: "",
          method: "cash",
        }}
      />
    </>
  );
}
