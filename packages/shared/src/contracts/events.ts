export interface CrawlRequestedEvent {
  workspaceId: string;
  jobId: string;
  seedUrl: string;
  depth: number;
  maxPages: number;
}

export interface DocumentUploadedEvent {
  workspaceId: string;
  documentId: string;
  versionId: string;
  ingestionJobId?: string;
  objectKey: string;
  fileName?: string;
  mimeType?: string;
}

export interface DocumentParsedEvent {
  workspaceId: string;
  documentId: string;
  versionId: string;
  sections: Array<{
    sectionId: string;
    headingPath: string[];
    content: string;
    page?: number;
    url?: string;
  }>;
}

export interface DocumentEmbeddedEvent {
  workspaceId: string;
  documentId: string;
  chunkCount: number;
}

export interface DocumentIndexedEvent {
  workspaceId: string;
  documentId: string;
  indexVersion: number;
}

export interface DocumentAutoTagSummaryEvent {
  workspaceId: string;
  documentId: string;
}
