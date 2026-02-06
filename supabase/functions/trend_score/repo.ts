import type {
  Deps,
  MonitoredKeyword,
  RawBucketRow,
  TrendBucket,
  TrendScoreRow,
} from "./types.ts";

const HISTORY_DAYS = 7;
const BATCH_CHUNK_SIZE = 50;

export async function fetchEnabledKeywords(
  deps: Deps
): Promise<MonitoredKeyword[]> {
  const { data, error } = await deps.supabase
    .from("monitored_keywords")
    .select("id, keyword")
    .eq("enabled", true);

  if (error) {
    throw new Error(`Failed to fetch keywords: ${error.message}`);
  }

  return (data ?? []) as MonitoredKeyword[];
}

export async function fetchBucketsBatch(
  deps: Deps,
  keywordIds: string[],
  now: Date
): Promise<RawBucketRow[]> {
  const since = new Date(now);
  since.setDate(since.getDate() - HISTORY_DAYS);

  const allRows: RawBucketRow[] = [];

  for (let i = 0; i < keywordIds.length; i += BATCH_CHUNK_SIZE) {
    const chunk = keywordIds.slice(i, i + BATCH_CHUNK_SIZE);

    const { data, error } = await deps.supabase
      .from("trend_buckets")
      .select("keyword_id, bucket_start, news_count")
      .in("keyword_id", chunk)
      .gte("bucket_start", since.toISOString())
      .order("bucket_start", { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch buckets batch: ${error.message}`);
    }

    if (data) {
      allRows.push(...(data as RawBucketRow[]));
    }
  }

  return allRows;
}

export function groupByKeyword(
  rows: RawBucketRow[]
): Map<string, TrendBucket[]> {
  const grouped = new Map<string, TrendBucket[]>();

  for (const row of rows) {
    let buckets = grouped.get(row.keyword_id);
    if (!buckets) {
      buckets = [];
      grouped.set(row.keyword_id, buckets);
    }
    buckets.push({
      bucket_start: row.bucket_start,
      news_count: row.news_count,
    });
  }

  for (const [, buckets] of grouped) {
    buckets.sort(
      (a, b) =>
        new Date(a.bucket_start).getTime() -
        new Date(b.bucket_start).getTime()
    );
  }

  return grouped;
}

export async function bulkInsertScores(
  deps: Deps,
  scores: TrendScoreRow[]
): Promise<string[]> {
  if (scores.length === 0) return [];

  const errors: string[] = [];

  for (let i = 0; i < scores.length; i += BATCH_CHUNK_SIZE) {
    const chunk = scores.slice(i, i + BATCH_CHUNK_SIZE);

    const { error } = await deps.supabase.from("trend_scores").insert(chunk);

    if (error && !error.message.includes("duplicate")) {
      errors.push(`Bulk insert error: ${error.message}`);
    }
  }

  return errors;
}
