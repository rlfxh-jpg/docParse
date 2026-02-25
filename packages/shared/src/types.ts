export type WorkspaceRole = "owner" | "editor" | "viewer";
export type DocumentVisibility = "private" | "workspace" | "shared";
export type SourceType = "upload_pdf" | "upload_docx" | "upload_md" | "web_crawl";

export interface Citation {
  documentId: string;
  versionId: string;
  chunkId: string;
  title: string;
  sourceType: SourceType;
  page?: number;
  url?: string;
  snippet: string;
}

export interface QaResponse {
  answer: string;
  citations: Citation[];
  confidence: number;
  refused: boolean;
  refusalReason?: "NO_EVIDENCE" | "NO_PERMISSION" | "LOW_CONFIDENCE";
}

export interface ParsedSection {
  sectionId: string;
  headingPath: string[];
  content: string;
  page?: number;
  url?: string;
}

export interface DocumentChunk {
  chunkId: string;
  documentId: string;
  versionId: string;
  workspaceId: string;
  content: string;
  headingPath: string[];
  tokenEstimate: number;
  page?: number;
  url?: string;
}
