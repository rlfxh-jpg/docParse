import { Injectable } from "@nestjs/common";
import OpenAI from "openai";
import { Citation, QaResponse, REFUSAL_MESSAGE, RAG_DEFAULTS } from "@smart-doc/shared";
import { env } from "../../common/env.js";

export interface AnswerContext {
  chunkId: string;
  content: string;
  title: string;
  sourceType: "upload_pdf" | "upload_docx" | "upload_md" | "web_crawl";
  documentId: string;
  versionId: string;
  page?: number;
  url?: string;
}

@Injectable()
export class LlmService {
  private readonly client: OpenAI | null;

  constructor() {
    this.client = env.OPENAI_API_KEY
      ? new OpenAI({
          apiKey: env.OPENAI_API_KEY,
          baseURL: env.OPENAI_BASE_URL,
        })
      : null;
  }

  async generateAnswer(question: string, contexts: AnswerContext[]): Promise<QaResponse> {
    if (contexts.length === 0) {
      return this.refuse("NO_EVIDENCE");
    }

    if (!this.client) {
      return this.fallbackAnswer(question, contexts);
    }

    try {
      const payload = contexts.map((c, idx) => ({
        rank: idx + 1,
        chunkId: c.chunkId,
        title: c.title,
        content: c.content,
      }));

      const completion = await this.client.chat.completions.create({
        model: env.CHAT_MODEL,
        temperature: RAG_DEFAULTS.temperature,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are a strict enterprise knowledge assistant. Use only given evidence. Return JSON {answer:string, confidence:number, citationChunkIds:string[]}. If evidence is insufficient, return confidence < 0.55 and empty citationChunkIds.",
          },
          {
            role: "user",
            content: JSON.stringify({ question, contexts: payload }),
          },
        ],
      });

      const raw = completion.choices[0]?.message?.content;
      if (!raw) {
        return this.refuse("LOW_CONFIDENCE");
      }

      const parsed = JSON.parse(raw) as {
        answer?: string;
        confidence?: number;
        citationChunkIds?: string[];
      };

      const confidence = Number(parsed.confidence ?? 0);
      const citationIds = Array.isArray(parsed.citationChunkIds) ? parsed.citationChunkIds : [];
      const selectedContexts = contexts.filter((ctx) => citationIds.includes(ctx.chunkId));
      const citations = this.toCitations(selectedContexts);

      if (!parsed.answer || citations.length === 0 || confidence < RAG_DEFAULTS.minConfidence) {
        return this.refuse(confidence < RAG_DEFAULTS.minConfidence ? "LOW_CONFIDENCE" : "NO_EVIDENCE");
      }

      return {
        answer: parsed.answer,
        citations,
        confidence,
        refused: false,
      };
    } catch {
      return this.fallbackAnswer(question, contexts);
    }
  }

  private fallbackAnswer(question: string, contexts: AnswerContext[]): QaResponse {
    const top = contexts.slice(0, 3);
    const shortText = top
      .map((ctx, idx) => `(${idx + 1}) ${ctx.content.slice(0, 120).replace(/\s+/g, " ")}`)
      .join("\n");

    const answer = `根据知识库证据，针对问题“${question}”，可参考以下内容：\n${shortText}`;

    return {
      answer,
      citations: this.toCitations(top),
      confidence: 0.62,
      refused: false,
    };
  }

  private toCitations(contexts: AnswerContext[]): Citation[] {
    return contexts.map((ctx) => ({
      documentId: ctx.documentId,
      versionId: ctx.versionId,
      chunkId: ctx.chunkId,
      title: ctx.title,
      sourceType: ctx.sourceType,
      page: ctx.page,
      url: ctx.url,
      snippet: ctx.content.slice(0, 220),
    }));
  }

  private refuse(reason: "NO_EVIDENCE" | "LOW_CONFIDENCE" | "NO_PERMISSION"): QaResponse {
    return {
      answer: env.REFUSAL_MESSAGE ?? REFUSAL_MESSAGE,
      citations: [],
      confidence: 0,
      refused: true,
      refusalReason: reason,
    };
  }
}
