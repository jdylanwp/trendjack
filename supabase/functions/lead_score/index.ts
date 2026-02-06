import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createDeps } from "./deps.ts";
import { runPipeline } from "./pipeline.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    let batchSize = 10;

    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body.batch_size) batchSize = body.batch_size;
      } catch {
        // Use default batch size
      }
    }

    const deps = createDeps();
    const result = await runPipeline(deps, batchSize);

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        success: false,
        error: (err as Error).message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
