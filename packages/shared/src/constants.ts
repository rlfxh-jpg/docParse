export const REFUSAL_MESSAGE = "未在可访问知识库中找到可验证依据。请上传更多资料或调整问题。";

export const RAG_DEFAULTS = {
  vectorTopK: 30,
  keywordTopK: 30,
  fusedTopK: 20,
  contextTopK: 8,
  minConfidence: 0.55,
  temperature: 0.2,
} as const;

export const PIPELINE_EVENTS = {
  CRAWL_REQUESTED: "crawl.requested",
  DOCUMENT_UPLOADED: "document.uploaded",
  DOCUMENT_PARSED: "document.parsed",
  DOCUMENT_EMBEDDED: "document.embedded",
  DOCUMENT_INDEXED: "document.indexed",
  DOCUMENT_AUTO_TAG_SUMMARY: "document.auto_tag_summary",
} as const;

export const QUEUE_NAMES = {
  INGESTION: "ingestion",
  CRAWL: "crawl",
  AUTOMATION: "automation",
} as const;
