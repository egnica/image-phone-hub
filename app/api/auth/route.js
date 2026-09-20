import {
  authConfigured,
  clearedSessionCookie,
  isAuthenticated,
  sessionCookie,
  verifyPassword,
} from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request) {
  return Response.json({
    configured: authConfigured(),
    authenticated: isAuthenticated(request),
  });
}

export async function POST(request) {
  if (!authConfigured()) {
    return Response.json(
      { error: "MEDIA_HUB_PASSWORD is not configured." },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => ({}));
  if (!verifyPassword(body.password)) {
    return Response.json({ error: "Incorrect password." }, { status: 401 });
  }

  return new Response(JSON.stringify({ authenticated: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": sessionCookie(),
    },
  });
}

export async function DELETE() {
  return new Response(JSON.stringify({ authenticated: false }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": clearedSessionCookie(),
    },
  });
}
