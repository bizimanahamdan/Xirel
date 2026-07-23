export type NotificationPayload = {
  title: string;
  content: string;
};

/**
 * Local, offline replacement for the old cloud notification service.
 * Simply logs to the server console — no network call is made, so this
 * always "succeeds" when running locally. Wire this up to email/webhook/etc.
 * yourself if you want real notifications.
 */
export async function notifyOwner(payload: NotificationPayload): Promise<boolean> {
  console.log(`[Notification] ${payload.title}: ${payload.content}`);
  return true;
}
