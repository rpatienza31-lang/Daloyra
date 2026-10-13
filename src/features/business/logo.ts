import "server-only";
import { createClient } from "@/lib/supabase/server";
import { detectImageType, IMAGE_EXTENSIONS } from "@/lib/image-type";

/**
 * Stores a logo under `{business_id}/` in the private logos bucket and points the
 * business at it. The file's bytes decide its type, not its name. Returns false on any
 * failure; the caller decides how to tell the user.
 */
export async function saveLogo(businessId: string, file: File): Promise<boolean> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectImageType(bytes);
  if (!type) return false;

  const supabase = await createClient();
  const path = `${businessId}/logo-${Date.now()}.${IMAGE_EXTENSIONS[type]}`;
  const upload = await supabase.storage
    .from("logos")
    .upload(path, bytes, { contentType: type, upsert: false });
  if (upload.error) {
    console.error("logo upload failed", upload.error.message);
    return false;
  }

  const { data: previous } = await supabase
    .from("businesses")
    .select("logo_path")
    .eq("id", businessId)
    .maybeSingle();
  const { error } = await supabase
    .from("businesses")
    .update({ logo_path: path })
    .eq("id", businessId);
  if (error) {
    console.error("saving logo_path failed", error.code, error.message);
    return false;
  }
  if (previous?.logo_path) await removeLogoFile(previous.logo_path);
  return true;
}

/** Removes the logo from the business and deletes the old file. */
export async function removeLogo(businessId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data: previous } = await supabase
    .from("businesses")
    .select("logo_path")
    .eq("id", businessId)
    .maybeSingle();
  const { error } = await supabase
    .from("businesses")
    .update({ logo_path: null })
    .eq("id", businessId);
  if (error) {
    console.error("clearing logo_path failed", error.code, error.message);
    return false;
  }
  if (previous?.logo_path) await removeLogoFile(previous.logo_path);
  return true;
}

async function removeLogoFile(path: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.storage.from("logos").remove([path]);
  // Not fatal: an orphaned file is harmless and private.
  if (error) console.error("removing old logo failed", error.message);
}
