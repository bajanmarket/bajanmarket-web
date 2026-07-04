import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { LegalPage, H2 } from "@/components/LegalPage";

const SITE_URL = "https://bajanmarketplacetest.lovable.app";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Bajan.market" },
      { name: "description", content: "The terms that govern your use of Bajan.market, Barbados' cleaner marketplace." },
      { property: "og:title", content: "Terms of Service — Bajan.market" },
      { property: "og:description", content: "The terms that govern your use of Bajan.market." },
      { property: "og:url", content: `${SITE_URL}/terms` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/terms` }],
  }),
  component: Terms,
});

function Terms() {
  return (
    <AppShell>
      <LegalPage title="Terms of Service" updated="4 July 2026">
        <p>
          Welcome to Bajan.market. By creating an account or using the site you agree to these terms.
          This page is maintained by the Bajan.market team.
        </p>

        <H2>Who can use Bajan.market</H2>
        <p>
          You must be at least 18 years old and able to enter a binding contract. You are responsible for
          keeping your account credentials safe and for everything that happens under your account.
        </p>

        <H2>Your listings</H2>
        <p>
          You keep ownership of the content you post. By posting, you grant Bajan.market a worldwide, royalty-free
          licence to display and distribute that content on the platform so buyers can find it. You confirm you
          have the right to sell what you list and that the description is accurate.
        </p>

        <H2>What you can't do</H2>
        <ul className="list-disc pl-5 flex flex-col gap-1">
          <li>List prohibited or illegal items (see the Community Guidelines).</li>
          <li>Scam, defraud, harass or impersonate anyone.</li>
          <li>Scrape, spam, or otherwise abuse the platform or its users.</li>
          <li>Use Bajan.market to break any law of Barbados.</li>
        </ul>

        <H2>Transactions</H2>
        <p>
          Bajan.market is a listing platform. We do not process payments, arrange delivery, verify condition,
          or act as an escrow. Buyers and sellers arrange payment and handover directly and are responsible for
          their own dealings. Meet in a safe public place, inspect items in person, and use common sense.
        </p>

        <H2>Moderation and enforcement</H2>
        <p>
          We may hide listings, remove content, suspend or ban accounts, and refuse service at our discretion,
          particularly to protect our community. Reports are reviewed by our moderation team.
        </p>

        <H2>Disclaimer</H2>
        <p>
          Bajan.market is provided "as is" without warranty of any kind. To the fullest extent permitted by law,
          we are not liable for indirect or consequential loss arising from your use of the platform or from any
          transaction between users.
        </p>

        <H2>Changes to these terms</H2>
        <p>
          We may update these terms from time to time. Material changes will be posted on this page with a new
          "last updated" date. Continued use after changes means you accept the new terms.
        </p>

        <H2>Contact</H2>
        <p>Questions? Reach us at <a className="text-teal hover:underline" href="mailto:hello@bajan.market">hello@bajan.market</a>.</p>
      </LegalPage>
    </AppShell>
  );
}
