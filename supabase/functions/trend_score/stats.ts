import type { TrendBucket, TrendAnalysis } from "./types.ts";

const Z_SCORE_THRESHOLD = 1.5;
const MIN_CURRENT_COUNT = 5;

export function computeMean(values: number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((s, v) => s + v, 0);
  return sum / values.length;
}

export function computeStdDev(values: number[], mean: number): number {
  if (values.length === 0) return 0;
  const variance =
    values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

export function computeZScore(
  current: number,
  mean: number,
  stdDev: number
): number {
  if (stdDev === 0) return 0;
  return (current - mean) / stdDev;
}

export function computeHeatScore(current: number, mean: number): number {
  return (current - mean) / (mean + 1);
}

export function detectTrend(zScore: number, currentCount: number): boolean {
  return zScore > Z_SCORE_THRESHOLD && currentCount >= MIN_CURRENT_COUNT;
}

export function analyzeSeries(
  buckets: TrendBucket[],
  windowHours: number,
  now: Date
): TrendAnalysis | null {
  if (buckets.length === 0) return null;

  const cutoff = new Date(now);
  cutoff.setHours(cutoff.getHours() - windowHours);

  const recentBuckets = buckets.filter(
    (b) => new Date(b.bucket_start) >= cutoff
  );

  const current24hCount = recentBuckets.reduce(
    (s, b) => s + b.news_count,
    0
  );

  const allCounts = buckets.map((b) => b.news_count);
  const mean = computeMean(allCounts);
  const stdDev = computeStdDev(allCounts, mean);
  const zScore = computeZScore(current24hCount, mean, stdDev);
  const heatScore = computeHeatScore(current24hCount, mean);
  const isTrending = detectTrend(zScore, current24hCount);

  return {
    current24hCount,
    mean: parseFloat(mean.toFixed(2)),
    stdDev: parseFloat(stdDev.toFixed(2)),
    zScore: parseFloat(zScore.toFixed(2)),
    heatScore: parseFloat(heatScore.toFixed(2)),
    isTrending,
    totalBuckets: buckets.length,
    current24hBuckets: recentBuckets.length,
  };
}
