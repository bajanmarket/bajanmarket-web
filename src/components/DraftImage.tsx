import { useState } from "react";
import { Store } from "lucide-react";

function initials(label?: string | null) {
  if (!label) return "";
  return label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
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
  className = "",
  imgClassName = "",
  loading = "lazy",
}: {
  src?: string | null;
  alt?: string;
  label?: string | null;
  className?: string;
  imgClassName?: string;
  loading?: "lazy" | "eager";
}) {
  const [failed, setFailed] = useState(false);
  const showImage = !!src && !failed;
  const text = initials(label);

  return (
    <div className={`relative overflow-hidden bg-sand-deep ${className}`}>
      {showImage ? (
        <img
          src={src!}
          alt={alt ?? ""}
          loading={loading}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
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
