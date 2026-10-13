import { z } from "zod";
import { copy } from "@/lib/copy";

export const categorySchema = z.object({
  id: z.uuid(),
  name: z
    .string()
    .trim()
    .min(1, copy.settings.categories.nameRequired)
    .max(60, copy.validation.tooLong(60)),
});
export type CategoryInput = z.input<typeof categorySchema>;

export interface Category {
  id: string;
  name: string;
  isDefault: boolean;
  archivedAt: string | null;
}
