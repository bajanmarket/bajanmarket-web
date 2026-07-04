import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { LegalPage, H2 } from "@/components/LegalPage";

const SITE_URL = "https://bajanmarketplacetest.lovable.app";

export const Route = createFileRoute("/community-guidelines")({
  head: () => ({
    meta: [
      { title: "Community Guidelines — Bajan.market" },
      { name: "description", content: "The rules that keep Bajan.market a safe, honest marketplace for Barbados." },
      { property: "og:title", content: "Community Guidelines — Bajan.market" },
      { property: "og:description", content: "The rules that keep Bajan.market safe and honest." },
      { property: "og:url", content: `${SITE_URL}/community-guidelines` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/community-guidelines` }],
  }),
  component: Community,
});

function Community() {
  return (
    <AppShell>
      <LegalPage title="Community Guidelines" updated="4 July 2026">
        <p>
          Bajan.market only works when people trust each other. These rules apply to everyone — buyers,
          sellers and browsers alike. Break them and your listings can be hidden and your account banned.
        </p>

        <H2>Be honest</H2>
        <ul className="list-disc pl-5 flex flex-col gap-1">
          <li>Only list things you actually have and can sell.</li>
          <li>Use your own clear photos. No stolen or misleading images.</li>
          <li>Describe the real condition — flaws included.</li>
          <li>Set a real price. No bait-and-switch.</li>
        </ul>

        <H2>Be respectful</H2>
        <ul className="list-disc pl-5 flex flex-col gap-1">
          <li>No harassment, threats, slurs, or discrimination.</li>
          <li>No spam, off-platform link dumps, or unwanted sales pitches in DMs.</li>
          <li>No impersonating another person or business.</li>
        </ul>

        <H2>What can't be sold</H2>
        <ul className="list-disc pl-5 flex flex-col gap-1">
          <li>Illegal goods and services, or anything restricted under Barbados law.</li>
          <li>Weapons, ammunition and explosives.</li>
          <li>Drugs, drug paraphernalia and prescription medicines.</li>
          <li>Live animals.</li>
          <li>Stolen goods, counterfeit items, or replicas passed off as authentic.</li>
          <li>Adult or sexually explicit content.</li>
          <li>Alcohol, tobacco and vaping products.</li>
          <li>Recalled, unsafe or hazardous items.</li>
          <li>Personal data, accounts, tickets or subscriptions you can't transfer.</li>
        </ul>

        <H2>Meet safely</H2>
        <ul className="list-disc pl-5 flex flex-col gap-1">
          <li>Meet in a public place during the day when you can.</li>
          <li>Inspect the item before you pay.</li>
          <li>Don't send money upfront to someone you haven't met.</li>
          <li>Trust your gut — if it feels off, walk away and report the listing.</li>
        </ul>

        <H2>Reporting</H2>
        <p>
          Tap the flag icon on any listing or seller profile to report a problem. Reports are confidential
          and reviewed by our moderation team. False or malicious reports may themselves be actioned.
        </p>

        <H2>Enforcement</H2>
        <p>
          We may hide listings, restrict features, and suspend or permanently ban accounts that break these
          rules. Serious violations may be reported to the appropriate authorities.
        </p>
      </LegalPage>
    </AppShell>
  );
}
