import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import { createHash } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const BATCH_SIZE = 25;

const model = new Supabase.ai.Session("gte-small");

function hashContent(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let limit = BATCH_SIZE;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body.limit) limit = Math.min(body.limit, 100);
      } catch {
        // use default
      }
    }

    const { data: posts, error: fetchError } = await supabase
      .from("reddit_posts")
      .select("id, title, body")
      .not(
        "id",
        "in",
        `(${(
          await supabase
            .from("post_embeddings")
            .select("reddit_post_id")
        ).data?.map((r: { reddit_post_id: string }) => r.reddit_post_id).join(",") || "00000000-0000-0000-0000-000000000000"})`
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (fetchError) {
      throw new Error(`Failed to fetch posts: ${fetchError.message}`);
    }

    if (!posts || posts.length === 0) {
      return new Response(
        JSON.stringify({ success: true, embedded: 0, message: "No new posts to embed" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const existingIds = await supabase
      .from("post_embeddings")
      .select("reddit_post_id")
      .in("reddit_post_id", posts.map((p: { id: string }) => p.id));

    const alreadyEmbedded = new Set(
      (existingIds.data || []).map((r: { reddit_post_id: string }) => r.reddit_post_id)
    );

    const toEmbed = posts.filter(
      (p: { id: string }) => !alreadyEmbedded.has(p.id)
    );

    let embedded = 0;
    const errors: string[] = [];

    for (const post of toEmbed) {
      try {
        const text = `${post.title} ${post.body}`.substring(0, 2000);
        const contentHash = hashContent(text);

        const existingHash = await supabase
          .from("post_embeddings")
          .select("id")
          .eq("reddit_post_id", post.id)
          .maybeSingle();

        if (existingHash.data) continue;

        const output = await model.run(text, {
          mean_pool: true,
          normalize: true,
        });

        const embedding = Array.from(output as Float32Array);

        const { error: insertError } = await supabase
          .from("post_embeddings")
          .insert({
            reddit_post_id: post.id,
            embedding: embedding,
            content_hash: contentHash,
          });

        if (insertError) {
          if (insertError.message.includes("duplicate")) continue;
          errors.push(`Post ${post.id}: ${insertError.message}`);
          continue;
        }

        embedded++;
      } catch (err) {
        errors.push(`Post ${post.id}: ${(err as Error).message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        embedded,
        processed: toEmbed.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
