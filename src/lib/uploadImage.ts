import { supabase } from "@/integrations/supabase/client";

const TEN_YEARS = 60 * 60 * 24 * 365 * 10;

// Raw device limit (before compression). Modern phones easily hit 5-12 MB.
export const MAX_IMAGE_BYTES = 25 * 1024 * 1024; // 25 MB pre-compression
// Target size we actually upload after compression.
const COMPRESS_TARGET_MB = 1.5;
const COMPRESS_MAX_DIMENSION = 2000;

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
];

// Broad accept string that lets mobile browsers show gallery + camera options,
// including HEIC on iOS. Extensions cover Android browsers that report empty
// mime types for HEIC files coming from the gallery.
export const IMAGE_ACCEPT = "image/*,.heic,.heif";

const EXT_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "jpg",
  "image/heif": "jpg",
};

function looksLikeImage(file: File): boolean {
  if (file.type && file.type.startsWith("image/")) return true;
  return /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(file.name);
}

export function validateImage(file: File): string | null {
  if (!looksLikeImage(file)) {
    return "Only image files are allowed (JPG, PNG, WebP, GIF, HEIC).";
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `Image is too large (max ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} MB).`;
  }
  if (file.size === 0) return "File is empty.";
  return null;
}

async function convertHeicIfNeeded(file: File): Promise<File> {
  const isHeic =
    /heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
  if (!isHeic) return file;
  try {
    const heic2any = (await import("heic2any")).default;
    const converted = (await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 })) as Blob;
    return new File([converted], file.name.replace(/\.(heic|heif)$/i, ".jpg"), {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  } catch {
    // If HEIC conversion fails (some Android browsers can decode HEIC natively),
    // just hand the file back and let compression / upload try.
    return file;
  }
}

async function compress(file: File): Promise<File> {
  // Skip tiny files or GIFs (animated frames would be lost).
  if (file.size < 400 * 1024) return file;
  if (file.type === "image/gif") return file;
  try {
    const imageCompression = (await import("browser-image-compression")).default;
    const out = await imageCompression(file, {
      maxSizeMB: COMPRESS_TARGET_MB,
      maxWidthOrHeight: COMPRESS_MAX_DIMENSION,
      useWebWorker: true,
      initialQuality: 0.85,
      // Library reads EXIF orientation and re-encodes upright.
    });
    // imageCompression returns a Blob in some browsers — normalize to File.
    const blob = out as Blob;
    if (blob instanceof File) return blob;
    return new File([blob], file.name, { type: blob.type || file.type, lastModified: Date.now() });
  } catch {
    return file;
  }
}

export type UploadProgress = (percent: number) => void;

/** Prepare a File for upload: convert HEIC, compress, correct orientation. */
export async function prepareImage(file: File): Promise<File> {
  const converted = await convertHeicIfNeeded(file);
  return await compress(converted);
}

/**
 * Upload a file to a private bucket and return a long-lived signed URL.
 * Files are namespaced by user id so RLS on storage.objects lets the owner
 * update/delete them later.
 */
export async function uploadImage(
  bucket: "listings" | "avatars",
  userId: string,
  file: File,
  onProgress?: UploadProgress,
): Promise<string> {
  const err = validateImage(file);
  if (err) throw new Error(err);

  onProgress?.(5);
  const prepared = await prepareImage(file);
  onProgress?.(45);

  const ext = EXT_MAP[prepared.type] ?? EXT_MAP[file.type] ?? "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;

  // Retry once on transient failure (mobile networks flap).
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const { error: upErr } = await supabase.storage.from(bucket).upload(path, prepared, {
      cacheControl: "31536000",
      contentType: prepared.type || "image/jpeg",
      upsert: false,
    });
    if (!upErr) { lastError = null; break; }
    lastError = upErr;
    await new Promise((r) => setTimeout(r, 400));
  }
  if (lastError) throw lastError;
  onProgress?.(90);

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, TEN_YEARS);
  if (error || !data) throw error ?? new Error("Failed to sign URL");
  onProgress?.(100);
  return data.signedUrl;
}
