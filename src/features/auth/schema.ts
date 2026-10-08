import { z } from "zod";
import { copy } from "@/lib/copy";

/** Shared by the forms (client) and the Server Actions (server). */

const v = copy.validation;

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, v.emailInvalid)
  .pipe(z.email({ error: v.emailInvalid }));

// Supabase Auth hashes with bcrypt, which only uses the first 72 bytes.
const newPassword = z.string().min(8, v.passwordTooShort).max(72, v.passwordTooLong);

export const signUpSchema = z.object({
  fullName: z.string().trim().min(1, v.nameRequired).max(120, v.nameTooLong),
  email,
  password: newPassword,
});
export type SignUpInput = z.infer<typeof signUpSchema>;

export const logInSchema = z.object({
  email,
  password: z.string().min(1, v.passwordRequired).max(72, v.passwordTooLong),
});
export type LogInInput = z.infer<typeof logInSchema>;

export const emailOnlySchema = z.object({ email });
export type EmailOnlyInput = z.infer<typeof emailOnlySchema>;

export const resetPasswordSchema = z
  .object({ password: newPassword, confirmPassword: z.string() })
  .refine((data) => data.password === data.confirmPassword, {
    message: v.passwordsDontMatch,
    path: ["confirmPassword"],
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
