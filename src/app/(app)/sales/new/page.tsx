import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { SaleForm } from "@/features/sales/components/sale-form";
import { listCustomerOptions } from "@/features/sales/queries";
import { getCurrentBusiness } from "@/features/business/queries";
import { listProductOptions } from "@/features/products/queries";
import { copy } from "@/lib/copy";
import { todayIn } from "@/lib/dates";
import { can } from "@/lib/permissions";

export const metadata: Metadata = { title: `${copy.sales.newTitle} · ${copy.brand.name}` };

export default async function NewSalePage({ searchParams }: PageProps<"/sales/new">) {
  const business = await getCurrentBusiness();
  if (!business) return null;
  const params = await searchParams;
  const [customers, products] = await Promise.all([
    listCustomerOptions(business.id),
    listProductOptions(business.id),
  ]);
  const preselected = customers.find((c) => c.id === params.customer)?.id ?? "";

  return (
    <>
      <PageHeader title={copy.sales.newTitle} />
      <SaleForm
        mode="create"
        currencyCode={business.currencyCode}
        customers={customers}
        products={products}
        canAddCustomer={can(business.role, "people.add")}
        defaults={{
          id: crypto.randomUUID(),
          customerId: preselected,
          saleDate: todayIn(business.timezone),
          referenceNo: "",
          items: [{ productId: "", description: "", quantity: "1", unitPrice: "" }],
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
