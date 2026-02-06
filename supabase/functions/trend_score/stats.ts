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

export function computeSnapScore(counts: number[]): number {
  if (counts.length < 4) return 0;

  const velocities: number[] = [];
  for (let i = 1; i < counts.length; i++) {
    velocities.push(counts[i] - counts[i - 1]);
  }

  const accelerations: number[] = [];
  for (let i = 1; i < velocities.length; i++) {
    accelerations.push(velocities[i] - velocities[i - 1]);
  }

  const jerks: number[] = [];
  for (let i = 1; i < accelerations.length; i++) {
    jerks.push(accelerations[i] - accelerations[i - 1]);
  }

  const currentJerk = jerks[jerks.length - 1];
  const currentAccel = accelerations[accelerations.length - 1];

  const meanAccel =
    accelerations.reduce((a, b) => a + b, 0) / accelerations.length;
  const variance =
    accelerations.reduce((a, b) => a + Math.pow(b - meanAccel, 2), 0) /
    accelerations.length;

  const stabilityFactor = variance === 0 ? 1 : variance;
  const svr = (currentJerk * Math.abs(currentAccel)) / stabilityFactor;

  return parseFloat(svr.toFixed(4));
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
  const snapScore = computeSnapScore(allCounts);

  return {
    current24hCount,
    mean: parseFloat(mean.toFixed(2)),
    stdDev: parseFloat(stdDev.toFixed(2)),
    zScore: parseFloat(zScore.toFixed(2)),
    heatScore: parseFloat(heatScore.toFixed(2)),
    isTrending,
    totalBuckets: buckets.length,
    current24hBuckets: recentBuckets.length,
    snapScore,
  };
}
