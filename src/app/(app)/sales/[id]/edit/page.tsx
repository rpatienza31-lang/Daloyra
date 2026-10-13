import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { SaleForm } from "@/features/sales/components/sale-form";
import { getSale, listCustomerOptions } from "@/features/sales/queries";
import { getCurrentBusiness } from "@/features/business/queries";
import { copy } from "@/lib/copy";
import { formatQuantity } from "@/lib/money";
import { can } from "@/lib/permissions";
import { isUuid } from "@/lib/uuid";

export const metadata: Metadata = { title: `${copy.sales.editTitle} · ${copy.brand.name}` };

export default async function EditSalePage({ params }: PageProps<"/sales/[id]/edit">) {
  const { id } = await params;
  const business = await getCurrentBusiness();
  if (!business || !isUuid(id)) notFound();
  if (!can(business.role, "money.edit")) redirect(`/sales/${id}`);

  const [found, customers] = await Promise.all([
    getSale(business.id, id),
    listCustomerOptions(business.id),
  ]);
  if (!found) notFound();
  const { sale, items } = found;
  if (sale.voidedAt) redirect(`/sales/${id}`);

  // Keep the sale's current customer selectable even if it was archived since.
  const options =
    sale.customerId && !customers.some((c) => c.id === sale.customerId)
      ? [...customers, { id: sale.customerId, name: sale.customerName ?? "" }]
      : customers;

  return (
    <>
      <PageHeader title={`${copy.sales.editTitle} ${sale.referenceNo}`} />
      <SaleForm
        mode="edit"
        currencyCode={business.currencyCode}
        customers={options}
        canAddCustomer={can(business.role, "people.add")}
        defaults={{
          id: sale.id,
          customerId: sale.customerId ?? "",
          saleDate: sale.saleDate,
          referenceNo: sale.referenceNo,
          items: items.map((i) => ({
            description: i.description,
            quantity: formatQuantity(i.quantity),
            unitPrice: i.unitPrice,
          })),
          discount: sale.discount === "0.00" ? "" : sale.discount,
          dueDate: sale.dueDate ?? "",
          notes: sale.notes ?? "",
          paid: "full",
          paidAmount: "",
          method: "cash",
        }}
      />
    </>
  );
}
