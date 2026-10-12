import { z } from "zod";
import { copy } from "@/lib/copy";

export const profileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, copy.validation.nameRequired)
    .max(120, copy.validation.nameTooLong),
});
export type ProfileInput = z.infer<typeof profileSchema>;
