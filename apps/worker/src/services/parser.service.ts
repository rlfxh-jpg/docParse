import { ParsedSection } from "@smart-doc/shared";
import { env } from "../env.js";

/**
 * 函数说明：parseText，负责当前模块的业务处理逻辑。
 * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
 * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
 * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
 */
export async function parseText(sourceType: string, content: string, url?: string): Promise<ParsedSection[]> {
  const response = await fetch(`${env.PARSER_SERVICE_URL}/parse/text`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sourceType, content, url }),
  });

  if (!response.ok) {
    throw new Error(`Parser text request failed: ${response.status}`);
  }

  const data = (await response.json()) as { sections: ParsedSection[] };
  return data.sections;
}

/**
 * 函数说明：parseWeb，负责当前模块的业务处理逻辑。
 * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
 * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
 * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
 */
export async function parseWeb(url: string): Promise<{ title: string; sections: ParsedSection[] }> {
  const response = await fetch(`${env.PARSER_SERVICE_URL}/parse/web`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    throw new Error(`Parser web request failed: ${response.status}`);
  }

  return (await response.json()) as { title: string; sections: ParsedSection[] };
}

/**
 * 函数说明：parseFile，负责当前模块的业务处理逻辑。
 * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
 * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
 * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
 */
export async function parseFile(input: {
  fileName: string;
  mimeType: string;
  contentBase64: string;
}): Promise<ParsedSection[]> {
  const response = await fetch(`${env.PARSER_SERVICE_URL}/parse/file`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(`Parser file request failed: ${response.status}`);
  }

  const data = (await response.json()) as { sections: ParsedSection[] };
  return data.sections;
}
