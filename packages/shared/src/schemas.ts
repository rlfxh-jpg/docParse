import { z } from "zod";

export const workspaceRoleSchema = z.enum(["owner", "editor", "viewer"]);
export const documentVisibilitySchema = z.enum(["private", "workspace", "shared"]);

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const citationSchema = z.object({
  documentId: z.string().uuid(),
  versionId: z.string().uuid(),
  chunkId: z.string(),
  title: z.string(),
  sourceType: z.enum(["upload_pdf", "upload_docx", "upload_md", "web_crawl"]),
  page: z.number().int().positive().optional(),
  url: z.string().url().optional(),
  snippet: z.string().min(1),
});

export const qaResponseSchema = z.object({
  answer: z.string(),
  citations: z.array(citationSchema),
  confidence: z.number().min(0).max(1),
  refused: z.boolean(),
  refusalReason: z.enum(["NO_EVIDENCE", "NO_PERMISSION", "LOW_CONFIDENCE"]).optional(),
});
