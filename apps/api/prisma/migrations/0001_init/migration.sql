-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Vector and text search indexes for document_chunks
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding_hnsw
ON "DocumentChunk"
USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_document_chunks_tsv_gin
ON "DocumentChunk"
USING gin (tsv);

-- Keep tsv column synchronized on content updates
CREATE OR REPLACE FUNCTION update_document_chunk_tsv()
RETURNS trigger AS $$
BEGIN
  NEW.tsv := to_tsvector('simple', COALESCE(NEW.content, ''));
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_document_chunk_tsv ON "DocumentChunk";
CREATE TRIGGER trg_document_chunk_tsv
BEFORE INSERT OR UPDATE OF content ON "DocumentChunk"
FOR EACH ROW EXECUTE FUNCTION update_document_chunk_tsv();
