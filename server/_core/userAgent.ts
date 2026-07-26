/**
 * Minimal, dependency-free user-agent parsing. Good enough for "what kind of
 * device/browser are our visitors using" analytics — not meant to be a
 * exhaustive UA database.
 */
export function parseUserAgent(userAgent: string | undefined | null) {
  const ua = userAgent ?? "";

  let device: "mobile" | "tablet" | "desktop" | "unknown" = "unknown";
  if (/iPad|Android(?!.*Mobile)|Tablet/i.test(ua)) {
    device = "tablet";
  } else if (/Mobi|iPhone|Android/i.test(ua)) {
    device = "mobile";
  } else if (ua.length > 0) {
    device = "desktop";
  }

  let browser = "unknown";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/OPR\/|Opera/i.test(ua)) browser = "Opera";
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = "Chrome";
  else if (/CriOS/i.test(ua)) browser = "Chrome (iOS)";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Safari\//i.test(ua) && /Version\//i.test(ua)) browser = "Safari";
  else if (ua.length > 0) browser = "Other";

  let os = "unknown";
  if (/Windows/i.test(ua)) os = "Windows";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/Mac OS X/i.test(ua)) os = "macOS";
  else if (/Linux/i.test(ua)) os = "Linux";
  else if (ua.length > 0) os = "Other";

  return { device, browser, os };
}
