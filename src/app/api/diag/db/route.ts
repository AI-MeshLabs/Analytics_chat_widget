import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAnalyticsSchema, getSupabaseServiceKey, getSupabaseUrl } from "@/lib/supabaseConfig";

export async function GET() {
  let schema: string;
  try {
    schema = getAnalyticsSchema();
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        stage: "env",
        error: error instanceof Error ? error.message : "Invalid Supabase configuration",
      },
      { status: 500 },
    );
  }

  let supabaseUrl: string;
  let supabaseKey: string;
  try {
    supabaseUrl = getSupabaseUrl();
    supabaseKey = getSupabaseServiceKey();
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        stage: "env",
        error: error instanceof Error ? error.message : "Missing Supabase credentials",
      },
      { status: 500 },
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const countProbe = await supabase.schema(schema).from("calls").select("*", { count: "exact", head: true });
    const sampleProbe = await supabase.schema(schema).from("calls").select("*").limit(1);

    const ok = !countProbe.error && !sampleProbe.error;

    return NextResponse.json({
      ok,
      schema,
      table: "calls",
      stage: "query",
      countProbe: {
        count: countProbe.count ?? null,
        error: countProbe.error
          ? {
              code: countProbe.error.code ?? null,
              message: countProbe.error.message ?? "",
              details: countProbe.error.details ?? null,
              hint: countProbe.error.hint ?? null,
            }
          : null,
      },
      sampleProbe: {
        rowCount: sampleProbe.data?.length ?? 0,
        columns: sampleProbe.data && sampleProbe.data[0] ? Object.keys(sampleProbe.data[0]) : [],
        error: sampleProbe.error
          ? {
              code: sampleProbe.error.code ?? null,
              message: sampleProbe.error.message ?? "",
              details: sampleProbe.error.details ?? null,
              hint: sampleProbe.error.hint ?? null,
            }
          : null,
      },
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        stage: "exception",
        error: "Unexpected DB diagnostic failure",
      },
      { status: 500 },
    );
  }
}
