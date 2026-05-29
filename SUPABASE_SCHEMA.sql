-- =====================================================================
-- Personal Cognitive Operating System  -  Supabase schema
-- =====================================================================
-- HOW TO USE:
-- 1.  Go to https://supabase.com  ->  your project  ->  left sidebar
--     "SQL Editor"  ->  click "+ New query".
-- 2.  Paste this ENTIRE file into the editor.
-- 3.  Click "RUN" (top right).  It is idempotent — safe to re-run.
-- 4.  Confirm under "Table Editor" that all 8 tables were created.
-- 5.  Copy your Project URL + anon key + service role key into .env.local
--     (see .env.example).
--
-- This app has no auth, so RLS is enabled but a permissive policy is
-- applied to every table. Anyone with your anon key can read/write.
-- Treat the URL + keys as secrets and DO NOT commit them.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. summaries  -  one row per generated insight brief
-- ---------------------------------------------------------------------
create table if not exists public.summaries (
    id              uuid primary key default gen_random_uuid(),
    source_type     text not null check (source_type in ('youtube','article','reddit','newsletter','manual')),
    source_url      text,
    source_id       text,
    title           text not null,
    author          text,
    thumbnail       text,
    raw_transcript  text,
    insight         jsonb not null default '{}'::jsonb,
    tags            text[] not null default '{}',
    topics          text[] not null default '{}',
    is_saved        boolean not null default true,
    reflection      text,
    created_at      timestamptz not null default now()
);
create index if not exists summaries_created_at_idx on public.summaries (created_at desc);
create index if not exists summaries_topics_idx on public.summaries using gin (topics);
create index if not exists summaries_source_id_idx on public.summaries (source_id);

-- ---------------------------------------------------------------------
-- 2. saved_insights  -  quotes / frameworks / ideas the user star-saves
-- ---------------------------------------------------------------------
create table if not exists public.saved_insights (
    id            uuid primary key default gen_random_uuid(),
    summary_id    uuid references public.summaries(id) on delete set null,
    kind          text not null check (kind in ('summary','quote','framework','idea')),
    content       text not null,
    source_title  text,
    source_url    text,
    created_at    timestamptz not null default now()
);
create index if not exists saved_insights_created_at_idx on public.saved_insights (created_at desc);

-- ---------------------------------------------------------------------
-- 3. swipe_history  -  every left/right/super swipe on the feed
-- ---------------------------------------------------------------------
create table if not exists public.swipe_history (
    id             uuid primary key default gen_random_uuid(),
    feed_item_id   uuid,
    source_url     text not null,
    direction      text not null check (direction in ('left','right','super')),
    topics         text[] not null default '{}',
    created_at     timestamptz not null default now()
);
create index if not exists swipe_history_created_at_idx on public.swipe_history (created_at desc);

-- ---------------------------------------------------------------------
-- 4. user_preferences  -  per-topic learned weights (drives ranking)
-- ---------------------------------------------------------------------
create table if not exists public.user_preferences (
    id          uuid primary key default gen_random_uuid(),
    topic       text not null unique,
    weight      integer not null default 0,
    updated_at  timestamptz not null default now()
);
create index if not exists user_preferences_weight_idx on public.user_preferences (weight desc);

-- ---------------------------------------------------------------------
-- 5. daily_reflections  -  the "what will you apply today?" answers
-- ---------------------------------------------------------------------
create table if not exists public.daily_reflections (
    id          uuid primary key default gen_random_uuid(),
    summary_id  uuid references public.summaries(id) on delete cascade,
    prompt      text not null default 'What will you apply today?',
    answer      text not null,
    created_at  timestamptz not null default now()
);
create index if not exists daily_reflections_created_at_idx on public.daily_reflections (created_at desc);

-- ---------------------------------------------------------------------
-- 6. streaks  -  one row per day, for streak / XP / consistency
-- ---------------------------------------------------------------------
create table if not exists public.streaks (
    id                  uuid primary key default gen_random_uuid(),
    date                date not null unique,
    xp_earned           integer not null default 0,
    summaries_count     integer not null default 0,
    reflections_count   integer not null default 0,
    swipes_count        integer not null default 0
);
create index if not exists streaks_date_idx on public.streaks (date desc);

-- ---------------------------------------------------------------------
-- 7. generated_feeds  -  cards waiting in the swipe queue
-- ---------------------------------------------------------------------
create table if not exists public.generated_feeds (
    id              uuid primary key default gen_random_uuid(),
    source_type     text not null check (source_type in ('youtube','article','reddit','newsletter','manual')),
    source_url      text not null,
    source_id       text,
    title           text not null,
    author          text,
    thumbnail       text,
    description     text,
    topics          text[] not null default '{}',
    score           integer not null default 0,
    generated_for   date not null default current_date,
    consumed        boolean not null default false,
    created_at      timestamptz not null default now()
);
create index if not exists generated_feeds_score_idx on public.generated_feeds (consumed, score desc);
create index if not exists generated_feeds_source_id_idx on public.generated_feeds (source_id);
create index if not exists generated_feeds_created_at_idx on public.generated_feeds (created_at desc);

-- ---------------------------------------------------------------------
-- 8. recommendations  -  AI-generated nudges shown on the dashboard
-- ---------------------------------------------------------------------
create table if not exists public.recommendations (
    id          uuid primary key default gen_random_uuid(),
    kind        text not null check (kind in ('reread','apply','followup','related')),
    title       text not null,
    body        text,
    summary_id  uuid references public.summaries(id) on delete cascade,
    dismissed   boolean not null default false,
    created_at  timestamptz not null default now()
);
create index if not exists recommendations_created_at_idx on public.recommendations (created_at desc);

-- =====================================================================
-- Row Level Security
-- =====================================================================
-- This is a single-user personal app with no auth. We enable RLS for
-- defense in depth and add a permissive policy on each table.

alter table public.summaries          enable row level security;
alter table public.saved_insights     enable row level security;
alter table public.swipe_history      enable row level security;
alter table public.user_preferences   enable row level security;
alter table public.daily_reflections  enable row level security;
alter table public.streaks            enable row level security;
alter table public.generated_feeds    enable row level security;
alter table public.recommendations    enable row level security;

do $$
declare t text;
begin
  for t in select unnest(array[
    'summaries','saved_insights','swipe_history','user_preferences',
    'daily_reflections','streaks','generated_feeds','recommendations'
  ]) loop
    execute format('drop policy if exists "personal_all" on public.%I', t);
    execute format(
      'create policy "personal_all" on public.%I for all using (true) with check (true)',
      t
    );
  end loop;
end $$;

-- =====================================================================
-- 9. feed_search_state  -  keeps track of search query tokens/pages
-- =====================================================================
create table if not exists public.feed_search_state (
    id uuid primary key default gen_random_uuid(),
    query text not null,
    order_kind text not null check (order_kind in ('relevance','viewCount','date')),
    page_token text,
    last_used_at timestamptz not null default now(),
    exhausted_at timestamptz,
    yield_count integer not null default 0,
    unique (query, order_kind)
);
create index if not exists feed_search_state_last_used_idx on public.feed_search_state (last_used_at desc);

alter table public.feed_search_state enable row level security;
do $$ begin
    drop policy if exists "personal_all" on public.feed_search_state;
    create policy "personal_all" on public.feed_search_state for all using (true) with check (true);
end $$;

-- =====================================================================
-- 10. generated_feeds unique constraint for upsert support
-- =====================================================================
-- Clean up duplicate source_ids in generated_feeds, keeping the latest one
delete from public.generated_feeds a
using public.generated_feeds b
where a.source_id = b.source_id and a.created_at < b.created_at;

-- Ensure source_id is unique in generated_feeds to support upsert/onConflict
alter table public.generated_feeds drop constraint if exists generated_feeds_source_id_unique;
alter table public.generated_feeds add constraint generated_feeds_source_id_unique unique (source_id);

-- =====================================================================
-- 11. creator_state  -  caches resolved YouTube handle metadata
-- =====================================================================
create table if not exists public.creator_state (
    handle              text primary key,
    name                text not null,
    channel_id          text,
    uploads_playlist_id text,
    resolved_at         timestamptz,
    resolution_error    text,
    last_used_at        timestamptz default now()
);
create index if not exists creator_state_last_used_idx on public.creator_state (last_used_at desc);

alter table public.creator_state enable row level security;
do $$
begin
    drop policy if exists "personal_all" on public.creator_state;
    create policy "personal_all" on public.creator_state for all using (true) with check (true);
end $$;

-- =====================================================================
-- 12. creator_state schema updates for top video caching
-- =====================================================================
alter table public.creator_state
    add column if not exists top_video_ids text[],
    add column if not exists top_video_ids_refreshed_at timestamptz;

-- =====================================================================
-- Done. You can now insert / select from any of these tables using the
-- anon key. The Next.js server uses the service role key for writes.
-- =====================================================================

-- =====================================================================
-- 13. One-time cleanup of poisoned transient failures in creator_state
-- (safe to re-run; only clears rows with transient error reasons)
-- =====================================================================
update public.creator_state
set resolution_error = null, last_used_at = '1970-01-01T00:00:00Z'
where resolution_error in (
  'quota_exhausted',
  'http_403',
  'http_429',
  'http_500',
  'http_502',
  'http_503',
  'http_504',
  'fetch_failed',
  'piped_fetch_failed'
)
and channel_id is null;


