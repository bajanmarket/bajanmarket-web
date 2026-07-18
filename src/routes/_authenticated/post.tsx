import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { PARISHES, CONDITIONS } from "@/lib/parishes";
import { uploadImage, validateImage, IMAGE_ACCEPT } from "@/lib/uploadImage";
import { useAuth } from "@/lib/useAuth";
import { ImagePlus, X, Sparkles, Camera, Upload, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { SellerOnboarding } from "@/components/SellerOnboarding";
import { suggestListingFromImage } from "@/lib/ai-listing.functions";
import { ShareMenu } from "@/components/ShareMenu";
import { sharePrefill, SITE_URL } from "@/lib/share";
import { formatBBD } from "@/lib/format";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/post")({
  head: () => ({ meta: [{ title: "Post a listing — Bajan.market" }] }),
  component: PostListing,
});

const schema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(4000),
  price: z.coerce.number().nonnegative(),
  category_id: z.string().uuid(),
  parish: z.string().min(1),
  condition: z.string().min(1),
  negotiable: z.boolean(),
});

type Defaults = {
  title: string;
  description: string;
  price: string;
  category_id: string;
  condition: string;
  negotiable: boolean;
};

const EMPTY: Defaults = { title: "", description: "", price: "", category_id: "", condition: "good", negotiable: true };

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Could not read file"));
    r.readAsDataURL(file);
  });
}

function PostListing() {
  
  const { user } = useAuth();
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [uploadIndex, setUploadIndex] = useState(0);
  const [defaults, setDefaults] = useState<Defaults>(EMPTY);
  const [formKey, setFormKey] = useState(0);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiHint, setAiHint] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [posted, setPosted] = useState<{ id: string; title: string; price: number; cover_url: string | null } | null>(null);
  const suggest = useServerFn(suggestListingFromImage);

  const { data: cats } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await supabase.from("categories").select("id, name").eq("active", true).order("sort_order")).data ?? [],
  });

  const runAi = async () => {
    if (files.length === 0) { toast.error("Add a photo first"); return; }
    if (!cats || cats.length === 0) { toast.error("Categories still loading"); return; }
    setAiBusy(true);
    try {
      const dataUrl = await fileToDataUrl(files[0]);
      const out = await suggest({
        data: {
          image_data_url: dataUrl,
          hint: aiHint.trim(),
          categories: cats.map((c) => ({ id: c.id, name: c.name })),
        },
      });
      setDefaults({
        title: out.title,
        description: out.description,
        price: out.suggested_price_bbd ? String(out.suggested_price_bbd) : "",
        category_id: out.category_id,
        condition: out.condition,
        negotiable: out.negotiable,
      });
      setFormKey((k) => k + 1);
      toast.success("AI filled the form — review before posting");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAiBusy(false);
    }
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse({
      title: fd.get("title"),
      description: fd.get("description"),
      price: fd.get("price"),
      category_id: fd.get("category_id"),
      parish: fd.get("parish"),
      condition: fd.get("condition"),
      negotiable: fd.get("negotiable") === "on",
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form");
      return;
    }
    if (files.length === 0) { toast.error("Add at least one photo"); return; }

    setBusy(true);
    try {
      const urls: string[] = [];
      for (const f of files) urls.push(await uploadImage("listings", user.id, f));

      const { data: listing, error } = await supabase
        .from("listings")
        .insert({
          ...parsed.data,
          seller_id: user.id,
          currency: "BBD",
          cover_image_url: urls[0],
          parish: parsed.data.parish as never,
          condition: parsed.data.condition as never,
        })
        .select("id")
        .single();
      if (error) throw error;

      if (urls.length > 1) {
        await supabase.from("listing_images").insert(
          urls.slice(1).map((url, i) => ({ listing_id: listing.id, url, sort_order: i + 1 })),
        );
      }
      toast.success("Listing posted!");
      setPosted({ id: listing.id, title: parsed.data.title, price: parsed.data.price, cover_url: urls[0] });
      // Reset the form so "Post another" starts clean
      setFiles([]);
      setDefaults(EMPTY);
      setFormKey((k) => k + 1);
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const addFiles = (fs: FileList | null) => {
    if (!fs) return;
    const incoming = Array.from(fs);
    const accepted: File[] = [];
    for (const f of incoming) {
      const err = validateImage(f);
      if (err) { toast.error(`${f.name}: ${err}`); continue; }
      accepted.push(f);
    }
    setFiles((prev) => [...prev, ...accepted].slice(0, 10));
  };

  if (posted) {
    return (
      <AppShell>
        <div className="max-w-xl mx-auto">
          <div className="bg-white rounded-3xl ring-1 ring-hairline p-6 sm:p-8 text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-teal-soft text-teal px-3 py-1 text-[11px] font-semibold uppercase tracking-wider">Live</div>
            <h1 className="text-2xl font-medium mt-3">Your listing is live</h1>
            <p className="text-sm text-navy/60 mt-1">Share it around — the more eyes, the faster it sells.</p>

            <div className="mt-5 flex items-center gap-3 p-3 bg-sand rounded-2xl text-left">
              <div className="size-14 rounded-xl bg-sand-deep overflow-hidden shrink-0">
                {posted.cover_url && <img src={posted.cover_url} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{posted.title}</div>
                <div className="text-xs text-navy/60">{formatBBD(posted.price, "BBD")}</div>
              </div>
            </div>

            <div className="mt-6">
              <ShareMenu
                inline
                url={`${SITE_URL}/listing/${posted.id}`}
                title={posted.title}
                text={sharePrefill("post_success", { title: posted.title, price: formatBBD(posted.price, "BBD") })}
                source="post_success"
              />
            </div>

            <div className="mt-6 flex gap-2">
              <Link
                to="/listing/$id"
                params={{ id: posted.id }}
                className="flex-1 bg-navy text-white rounded-2xl py-3 text-sm font-semibold"
              >
                View listing
              </Link>
              <button
                onClick={() => setPosted(null)}
                className="flex-1 bg-white ring-1 ring-hairline text-navy rounded-2xl py-3 text-sm font-semibold"
              >
                Post another
              </button>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-medium tracking-tight mb-1">Post a listing</h1>
        <p className="text-navy/60 text-sm mb-6">Sell it to the island. Takes about a minute.</p>

        <SellerOnboarding variant="steps" />

        <form key={formKey} onSubmit={onSubmit} className="bg-white rounded-3xl ring-1 ring-hairline p-6 flex flex-col gap-5">
          <div>
            <Label>Photos ({files.length}/10)</Label>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-2">
              {files.map((f, i) => (
                <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-sand-deep">
                  <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setFiles(files.filter((_, j) => j !== i))}
                    className="absolute top-1 right-1 size-6 rounded-full bg-black/60 text-white grid place-items-center"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
              {files.length < 10 && (
                <label className="aspect-square rounded-xl border-2 border-dashed border-hairline grid place-items-center cursor-pointer hover:bg-sand transition-colors">
                  <ImagePlus className="size-5 text-navy/40" />
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden onChange={(e) => addFiles(e.target.files)} />
                </label>
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-teal/10 to-coral/10 ring-1 ring-teal/20 p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-teal" />
              <span className="text-sm font-medium text-navy">AI listing assistant</span>
            </div>
            <p className="text-xs text-navy/60 -mt-1">
              Upload a photo, then let AI draft a title, description, category, condition, and suggested price. You can edit everything before posting.
            </p>
            <input
              type="text"
              value={aiHint}
              onChange={(e) => setAiHint(e.target.value)}
              placeholder="Optional hint — brand, model, size, age…"
              maxLength={300}
              className={input}
            />
            <button
              type="button"
              onClick={runAi}
              disabled={aiBusy || files.length === 0}
              className="bg-navy text-white rounded-xl px-4 py-2.5 text-sm font-medium disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              <Sparkles className="size-4" />
              {aiBusy ? "Analysing photo…" : files.length === 0 ? "Add a photo first" : "Fill with AI"}
            </button>
          </div>

          <Field label="Title">
            <input name="title" required maxLength={120} defaultValue={defaults.title} className={input} placeholder="2018 Suzuki Swift Sport" />
          </Field>

          <Field label="Description">
            <textarea name="description" required minLength={10} maxLength={4000} rows={5} defaultValue={defaults.description} className={input} placeholder="Condition, history, why you're selling…" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Price (BBD)">
              <input name="price" required type="number" min="0" step="1" defaultValue={defaults.price} className={input} placeholder="0" />
            </Field>
            <Field label="Category">
              <select name="category_id" required defaultValue={defaults.category_id} className={input}>
                <option value="">Choose…</option>
                {cats?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Parish">
              <select name="parish" required className={input}>
                <option value="">Choose…</option>
                {PARISHES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </Field>
            <Field label="Condition">
              <select name="condition" required defaultValue={defaults.condition} className={input}>
                {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </Field>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="negotiable" defaultChecked={defaults.negotiable} className="size-4 accent-teal" />
            Price is negotiable
          </label>

          <button
            disabled={busy}
            className="bg-coral text-white rounded-2xl py-3.5 text-sm font-semibold active:scale-95 transition-transform disabled:opacity-60"
          >
            {busy ? "Posting…" : "Post listing"}
          </button>
        </form>
      </div>
    </AppShell>
  );
}

const input = "w-full bg-sand rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-teal";
function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] font-medium uppercase tracking-wider text-navy/50">{children}</span>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1.5"><Label>{label}</Label>{children}</label>;
}
