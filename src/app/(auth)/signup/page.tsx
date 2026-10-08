import type { Metadata } from "next";
import { SignUpForm } from "@/features/auth/components/signup-form";
import { copy } from "@/lib/copy";

export const metadata: Metadata = { title: `${copy.auth.signup.title} · ${copy.brand.name}` };

export default function SignUpPage() {
  return <SignUpForm />;
}
