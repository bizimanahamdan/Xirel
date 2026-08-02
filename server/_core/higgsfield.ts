import { HiggsfieldClient, InputImage, DoPModel } from "@higgsfield/client";
import { ENV } from "./env";

const DEFAULT_PROMPT =
  "Slow cinematic 360-degree rotation showcase of this product on a clean studio background, professional product photography lighting, smooth camera movement";

export function isHiggsfieldConfigured(): boolean {
  return Boolean(ENV.higgsfieldApiKey && ENV.higgsfieldApiSecret);
}

let cachedClient: HiggsfieldClient | null = null;

function getClient(): HiggsfieldClient {
  if (!isHiggsfieldConfigured()) {
    throw new Error("Higgsfield isn't configured — set HIGGSFIELD_API_KEY and HIGGSFIELD_API_SECRET.");
  }
  if (!cachedClient) {
    cachedClient = new HiggsfieldClient({
      apiKey: ENV.higgsfieldApiKey,
      apiSecret: ENV.higgsfieldApiSecret,
      // Video generation can genuinely take a couple of minutes — give the
      // SDK's built-in polling enough room rather than timing out early.
      maxPollTime: 5 * 60 * 1000,
    });
  }
  return cachedClient;
}

/**
 * Generates a short cinematic showcase video from a single product image.
 * Returns the resulting video's URL (hosted on Higgsfield's CDN — the
 * caller is responsible for re-hosting it elsewhere, e.g. Cloudinary, if
 * long-term persistence independent of Higgsfield is wanted).
 */
export async function generateProductShowcaseVideo(
  imageUrl: string,
  prompt?: string
): Promise<string> {
  const client = getClient();

  const jobSet = await client.generate(
    "/v1/image2video/dop",
    {
      model: DoPModel.TURBO,
      prompt: prompt ?? DEFAULT_PROMPT,
      input_images: [InputImage.fromUrl(imageUrl)],
    },
    { withPolling: true }
  );

  if (jobSet.isFailed) {
    throw new Error("Higgsfield video generation failed.");
  }
  if (jobSet.isNsfw) {
    throw new Error("Higgsfield flagged this image's content and declined to generate a video.");
  }
  if (!jobSet.isCompleted) {
    throw new Error("Higgsfield video generation didn't complete in time — try again.");
  }

  const url = jobSet.jobs[0]?.results?.raw?.url;
  if (!url) {
    throw new Error("Higgsfield returned no video URL.");
  }

  return url;
}
