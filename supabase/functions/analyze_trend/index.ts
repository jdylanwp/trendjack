import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface AnalyzeRequest {
  keyword_id: string;
  topic?: string;
  hours?: number;
}

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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { keyword_id, topic, hours = 48 }: AnalyzeRequest = await req.json();

    if (!keyword_id) {
      return new Response(
        JSON.stringify({ error: "keyword_id is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: keyword, error: keywordError } = await supabase
      .from("monitored_keywords")
      .select("keyword")
      .eq("id", keyword_id)
      .maybeSingle();

    if (keywordError || !keyword) {
      return new Response(
        JSON.stringify({ error: "Keyword not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const { data: cachedAnalysis } = await supabase
      .from("trend_analyses")
      .select("*")
      .eq("keyword_id", keyword_id)
      .eq("topic", topic || keyword.keyword)
      .gte("analyzed_at", twentyFourHoursAgo.toISOString())
      .order("analyzed_at", { ascending: false })
      .maybeSingle();

    if (cachedAnalysis) {
      return new Response(
        JSON.stringify({
          success: true,
          analysis: {
            summary: cachedAnalysis.summary,
            confidence: cachedAnalysis.confidence,
            newsCount: cachedAnalysis.news_count,
            timeRange: cachedAnalysis.time_range,
            cached: true,
            analyzedAt: cachedAnalysis.analyzed_at
          }
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - hours);

    const { data: newsItems, error: newsError } = await supabase
      .from("news_items")
      .select("title, published_at")
      .eq("keyword_id", keyword_id)
      .gte("published_at", cutoffDate.toISOString())
      .order("published_at", { ascending: false })
      .limit(20);

    if (newsError) {
      throw new Error(`Failed to fetch news: ${newsError.message}`);
    }

    if (!newsItems || newsItems.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          analysis: {
            summary: [
              "No recent news found for this keyword.",
              "The system may need more time to collect data.",
              "Try again after the next trend_fetch cycle runs."
            ],
            confidence: "low",
            newsCount: 0
          }
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let filteredTitles = newsItems.map(item => item.title);
    if (topic) {
      filteredTitles = filteredTitles.filter(title =>
        title.toLowerCase().includes(topic.toLowerCase())
      );
    }

    if (filteredTitles.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          analysis: {
            summary: [
              `No news found specifically mentioning "${topic}".`,
              "The topic may be too new or the pattern hasn't been confirmed.",
              "Monitor for additional mentions in upcoming news cycles."
            ],
            confidence: "low",
            newsCount: 0
          }
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const openRouterKey = Deno.env.get("OPENROUTER_API_KEY");

    let analysis;
    if (openRouterKey) {
      analysis = await generateAIAnalysis(
        keyword.keyword,
        topic || keyword.keyword,
        filteredTitles,
        openRouterKey
      );
    } else {
      analysis = generateBasicAnalysis(
        keyword.keyword,
        topic || keyword.keyword,
        filteredTitles
      );
    }

    const confidence = filteredTitles.length >= 5 ? "high" : "medium";

    await supabase
      .from("trend_analyses")
      .insert({
        keyword_id: keyword_id,
        topic: topic || keyword.keyword,
        summary: analysis,
        confidence: confidence,
        news_count: filteredTitles.length,
        time_range: `${hours}h`,
        analyzed_at: new Date().toISOString()
      });

    return new Response(
      JSON.stringify({
        success: true,
        analysis: {
          summary: analysis,
          confidence: confidence,
          newsCount: filteredTitles.length,
          timeRange: `${hours}h`,
          cached: false
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Analysis error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Failed to analyze trend"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

async function generateAIAnalysis(
  keyword: string,
  topic: string,
  titles: string[],
  apiKey: string
): Promise<string[]> {
  const prompt = `You are analyzing trending news for a B2B lead generation tool.

Keyword being monitored: "${keyword}"
Topic that's trending: "${topic}"

Recent news headlines (last 48 hours):
${titles.slice(0, 15).map((t, i) => `${i + 1}. ${t}`).join('\n')}

Provide EXACTLY 3 bullet points (no more, no less) explaining WHY this topic is trending. Each bullet should:
- Be concise (max 20 words)
- Focus on the business opportunity or problem
- Be actionable for someone building B2B tools

Format your response as exactly 3 lines, one bullet point per line, no bullet symbols, no numbering, no extra text.`;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://trendjack.app",
      },
      body: JSON.stringify({
        model: "google/gemma-3-27b-it:free",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 200
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || "";

    const bullets = content
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0)
      .slice(0, 3);

    if (bullets.length === 3) {
      return bullets;
    }

    return generateBasicAnalysis(keyword, topic, titles);
  } catch (error) {
    console.error("AI analysis failed, falling back to basic:", error);
    return generateBasicAnalysis(keyword, topic, titles);
  }
}

function generateBasicAnalysis(
  keyword: string,
  topic: string,
  titles: string[]
): string[] {
  const topicLower = topic.toLowerCase();
  const keywordLower = keyword.toLowerCase();

  const commonWords = new Map<string, number>();
  titles.forEach(title => {
    const words = title.toLowerCase()
      .split(/\s+/)
      .filter(w =>
        w.length > 4 &&
        w !== topicLower &&
        w !== keywordLower &&
        !['about', 'after', 'their', 'which', 'where'].includes(w)
      );

    words.forEach(word => {
      commonWords.set(word, (commonWords.get(word) || 0) + 1);
    });
  });

  const topWords = Array.from(commonWords.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([word]) => word);

  return [
    `${titles.length} news items mention "${topic}" with "${keyword}" in the last 48 hours`,
    `Common themes: ${topWords.join(', ') || 'emerging pattern detected'}`,
    `This represents a ${titles.length >= 10 ? 'major' : 'growing'} opportunity for B2B solutions`
  ];
}
