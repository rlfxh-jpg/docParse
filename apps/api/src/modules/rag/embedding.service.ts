import { Injectable } from "@nestjs/common";
import OpenAI from "openai";
import { env } from "../../common/env.js";

@Injectable()
export class EmbeddingService {
  private readonly client: OpenAI | null;

  constructor() {
    this.client = env.OPENAI_API_KEY
      ? new OpenAI({
          apiKey: env.OPENAI_API_KEY,
          baseURL: env.OPENAI_BASE_URL,
        })
      : null;
  }

  async embedOne(text: string): Promise<number[]> {
    if (!this.client) {
      return this.fakeEmbedding(text);
    }

    const response = await this.client.embeddings.create({
      model: env.EMBEDDING_MODEL,
      input: text.slice(0, 4000),
    });

    const embedding = response.data?.[0]?.embedding;
    if (!embedding || embedding.length === 0) {
      return this.fakeEmbedding(text);
    }

    return this.normalizeLength(embedding, 1024);
  }

  async embedMany(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    if (!this.client) {
      return texts.map((text) => this.fakeEmbedding(text));
    }

    const response = await this.client.embeddings.create({
      model: env.EMBEDDING_MODEL,
      input: texts.map((t) => t.slice(0, 4000)),
    });

    const out: number[][] = response.data.map((item) => this.normalizeLength(item.embedding, 1024));
    if (out.length !== texts.length) {
      return texts.map((text) => this.fakeEmbedding(text));
    }

    return out;
  }

  private normalizeLength(input: number[], length: number): number[] {
    if (input.length === length) {
      return input;
    }

    if (input.length > length) {
      return input.slice(0, length);
    }

    const output = [...input];
    while (output.length < length) {
      output.push(0);
    }

    return output;
  }

  private fakeEmbedding(text: string): number[] {
    const length = 1024;
    const vector = new Array<number>(length).fill(0);
    const source = text || "empty";

    for (let i = 0; i < source.length; i += 1) {
      const code = source.charCodeAt(i);
      const index = i % length;
      vector[index] += ((code % 97) - 48) / 100;
    }

    const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
    return vector.map((value) => value / norm);
  }
}
