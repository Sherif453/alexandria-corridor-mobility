export const BACKEND_API_SECRET_HEADER = "X-Alex-Backend-Secret";

const DEFAULT_BACKEND_TIMEOUT_MS = 8000;

function getOptionalEnv(name: string): string | null {
  const value = process.env[name]?.trim();

  return value ? value : null;
}

function getBackendTimeoutMs(): number {
  const parsed = Number(process.env.BACKEND_API_TIMEOUT_MS);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_BACKEND_TIMEOUT_MS;
}

function isEnabled(value: string | undefined): boolean {
  return value === "true" || value === "1";
}

export function isBackendProxyConfigured(): boolean {
  return Boolean(getOptionalEnv("BACKEND_API_BASE_URL"));
}

export function isBackendAdminRefreshProxyEnabled(): boolean {
  return isEnabled(process.env.BACKEND_PROXY_ADMIN_REFRESH_ENABLED);
}

export function buildBackendApiUrl(requestUrl: string, backendBaseUrl: string): string {
  const incomingUrl = new URL(requestUrl);
  const baseUrl = new URL(backendBaseUrl);

  if (incomingUrl.origin === baseUrl.origin) {
    return "";
  }

  return new URL(`${incomingUrl.pathname}${incomingUrl.search}`, baseUrl).toString();
}

function copyResponseHeaders(headers: Headers): Headers {
  const copied = new Headers();
  const allowedHeaders = [
    "cache-control",
    "content-type",
    "etag",
    "last-modified",
    "x-robots-tag",
  ];

  for (const header of allowedHeaders) {
    const value = headers.get(header);

    if (value) {
      copied.set(header, value);
    }
  }

  return copied;
}

export async function proxyApiRequest(request: Request): Promise<Response | null> {
  const backendBaseUrl = getOptionalEnv("BACKEND_API_BASE_URL");

  if (!backendBaseUrl) {
    return null;
  }

  const targetUrl = buildBackendApiUrl(request.url, backendBaseUrl);

  if (!targetUrl) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getBackendTimeoutMs());
  const headers = new Headers({
    Accept: "application/json",
  });
  const contentType = request.headers.get("Content-Type");
  const backendSecret = getOptionalEnv("BACKEND_API_SECRET");

  if (contentType) {
    headers.set("Content-Type", contentType);
  }

  if (backendSecret) {
    headers.set(BACKEND_API_SECRET_HEADER, backendSecret);
  }

  try {
    const response = await fetch(targetUrl, {
      body: request.method === "GET" || request.method === "HEAD"
        ? undefined
        : await request.text(),
      cache: "no-store",
      headers,
      method: request.method,
      redirect: "manual",
      signal: controller.signal,
    });

    return new Response(response.body, {
      headers: copyResponseHeaders(response.headers),
      status: response.status,
      statusText: response.statusText,
    });
  } finally {
    clearTimeout(timeout);
  }
}
