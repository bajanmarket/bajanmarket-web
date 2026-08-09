import { Link } from "@tanstack/react-router";
import { Search, MessageCircle, Handshake, Camera, Upload, Store, ShieldCheck, Flag, UserCheck, Lock, BookOpen, Eye } from "lucide-react";

function Step({ n, icon: Icon, title, body }: { n: number; icon: typeof Search; title: string; body: string }) {
  return (
    <li className="flex gap-3">
      <span className="shrink-0 size-9 rounded-2xl bg-white ring-1 ring-hairline grid place-items-center text-teal">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div>
        <p className="text-sm font-medium text-navy">{n}. {title}</p>
        <p className="text-xs text-navy/60 mt-0.5 leading-relaxed">{body}</p>
      </div>
    </li>
  );
}

export function HowItWorks() {
  return (
    <section className="mt-12" aria-labelledby="how-it-works">
      <h2 id="how-it-works" className="text-xl font-medium text-navy">How BajanMarket works</h2>
      <div className="grid sm:grid-cols-2 gap-4 mt-5">
        <div className="bg-white rounded-3xl ring-1 ring-hairline p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-navy/50 mb-4">If you're buying</h3>
          <ol className="flex flex-col gap-4">
            <Step n={1} icon={Search} title="Find it" body="Browse or search BajanMarket by category, parish or price." />
            <Step n={2} icon={MessageCircle} title="Message" body="Contact the seller safely through BajanMarket — no phone number needed." />
            <Step n={3} icon={Handshake} title="Make the deal" body="Agree on price, pickup, delivery or service arrangements." />
          </ol>
        </div>
        <div className="bg-white rounded-3xl ring-1 ring-hairline p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-navy/50 mb-4">If you're selling</h3>
          <ol className="flex flex-col gap-4">
            <Step n={1} icon={Camera} title="Create your listing" body="Add photos, a description and your price in BBD." />
            <Step n={2} icon={Upload} title="Publish" body="Make the listing available to buyers right across Barbados." />
            <Step n={3} icon={Store} title="Chat and sell" body="Respond to interested customers and close the deal." />
          </ol>
          <Link
            to="/post"
            className="inline-flex mt-6 items-center rounded-2xl bg-coral text-white px-5 py-2.5 text-sm font-medium active:scale-95 transition-transform"
          >
            Post a free listing
          </Link>
        </div>
      </div>
    </section>
  );
}

const TRUST = [
  { icon: MessageCircle, title: "In-platform messaging", body: "Talk to buyers and sellers without handing over your phone number or email." },
  { icon: Flag, title: "Report anything off", body: "Every listing, profile and message can be reported in a couple of taps." },
  { icon: ShieldCheck, title: "Human moderation", body: "Reports go to a real moderation queue — listings can be hidden and accounts banned." },
  { icon: UserCheck, title: "Real seller profiles", body: "See when a seller joined and what else they have listed before you message." },
  { icon: Lock, title: "Privacy controls", body: "Hide conversations from your inbox and choose which notifications you receive." },
  { icon: BookOpen, title: "Clear community rules", body: "Prohibited items and expected behaviour are spelled out in our guidelines." },
];

export function TrustSection() {
  return (
    <section className="mt-12" aria-labelledby="trust-safety">
      <h2 id="trust-safety" className="text-xl font-medium text-navy">Built to feel safer than a Facebook group</h2>
      <p className="text-sm text-navy/60 mt-2 max-w-2xl">
        BajanMarket doesn't hold your money or inspect items — deals happen between you and the other person.
        What we do give you is a cleaner place to trade, with the tools to keep it that way.
      </p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-5">
        {TRUST.map((t) => (
          <div key={t.title} className="bg-white rounded-3xl ring-1 ring-hairline p-5">
            <span className="size-9 rounded-2xl bg-sand-deep/40 grid place-items-center text-teal mb-3">
              <t.icon className="size-4" aria-hidden="true" />
            </span>
            <p className="text-sm font-medium text-navy">{t.title}</p>
            <p className="text-xs text-navy/60 mt-1 leading-relaxed">{t.body}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 mt-5 text-sm">
        <Link to="/community-guidelines" className="text-teal hover:underline inline-flex items-center gap-1.5">
          <Eye className="size-3.5" aria-hidden="true" /> Read the Community Guidelines
        </Link>
        <Link to="/terms" className="text-navy/60 hover:text-teal">Terms of use</Link>
        <Link to="/privacy" className="text-navy/60 hover:text-teal">Privacy policy</Link>
      </div>
    </section>
  );
}
