import type {
  Deps,
  MonitoredKeyword,
  TrendScoreRow,
  KeywordLog,
  PipelineResult,
} from "./types.ts";
import { analyzeSeries } from "./stats.ts";
import {
  fetchEnabledKeywords,
  fetchBucketsBatch,
  groupByKeyword,
  bulkInsertScores,
} from "./repo.ts";

const WINDOW_HOURS = 24;

function buildKeywordMap(
  keywords: MonitoredKeyword[]
): Map<string, MonitoredKeyword> {
  const map = new Map<string, MonitoredKeyword>();
  for (const kw of keywords) {
    map.set(kw.id, kw);
  }
  return map;
}

export async function runPipeline(deps: Deps): Promise<PipelineResult> {
  const startTime = new Date().toISOString();
  const now = new Date();
  const logs: KeywordLog[] = [];

  try {
    const keywords = await fetchEnabledKeywords(deps);

    if (keywords.length === 0) {
      return {
        success: true,
        summary: {
          keywordsProcessed: 0,
          trendingKeywordsFound: 0,
          trendingKeywords: [],
        },
        executionLogs: [],
        startTime,
        endTime: new Date().toISOString(),
      };
    }

    const keywordMap = buildKeywordMap(keywords);
    const keywordIds = keywords.map((kw) => kw.id);

    const rawRows = await fetchBucketsBatch(deps, keywordIds, now);
    const grouped = groupByKeyword(rawRows);

    const scoresToInsert: TrendScoreRow[] = [];

    for (const keyword of keywords) {
      const log: KeywordLog = {
        timestamp: new Date().toISOString(),
        keyword: keyword.keyword,
        windowHours: WINDOW_HOURS,
        current24hCount: 0,
        baseline: 0,
        heatScore: 0,
        zScore: 0,
        standardDeviation: 0,
        isTrending: false,
        errors: [],
      };

      const buckets = grouped.get(keyword.id);

      if (!buckets || buckets.length === 0) {
        log.errors.push("No historical data available");
        logs.push(log);
        continue;
      }

      const analysis = analyzeSeries(buckets, WINDOW_HOURS, now);

      if (!analysis) {
        log.errors.push("Analysis returned null");
        logs.push(log);
        continue;
      }

      log.current24hCount = analysis.current24hCount;
      log.baseline = analysis.mean;
      log.heatScore = analysis.heatScore;
      log.zScore = analysis.zScore;
      log.standardDeviation = analysis.stdDev;
      log.isTrending = analysis.isTrending;

      scoresToInsert.push({
        keyword_id: keyword.id,
        window_hours: WINDOW_HOURS,
        heat_score: analysis.heatScore,
        z_score: analysis.zScore,
        standard_deviation: analysis.stdDev,
        baseline: {
          mean: analysis.mean,
          stdDev: analysis.stdDev,
          current24h: analysis.current24hCount,
          totalBuckets: analysis.totalBuckets,
          current24hBuckets: analysis.current24hBuckets,
          snapScore: analysis.snapScore,
        },
        is_trending: analysis.isTrending,
        calculated_at: now.toISOString(),
      });

      logs.push(log);
    }

    const insertErrors = await bulkInsertScores(deps, scoresToInsert);
    if (insertErrors.length > 0) {
      for (const err of insertErrors) {
        logs[logs.length - 1]?.errors.push(err);
      }
    }

    const trending = logs.filter((l) => l.isTrending);

    return {
      success: true,
      summary: {
        keywordsProcessed: keywords.length,
        trendingKeywordsFound: trending.length,
        trendingKeywords: trending.map((l) => ({
          keyword: l.keyword,
          heatScore: l.heatScore,
          zScore: l.zScore,
          current24hCount: l.current24hCount,
        })),
      },
      executionLogs: logs,
      startTime,
      endTime: new Date().toISOString(),
    };
  } catch (err) {
    return {
      success: false,
      summary: {
        keywordsProcessed: 0,
        trendingKeywordsFound: 0,
        trendingKeywords: [],
      },
      executionLogs: logs,
      startTime,
      endTime: new Date().toISOString(),
      error: (err as Error).message,
    };
  }
}
