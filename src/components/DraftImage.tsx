import { useState } from "react";
import { Store } from "lucide-react";

function initials(label?: string | null) {
  if (!label) return "";
  return label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
}

/**
 * Image for draft storefronts.
 *
 * Only ever shows the merchant's REAL imagery (our stored copy, or the live
 * source URL). When no genuine image exists we show a neutral BajanMarket
 * placeholder — never a generated stand-in that would misrepresent the seller.
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
  const imageSrc = src && !failed ? src : null;
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
          onError={() => setFailed(true)}
          className={`w-full h-full object-cover ${imgClassName}`}
        />
      ) : (
        <div className="w-full h-full grid place-items-center bg-gradient-to-br from-teal-soft to-sand-deep">
          {text ? (
            <span className="font-semibold text-navy/45 tracking-wide text-lg">{text}</span>
          ) : (
            <Store className="size-1/4 max-h-10 text-navy/25" />
          )}
        </div>
      )}
    </div>
  );
}
