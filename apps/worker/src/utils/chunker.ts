import { randomUUID } from "node:crypto";
import { ParsedSection } from "@smart-doc/shared";

export interface ChunkedText {
  chunkId: string;
  content: string;
  headingPath: string[];
  tokenEstimate: number;
  page?: number;
  url?: string;
}

const WINDOW_SIZE = 500;
const OVERLAP = 100;

export function chunkSections(sections: ParsedSection[]): ChunkedText[] {
  const result: ChunkedText[] = [];

  for (const section of sections) {
    const text = section.content.trim();
    if (!text) {
      continue;
    }

    if (text.length <= WINDOW_SIZE) {
      result.push({
        chunkId: randomUUID(),
        content: text,
        headingPath: section.headingPath,
        tokenEstimate: estimateTokens(text),
        page: section.page,
        url: section.url,
      });
      continue;
    }

    let start = 0;
    while (start < text.length) {
      const end = Math.min(start + WINDOW_SIZE, text.length);
      const part = text.slice(start, end);
      result.push({
        chunkId: randomUUID(),
        content: part,
        headingPath: section.headingPath,
        tokenEstimate: estimateTokens(part),
        page: section.page,
        url: section.url,
      });

      if (end >= text.length) {
        break;
      }

      start = end - OVERLAP;
    }
  }

  return result;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 2);
}
