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

/**
 * 函数说明：chunkSections，负责当前模块的业务处理逻辑。
 * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
 * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
 * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
 */
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

/**
 * 函数说明：estimateTokens，负责当前模块的业务处理逻辑。
 * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
 * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
 * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 2);
}
