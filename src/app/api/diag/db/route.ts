import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      {
        ok: false,
        stage: "env",
        error: "Missing SUPABASE_URL or SUPABASE_KEY",
      },
      { status: 500 },
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const countProbe = await supabase.schema("onepoint").from("call_data").select("*", { count: "exact", head: true });
    const sampleProbe = await supabase.schema("onepoint").from("call_data").select("*").limit(1);
    const callsCountProbe = await supabase.schema("onepoint").from("calls").select("*", { count: "exact", head: true });

    const ok =
      !countProbe.error && !sampleProbe.error && !callsCountProbe.error;

    return NextResponse.json({
      ok,
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
      callsCountProbe: {
        count: callsCountProbe.count ?? null,
        error: callsCountProbe.error
          ? {
              code: callsCountProbe.error.code ?? null,
              message: callsCountProbe.error.message ?? "",
              details: callsCountProbe.error.details ?? null,
              hint: callsCountProbe.error.hint ?? null,
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
