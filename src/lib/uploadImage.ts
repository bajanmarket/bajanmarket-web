import { supabase } from "@/integrations/supabase/client";

const TEN_YEARS = 60 * 60 * 24 * 365 * 10;

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const EXT_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function validateImage(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return "Only JPG, PNG, WebP or GIF images are allowed.";
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `Image is too large (max ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} MB).`;
  }
  if (file.size === 0) return "File is empty.";
  return null;
}

/**
 * Upload a file to a private bucket and return a long-lived signed URL.
 * Files are namespaced by user id so RLS on storage.objects lets the owner
 * update/delete them later.
 */
export async function uploadImage(bucket: "listings" | "avatars", userId: string, file: File): Promise<string> {
  const err = validateImage(file);
  if (err) throw new Error(err);
  const ext = EXT_MAP[file.type] ?? "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "31536000",
    contentType: file.type,
    upsert: false,
  });
  if (upErr) throw upErr;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, TEN_YEARS);
  if (error || !data) throw error ?? new Error("Failed to sign URL");
  return data.signedUrl;
}
