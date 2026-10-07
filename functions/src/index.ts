import { initializeApp } from 'firebase-admin/app';
import { getFirestore, type Transaction } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { defineInt, defineSecret, defineString } from 'firebase-functions/params';
import { logger } from 'firebase-functions';

initializeApp();

/**
 * The model key lives only here, as a Secret Manager secret:
 *   firebase functions:secrets:set AI_API_KEY
 * The provider, model and daily limit are deploy-time params (asked on the
 * first deploy, stored in functions/.env.<project>).
 */
const AI_API_KEY = defineSecret('AI_API_KEY');
const AI_PROVIDER = defineString('AI_PROVIDER', { default: 'anthropic', description: 'anthropic, openai or gemini' });
const AI_MODEL = defineString('AI_MODEL', { default: 'claude-opus-5-5', description: 'Model ID; the app should use the same one.' });
const AI_DAILY_LIMIT = defineInt('AI_DAILY_LIMIT', { default: 200, description: 'Requests per user per day.' });

const MAX_OUTPUT_TOKENS = 16_000;
const MAX_BODY_CHARS = 6_000_000; // a few downscaled photos at most
const ALLOWED_ANTHROPIC_BETAS = new Set(['server-side-fallback-2026-07-01']);

type Provider = 'anthropic' | 'openai' | 'gemini';

interface VendorRequest {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

interface ProxyRequest {
  provider: Provider;
  body: Record<string, unknown>;
  /** Only `anthropic-beta`, and only allowed values, is forwarded. */
  headers?: Record<string, string>;
}

/**
 * Forwards one model request from a signed-in F-AI user to the vendor,
 * adding the key. It pins the model and caps output tokens, so a client
 * can't use the key for anything else, and counts requests per user per
 * day. The response is the vendor's JSON, unchanged.
 */
export const aiProxy = onCall({ secrets: [AI_API_KEY], timeoutSeconds: 120, memory: '256MiB', maxInstances: 10 }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in to use the AI.');

  const data = request.data as Partial<ProxyRequest> | undefined;
  const provider = AI_PROVIDER.value() as Provider;
  if (!data || data.provider !== provider) throw new HttpsError('failed-precondition', `This server answers with ${provider}; set EXPO_PUBLIC_AI_PROVIDER=${provider}.`);
  if (!data.body || typeof data.body !== 'object') throw new HttpsError('invalid-argument', 'Missing request body.');
  if (JSON.stringify(data.body).length > MAX_BODY_CHARS) throw new HttpsError('invalid-argument', 'That request is too large.');

  await countRequest(uid, AI_DAILY_LIMIT.value());

  const vendor = buildVendorRequest(provider, AI_MODEL.value(), AI_API_KEY.value(), data.body, data.headers ?? {});
  const response = await fetch(vendor.url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...vendor.headers }, body: JSON.stringify(vendor.body) });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    logger.warn('vendor error', { provider, status: response.status, detail: detail.slice(0, 500) });
    if (response.status === 429) throw new HttpsError('resource-exhausted', 'The AI service is busy. Try again shortly.');
    if (response.status >= 500) throw new HttpsError('unavailable', 'The AI service is unavailable right now.');
    throw new HttpsError('internal', `AI request failed (${response.status}).`);
  }
  return response.json();
});

/** Counts one request against the user's daily limit; throws once it's reached. */
async function countRequest(uid: string, limit: number): Promise<void> {
  const day = new Date().toISOString().slice(0, 10);
  const ref = getFirestore().collection('aiUsage').doc(uid);
  await getFirestore().runTransaction(async (tx: Transaction) => {
    const snap = await tx.get(ref);
    const count = snap.exists && snap.get('day') === day ? (snap.get('count') as number) : 0;
    if (count >= limit) throw new HttpsError('resource-exhausted', "You've reached today's AI limit. It resets tomorrow.");
    tx.set(ref, { day, count: count + 1, updatedAt: new Date() });
  });
}

function buildVendorRequest(provider: Provider, model: string, apiKey: string, body: Record<string, unknown>, headers: Record<string, string>): VendorRequest {
  switch (provider) {
    case 'anthropic': {
      const beta = headers['anthropic-beta'];
      return {
        url: 'https://api.anthropic.com/v1/messages',
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', ...(beta && ALLOWED_ANTHROPIC_BETAS.has(beta) ? { 'anthropic-beta': beta } : {}) },
        body: { ...body, model, max_tokens: clamp(body.max_tokens) },
      };
    }
    case 'openai': {
      const { max_tokens: _legacy, ...rest } = body;
      return {
        url: 'https://api.openai.com/v1/chat/completions',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: { ...rest, model, max_completion_tokens: clamp(body.max_completion_tokens ?? _legacy) },
      };
    }
    case 'gemini': {
      const config = (body.generationConfig as Record<string, unknown> | undefined) ?? {};
      return {
        url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        headers: { 'x-goog-api-key': apiKey },
        body: { ...body, generationConfig: { ...config, maxOutputTokens: clamp(config.maxOutputTokens) } },
      };
    }
  }
}

function clamp(value: unknown): number {
  return typeof value === 'number' && value > 0 ? Math.min(Math.floor(value), MAX_OUTPUT_TOKENS) : 4096;
}
