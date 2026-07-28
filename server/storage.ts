// Image storage: uploads to Cloudinary when configured (recommended for any
// real deployment — real CDN-hosted URLs, no database bloat). Falls back to
// storing images as inline base64 data URIs directly in the database when
// Cloudinary isn't configured, so the app still works with zero setup.

import { v2 as cloudinary } from "cloudinary";
import { ENV } from "./_core/env";

let cloudinaryConfigured = false;

function isCloudinaryEnabled() {
  return Boolean(ENV.cloudinaryCloudName && ENV.cloudinaryApiKey && ENV.cloudinaryApiSecret);
}

function ensureCloudinaryConfigured() {
  if (cloudinaryConfigured) return;
  cloudinary.config({
    cloud_name: ENV.cloudinaryCloudName,
    api_key: ENV.cloudinaryApiKey,
    api_secret: ENV.cloudinaryApiSecret,
  });
  cloudinaryConfigured = true;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const buffer = typeof data === "string" ? Buffer.from(data) : Buffer.from(data);
  const dataUrl = `data:${contentType};base64,${buffer.toString("base64")}`;

  if (isCloudinaryEnabled()) {
    ensureCloudinaryConfigured();
    try {
      const result = await cloudinary.uploader.upload(dataUrl, {
        folder: "xirel",
        resource_type: "image",
      });
      return { key: result.public_id, url: result.secure_url };
    } catch (error) {
      console.error("Cloudinary upload failed, falling back to inline storage:", error);
      // Fall through to the data-URI fallback below rather than losing the
      // upload entirely.
    }
  }

  return { key: dataUrl, url: dataUrl };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  // For Cloudinary-hosted images, relKey is the public_id and the URL was
  // already returned by storagePut and stored on the record — nothing to
  // resolve here. For the data-URI fallback, relKey already *is* the URL.
  return { key: relKey, url: relKey };
}
