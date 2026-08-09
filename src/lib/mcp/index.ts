import { auth, defineMcp } from "@lovable.dev/mcp-js";
import searchListings from "./tools/search-listings";
import getListing from "./tools/get-listing";
import listMyListings from "./tools/list-my-listings";
import listMyFavourites from "./tools/list-my-favourites";
import listMyConversations from "./tools/list-my-conversations";

// Issuer must be the direct Supabase host, not the .lovable.cloud proxy.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "bajan-market-mcp",
  title: "BajanMarket",
  version: "0.1.0",
  instructions:
    "Tools for BajanMarket, Barbados' peer-to-peer marketplace. Use search_listings and get_listing to browse public listings, and list_my_listings / list_my_favourites / list_my_conversations to access the signed-in user's own data.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [searchListings, getListing, listMyListings, listMyFavourites, listMyConversations],
});
