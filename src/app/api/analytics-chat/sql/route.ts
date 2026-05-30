import { NextResponse } from "next/server";
import { executeReadonlySql } from "@/lib/analytics/readonlySql";

/** Allow slow analytics queries on serverless hosts (e.g. Vercel). */
export const maxDuration = 60;

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers.Vary = "Origin";
  } else {
    headers["Access-Control-Allow-Origin"] = "*";
  }
  return headers;
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

export async function POST(request: Request) {
  let body: { sql?: unknown };

  try {
    body = (await request.json()) as { sql?: unknown };
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body." },
      { status: 400, headers: corsHeaders(request) },
    );
  }

  const result = await executeReadonlySql(body.sql);
  const status = result.success ? 200 : 400;
  return NextResponse.json(result, { status, headers: corsHeaders(request) });
}
