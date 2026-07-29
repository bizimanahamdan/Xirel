import { ENV } from "./env";

const SYSTEM_PROMPT = `You are the friendly customer support assistant for Xirel, an online store selling premium electronics and outfits (clothing/fashion).

Key facts about Xirel:
- Product categories: Electronics and Outfits.
- Payment: customers pay via mobile money (MTN MoMo / Airtel Money) or Mastercard, following the instructions shown at checkout. Payments are confirmed manually by the store admin after the customer sends payment and provides a reference.
- Returns: see the store's Return Policy page for the return window and conditions.
- Support: for anything you can't resolve, tell the customer they can reach the team directly on WhatsApp (there's a WhatsApp button on the Support page).
- Order status: customers can check their order history from "My Account" > "Order History" when logged in.

Guidelines:
- Be warm, concise, and helpful. Keep answers short (2-4 sentences) unless more detail is clearly needed.
- If you don't know something specific about an order (you have no access to order data), direct the customer to WhatsApp or their Order History page rather than guessing.
- Don't make up policies, prices, or shipping times you don't actually know — point to the FAQ/Return Policy pages or WhatsApp instead.
- Never ask for or repeat back sensitive information like full card numbers, passwords, or one-time codes.`;

export type ChatMessage = { role: "user" | "assistant"; content: string };

export async function getChatbotReply(history: ChatMessage[]): Promise<string> {
  if (!ENV.groqApiKey) {
    return "Live chat isn't set up yet — please reach out on WhatsApp instead, we reply quickly there!";
  }

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ENV.groqApiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...history],
        temperature: 0.4,
        max_tokens: 400,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      console.error("Groq API error:", response.status, errorBody);
      return "Sorry, I'm having trouble responding right now — please try WhatsApp instead.";
    }

    const data = await response.json();
    const reply = data?.choices?.[0]?.message?.content;
    return typeof reply === "string" && reply.trim()
      ? reply.trim()
      : "Sorry, I didn't quite catch that — could you rephrase, or reach us on WhatsApp?";
  } catch (error) {
    console.error("Groq request failed:", error);
    return "Sorry, I'm having trouble responding right now — please try WhatsApp instead.";
  }
}
