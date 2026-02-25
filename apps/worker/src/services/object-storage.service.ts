import { Readable } from "node:stream";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "../env.js";

const client = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY,
    secretAccessKey: env.S3_SECRET_KEY,
  },
});

/**
 * 函数说明：readObjectAsBase64，从对象存储下载文件并转为 base64 字符串。
 * 执行流程：根据 objectKey 拉取对象内容，兼容 Node Stream 与 SDK 字节流两种响应格式。
 * 参数约定：objectKey 必须是已存在对象键，bucket 使用统一环境变量 `S3_BUCKET`。
 * 返回结果：返回 base64 文本，供解析服务复用当前 `parse/file` 协议。
 */
export async function readObjectAsBase64(objectKey: string): Promise<string> {
  const response = await client.send(
    new GetObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: objectKey,
    }),
  );

  const body = response.Body;
  if (!body) {
    throw new Error(`Object storage returned empty body for key: ${objectKey}`);
  }

  if (typeof (body as { transformToByteArray?: () => Promise<Uint8Array> }).transformToByteArray === "function") {
    const bytes = await (body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray();
    return Buffer.from(bytes).toString("base64");
  }

  if (body instanceof Readable) {
    const chunks: Buffer[] = [];
    for await (const chunk of body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString("base64");
  }

  throw new Error(`Unsupported object stream type for key: ${objectKey}`);
}

