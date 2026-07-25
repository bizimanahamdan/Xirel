// Image storage as inline data URIs — stored directly in the database record
// rather than on local disk. This means product images survive on hosts
// whose filesystem doesn't persist (most free-tier PaaS), with zero extra
// service (no S3/Cloudinary account needed). Fine for a small product
// catalog; swap in real object storage later if you need to host many large
// images.

export async function storagePut(
  _relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const buffer = typeof data === "string" ? Buffer.from(data) : Buffer.from(data);
  const dataUrl = `data:${contentType};base64,${buffer.toString("base64")}`;
  return { key: dataUrl, url: dataUrl };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  // relKey is already the full data URL in this scheme.
  return { key: relKey, url: relKey };
}
