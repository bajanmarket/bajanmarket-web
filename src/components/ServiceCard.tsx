import { Link } from "@tanstack/react-router";
import { MapPin, Clock, Star } from "lucide-react";
import { parishLabel } from "@/lib/parishes";

export type ServiceCardData = {
  id: string;
  title: string;
  price: number;
  currency: string;
  price_unit: string;
  duration_minutes: number;
  parish: string | null;
  cover_image_url: string | null;
  mobile_service: boolean;
  rating_avg: number;
  rating_count: number;
};

const UNIT_LABEL: Record<string, string> = {
  per_session: "per session",
  per_hour: "per hour",
  per_visit: "per visit",
  from: "from",
  quote: "quote on request",
};

export function ServiceCard({ service }: { service: ServiceCardData }) {
  return (
    <Link
      to="/services/$id"
      params={{ id: service.id }}
      className="bg-white rounded-2xl ring-1 ring-hairline overflow-hidden flex flex-col active:scale-[0.99] transition-transform"
    >
      <div className="aspect-[4/3] bg-sand-deep">
        {service.cover_image_url && (
          <img src={service.cover_image_url} alt={service.title} width={400} height={300} loading="lazy" decoding="async" className="w-full h-full object-cover" />
        )}
      </div>
      <div className="p-3 flex flex-col gap-1.5">
        <div className="text-sm font-medium leading-snug line-clamp-2">{service.title}</div>
        <div className="text-base font-semibold text-navy">
          {service.price > 0 ? `${service.currency} $${Number(service.price).toFixed(2)}` : "Quote"}
          <span className="text-[11px] font-normal text-navy/50 ml-1">
            {UNIT_LABEL[service.price_unit] ?? service.price_unit}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-navy/50">
          {service.parish && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" /> {parishLabel(service.parish as never)}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3" /> {service.duration_minutes} min
          </span>
          {service.rating_count > 0 && (
            <span className="inline-flex items-center gap-1">
              <Star className="size-3" /> {service.rating_avg.toFixed(1)}
            </span>
          )}
          {service.mobile_service && <span className="text-teal font-medium">Mobile</span>}
        </div>
      </div>
    </Link>
  );
}
