import { supabase } from "@/integrations/supabase/client";

const TEN_YEARS = 60 * 60 * 24 * 365 * 10;

/**
 * Upload a file to a private bucket and return a long-lived signed URL.
 * Files are namespaced by user id so RLS on storage.objects lets the owner
 * update/delete them later.
 */
export async function uploadImage(bucket: "listings" | "avatars", userId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "31536000",
    contentType: file.type || "image/jpeg",
    upsert: false,
  });
  if (upErr) throw upErr;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, TEN_YEARS);
  if (error || !data) throw error ?? new Error("Failed to sign URL");
  return data.signedUrl;
}
