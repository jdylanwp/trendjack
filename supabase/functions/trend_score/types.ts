import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export interface MonitoredKeyword {
  id: string;
  keyword: string;
}

export interface RawBucketRow {
  keyword_id: string;
  bucket_start: string;
  news_count: number;
}

export interface TrendBucket {
  bucket_start: string;
  news_count: number;
}

export interface TrendAnalysis {
  current24hCount: number;
  mean: number;
  stdDev: number;
  zScore: number;
  heatScore: number;
  isTrending: boolean;
  totalBuckets: number;
  current24hBuckets: number;
}

export interface TrendScoreRow {
  keyword_id: string;
  window_hours: number;
  heat_score: number;
  z_score: number;
  standard_deviation: number;
  baseline: Record<string, number>;
  is_trending: boolean;
  calculated_at: string;
}

export interface KeywordLog {
  timestamp: string;
  keyword: string;
  windowHours: number;
  current24hCount: number;
  baseline: number;
  heatScore: number;
  zScore: number;
  standardDeviation: number;
  isTrending: boolean;
  errors: string[];
}

export interface PipelineResult {
  success: boolean;
  summary: {
    keywordsProcessed: number;
    trendingKeywordsFound: number;
    trendingKeywords: {
      keyword: string;
      heatScore: number;
      zScore: number;
      current24hCount: number;
    }[];
  };
  executionLogs: KeywordLog[];
  startTime: string;
  endTime: string;
  error?: string;
}

export interface Deps {
  supabase: SupabaseClient;
}
