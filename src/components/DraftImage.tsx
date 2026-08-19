import { useState } from "react";
import { Store } from "lucide-react";
import generalImage from "@/assets/draft-store-general.jpg.asset.json";
import vehiclesImage from "@/assets/draft-store-vehicles.jpg.asset.json";
import foodImage from "@/assets/draft-store-food.jpg.asset.json";
import servicesImage from "@/assets/draft-store-services.jpg.asset.json";
import retailImage from "@/assets/draft-store-retail.jpg.asset.json";

function initials(label?: string | null) {
  if (!label) return "";
  return label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
}

export function draftFallbackImage(category?: string | null, title?: string | null) {
  const value = `${category ?? ""} ${title ?? ""}`.toLowerCase();
  if (/vehicle|car|auto|motor|suv|sedan|van|truck/.test(value)) return vehiclesImage.url;
  if (/food|cater|restaurant|bak|meal|drink|grocery|agricultur/.test(value)) return foodImage.url;
  if (/service|repair|clean|beauty|health|education|professional/.test(value)) return servicesImage.url;
  if (/fashion|clothing|retail|jewel|accessor|furniture|home|phone|electronic/.test(value)) return retailImage.url;
  return generalImage.url;
}

/**
 * Image with a branded fallback. Draft storefronts are assembled from public
 * business info, so image URLs are often missing or hotlink-blocked — never
 * show a broken/blank box to a prospective seller.
 */
export function DraftImage({
  src,
  alt,
  label,
  fallbackSrc,
  className = "",
  imgClassName = "",
  loading = "lazy",
}: {
  src?: string | null;
  alt?: string;
  label?: string | null;
  fallbackSrc?: string | null;
  className?: string;
  imgClassName?: string;
  loading?: "lazy" | "eager";
}) {
  const [failedSrc, setFailedSrc] = useState<string[]>([]);
  const imageSrc = [src, fallbackSrc].find((candidate) => Boolean(candidate) && !failedSrc.includes(candidate ?? ""));
  const text = initials(label);

  return (
    <div className={`relative overflow-hidden bg-sand-deep ${className}`}>
      {imageSrc ? (
        <img
          src={imageSrc}
          alt={alt ?? ""}
          loading={loading}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailedSrc((current) => (current.includes(imageSrc) ? current : [...current, imageSrc]))}
          className={`w-full h-full object-cover ${imgClassName}`}
        />
      ) : (
        <div className="w-full h-full grid place-items-center bg-gradient-to-br from-teal-soft to-sand-deep">
          {text ? (
            <span className="font-semibold text-navy/45 tracking-wide text-lg">
              {text}
            </span>
          ) : (
            <Store className="size-1/4 max-h-10 text-navy/25" />
          )}
        </div>
      )}
    </div>
  );
}
