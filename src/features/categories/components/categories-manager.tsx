"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Archive, ArchiveRestore, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { FormField, FormMessage, describedBy } from "@/components/forms/form-field";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { saveCategory, setCategoryArchived } from "../actions";
import { categorySchema, type Category, type CategoryInput } from "../schema";

const t = copy.settings.categories;

export function CategoriesManager({
  categories,
  canManage,
}: {
  categories: Category[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [renaming, setRenaming] = useState<Category | null>(null);

  function setArchived(category: Category, archived: boolean) {
    startTransition(async () => {
      const result = await setCategoryArchived(category.id, archived);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(archived ? t.archivedToast : t.restoredToast);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {canManage ? <AddCategoryForm key={categories.length} /> : null}

      <ul className="divide-y divide-border rounded-card border border-border bg-card">
        {categories.map((category) => {
          const archived = category.archivedAt !== null;
          return (
            <li key={category.id} className="flex min-h-14 items-center gap-3 px-4 py-2">
              <span
                className={cn(
                  "flex-1 font-medium",
                  archived && "text-muted-foreground line-through",
                )}
              >
                {category.name}
              </span>
              {category.isDefault ? <Badge variant="muted">{copy.common.default}</Badge> : null}
              {archived ? <Badge variant="muted">{copy.common.archived}</Badge> : null}
              {canManage ? (
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`${t.rename}: ${category.name}`}
                    onClick={() => setRenaming(category)}
                  >
                    <Pencil aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={pending}
                    aria-label={`${archived ? copy.common.restore : copy.common.archive}: ${category.name}`}
                    onClick={() => setArchived(category, !archived)}
                  >
                    {archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
                  </Button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      <Sheet open={renaming !== null} onOpenChange={(open) => !open && setRenaming(null)}>
        <SheetContent title={t.rename}>
          {renaming ? <RenameForm category={renaming} onDone={() => setRenaming(null)} /> : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function AddCategoryForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [id] = useState(() => crypto.randomUUID());
  const form = useForm<CategoryInput>({
    resolver: zodResolver(categorySchema),
    defaultValues: { id, name: "" },
  });
  const error = form.formState.errors.name?.message ?? formError ?? undefined;

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const result = await saveCategory("add", values);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      toast.success(t.added);
      // The parent re-keys this form on refresh, giving the next add a fresh id.
      router.refresh();
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <div className="flex-1">
        <FormField id="category-name" label={t.newLabel} error={error}>
          <Input
            id="category-name"
            placeholder={t.placeholder}
            autoComplete="off"
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy("category-name", error)}
            {...form.register("name")}
          />
        </FormField>
      </div>
      <Button type="submit" disabled={pending} className="sm:mt-6">
        <Plus aria-hidden />
        {t.add}
      </Button>
    </form>
  );
}

function RenameForm({ category, onDone }: { category: Category; onDone: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<CategoryInput>({
    resolver: zodResolver(categorySchema),
    defaultValues: { id: category.id, name: category.name },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const result = await saveCategory("rename", values);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      toast.success(copy.common.saved);
      onDone();
      router.refresh();
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {formError ? <FormMessage>{formError}</FormMessage> : null}
      <FormField id="rename-category" label={copy.people.fields.name} error={errors.name?.message}>
        <Input
          id="rename-category"
          autoComplete="off"
          aria-invalid={Boolean(errors.name)}
          aria-describedby={describedBy("rename-category", errors.name?.message)}
          {...form.register("name")}
        />
      </FormField>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? copy.common.saving : copy.common.save}
      </Button>
    </form>
  );
}
