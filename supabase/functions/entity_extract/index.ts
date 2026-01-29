import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface EntityExtractionResult {
  entity: string;
  category: string;
  confidence: number;
}

async function extractEntitiesWithAI(titles: string[]): Promise<EntityExtractionResult[]> {
  const openrouterKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!openrouterKey) {
    throw new Error("OPENROUTER_API_KEY not configured");
  }

  const prompt = `You are an expert trend analyst. Extract specific products, brands, technologies, concepts, or emerging topics from these article titles.

RULES:
- Ignore generic words like "review", "best", "guide", "how to", "2025"
- Focus on proper nouns, brand names, specific products, or unique concepts
- Return ONLY entities that represent real trends or topics people would search for
- Categorize each entity (SaaS, Health, Marketing, Finance, Tech, AI, E-commerce, etc.)
- Return max 10 entities, prioritize the most specific and interesting ones

Titles:
${titles.join("\n")}

Return a JSON array of objects with this exact format:
[{"entity": "Cursor AI", "category": "SaaS", "confidence": 0.95}, ...]`;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openrouterKey}`,
        "HTTP-Referer": "https://trendjack.app",
        "X-Title": "TrendJack Entity Extraction",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error("No valid JSON array in response");
    }

    const entities = JSON.parse(jsonMatch[0]);
    return entities.filter((e: EntityExtractionResult) =>
      e.entity && e.category && e.confidence > 0.6
    );
  } catch (error) {
    console.error("AI extraction error:", error);
    return [];
  }
}

async function upsertGlobalEntity(
  supabase: any,
  entityName: string,
  category: string,
  source: string
) {
  const today = new Date().toISOString().split('T')[0];

  const { data: existing, error: fetchError } = await supabase
    .from("global_entities")
    .select("id, volume_24h, total_mentions")
    .eq("entity_name", entityName)
    .maybeSingle();

  if (fetchError) {
    console.error("Fetch error:", fetchError);
    return null;
  }

  if (existing) {
    const { error: updateError } = await supabase
      .from("global_entities")
      .update({
        volume_24h: existing.volume_24h + 1,
        total_mentions: existing.total_mentions + 1,
        last_analyzed_at: new Date().toISOString(),
        category: category,
      })
      .eq("id", existing.id);

    if (updateError) {
      console.error("Update error:", updateError);
      return null;
    }

    await supabase
      .from("entity_mentions")
      .upsert({
        global_entity_id: existing.id,
        mention_date: today,
        source: source,
        mention_count: 1,
      }, {
        onConflict: "global_entity_id,mention_date,source",
        ignoreDuplicates: false,
      });

    return existing.id;
  } else {
    const { data: newEntity, error: insertError } = await supabase
      .from("global_entities")
      .insert({
        entity_name: entityName,
        category: category,
        volume_24h: 1,
        volume_7d: 1,
        volume_30d: 1,
        total_mentions: 1,
        trend_status: "New",
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return null;
    }

    await supabase
      .from("entity_mentions")
      .insert({
        global_entity_id: newEntity.id,
        mention_date: today,
        source: source,
        mention_count: 1,
      });

    return newEntity.id;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { titles, source = "news", batch_size = 20 } = await req.json();

    if (!titles || !Array.isArray(titles) || titles.length === 0) {
      return new Response(
        JSON.stringify({ error: "titles array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const batchedTitles = titles.slice(0, batch_size);

    const entities = await extractEntitiesWithAI(batchedTitles);

    const results = [];
    for (const entity of entities) {
      const entityId = await upsertGlobalEntity(
        supabase,
        entity.entity,
        entity.category,
        source
      );

      if (entityId) {
        results.push({
          entity_id: entityId,
          entity_name: entity.entity,
          category: entity.category,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        extracted: results.length,
        entities: results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Entity extraction error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});