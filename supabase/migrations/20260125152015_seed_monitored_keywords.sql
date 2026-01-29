/*
  # Seed Data: Monitored Keywords

  1. Purpose
    - Populate initial high-value B2B keywords for TrendJack
    - Each keyword is paired with a relevant subreddit for lead discovery

  2. Keywords Included
    - Shopify (r/shopify) - E-commerce platform discussions
    - Webflow (r/webflow) - No-code website builder community
    - SEO Help (r/SEO) - Search engine optimization questions
    - Cold Email (r/sales) - Sales outreach and cold email tactics
    - SaaS Growth (r/SaaS) - Software-as-a-Service growth strategies

  3. Notes
    - All keywords are enabled by default
    - These are safe to rerun (ON CONFLICT DO NOTHING)
*/

-- Insert high-value B2B keywords
INSERT INTO monitored_keywords (keyword, related_subreddit, enabled)
VALUES 
  ('Shopify', 'shopify', true),
  ('Webflow', 'webflow', true),
  ('SEO Help', 'SEO', true),
  ('Cold Email', 'sales', true),
  ('SaaS Growth', 'SaaS', true)
ON CONFLICT DO NOTHING;