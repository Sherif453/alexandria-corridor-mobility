import { NextResponse, type NextRequest } from "next/server";

const BACKEND_API_SECRET_HEADER = "X-Alex-Backend-Secret";

function isEnabled(value: string | undefined): boolean {
  return value === "true" || value === "1";
}

export function proxy(request: NextRequest) {
  if (!isEnabled(process.env.API_REQUIRE_BACKEND_SECRET)) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname === "/api/health") {
    return NextResponse.next();
  }

  const backendSecret = process.env.BACKEND_API_SECRET?.trim();

  if (!backendSecret) {
    return NextResponse.json(
      {
        status: "error",
        error: {
          code: "BACKEND_SECRET_NOT_CONFIGURED",
          message: "Backend API secret is not configured.",
        },
      },
      { status: 500 },
    );
  }

  if (request.headers.get(BACKEND_API_SECRET_HEADER) !== backendSecret) {
    return NextResponse.json(
      {
        status: "error",
        error: {
          code: "BACKEND_API_FORBIDDEN",
          message: "Backend API access is not allowed.",
        },
      },
      { status: 403 },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
