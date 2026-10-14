"use client";

import { NativeSelect } from "@/components/ui/select-native";
import { copy } from "@/lib/copy";
import type { ProductOption } from "../schema";

/**
 * Picks a product for a sale or purchase line, or "Type your own" for a free-text line.
 * The form decides what to fill in when a product is chosen.
 */
export function ProductSelect({
  id,
  products,
  value,
  onChange,
}: {
  id: string;
  products: ProductOption[];
  value: string;
  onChange: (product: ProductOption | null) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {copy.products.picker.label}
      </label>
      <NativeSelect
        id={id}
        value={value}
        onChange={(event) => onChange(products.find((p) => p.id === event.target.value) ?? null)}
      >
        <option value="">{copy.products.picker.none}</option>
        {products.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}
