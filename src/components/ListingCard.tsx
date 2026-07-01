import { Link } from "@tanstack/react-router";
import { formatBBD } from "@/lib/format";
import { parishLabel, conditionLabel } from "@/lib/parishes";
import { ImageOff } from "lucide-react";

export type ListingCardData = {
  id: string;
  title: string;
  price: number | string;
  currency: string;
  parish: string;
  condition: string;
  cover_image_url: string | null;
  status?: string | null;
};

export function ListingCard({ listing }: { listing: ListingCardData }) {
  const sold = listing.status === "sold";
  return (
    <Link
      to="/listing/$id"
      params={{ id: listing.id }}
      className="group bg-white rounded-2xl p-3 ring-1 ring-hairline shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="w-full aspect-[4/3] bg-sand-deep rounded-xl overflow-hidden mb-3 relative">
        {listing.cover_image_url ? (
          <img
            src={listing.cover_image_url}
            alt={listing.title}
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full grid place-items-center text-navy/20">
            <ImageOff className="size-8" />
          </div>
        )}
        {sold && (
          <div className="absolute top-2 left-2 bg-navy text-white text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded">
            Sold
          </div>
        )}
      </div>
      <div className="px-1 flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-base font-semibold text-navy truncate">{formatBBD(listing.price, listing.currency)}</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-teal bg-teal-soft px-2 py-0.5 rounded shrink-0">
            {conditionLabel(listing.condition)}
          </span>
        </div>
        <h3 className="text-sm text-navy/80 leading-snug line-clamp-2 min-h-[2.5rem]">{listing.title}</h3>
        <span className="text-[11px] text-navy/50 font-medium mt-1">{parishLabel(listing.parish)}</span>
      </div>
    </Link>
  );
}
