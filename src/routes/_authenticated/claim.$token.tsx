import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, Store, ShieldCheck, Loader2, X } from "lucide-react";
import { DraftImage, draftFallbackImage } from "@/components/DraftImage";
import {
  approveSocialFeed,
  getClaimWorkspace,
  startClaim,
  submitOwnershipVerification,
  updateClaimItem,
} from "@/lib/draftStore.functions";

export const Route = createFileRoute("/_authenticated/claim/$token")({
  head: () => ({
    meta: [
      { title: "Claim your BajanMarket storefront" },
      { name: "description", content: "Review, edit and publish the BajanMarket storefront prepared for your business." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Claim your BajanMarket storefront" },
      { property: "og:description", content: "Review and publish the storefront prepared for your business." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClaimPage,
});

function ClaimPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const begin = useServerFn(startClaim);
  const fetchWorkspace = useServerFn(getClaimWorkspace);
  const verify = useServerFn(submitOwnershipVerification);
  const saveItem = useServerFn(updateClaimItem);
  const publish = useServerFn(approveSocialFeed);

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    void begin({ data: { token } });
  }, [begin, token]);

  const { data, isLoading } = useQuery({
    queryKey: ["claim-workspace", token],
    queryFn: () => fetchWorkspace({ data: { token } }),
    retry: false,
  });

  const items = useMemo(() => (data?.ok ? data.items : []), [data]);

  useEffect(() => {
    if (seeded || items.length === 0) return;
    const next: Record<string, boolean> = {};
    for (const i of items) next[i.id] = i.status !== "rejected";
    setSelected(next);
    setSeeded(true);
  }, [items, seeded]);

  if (isLoading) {
    return <Shell><p className="text-sm text-navy/50">Loading your storefront…</p></Shell>;
  }
  if (!data?.ok) {
    return (
      <Shell>
        <Store className="size-8 mx-auto text-navy/30" />
        <h1 className="text-lg font-medium mt-3">Can't open this claim</h1>
        <p className="text-sm text-navy/60 mt-2">{data?.error ?? "This claim link is no longer valid."}</p>
        <Link to="/" className="inline-block mt-4 bg-navy text-white rounded-full px-4 py-2 text-sm font-medium">
          Go to BajanMarket
        </Link>
      </Shell>
    );
  }

  const store = data.store;
  if (store.claim_status === "claimed") {
    return (
      <Shell>
        <Check className="size-8 mx-auto text-teal" />
        <h1 className="text-lg font-medium mt-3">Storefront claimed</h1>
        <p className="text-sm text-navy/60 mt-2">{store.business_name} is now yours on BajanMarket.</p>
        <Link
          to="/business"
          className="inline-block mt-4 bg-navy text-white rounded-full px-4 py-2 text-sm font-medium"
        >
          Manage your storefront
        </Link>
      </Shell>
    );
  }

  const onVerify = async (method: "business_email" | "business_phone" | "existing_account" | "manual_review") => {
    setBusy(true);
    const res = await verify({ data: { token, method } });
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    await qc.invalidateQueries({ queryKey: ["claim-workspace", token] });
    toast.success(res.status === "verified" ? "Ownership verified" : "Sent for quick manual review");
  };

  const onPublish = async () => {
    setBusy(true);
    const approvedIds = Object.entries(selected).filter(([, v]) => v).map(([k]) => k);
    const res = await publish({ data: { token, approvedIds } });
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    toast.success(`Storefront published with ${res.published} listing${res.published === 1 ? "" : "s"}`);
    if (res.needsPrice.length) toast.info(`${res.needsPrice.length} item(s) need a price before they go live`);
    void navigate({ to: "/business" });
  };

  return (
    <div className="px-4 py-5 max-w-2xl mx-auto flex flex-col gap-5 pb-28">
      <header>
        <h1 className="text-2xl font-semibold">Claim {store.business_name}</h1>
        <p className="text-sm text-navy/60 mt-1">
          Review everything we prepared, untick anything you don't want, then publish. You stay in control of what goes live.
        </p>
      </header>

      <section className="bg-white rounded-2xl ring-1 ring-hairline p-5">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <ShieldCheck className="size-4 text-teal" /> Confirm you own this business
        </h2>
        {store.verification_status === "verified" ? (
          <p className="text-sm text-teal mt-2">Ownership confirmed.</p>
        ) : store.verification_status === "review_required" ? (
          <p className="text-sm text-navy/60 mt-2">
            We're reviewing your request. You can still finish setting up your storefront — it will publish once approved.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2 mt-3">
            <VerifyButton disabled={busy} onClick={() => onVerify("business_email")}>
              I use the business email
            </VerifyButton>
            <VerifyButton disabled={busy} onClick={() => onVerify("existing_account")}>
              I already sell here
            </VerifyButton>
            <VerifyButton disabled={busy} onClick={() => onVerify("manual_review")}>
              Ask for manual review
            </VerifyButton>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-navy/50 mb-3 px-1">
          Approve your content ({Object.values(selected).filter(Boolean).length}/{items.length})
        </h2>
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              checked={selected[item.id] ?? false}
              onToggle={() => setSelected((s) => ({ ...s, [item.id]: !s[item.id] }))}
              onSave={async (patch) => {
                const res = await saveItem({ data: { token, itemId: item.id, ...patch } });
                if (!res.ok) {
                  toast.error(res.error);
                  return;
                }
                await qc.invalidateQueries({ queryKey: ["claim-workspace", token] });
                toast.success("Saved");
              }}
            />
          ))}
          {items.length === 0 && (
            <p className="bg-white rounded-2xl ring-1 ring-hairline p-6 text-sm text-navy/60 text-center">
              Nothing drafted — you can add listings after claiming.
            </p>
          )}
        </div>
      </section>

      <div className="fixed bottom-0 inset-x-0 p-4 bg-gradient-to-t from-sand via-sand to-transparent">
        <button
          type="button"
          disabled={busy}
          onClick={onPublish}
          className="block w-full max-w-2xl mx-auto bg-navy text-white rounded-full px-6 py-4 text-sm font-semibold shadow-lg disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-4 animate-spin mx-auto" /> : "Publish my storefront"}
        </button>
      </div>
    </div>
  );
}

type Item = {
  id: string;
  title: string;
  description: string | null;
  price: number | null;
  category: string | null;
  image_url: string | null;
  content_type: string;
  status: string;
};

function ItemRow({
  item,
  checked,
  onToggle,
  onSave,
}: {
  item: Item;
  checked: boolean;
  onToggle: () => void;
  onSave: (patch: { title?: string; description?: string | null; price?: number | null }) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description ?? "");
  const [price, setPrice] = useState(item.price === null ? "" : String(item.price));

  return (
    <div className="bg-white rounded-2xl ring-1 ring-hairline p-4">
      <div className="flex gap-3 items-start">
        <button
          type="button"
          onClick={onToggle}
          aria-label={checked ? "Exclude this item" : "Include this item"}
          className={`size-6 shrink-0 rounded-md grid place-items-center ring-1 ${
            checked ? "bg-navy text-white ring-navy" : "bg-white text-navy/40 ring-hairline"
          }`}
        >
          {checked ? <Check className="size-4" /> : <X className="size-3.5" />}
        </button>
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex flex-col gap-2">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl ring-1 ring-hairline px-3 py-2 text-sm"
                placeholder="Title"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full rounded-xl ring-1 ring-hairline px-3 py-2 text-sm"
                placeholder="Description"
              />
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                inputMode="decimal"
                className="w-full rounded-xl ring-1 ring-hairline px-3 py-2 text-sm"
                placeholder="Price (BBD) — required to publish"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  className="bg-navy text-white rounded-full px-4 py-2 text-xs font-medium"
                  onClick={async () => {
                    const p = price.trim() === "" ? null : Number(price);
                    if (p !== null && (!Number.isFinite(p) || p < 0)) return toast.error("Enter a valid price");
                    await onSave({ title: title.trim(), description: description.trim() || null, price: p });
                    setEditing(false);
                  }}
                >
                  Save
                </button>
                <button
                  type="button"
                  className="rounded-full px-4 py-2 text-xs ring-1 ring-hairline"
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm font-medium leading-snug">{item.title}</p>
              {item.description && <p className="text-xs text-navy/60 mt-1 line-clamp-2">{item.description}</p>}
              <p className="text-xs text-navy/70 mt-1">
                {item.price === null ? "No price yet — add one to publish" : `$${item.price} BBD`}
              </p>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-xs text-teal font-medium mt-2"
              >
                Edit
              </button>
            </>
          )}
        </div>
        <DraftImage
          src={item.image_url}
          fallbackSrc={draftFallbackImage(item.category, item.title)}
          label={item.title}
          className="size-14 rounded-xl shrink-0"
        />
      </div>
    </div>
  );
}

function VerifyButton({ children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className="rounded-full ring-1 ring-hairline px-4 py-2 text-xs font-medium disabled:opacity-60"
    >
      {children}
    </button>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-5 py-16 grid place-items-center">
      <div className="bg-white rounded-3xl ring-1 ring-hairline p-8 text-center max-w-sm w-full">{children}</div>
    </div>
  );
}
