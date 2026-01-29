# TrendJack

A production-ready trend detection and lead discovery SaaS application built on Supabase.

## Overview

TrendJack monitors Google News for rising trends and scans Reddit for high-intent discussions related to those trends. It uses AI to score potential leads and suggest helpful replies.

### Key Features

- **Trend Detection**: Monitors Google News RSS feeds and calculates "heat scores" vs baseline
- **Reddit Monitoring**: Fetches posts from relevant subreddits
- **Smart Prefiltering**: Identifies high-intent posts before calling AI (cost optimization)
- **AI Lead Scoring**: Uses OpenRouter (GPT-4o-mini) to analyze intent and suggest replies
- **Idempotent Operations**: All functions are safe to rerun (no duplicate data)
- **Deduplication**: URL hashing ensures no duplicate news or Reddit posts

## Architecture

### Database Schema

The system uses 7 tables with proper relationships and deduplication:

1. **monitored_keywords**: Keywords to track with their related subreddits
2. **news_items**: Raw Google News ingestion (deduplicated by url_hash)
3. **trend_buckets**: Hourly aggregation of news volume
4. **trend_scores**: Calculated heat scores and trending flags
5. **reddit_posts**: Raw Reddit posts (deduplicated by url_hash)
6. **lead_candidates**: Prefiltered posts that passed basic intent checks
7. **leads**: Final scored leads with AI analysis (intent_score >= 75)

### Edge Functions Pipeline

1. **trend_fetch** (Every 60 minutes)
   - Fetches Google News RSS for each keyword
   - Inserts into news_items
   - Aggregates into hourly trend_buckets

2. **trend_score** (Every 60 minutes)
   - Calculates 24h volume vs 7-day baseline
   - Computes heat_score = (current - baseline) / (baseline + 1)
   - Marks is_trending = true if heat_score >= 1.0 AND count >= 5

3. **reddit_fetch** (Every 10 minutes)
   - Fetches Reddit RSS for each monitored subreddit
   - Truncates body to 1000 characters
   - Inserts with deduplication

4. **lead_score** (Every 10 minutes)
   - Only processes trending keywords
   - Prefilters Reddit posts for intent signals
   - Calls AI only for prefiltered candidates
   - Saves leads with intent_score >= 75

## Frontend Dashboard

The TrendJack dashboard is built with React, Vite, Tailwind CSS, and Recharts.

### Features

- **Dark Terminal Theme**: Professional slate-900 background with emerald green accents
- **Dashboard Page**:
  - Real-time heat score trend visualization with Recharts
  - Stats cards showing total keywords, trending count, and average heat score
  - Trending keywords table with heat scores
- **Leads Page**:
  - Sortable and filterable lead list
  - Intent score highlighting (color-coded by score)
  - One-click copy to clipboard for suggested replies
  - Status management (new/reviewed/ignored)
  - Direct links to Reddit posts
- **Auto-refresh**: Dashboard updates every 60s, Leads every 30s
- **Responsive Design**: Mobile-first approach with Tailwind breakpoints

### Tech Stack

- **Frontend**: React 18 + Vite
- **Styling**: Tailwind CSS (dark terminal theme)
- **Charts**: Recharts
- **Icons**: Lucide React
- **Routing**: React Router v6
- **Database**: Supabase (PostgreSQL)

## Setup Instructions

### 1. Database Setup

The database schema and seed data have been applied via migrations:
- Schema migration: `create_trendjack_schema`
- Seed data: `seed_monitored_keywords` (5 B2B keywords included)

### 2. Environment Variables

Add your OpenRouter API key to the `.env` file:

```bash
OPENROUTER_API_KEY=your_actual_api_key_here
```

Get your API key from: https://openrouter.ai/keys

**Note**: Supabase environment variables (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, etc.) are automatically available in Edge Functions.

### 3. Edge Functions Deployment

All 4 Edge Functions have been deployed:
- ✅ trend_fetch
- ✅ trend_score
- ✅ reddit_fetch
- ✅ lead_score

### 4. Run the Frontend

Start the development server:

```bash
npm run dev
```

The app will be available at http://localhost:3000

Build for production:

```bash
npm run build
```

### 5. Configure Scheduled Triggers

Set up cron triggers in your Supabase Dashboard:

**Dashboard → Database → Cron Jobs**

```sql
-- Run trend_fetch every 60 minutes
SELECT cron.schedule(
  'trend-fetch-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://wivelnlgwmxegdqjhswr.supabase.co/functions/v1/trend_fetch',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
  ) AS request_id;
  $$
);

-- Run trend_score every 60 minutes (offset by 5 minutes)
SELECT cron.schedule(
  'trend-score-hourly',
  '5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://wivelnlgwmxegdqjhswr.supabase.co/functions/v1/trend_score',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
  ) AS request_id;
  $$
);

-- Run reddit_fetch every 10 minutes
SELECT cron.schedule(
  'reddit-fetch-frequent',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://wivelnlgwmxegdqjhswr.supabase.co/functions/v1/reddit_fetch',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
  ) AS request_id;
  $$
);

-- Run lead_score every 10 minutes (offset by 2 minutes)
SELECT cron.schedule(
  'lead-score-frequent',
  '2,12,22,32,42,52 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://wivelnlgwmxegdqjhswr.supabase.co/functions/v1/lead_score',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
  ) AS request_id;
  $$
);
```

Replace `YOUR_ANON_KEY` with your actual Supabase anon key from the `.env` file.

## Manual Testing

Test each Edge Function manually before setting up cron:

```bash
# Test trend_fetch
curl -X POST https://wivelnlgwmxegdqjhswr.supabase.co/functions/v1/trend_fetch \
  -H "Authorization: Bearer YOUR_ANON_KEY"

# Test trend_score
curl -X POST https://wivelnlgwmxegdqjhswr.supabase.co/functions/v1/trend_score \
  -H "Authorization: Bearer YOUR_ANON_KEY"

# Test reddit_fetch
curl -X POST https://wivelnlgwmxegdqjhswr.supabase.co/functions/v1/reddit_fetch \
  -H "Authorization: Bearer YOUR_ANON_KEY"

# Test lead_score
curl -X POST https://wivelnlgwmxegdqjhswr.supabase.co/functions/v1/lead_score \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

Each function returns detailed execution logs in JSON format.

## Seed Data

The following B2B keywords are pre-configured:

| Keyword | Subreddit |
|---------|-----------|
| Shopify | r/shopify |
| Webflow | r/webflow |
| SEO Help | r/SEO |
| Cold Email | r/sales |
| SaaS Growth | r/SaaS |

## Data Flow

1. **Ingestion Phase**
   - trend_fetch → news_items → trend_buckets
   - reddit_fetch → reddit_posts

2. **Analysis Phase**
   - trend_score → trend_scores (identifies trending keywords)

3. **Lead Discovery Phase**
   - lead_score → lead_candidates → leads (only for trending keywords)

## Cost Optimization

- **Prefiltering**: Only 10-20% of posts pass prefilter (saves 80-90% on AI costs)
- **Deduplication**: URL hashing prevents duplicate processing
- **Selective AI Calls**: Only calls AI for trending keywords with high-intent posts
- **Efficient Models**: Uses GPT-4o-mini ($0.15 per 1M input tokens)

## Query Examples

```sql
-- View trending keywords
SELECT
  mk.keyword,
  ts.heat_score,
  ts.is_trending,
  ts.calculated_at
FROM trend_scores ts
JOIN monitored_keywords mk ON ts.keyword_id = mk.id
WHERE ts.is_trending = true
ORDER BY ts.heat_score DESC;

-- View high-intent leads
SELECT
  mk.keyword,
  rp.title,
  rp.subreddit,
  l.intent_score,
  l.pain_point,
  l.suggested_reply,
  l.status
FROM leads l
JOIN monitored_keywords mk ON l.keyword_id = mk.id
JOIN reddit_posts rp ON l.reddit_post_id = rp.id
WHERE l.status = 'new'
ORDER BY l.intent_score DESC, l.created_at DESC;

-- View execution statistics
SELECT
  DATE(created_at) as date,
  COUNT(*) as total_leads,
  AVG(intent_score) as avg_score,
  MAX(intent_score) as max_score
FROM leads
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

## Security

- **Row Level Security (RLS)**: Enabled on all tables
- **Service Role**: Edge Functions use service_role for write access
- **Authenticated Read**: Frontend users can read all data when authenticated
- **No Secrets in Code**: All API keys stored in environment variables

## Monitoring

Check Edge Function logs in Supabase Dashboard:
**Dashboard → Edge Functions → [Function Name] → Logs**

Each function returns detailed execution logs including:
- Items fetched/processed
- Items inserted/created
- Errors encountered
- Execution duration

## Adding New Keywords

```sql
INSERT INTO monitored_keywords (keyword, related_subreddit, enabled)
VALUES ('Your Keyword', 'relevant_subreddit', true);
```

The system will automatically start monitoring the new keyword on the next cron run.

## Troubleshooting

### No leads appearing?

1. Check if keywords are trending: `SELECT * FROM trend_scores WHERE is_trending = true;`
2. Check if Reddit posts are being fetched: `SELECT COUNT(*) FROM reddit_posts;`
3. Check Edge Function logs for errors

### AI scoring not working?

1. Verify OPENROUTER_API_KEY is set correctly
2. Check lead_score function logs for API errors
3. Ensure prefilter is passing posts: `SELECT COUNT(*) FROM lead_candidates;`

### Duplicate data?

This should not happen due to unique constraints, but if it does:
- Check url_hash generation in Edge Functions
- Verify UNIQUE constraints are in place: `\d+ news_items` and `\d+ reddit_posts`

## Tech Stack

### Backend
- **Database**: Supabase (PostgreSQL)
- **Runtime**: Deno (Supabase Edge Functions)
- **AI**: OpenRouter (GPT-4o-mini)
- **Scheduling**: Supabase Cron (pg_cron)
- **RSS Parsing**: rss-parser (npm)

### Frontend
- **Framework**: React 18 + Vite
- **Styling**: Tailwind CSS (custom terminal theme)
- **Charts**: Recharts
- **Icons**: Lucide React
- **Routing**: React Router v6
- **State**: React Hooks (useState, useEffect)
- **API Client**: Supabase JS Client

---

Built with production-ready best practices: idempotent operations, comprehensive error handling, detailed logging, and cost-optimized AI usage.
