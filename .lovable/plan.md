## Social sharing for buyers & sellers

Add first-class sharing to WhatsApp, Facebook, Instagram Stories, and X across the four highest-leverage surfaces. Include branded auto-generated preview images and UTM tags so we can see which channel drives traffic.

### 1. Reusable `<ShareMenu />` component

New `src/components/ShareMenu.tsx` — a popover (shadcn `Popover`) triggered by any share button. Props: `url`, `title`, `text`, `image?`, `source` ("listing" | "storefront" | "seller" | "my_listings" | "post_success").

Buttons inside:
- **WhatsApp** → `https://wa.me/?text=<encoded title + url>` (opens WhatsApp Web / app deep link, works on Bajan mobile).
- **Facebook** → `https://www.facebook.com/sharer/sharer.php?u=<url>`.
- **X** → `https://twitter.com/intent/tweet?text=<title>&url=<url>`.
- **Instagram Stories** → mobile: attempt `instagram-stories://share?...` deep link with the OG image; desktop / fallback: copy link + toast "Open Instagram and paste in your story" (Instagram has no public web share intent).
- **Copy link** (always).
- **Native share** button when `navigator.share` exists (mobile OS sheet — covers everything else).

Every outbound URL is built through a `withUtm(url, source, medium)` helper that appends `utm_source=<whatsapp|facebook|x|instagram|copy|native>`, `utm_medium=share`, `utm_campaign=<source>` (e.g. `listing_share`).

### 2. Where the share menu appears

- **Listing detail (`src/routes/listing.$id.tsx`)** — replace the current `Share2` icon-only button with the `ShareMenu` trigger. Passes listing title, price-included text, and the auto-generated OG image URL.
- **My Listings (`src/routes/_authenticated/my-listings.tsx`)** — add a small share icon on each listing card row so sellers can re-share anytime.
- **Post-listing success** — after a successful publish in `src/routes/_authenticated/post.tsx`, instead of navigating straight away, show a success screen ("Your listing is live") with the new listing's cover, a prominent `ShareMenu` inline (not a popover — buttons laid out), plus "View listing" and "Post another" actions.
- **Seller profile (`src/routes/seller.$id.tsx`)** and **Business storefront (`src/routes/business.$slug.tsx`)** — add a share button in the header area next to the follow/contact controls.

### 3. Auto-generated share images (OG)

Serve a per-entity PNG at stable URLs:
- `/api/public/og/listing/$id.png`
- `/api/public/og/business/$slug.png`
- `/api/public/og/seller/$id.png`

Implementation: new server routes under `src/routes/api/public/og.*.ts` that render a 1200x630 branded PNG using `satori` + `@resvg/resvg-js` (both Worker-compatible, pure JS/WASM). Card layout:
- Left: entity photo (listing cover / business banner or logo / seller avatar) fetched via `fetch` and inlined.
- Right: title, price (listing) or business name / seller name, parish chip, small "bajan.market" wordmark bottom-right, coral accent bar.
- Cache: `Cache-Control: public, max-age=3600, s-maxage=86400` and set `ETag` from a hash of the source fields so refreshes are cheap.
- Errors → fall back to a static branded `/og-default.png` so crawlers never see a broken image.

The route `head()` on listing/business/seller pages sets `og:image` and `twitter:image` to the absolute `https://bajan.market/api/public/og/...png` URL (built server-side using existing `getRequestOrigin` pattern, hardcoded to bajan.market in production).

Tell the user: crawlers cache previews — they can force a refresh in Facebook Sharing Debugger / WhatsApp by re-sharing after ~24h.

### 4. UTM tracking, lightly

- `withUtm()` helper in `src/lib/share.ts` — used by every share URL.
- Extend the existing `search_events` / analytics path: on any page load where `utm_source` is present in the URL, fire `logShareVisit({ path, utm_source, utm_medium, utm_campaign })` into a new small table `public.share_visits` (columns: path, utm_source, utm_medium, utm_campaign, referrer, created_at). Admin/moderator-only SELECT; anon INSERT via a `log_share_visit` SECURITY DEFINER RPC to avoid exposing the table.
- No admin dashboard in this pass — just capture the data so we can query it later. (Optional follow-up: add a "Share attribution" card to the Insights panel.)

### 5. Copy tone

Prefilled share text per source:
- Listing: `"{title} — {price} on Bajan.market"`
- Business: `"Check out {name} on Bajan.market"`
- Seller: `"{name}'s listings on Bajan.market"`

### Technical section

**Packages to add:** `satori`, `@resvg/resvg-js` (WASM build works on Cloudflare Workers).

**New files:**
- `src/components/ShareMenu.tsx`
- `src/lib/share.ts` (URL builders, `withUtm`, prefill text helpers)
- `src/lib/shareVisit.ts` (client-side UTM capture, called from `__root.tsx` on route change)
- `src/routes/api/public/og.listing.$id[.]png.ts`
- `src/routes/api/public/og.business.$slug[.]png.ts`
- `src/routes/api/public/og.seller.$id[.]png.ts`
- `src/lib/og-render.server.ts` (shared satori/resvg renderer + font loading)
- `public/og-default.png` (agent-generated branded fallback)

**Edited files:**
- `src/routes/listing.$id.tsx` — swap share icon → `<ShareMenu />`, point `og:image` at `/api/public/og/listing/$id.png`.
- `src/routes/business.$slug.tsx` — add share button in header, set `og:image` to `/api/public/og/business/$slug.png` (and set proper per-route `head()` if not already).
- `src/routes/seller.$id.tsx` — add share button in header, set `og:image` to `/api/public/og/seller/$id.png`.
- `src/routes/_authenticated/my-listings.tsx` — add per-row share button.
- `src/routes/_authenticated/post.tsx` — success step with inline share UI.
- `src/routes/__root.tsx` — mount UTM capture on route changes.

**Migration:**
1. `CREATE TABLE public.share_visits (id, path text, utm_source text, utm_medium text, utm_campaign text, referrer text, created_at timestamptz default now())` + GRANTs (`SELECT` to authenticated for admin panel; no direct INSERT), RLS enabled, admin/moderator SELECT policy via `has_role`.
2. `CREATE FUNCTION public.log_share_visit(...) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public` — inserts a row; `GRANT EXECUTE ... TO anon, authenticated`.

**Instagram note:** true Stories sharing requires the native app — the deep-link attempt + copy-to-clipboard fallback is the standard web pattern; no OAuth or Meta app needed.

**Out of scope:** admin analytics dashboard for share_visits, Pinterest / LinkedIn / Reddit, sharing individual reviews, referral rewards.
