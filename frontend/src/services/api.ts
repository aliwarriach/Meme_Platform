import { create, type ApiResponse } from 'apisauce';

import { API_BASE_URL } from '@/constants/config';

// 15s timeout so an unreachable/wrong-network backend fails fast with a clear error instead of
// hanging on the OS-level TCP connect timeout (which can take minutes). Generous enough for
// normal LAN calls including image uploads.
// `ngrok-skip-browser-warning` disables ngrok's free-tier HTML interstitial page, which would
// otherwise be returned instead of JSON when the backend is reached through an ngrok tunnel
// (harmless header for any non-ngrok backend).
export const api = create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'ngrok-skip-browser-warning': 'true' },
});

export function setAuthToken(token: string | null) {
  if (token) {
    api.setHeader('Authorization', `Bearer ${token}`);
  } else {
    api.deleteHeader('Authorization');
  }
}

// Logs every request/response apisauce makes — method, full URL, status, and apisauce's
// classification of what went wrong (network vs. server vs. client). This is the first
// place to look when a call "silently" fails: it proves whether the request ever left
// the device, and if it did, what actually came back.
if (__DEV__) {
  api.addMonitor((response) => {
    const method = response.config?.method?.toUpperCase();
    const url = `${response.config?.baseURL ?? ''}${response.config?.url ?? ''}`;
    if (response.ok) {
      console.log(`[api] ${method} ${url} -> ${response.status}`);
    } else {
      console.warn(
        `[api] ${method} ${url} -> FAILED`,
        `problem=${response.problem}`,
        `status=${response.status ?? 'none'}`,
        response.originalError?.message ? `originalError=${response.originalError.message}` : '',
        response.data
      );
    }
  });
}

type ValidationErrorItem = { msg?: string };

function extractDetailMessage(response: ApiResponse<unknown>): string | null {
  const detail = (response.data as { detail?: unknown } | undefined)?.detail;

  if (typeof detail === 'string') return detail;

  // FastAPI/Pydantic validation errors return `detail` as a list of {msg, loc, type}.
  if (Array.isArray(detail) && detail.length > 0) {
    const messages = (detail as ValidationErrorItem[])
      .map((item) => item?.msg)
      .filter((msg): msg is string => typeof msg === 'string');
    if (messages.length > 0) return messages.join(' ');
  }

  return null;
}

// Human-readable description of *why* a call failed at the transport level (as opposed
// to a normal 4xx/5xx with a body), so "it didn't work" always comes with a reason.
function describeTransportProblem(response: ApiResponse<unknown>): string {
  const method = response.config?.method?.toUpperCase() ?? 'request';
  const url = `${response.config?.baseURL ?? ''}${response.config?.url ?? ''}`;

  switch (response.problem) {
    case 'NETWORK_ERROR':
    case 'CONNECTION_ERROR':
      return `Could not reach the server at ${url} (${method}). Is the backend running and is EXPO_PUBLIC_API_URL set correctly?`;
    case 'TIMEOUT_ERROR':
      return `The request to ${url} (${method}) timed out.`;
    case 'CANCEL_ERROR':
      return `The request to ${url} (${method}) was cancelled.`;
    case 'SERVER_ERROR':
      return `The server returned an error (status ${response.status}) for ${method} ${url}.`;
    case 'CLIENT_ERROR':
      return `The request was rejected (status ${response.status}) for ${method} ${url}.`;
    default:
      return `${method} ${url} failed (status ${response.status ?? 'unknown'}).`;
  }
}

/**
 * Throws a descriptive Error for a failed apisauce response: prefers the backend's own
 * `detail` message (single string or Pydantic validation list), falling back to a
 * transport-level description (network/timeout/server/client) rather than a generic
 * "something went wrong" — so the thrown message always says what actually happened.
 * Doesn't itself log to the console — the monitor above already logs every failed
 * request, including ones a screen handles gracefully (e.g. an expected 403), so a
 * second console.error here would just be alarming duplicate noise for non-bugs.
 */
export function throwApiError(response: ApiResponse<unknown>, context: string): never {
  const detailMessage = extractDetailMessage(response);
  throw new Error(detailMessage ?? describeTransportProblem(response));
}
