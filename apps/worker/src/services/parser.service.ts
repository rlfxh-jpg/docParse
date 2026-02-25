import { ParsedSection } from "@smart-doc/shared";
import { env } from "../env.js";

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
