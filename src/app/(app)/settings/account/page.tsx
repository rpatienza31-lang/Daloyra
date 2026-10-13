import type { Metadata } from "next";
import { ChangePasswordForm, ProfileForm } from "@/features/account/components/account-forms";
import { createClient } from "@/lib/supabase/server";
import { requireUserId } from "@/lib/auth";
import { copy } from "@/lib/copy";

export const metadata: Metadata = { title: `${copy.settings.account.title} · ${copy.brand.name}` };

export default async function AccountSettingsPage() {
  const userId = await requireUserId();
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", userId)
    .maybeSingle();
  const t = copy.settings.account;

  return (
    <div className="flex max-w-xl flex-col gap-10">
      <section>
        <h2 className="text-lg font-semibold">{t.title}</h2>
        <p className="mt-1 mb-5 text-sm text-muted-foreground">{t.subtitle}</p>
        <ProfileForm fullName={data?.full_name ?? ""} email={data?.email ?? ""} />
      </section>
      <section>
        <h2 className="mb-5 text-lg font-semibold">{t.passwordTitle}</h2>
        <ChangePasswordForm />
      </section>
    </div>
  );
}
