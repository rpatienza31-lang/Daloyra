import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { PurchaseForm } from "@/features/purchases/components/purchase-form";
import { listSupplierOptions } from "@/features/purchases/queries";
import { getCurrentBusiness } from "@/features/business/queries";
import { copy } from "@/lib/copy";
import { todayIn } from "@/lib/dates";
import { can } from "@/lib/permissions";

export const metadata: Metadata = { title: `${copy.purchases.newTitle} · ${copy.brand.name}` };

export default async function NewPurchasePage({ searchParams }: PageProps<"/purchases/new">) {
  const business = await getCurrentBusiness();
  if (!business) return null;
  const params = await searchParams;
  const suppliers = await listSupplierOptions(business.id);
  const preselected = suppliers.find((c) => c.id === params.supplier)?.id ?? "";

  return (
    <>
      <PageHeader title={copy.purchases.newTitle} />
      <PurchaseForm
        mode="create"
        currencyCode={business.currencyCode}
        suppliers={suppliers}
        canAddSupplier={can(business.role, "people.add")}
        defaults={{
          id: crypto.randomUUID(),
          supplierId: preselected,
          purchaseDate: todayIn(business.timezone),
          referenceNo: "",
          items: [{ description: "", quantity: "1", unitCost: "" }],
          discount: "",
          dueDate: "",
          notes: "",
          paid: "full",
          paidAmount: "",
          method: "cash",
        }}
      />
    </>
  );
}
