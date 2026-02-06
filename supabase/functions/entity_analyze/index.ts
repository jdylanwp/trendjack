import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface EntityMention {
  mention_date: string;
  mention_count: number;
}

function calculateLinearRegression(data: { x: number; y: number }[]): {
  slope: number;
  rsquared: number;
} {
  const n = data.length;
  if (n < 2) return { slope: 0, rsquared: 0 };

  const sumX = data.reduce((sum, p) => sum + p.x, 0);
  const sumY = data.reduce((sum, p) => sum + p.y, 0);
  const sumXY = data.reduce((sum, p) => sum + p.x * p.y, 0);
  const sumX2 = data.reduce((sum, p) => sum + p.x * p.x, 0);
  const sumY2 = data.reduce((sum, p) => sum + p.y * p.y, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

  const meanY = sumY / n;
  const ssTotal = data.reduce((sum, p) => sum + Math.pow(p.y - meanY, 2), 0);
  const ssResidual = data.reduce((sum, p) => {
    const predicted = slope * p.x + (sumY - slope * sumX) / n;
    return sum + Math.pow(p.y - predicted, 2);
  }, 0);

  const rsquared = ssTotal > 0 ? 1 - ssResidual / ssTotal : 0;

  return { slope, rsquared };
}

function calculateZScore(recentVolume: number, historicalData: number[]): number {
  if (historicalData.length < 2) return 0;

  const mean = historicalData.reduce((a, b) => a + b, 0) / historicalData.length;
  const variance =
    historicalData.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
    historicalData.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return 0;

  return (recentVolume - mean) / stdDev;
}

function classifyTrend(
  zScore: number,
  slope: number,
  rsquared: number,
  volume24h: number
): string {
  if (volume24h < 3) return "New";

  if (zScore > 2 && volume24h > 10) return "Exploding";

  if (slope > 0.15 && rsquared > 0.7 && volume24h > 5) return "Slow Burn";

  if (zScore < -1 && slope < -0.1) return "Declining";

  if (volume24h > 20) return "Peaked";

  return "Stable";
}

async function analyzeEntity(supabase: any, entityId: string, entityName: string) {
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);

  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 7);

  const oneDayAgo = new Date(today);
  oneDayAgo.setDate(today.getDate() - 1);

  const { data: mentions, error } = await supabase
    .from("entity_mentions")
    .select("mention_date, mention_count")
    .eq("global_entity_id", entityId)
    .gte("mention_date", thirtyDaysAgo.toISOString().split("T")[0])
    .order("mention_date", { ascending: true });

  if (error || !mentions || mentions.length === 0) {
    return null;
  }

  const mentionsByDate = new Map<string, number>();
  mentions.forEach((m: EntityMention) => {
    mentionsByDate.set(m.mention_date, m.mention_count);
  });

  let volume24h = 0;
  let volume7d = 0;
  let volume30d = 0;

  const regressionData: { x: number; y: number }[] = [];
  const historicalVolumes: number[] = [];

  for (let i = 0; i <= 30; i++) {
    const checkDate = new Date(thirtyDaysAgo);
    checkDate.setDate(thirtyDaysAgo.getDate() + i);
    const dateStr = checkDate.toISOString().split("T")[0];
    const count = mentionsByDate.get(dateStr) || 0;

    volume30d += count;

    if (i >= 24) volume7d += count;
    if (i >= 30) volume24h += count;

    if (i < 30) historicalVolumes.push(count);

    regressionData.push({ x: i, y: count });
  }

  const { slope, rsquared } = calculateLinearRegression(regressionData);

  const zScore = calculateZScore(volume24h, historicalVolumes);

  const trendStatus = classifyTrend(zScore, slope, rsquared, volume24h);

  await supabase
    .from("global_entities")
    .update({
      volume_24h: volume24h,
      volume_7d: volume7d,
      volume_30d: volume30d,
      z_score: zScore,
      growth_slope: slope,
      trend_status: trendStatus,
      last_analyzed_at: new Date().toISOString(),
    })
    .eq("id", entityId);

  return {
    entity_name: entityName,
    volume_24h: volume24h,
    volume_7d: volume7d,
    volume_30d: volume30d,
    z_score: parseFloat(zScore.toFixed(2)),
    growth_slope: parseFloat(slope.toFixed(4)),
    rsquared: parseFloat(rsquared.toFixed(2)),
    trend_status: trendStatus,
  };
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

    let batchSize = 20;
    let specificEntityId = null;

    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body.batch_size) batchSize = body.batch_size;
        if (body.entity_id) specificEntityId = body.entity_id;
      } catch {
        // Ignore parse errors
      }
    }

    let query = supabase
      .from("global_entities")
      .select("id, entity_name, last_analyzed_at")
      .order("last_analyzed_at", { ascending: true });

    if (specificEntityId) {
      query = query.eq("id", specificEntityId).limit(1);
    } else {
      query = query.limit(batchSize);
    }

    const { data: entities, error: entitiesError } = await query;

    if (entitiesError) {
      throw new Error(`Failed to fetch entities: ${entitiesError.message}`);
    }

    if (!entities || entities.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No entities to analyze",
          analyzed: 0,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const results = [];
    for (const entity of entities) {
      const analysis = await analyzeEntity(supabase, entity.id, entity.entity_name);
      if (analysis) {
        results.push(analysis);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        analyzed: results.length,
        results: results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Entity analysis error:", error);
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