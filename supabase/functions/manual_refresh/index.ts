import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization")!;

    const token = authHeader.replace("Bearer ", "");

    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "APIKey": supabaseServiceKey,
      },
    });

    if (!userResponse.ok) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const user = await userResponse.json();
    const userId = user.id;

    const limitsResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/check_manual_run_limit`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${supabaseServiceKey}`,
        "Content-Type": "application/json",
        "APIKey": supabaseServiceKey,
      },
      body: JSON.stringify({}),
    });

    const canRun = await limitsResponse.json();

    if (!canRun) {
      const limitsDataResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/get_user_tier_limits`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "APIKey": supabaseServiceKey,
        },
        body: JSON.stringify({ p_user_id: userId }),
      });

      const limitsData = await limitsDataResponse.json();
      const limit = limitsData[0]?.max_manual_runs_per_month || 0;

      return new Response(
        JSON.stringify({
          success: false,
          error: `Manual refresh limit reached (${limit} per month). Upgrade your plan for more manual refreshes.`,
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const keywordsResponse = await fetch(
      `${supabaseUrl}/rest/v1/monitored_keywords?user_id=eq.${userId}&enabled=eq.true&select=id,keyword,related_subreddit`,
      {
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          "APIKey": supabaseServiceKey,
        },
      }
    );

    const keywords = await keywordsResponse.json();

    if (!keywords || keywords.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "No keywords configured. Add keywords in Settings first.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const trendPromises = keywords.map((kw: any) =>
      fetch(`${supabaseUrl}/functions/v1/trend_fetch`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ keyword_id: kw.id }),
      })
    );

    await Promise.allSettled(trendPromises);

    const redditPromises = keywords.map((kw: any) =>
      fetch(`${supabaseUrl}/functions/v1/reddit_fetch`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ keyword_id: kw.id }),
      })
    );

    await Promise.allSettled(redditPromises);

    await fetch(`${supabaseUrl}/rest/v1/rpc/increment_usage`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "APIKey": supabaseServiceKey,
      },
      body: JSON.stringify({ p_usage_type: "manual_run", p_user_id: userId }),
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully refreshed data for ${keywords.length} keywords`,
        keywordsProcessed: keywords.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Manual refresh error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});