import { Injectable, InternalServerErrorException } from "@nestjs/common";
import {
  CreateBucketCommand,
  type CreateBucketCommandInput,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../env.js";

@Injectable()
export class StorageService {
  private readonly client: S3Client;
  private bucketReady = false;

  /**
   * 构造函数，用于注入并保存当前类运行所需依赖。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
  constructor() {
    this.client = new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY,
        secretAccessKey: env.S3_SECRET_KEY,
      },
    });
  }

  /**
   * 函数说明：createUploadUrl，生成对象上传预签名 URL。
   * 执行流程：先确保目标 bucket 存在，再创建 PutObject 预签名链接供前端直传。
   * 参数约定：objectKey 为对象唯一键；contentType 可选，建议由调用方明确传入。
   * 返回结果：返回上传 URL 与过期秒数，供调用方展示或执行上传。
   */
  async createUploadUrl(objectKey: string, contentType?: string): Promise<{ url: string; expiresInSeconds: number }> {
    await this.ensureBucketExists();

    const url = await getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: objectKey,
        ...(contentType ? { ContentType: contentType } : {}),
      }),
      { expiresIn: env.S3_PRESIGN_EXPIRES_SECONDS },
    );

    return {
      url,
      expiresInSeconds: env.S3_PRESIGN_EXPIRES_SECONDS,
    };
  }

  /**
   * 函数说明：createDownloadUrl，生成对象下载预签名 URL。
   * 执行流程：确保 bucket 可访问后，为指定 objectKey 生成 GetObject 预签名链接。
   * 参数约定：objectKey 必须对应已上传对象；不存在时下载会返回存储侧错误。
   * 返回结果：返回下载 URL 与过期秒数，前端可直接跳转或下载。
   */
  async createDownloadUrl(objectKey: string): Promise<{ url: string; expiresInSeconds: number }> {
    await this.ensureBucketExists();

    const url = await getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: objectKey,
      }),
      { expiresIn: env.S3_PRESIGN_EXPIRES_SECONDS },
    );

    return {
      url,
      expiresInSeconds: env.S3_PRESIGN_EXPIRES_SECONDS,
    };
  }

  /**
   * 函数说明：ensureBucketExists，按需检查并创建目标 bucket。
   * 执行流程：首次调用先 HeadBucket；若不存在则创建，成功后缓存结果避免重复检查。
   * 参数约定：无外部参数，使用全局环境配置中的 bucket 与 region。
   * 返回结果：bucket 可用时返回；失败抛出统一内部错误给上层处理。
   */
  private async ensureBucketExists(): Promise<void> {
    if (this.bucketReady) {
      return;
    }

    try {
      await this.client.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }));
      this.bucketReady = true;
      return;
    } catch (error) {
      if (!this.shouldCreateBucket(error)) {
        throw new InternalServerErrorException("Object storage unavailable");
      }
    }

    try {
      const input: CreateBucketCommandInput = { Bucket: env.S3_BUCKET };
      if (env.S3_REGION !== "us-east-1") {
        input.CreateBucketConfiguration = {
          LocationConstraint: env.S3_REGION as NonNullable<
            NonNullable<CreateBucketCommandInput["CreateBucketConfiguration"]>["LocationConstraint"]
          >,
        };
      }
      await this.client.send(new CreateBucketCommand(input));
      this.bucketReady = true;
    } catch (error) {
      if (this.isIgnorableCreateBucketError(error)) {
        this.bucketReady = true;
        return;
      }
      throw new InternalServerErrorException("Failed to initialize object storage bucket");
    }
  }

  /**
   * 函数说明：shouldCreateBucket，判断 HeadBucket 失败后是否应尝试创建 bucket。
   * 执行流程：根据错误码过滤鉴权类异常，仅对“资源不存在”类错误触发创建逻辑。
   * 参数约定：error 为存储 SDK 抛出的原始异常对象。
   * 返回结果：返回 true 表示可尝试创建 bucket；false 表示应直接抛错。
   */
  private shouldCreateBucket(error: unknown): boolean {
    const code = this.readErrorCode(error);
    if (!code) {
      return true;
    }
    return !["Forbidden", "AccessDenied", "InvalidAccessKeyId", "SignatureDoesNotMatch"].includes(code);
  }

  /**
   * 函数说明：isIgnorableCreateBucketError，识别可忽略的 bucket 创建并发错误。
   * 执行流程：当并发实例同时创建 bucket 时，若返回“已存在/已归属”则视为成功。
   * 参数约定：error 为 CreateBucket 请求抛出的原始异常对象。
   * 返回结果：返回 true 表示可忽略该错误并继续流程。
   */
  private isIgnorableCreateBucketError(error: unknown): boolean {
    const code = this.readErrorCode(error);
    return code === "BucketAlreadyOwnedByYou" || code === "BucketAlreadyExists";
  }

  /**
   * 函数说明：readErrorCode，从对象存储异常中提取错误码。
   * 执行流程：兼容 AWS SDK `$metadata` 与常见 `name/code` 字段，统一返回可读标识。
   * 参数约定：error 为任意未知异常对象。
   * 返回结果：返回错误码字符串；无法识别时返回空字符串。
   */
  private readErrorCode(error: unknown): string {
    if (!error || typeof error !== "object") {
      return "";
    }
    const record = error as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name : "";
    const code = typeof record.code === "string" ? record.code : "";
    return code || name;
  }
}
