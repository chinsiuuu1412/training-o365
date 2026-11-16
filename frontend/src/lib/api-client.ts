import type { ApiEnvelope, Page } from "@/types/api";

export class ApiClientError extends Error {
  status: number;
  code: string;
  details: Record<string, unknown> | null;
  retryAfter: number | null;
  isNetworkError: boolean;
  isUncertainOutcome: boolean;

  constructor(params: {
    message: string;
    status: number;
    code: string;
    details?: Record<string, unknown> | null;
    retryAfter?: number | null;
    isNetworkError?: boolean;
    isUncertainOutcome?: boolean;
  }) {
    super(params.message);
    this.name = "ApiClientError";
    this.status = params.status;
    this.code = params.code;
    this.details = params.details ?? null;
    this.retryAfter = params.retryAfter ?? null;
    this.isNetworkError = Boolean(params.isNetworkError);
    this.isUncertainOutcome = Boolean(params.isUncertainOutcome);
  }
}

export const ApiError = ApiClientError;

export function formatApiError(err: unknown, fallback = "Yêu cầu không thành công."): string {
  if (err instanceof ApiClientError) {
    return err.message || fallback;
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return fallback;
}

export interface ApiRequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  idempotencyKey?: string;
  skipUnauthorizedHandler?: boolean;
}

let csrfTokenInMemory: string | null = null;
let serverOffsetMs = 0;
let unauthorizedHandler: (() => void) | null = null;
let fetchImpl: typeof fetch = (...args) => globalThis.fetch(...args);

export function setCsrfToken(token: string | null) {
  csrfTokenInMemory = token;
}

export function getCsrfToken(): string | null {
  return csrfTokenInMemory;
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

export function setFetchImplementation(fn: typeof fetch) {
  fetchImpl = fn;
}

export function getServerOffsetMs(): number {
  return serverOffsetMs;
}

export function getServerNowMs(): number {
  return Date.now() + serverOffsetMs;
}

export function resetApiClientStateForTests() {
  csrfTokenInMemory = null;
  serverOffsetMs = 0;
  unauthorizedHandler = null;
  fetchImpl = (...args) => globalThis.fetch(...args);
}

function updateServerClock(res: Response) {
  const dateHeader = res.headers.get("Date");
  if (!dateHeader) return;
  const parsed = Date.parse(dateHeader);
  if (!Number.isNaN(parsed)) {
    serverOffsetMs = parsed - Date.now();
  }
}

function parseRetryAfter(res: Response): number | null {
  const raw = res.headers.get("Retry-After");
  if (!raw) return null;
  const sec = Number(raw);
  return Number.isFinite(sec) && sec > 0 ? sec : null;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const method = options.method ?? "GET";
  const isMutation = method !== "GET";
  const headers: Record<string, string> = {
    ...(options.headers ?? {}),
  };

  if (isMutation) {
    headers["Content-Type"] = "application/json";
    if (path !== "/auth/login" && csrfTokenInMemory) {
      headers["X-CSRF-Token"] = csrfTokenInMemory;
    }
    if (options.idempotencyKey) {
      headers["Idempotency-Key"] = options.idempotencyKey;
    }
  }

  let response: Response;
  try {
    response = await fetchImpl(`/api/v1${path}`, {
      method,
      credentials: "include",
      headers,
      body: isMutation ? JSON.stringify(options.body ?? {}) : undefined,
      signal: options.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw err;
    }
    throw new ApiClientError({
      message: isMutation
        ? "Mất kết nối mạng khi gửi yêu cầu. Vui lòng kiểm tra dữ liệu hiện tại trước khi thử lại."
        : "Không thể kết nối tới máy chủ. Vui lòng thử lại.",
      status: 0,
      code: "network_error",
      isNetworkError: true,
      isUncertainOutcome: isMutation,
    });
  }

  updateServerClock(response);
  const retryAfter = parseRetryAfter(response);

  let envelope: ApiEnvelope<T> | null = null;
  try {
    envelope = (await response.json()) as ApiEnvelope<T>;
  } catch {
    envelope = null;
  }

  if (!response.ok || !envelope || envelope.error) {
    const code = envelope?.error?.code ?? (response.status >= 500 ? "internal_error" : "request_failed");
    let message = envelope?.error?.message;
    if (!message) {
      if (response.status === 429) {
        message = retryAfter
          ? `Thao tác quá nhanh. Vui lòng thử lại sau ${retryAfter} giây.`
          : "Thao tác quá nhanh. Vui lòng thử lại sau.";
      } else if (response.status >= 500) {
        message = isMutation
          ? "Máy chủ gặp sự cố khi xử lý. Vui lòng kiểm tra trạng thái hiện tại trước khi thử lại."
          : "Hệ thống đang bận hoặc gặp sự cố. Vui lòng thử lại.";
      } else {
        message = "Yêu cầu không thành công.";
      }
    } else if (response.status === 429 && retryAfter) {
      message = `${message} (Thử lại sau ${retryAfter} giây)`;
    }

    if (response.status === 401 && path !== "/auth/login" && !options.skipUnauthorizedHandler) {
      csrfTokenInMemory = null;
      unauthorizedHandler?.();
    }

    throw new ApiClientError({
      message,
      status: response.status,
      code,
      details: envelope?.error?.details ?? null,
      retryAfter,
      isUncertainOutcome: isMutation && response.status >= 500,
    });
  }

  return envelope.data as T;
}

export async function fetchAllPages<T>(
  fetchPage: (page: number, pageSize: number) => Promise<Page<T>>,
  pageSize = 100,
): Promise<T[]> {
  const all: T[] = [];
  let page = 1;
  while (true) {
    const res = await fetchPage(page, pageSize);
    all.push(...res.items);
    if (all.length >= res.total || res.items.length === 0) {
      break;
    }
    page += 1;
  }
  return all;
}

export function buildQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") {
      qs.set(k, String(v));
    }
  }
  const str = qs.toString();
  return str ? `?${str}` : "";
}
