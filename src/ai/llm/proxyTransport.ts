import { FunctionsError, getFunctions, httpsCallable } from 'firebase/functions';
import { getFirebaseApp } from '@/services/firebase/app';
import type { Transport } from './http';
import { LLMError } from './types';

const DEFAULT_TIMEOUT_MS = 20_000;

/**
 * Sends model requests through the `aiProxy` Cloud Function (functions/),
 * which adds the key on the server. The app holds no key in this mode; the
 * user must be signed in, and the server pins the model and a daily limit.
 * Only the request body (and Claude's beta header) is forwarded; the URL
 * and key headers are the server's.
 */
export const proxyTransport: Transport = async (call) => {
  const callable = httpsCallable(getFunctions(getFirebaseApp()), 'aiProxy', { timeout: call.timeoutMs ?? DEFAULT_TIMEOUT_MS });
  const beta = call.headers['anthropic-beta'];
  const request = callable({ provider: call.provider, body: call.body, headers: beta ? { 'anthropic-beta': beta } : {} });

  try {
    const result = await (call.signal ? raceAbort(request, call.signal) : request);
    return result.data;
  } catch (error) {
    throw toLLMError(error, call.vendor);
  }
};

function raceAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal.aborted) return reject(new LLMError('The AI request was cancelled.', false));
    const onAbort = () => reject(new LLMError('The AI request was cancelled.', false));
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
  });
}

export function toLLMError(error: unknown, vendor: string): LLMError {
  if (error instanceof LLMError) return error;
  if (error instanceof FunctionsError) {
    switch (error.code) {
      case 'functions/unauthenticated':
        return new LLMError('Sign in to F-AI to use the AI.', false);
      case 'functions/resource-exhausted':
        return new LLMError(error.message || "You've reached today's AI limit.", false);
      case 'functions/failed-precondition':
      case 'functions/invalid-argument':
      case 'functions/not-found':
      case 'functions/permission-denied':
        return new LLMError(error.message || 'The AI proxy refused this request.', false);
      default:
        return new LLMError(`Could not reach ${vendor} through F-AI's server (offline or timed out).`, true);
    }
  }
  return new LLMError(`Could not reach ${vendor} through F-AI's server.`, true);
}
