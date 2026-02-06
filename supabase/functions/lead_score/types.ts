import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export interface MonitoredKeyword {
  id: string;
  keyword: string;
  related_subreddit: string;
  user_id: string;
  last_processed_at: string | null;
}

export interface RedditPost {
  id: string;
  subreddit: string;
  canonical_url: string;
  title: string;
  body: string;
  author: string;
  flair: string | null;
  created_at: string;
}

export interface AIResponse {
  intent_score: number;
  pain_point: string;
  suggested_reply: string;
  fury_score: number;
  pain_summary: string;
  primary_trigger: string;
  sample_quote: string;
}

export interface UserContext {
  offerContext: string;
  limits: UserLimits;
}

export interface UserLimits {
  current_ai_analyses: number;
  max_ai_analyses_per_month: number;
  current_leads: number;
  max_leads_per_month: number;
}

export interface FilteredCandidate {
  post: RedditPost;
  keyword: MonitoredKeyword;
  reasons: string[];
}

export interface ScoredLead {
  candidate: FilteredCandidate;
  aiResponse: AIResponse;
}

export interface KeywordLog {
  timestamp: string;
  keyword: string;
  postsAnalyzed: number;
  candidatesCreated: number;
  aiCallsMade: number;
  leadsCreated: number;
  errors: string[];
}

export interface PipelineResult {
  success: boolean;
  summary: {
    keywordsProcessed: number;
    totalCandidatesCreated: number;
    totalAICallsMade: number;
    totalLeadsCreated: number;
  };
  logs: KeywordLog[];
  startTime: string;
  endTime: string;
  error?: string;
}

export interface Deps {
  supabase: SupabaseClient;
  openRouterApiKey: string;
  scorePost: (
    post: RedditPost,
    keyword: string,
    apiKey: string,
    offerContext: string
  ) => Promise<AIResponse>;
}
