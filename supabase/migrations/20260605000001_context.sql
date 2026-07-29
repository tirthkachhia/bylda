-- migration_001_context.sql
-- Phase 1: Context Ingestion Layer

CREATE EXTENSION IF NOT EXISTS vector;

-- -----------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS context_sources (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid        NOT NULL REFERENCES auth.users(id),
  source_type    text        NOT NULL CHECK (source_type IN ('notion','slack','github','text','url')),
  source_url     text,
  name           text        NOT NULL,
  status         text        NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','error','inactive')),
  last_synced_at timestamptz,
  created_at     timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS context_chunks (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid        NOT NULL REFERENCES auth.users(id),
  source_id   uuid        NOT NULL REFERENCES context_sources(id) ON DELETE CASCADE,
  content     text        NOT NULL,
  token_count int,
  metadata    jsonb       DEFAULT '{}',
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS context_embeddings (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_id   uuid        NOT NULL REFERENCES context_chunks(id) ON DELETE CASCADE,
  embedding  vector(1536),
  model      text        DEFAULT 'text-embedding-3-small',
  created_at timestamptz DEFAULT now()
);

-- -----------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------

ALTER TABLE context_sources    ENABLE ROW LEVEL SECURITY;
ALTER TABLE context_chunks     ENABLE ROW LEVEL SECURITY;
ALTER TABLE context_embeddings ENABLE ROW LEVEL SECURITY;

-- context_sources
DROP POLICY IF EXISTS "cs_select" ON context_sources;
DROP POLICY IF EXISTS "cs_insert" ON context_sources;
DROP POLICY IF EXISTS "cs_update" ON context_sources;
DROP POLICY IF EXISTS "cs_delete" ON context_sources;

CREATE POLICY "cs_select" ON context_sources FOR SELECT USING (org_id = auth.uid());
CREATE POLICY "cs_insert" ON context_sources FOR INSERT WITH CHECK (org_id = auth.uid());
CREATE POLICY "cs_update" ON context_sources FOR UPDATE USING (org_id = auth.uid());
CREATE POLICY "cs_delete" ON context_sources FOR DELETE USING (org_id = auth.uid());

-- context_chunks
DROP POLICY IF EXISTS "cc_select" ON context_chunks;
DROP POLICY IF EXISTS "cc_insert" ON context_chunks;
DROP POLICY IF EXISTS "cc_update" ON context_chunks;
DROP POLICY IF EXISTS "cc_delete" ON context_chunks;

CREATE POLICY "cc_select" ON context_chunks FOR SELECT USING (org_id = auth.uid());
CREATE POLICY "cc_insert" ON context_chunks FOR INSERT WITH CHECK (org_id = auth.uid());
CREATE POLICY "cc_update" ON context_chunks FOR UPDATE USING (org_id = auth.uid());
CREATE POLICY "cc_delete" ON context_chunks FOR DELETE USING (org_id = auth.uid());

-- context_embeddings (via join to context_chunks)
DROP POLICY IF EXISTS "ce_select" ON context_embeddings;
DROP POLICY IF EXISTS "ce_insert" ON context_embeddings;
DROP POLICY IF EXISTS "ce_delete" ON context_embeddings;

CREATE POLICY "ce_select" ON context_embeddings FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM context_chunks
    WHERE context_chunks.id = context_embeddings.chunk_id
      AND context_chunks.org_id = auth.uid()
  )
);
CREATE POLICY "ce_insert" ON context_embeddings FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM context_chunks
    WHERE context_chunks.id = context_embeddings.chunk_id
      AND context_chunks.org_id = auth.uid()
  )
);
CREATE POLICY "ce_delete" ON context_embeddings FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM context_chunks
    WHERE context_chunks.id = context_embeddings.chunk_id
      AND context_chunks.org_id = auth.uid()
  )
);

-- -----------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_context_chunks_org_id    ON context_chunks(org_id);
CREATE INDEX IF NOT EXISTS idx_context_chunks_source_id ON context_chunks(source_id);
CREATE INDEX IF NOT EXISTS idx_context_embeddings_chunk ON context_embeddings(chunk_id);
CREATE INDEX IF NOT EXISTS idx_context_embeddings_ivfflat
  ON context_embeddings USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- -----------------------------------------------------------------------
-- match_documents RPC (semantic search)
-- -----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION match_documents(
  query_embedding  vector(1536),
  match_count      int     DEFAULT 10,
  filter_org_id    uuid    DEFAULT NULL
)
RETURNS TABLE (
  id          uuid,
  content     text,
  metadata    jsonb,
  source_id   uuid,
  similarity  float
)
LANGUAGE sql STABLE SECURITY INVOKER
AS $$
  SELECT
    cc.id,
    cc.content,
    cc.metadata,
    cc.source_id,
    1 - (ce.embedding <=> query_embedding) AS similarity
  FROM context_embeddings ce
  JOIN context_chunks cc ON cc.id = ce.chunk_id
  WHERE (filter_org_id IS NULL OR cc.org_id = filter_org_id)
  ORDER BY ce.embedding <=> query_embedding
  LIMIT match_count;
$$;
