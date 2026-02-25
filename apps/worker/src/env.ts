import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  PARSER_SERVICE_URL: z.string().url().default("http://localhost:8000"),
  OPENAI_BASE_URL: z.string().url().default("https://api.openai.com/v1"),
  OPENAI_API_KEY: z.string().optional(),
  CHAT_MODEL: z.string().default("qwen-plus-latest"),
  EMBEDDING_MODEL: z.string().default("text-embedding-v3"),
});

export const env = schema.parse({
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL,
  REDIS_URL: process.env.REDIS_URL,
  PARSER_SERVICE_URL: process.env.PARSER_SERVICE_URL,
  OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  CHAT_MODEL: process.env.CHAT_MODEL,
  EMBEDDING_MODEL: process.env.EMBEDDING_MODEL,
});
