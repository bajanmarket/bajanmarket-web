import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  image_data_url: z.string().min(20),
  hint: z.string().max(300).optional().default(""),
  categories: z.array(z.object({ id: z.string().uuid(), name: z.string() })).min(1),
});

const CONDITIONS = ["new", "like_new", "good", "fair", "for_parts"] as const;

export type AiListingSuggestion = {
  title: string;
  description: string;
  condition: (typeof CONDITIONS)[number];
  category_id: string;
  suggested_price_bbd: number;
  negotiable: boolean;
};

export const suggestListingFromImage = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => InputSchema.parse(raw))
  .handler(async ({ data }): Promise<AiListingSuggestion> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI is not configured");

    const catList = data.categories.map((c) => `- ${c.name} (id: ${c.id})`).join("\n");

    const systemPrompt = `You help sellers in Barbados write marketplace listings. Prices are Barbadian dollars (BBD). Given a photo of an item and an optional short hint from the seller, produce a concise, honest listing.

Rules:
- Title: 3-70 chars, no ALL CAPS, no emojis, include brand/model if visible.
- Description: 2-4 short paragraphs, factual, mention key features, materials, size cues, and any visible wear. No made-up specs.
- Condition: pick one of new, like_new, good, fair, for_parts based on visible wear.
- Category: pick the single best-fit id from the provided list.
- Price: a fair used market price in BBD as an integer. If you truly cannot estimate, use 0.
- Negotiable: true unless it's clearly a low-priced everyday item.

Return ONLY the JSON object matching the tool schema — no prose.

Available categories:
${catList}`;

    const body = {
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: data.hint ? `Seller hint: ${data.hint}` : "No hint provided. Describe what you see." },
            { type: "image_url", image_url: { url: data.image_data_url } },
          ],
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "emit_listing",
            description: "Return the suggested listing fields.",
            parameters: {
              type: "object",
              additionalProperties: false,
              properties: {
                title: { type: "string" },
                description: { type: "string" },
                condition: { type: "string", enum: [...CONDITIONS] },
                category_id: { type: "string" },
                suggested_price_bbd: { type: "number" },
                negotiable: { type: "boolean" },
              },
              required: ["title", "description", "condition", "category_id", "suggested_price_bbd", "negotiable"],
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "emit_listing" } },
    };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
      },
      body: JSON.stringify(body),
    });

    if (res.status === 429) throw new Error("AI is busy — try again in a moment");
    if (res.status === 402) throw new Error("AI credits exhausted — please top up in workspace settings");
    if (!res.ok) throw new Error(`AI request failed (${res.status})`);

    const json = (await res.json()) as {
      choices?: Array<{
        message?: {
          tool_calls?: Array<{ function?: { arguments?: string } }>;
        };
      }>;
    };
    const argStr = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!argStr) throw new Error("AI returned no suggestion");

    const parsed = JSON.parse(argStr) as AiListingSuggestion;

    // Validate category is one we sent
    const validIds = new Set(data.categories.map((c) => c.id));
    if (!validIds.has(parsed.category_id)) {
      parsed.category_id = data.categories[0].id;
    }
    if (!(CONDITIONS as readonly string[]).includes(parsed.condition)) {
      parsed.condition = "good";
    }
    parsed.suggested_price_bbd = Math.max(0, Math.round(Number(parsed.suggested_price_bbd) || 0));
    parsed.title = String(parsed.title).slice(0, 120);
    parsed.description = String(parsed.description).slice(0, 4000);

    return parsed;
  });
