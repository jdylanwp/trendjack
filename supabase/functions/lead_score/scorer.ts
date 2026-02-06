import type {
  Deps,
  FilteredCandidate,
  ScoredLead,
  UserLimits,
} from "./types.ts";

const MAX_CONCURRENCY = 3;

interface ScoreResult {
  scored: ScoredLead[];
  aiCallsMade: number;
  errors: string[];
}

async function scoreOne(
  candidate: FilteredCandidate,
  deps: Deps,
  offerContext: string
): Promise<ScoredLead> {
  const aiResponse = await deps.scorePost(
    candidate.post,
    candidate.keyword.keyword,
    deps.openRouterApiKey,
    offerContext
  );
  return { candidate, aiResponse };
}

export async function scoreCandidates(
  candidates: FilteredCandidate[],
  deps: Deps,
  offerContext: string,
  limits: UserLimits
): Promise<ScoreResult> {
  const result: ScoreResult = { scored: [], aiCallsMade: 0, errors: [] };

  if (candidates.length === 0) {
    return result;
  }

  let availableBudget =
    limits.max_ai_analyses_per_month - limits.current_ai_analyses;

  const toScore = candidates.slice(0, availableBudget);

  let i = 0;
  while (i < toScore.length) {
    const batch = toScore.slice(i, i + MAX_CONCURRENCY);
    const settled = await Promise.allSettled(
      batch.map((c) => scoreOne(c, deps, offerContext))
    );

    for (const outcome of settled) {
      if (outcome.status === "fulfilled") {
        result.scored.push(outcome.value);
        result.aiCallsMade++;
      } else {
        result.errors.push(`AI scoring error: ${outcome.reason?.message ?? outcome.reason}`);
      }
    }

    i += MAX_CONCURRENCY;
  }

  return result;
}
