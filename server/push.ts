import { buildPushPayload, type PushSubscription } from '@block65/webcrypto-web-push';

export interface PushEnvironment {
  DB: D1Database;
  VAPID_SUBJECT?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
}

export interface PushNotice {
  title: string;
  body: string;
  url: string;
  tag: string;
}

interface StoredPushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export function isPushConfigured(env: PushEnvironment): boolean {
  return Boolean(env.VAPID_SUBJECT?.trim() && env.VAPID_PUBLIC_KEY?.trim() && env.VAPID_PRIVATE_KEY?.trim());
}

/**
 * Subscription endpoints are capability URLs. Restrict them to browser push
 * services before persisting so authenticated clients cannot turn push sends
 * into an arbitrary-request proxy.
 */
export function isValidPushEndpoint(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
    const host = url.hostname.toLowerCase();
    return host === 'fcm.googleapis.com'
      || host === 'web.push.apple.com'
      || host === 'push.services.mozilla.com'
      || host.endsWith('.push.services.mozilla.com')
      || host === 'notify.windows.com'
      || host.endsWith('.notify.windows.com');
  } catch {
    return false;
  }
}

export async function sendPushToUser(
  env: PushEnvironment,
  userId: string,
  notice: PushNotice,
  ttlSeconds = 24 * 60 * 60,
): Promise<void> {
  if (!isPushConfigured(env)) return;

  try {
    const result = await env.DB.prepare(`SELECT endpoint, p256dh, auth
      FROM push_subscriptions WHERE user_id = ? ORDER BY updated_at DESC LIMIT 8`)
      .bind(userId).all<StoredPushSubscription>();
    const subscriptions = result.results ?? [];
    await Promise.allSettled(subscriptions.map(async row => {
      if (!isValidPushEndpoint(row.endpoint)) {
        await env.DB.prepare('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?')
          .bind(userId, row.endpoint).run();
        return;
      }

      const subscription: PushSubscription = {
        endpoint: row.endpoint,
        expirationTime: null,
        keys: { p256dh: row.p256dh, auth: row.auth },
      };
      try {
        const payload = await buildPushPayload({
          data: notice,
          options: { ttl: Math.max(60, Math.min(ttlSeconds, 2_419_200)), urgency: 'high' },
        }, subscription, {
          subject: env.VAPID_SUBJECT,
          publicKey: env.VAPID_PUBLIC_KEY,
          privateKey: env.VAPID_PRIVATE_KEY,
        });
        const response = await fetch(row.endpoint, {
          ...payload,
          body: payload.body as BodyInit,
          redirect: 'manual',
          signal: AbortSignal.timeout(5_000),
        });
        if (response.status === 404 || response.status === 410) {
          await env.DB.prepare('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?')
            .bind(userId, row.endpoint).run();
        } else if (!response.ok) {
          // Do not log endpoint URLs or subscription keys: both are credentials.
          console.warn('Push delivery returned a non-success status:', response.status);
        }
      } catch {
        // Push delivery is best-effort and must never roll back the user action.
      }
    }));
  } catch {
    // Missing local migrations or a temporary D1 failure must not affect the app.
  }
}
