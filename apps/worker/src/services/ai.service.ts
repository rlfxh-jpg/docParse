import OpenAI from "openai";
import { env } from "../env.js";

const client = env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: env.OPENAI_API_KEY,
      baseURL: env.OPENAI_BASE_URL,
    })
  : null;

/**
 * 函数说明：embedMany，负责当前模块的业务处理逻辑。
 * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
 * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
 * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
 */
export async function embedMany(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  if (!client) {
    return texts.map(fakeEmbedding);
  }

  try {
    const response = await client.embeddings.create({
      model: env.EMBEDDING_MODEL,
      input: texts.map((t) => t.slice(0, 4000)),
    });

    return response.data.map((item) => normalizeLength(item.embedding, 1024));
  } catch {
    return texts.map(fakeEmbedding);
  }
}

/**
 * 函数说明：summarizeAndTag，负责当前模块的业务处理逻辑。
 * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
 * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
 * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
 */
export async function summarizeAndTag(input: string): Promise<{ summary: string; labels: string[]; keywords: string[] }> {
  const text = input.replace(/\s+/g, " ").trim();

  if (!client) {
    const summary = text.slice(0, 160);
    const terms = extractTopKeywords(text, 8);
    return {
      summary,
      labels: terms.slice(0, 5),
      keywords: terms.slice(0, 5),
    };
  }

  try {
    const completion = await client.chat.completions.create({
      model: env.CHAT_MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a document metadata assistant. Return JSON {summary:string, labels:string[], keywords:string[]}. summary should be 80-160 Chinese characters, labels 3-8 items, keywords exactly 5 items.",
        },
        {
          role: "user",
          content: text.slice(0, 6000),
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      throw new Error("No content from LLM");
    }

    const parsed = JSON.parse(raw) as {
      summary?: string;
      labels?: string[];
      keywords?: string[];
    };

    const summary = (parsed.summary ?? text.slice(0, 120)).slice(0, 220);
    const labels = sanitizeStringList(parsed.labels, 3, 8);
    const keywords = sanitizeStringList(parsed.keywords, 5, 5);

    return {
      summary,
      labels,
      keywords,
    };
  } catch {
    const summary = text.slice(0, 160);
    const terms = extractTopKeywords(text, 8);
    return {
      summary,
      labels: terms.slice(0, 5),
      keywords: terms.slice(0, 5),
    };
  }
}

/**
 * 函数说明：sanitizeStringList，负责当前模块的业务处理逻辑。
 * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
 * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
 * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
 */
function sanitizeStringList(items: string[] | undefined, min: number, max: number): string[] {
  const clean = (items ?? []).map((item) => item.trim()).filter(Boolean);
  if (clean.length === 0) {
    return [];
  }

  const unique = Array.from(new Set(clean)).slice(0, max);
  if (unique.length >= min) {
    return unique;
  }

  return unique;
}

/**
 * 函数说明：extractTopKeywords，负责当前模块的业务处理逻辑。
 * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
 * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
 * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
 */
function extractTopKeywords(text: string, limit: number): string[] {
  const tokens = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2);

  const counter = new Map<string, number>();
  for (const token of tokens) {
    counter.set(token, (counter.get(token) ?? 0) + 1);
  }

  return [...counter.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([term]) => term);
}

/**
 * 函数说明：normalizeLength，负责当前模块的业务处理逻辑。
 * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
 * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
 * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
 */
function normalizeLength(input: number[], length: number): number[] {
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

/**
 * 函数说明：fakeEmbedding，负责当前模块的业务处理逻辑。
 * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
 * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
 * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
 */
function fakeEmbedding(text: string): number[] {
  const vector = new Array<number>(1024).fill(0);
  const source = text || "empty";
  for (let i = 0; i < source.length; i += 1) {
    const code = source.charCodeAt(i);
    vector[i % 1024] += ((code % 103) - 51) / 80;
  }

  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / norm);
}
