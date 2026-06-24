import { API_BASE_URL } from '../config/googleAds';

function getApiBaseUrls() {
  const configuredBaseUrl = String(API_BASE_URL).replace(/\/$/, '');
  const isLocalBrowser =
    typeof window !== 'undefined' &&
    ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
  const localFallbacks =
    isLocalBrowser ||
    configuredBaseUrl.includes('localhost') ||
    configuredBaseUrl.includes('127.0.0.1') ||
    configuredBaseUrl.includes('[::1]')
      ? ['http://127.0.0.1:3001', 'http://localhost:3001']
      : [];

  return Array.from(new Set([configuredBaseUrl, '', ...localFallbacks]));
}

export async function apiFetch(path: string, options?: RequestInit) {
  let lastError: unknown;

  for (const baseUrl of getApiBaseUrls()) {
    try {
      const response = await window.fetch(`${baseUrl}${path}`, options);
      const contentType = response.headers.get('content-type') ?? '';
      const isUnexpectedHtml =
        response.ok &&
        contentType.includes('text/html') &&
        path.startsWith('/');

      if (isUnexpectedHtml) {
        lastError = new Error(`API route ${path.split('?')[0]} returned the frontend page`);
        continue;
      }

      return response;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Failed to fetch');
}

export async function parseJsonSafe(response: Response) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('text/html') || text.trimStart().startsWith('<!doctype')) {
      throw new Error('Backend API route is not configured. Restart the frontend dev server.');
    }
    return text;
  }
}

export function extractApiError(body: any, fallback: string) {
  const skippedReason = Array.isArray(body?.message?.skippedAds)
    ? body.message.skippedAds
        .map((item: any) => item?.reason)
        .find((reason: unknown): reason is string => typeof reason === 'string' && reason.length > 0)
    : '';

  if (typeof body?.message === 'string') {
    return body.message;
  }

  if (typeof body?.message?.message === 'string') {
    return [body.message.message, skippedReason].filter(Boolean).join(': ');
  }

  if (typeof body?.message?.details?.error?.message === 'string') {
    return body.message.details.error.message;
  }

  if (typeof body?.error?.message === 'string') {
    return body.error.message;
  }

  return fallback;
}
