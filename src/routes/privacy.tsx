import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { LegalPage, H2 } from "@/components/LegalPage";

const SITE_URL = "https://bajanmarket.app";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — BajanMarket" },
      { name: "description", content: "How BajanMarket collects, uses and protects your personal information." },
      { property: "og:title", content: "Privacy Policy — BajanMarket" },
      { property: "og:description", content: "How BajanMarket handles your personal information." },
      { property: "og:url", content: `${SITE_URL}/privacy` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/privacy` }],
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <AppShell>
      <LegalPage title="Privacy Policy" updated="4 July 2026">
        <p>
          This policy explains what BajanMarket collects, how we use it, and the choices you have.
          It is maintained by the BajanMarket team.
        </p>

        <H2>Information we collect</H2>
        <ul className="list-disc pl-5 flex flex-col gap-1">
          <li><strong>Account:</strong> email, display name, and any profile details you add (avatar, bio, parish, phone).</li>
          <li><strong>Listings and messages:</strong> the content you post and the messages you send other users.</li>
          <li><strong>Usage:</strong> basic device and log information needed to run the service securely.</li>
        </ul>

        <H2>How we use it</H2>
        <ul className="list-disc pl-5 flex flex-col gap-1">
          <li>To operate the marketplace — show your listings, deliver your messages, run search.</li>
          <li>To keep the platform safe — review reports, prevent fraud, enforce our rules.</li>
          <li>To improve the product and communicate essential service updates.</li>
        </ul>

        <H2>What other people can see</H2>
        <p>
          Your display name, avatar, bio, parish and public listings are visible to anyone. Your email address
          is private. Your phone number is only shared if you choose to reveal it to a buyer or seller.
          Messages are visible to the participants in the conversation and, when necessary, to our moderation
          team when a report is filed.
        </p>

        <H2>Who we share it with</H2>
        <p>
          We share data with the infrastructure providers we need to run the service (hosting, database, email
          delivery). We do not sell your personal information. We may disclose information if required by law
          or to protect the rights and safety of our users.
        </p>

        <H2>Your choices</H2>
        <ul className="list-disc pl-5 flex flex-col gap-1">
          <li>Edit or delete your listings at any time from "My listings".</li>
          <li>Update your profile from the Profile page.</li>
          <li>Delete your account from the Profile page — this removes your listings and profile data.</li>
        </ul>

        <H2>Data retention</H2>
        <p>
          We keep your account information while your account is active. When you delete your account,
          we remove your profile and listings. Messages may be retained in the other participant's inbox and
          in moderation records where needed to keep the community safe.
        </p>

        <H2>Cookies</H2>
        <p>
          We use only the cookies and local storage needed to keep you signed in and remember your preferences.
        </p>

        <H2>Children</H2>
        <p>BajanMarket is not intended for anyone under 18.</p>

        <H2>Contact</H2>
        <p>Privacy questions? Email <a className="text-teal hover:underline" href="mailto:privacy@bajanmarket.app">privacy@bajanmarket.app</a>.</p>
      </LegalPage>
    </AppShell>
  );
}
