type ApiErrorPayload = {
  status: "error";
  error: {
    code: string;
    message: string;
  };
};

type ApiSuccessPayload<T> = {
  status: "ok";
  data: T;
};

function mergeHeaders(headers?: HeadersInit): Headers {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Content-Type", "application/json; charset=utf-8");
  responseHeaders.set("X-Robots-Tag", "noindex");

  return responseHeaders;
}

export function apiOk<T>(data: T, init?: ResponseInit): Response {
  return Response.json(
    {
      status: "ok",
      data,
    } satisfies ApiSuccessPayload<T>,
    {
      ...init,
      headers: mergeHeaders(init?.headers),
    },
  );
}

export function apiError(
  status: number,
  code: string,
  message: string,
  init?: ResponseInit,
): Response {
  return Response.json(
    {
      status: "error",
      error: {
        code,
        message,
      },
    } satisfies ApiErrorPayload,
    {
      ...init,
      status,
      headers: mergeHeaders(init?.headers),
    },
  );
}
