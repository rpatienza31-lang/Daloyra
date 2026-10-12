import type { Metadata } from "next";
import { CategoriesManager } from "@/features/categories/components/categories-manager";
import { listCategories } from "@/features/categories/queries";
import { getCurrentBusiness } from "@/features/business/queries";
import { copy } from "@/lib/copy";
import { can } from "@/lib/permissions";

export const metadata: Metadata = {
  title: `${copy.settings.categories.title} · ${copy.brand.name}`,
};

export default async function CategoriesPage() {
  const business = await getCurrentBusiness();
  if (!business) return null;
  const categories = await listCategories(business.id);
  const t = copy.settings.categories;

  return (
    <section>
      <h2 className="text-lg font-semibold">{t.title}</h2>
      <p className="mt-1 mb-5 text-sm text-muted-foreground">{t.subtitle}</p>
      <CategoriesManager
        categories={categories}
        canManage={can(business.role, "categories.manage")}
      />
    </section>
  );
}
