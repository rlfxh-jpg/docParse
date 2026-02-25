# 智能文档平台 MVP 实施方案（6-8 周，个人/小团队）

## 简要摘要
- 产品目标：构建一个支持 `文档管理 + AI 理解 + 智能问答 + 自动化处理` 的 Web 平台，对标 Notion AI/语雀智能问答的核心能力。
- 已锁定范围：`个人/小团队`、`云上单区域部署`、`本地上传+网页抓取`、`基础 RAG + 引用溯源`、`入库后自动摘要/标签`、`无引用不作答`。
- 技术路线：`TypeScript 全栈` 为主，配套 `Python 解析服务`；数据层用 `PostgreSQL + pgvector`，异步任务用 `Redis + BullMQ`，文件存储用 `S3`。

## 范围定义
### In Scope（MVP 必做）
- 用户与团队空间：注册登录、团队空间、成员邀请、角色权限。
- 文档管理：文件夹、文档上传、在线编辑（单人编辑）、版本记录、文档级共享。
- 编辑增强：草稿自动保存、发布、回滚、索引状态可视化、单人编辑锁（软锁 + 心跳续租）。
- 数据接入：支持 `PDF / Word(.docx) / Markdown / 网页抓取`。
- AI 理解：文档解析、分块、向量化、关键词索引。
- 智能问答：基于 RAG 的问答，答案必须带引用来源。
- 自动化：文档入库完成后自动生成摘要与标签。
- 可观测性：错误监控、任务状态、关键指标监控。

### Out of Scope（MVP 不做）
- 多人实时协同编辑（CRDT/OT）。
- 企业系统连接器（飞书/钉钉/Confluence/Drive）。
- 图片 OCR 与扫描件识别。
- Agent 自主任务执行与复杂审批流编排。
- 多区域部署与跨区容灾。

## 目标架构（Decision Complete）
### 代码组织
- 采用 `pnpm monorepo`。
- 目录固定为：`apps/web`、`apps/api`、`apps/worker`、`services/parser`、`packages/shared`。

### 服务与技术栈
| 服务 | 技术 | 职责 | 部署 |
|---|---|---|---|
| `apps/web` | Next.js 15 + React + Tailwind + Tiptap | 前端 UI、文档编辑、问答界面、管理后台 | Node 容器 |
| `apps/api` | NestJS + Prisma + Fastify | 鉴权、文档/权限 API、检索/问答 API、任务编排 API | Node 容器 |
| `apps/worker` | Node.js + BullMQ | 异步执行抓取、解析、切块、嵌入、摘要标签 | Node 容器 |
| `services/parser` | FastAPI + PyMuPDF + python-docx + trafilatura | 高质量文本提取与结构化段落输出 | Python 容器 |
| `PostgreSQL` | PostgreSQL 16 + pgvector | 业务数据、全文索引、向量索引 | 托管数据库 |
| `Redis` | Redis 7 | 队列、限流、短期缓存 | 托管 Redis |
| `Object Storage` | S3 兼容存储 | 原始文件、版本文件 | 托管对象存储 |

### 核心执行流程
1. 文档入库流程：上传/抓取/编辑发布 -> 解析文本 -> 切块 -> 生成 embedding -> 写入索引 -> 触发摘要标签任务。
2. 问答流程：权限过滤 -> 混合检索（向量+关键词）-> 融合排序 -> LLM 生成带引用答案 -> 引用校验 -> 返回。
3. 自动化流程：`document.indexed` 事件触发 -> 生成摘要/标签 -> 写入文档元数据 -> 前端即时可见。
4. 编辑发布流程：草稿自动保存 -> 发布生成版本 -> 触发 `document.published` -> 入库索引 -> 可问答。

## 公共 API / 接口 / 类型
### API 基础规则
- 统一前缀：`/api/v1`。
- 认证方式：`JWT Access(15m) + Refresh(7d)`，HttpOnly Cookie。
- 所有列表接口默认分页：`page`、`pageSize`，默认 `20`，最大 `100`。
- 问答采用 `SSE` 流式输出，最终包包含 `answer + citations + confidence`。
- 问答与检索默认仅基于已发布版本（`published version`），草稿内容不参与召回。

### REST/SSE 接口清单
| Method | Path | 用途 |
|---|---|---|
| POST | `/api/v1/auth/register` | 注册 |
| POST | `/api/v1/auth/login` | 登录 |
| POST | `/api/v1/auth/refresh` | 刷新 token |
| POST | `/api/v1/auth/logout` | 退出 |
| GET | `/api/v1/workspaces` | 获取用户空间列表 |
| POST | `/api/v1/workspaces` | 创建空间 |
| POST | `/api/v1/workspaces/:id/invite` | 邀请成员 |
| PATCH | `/api/v1/workspaces/:id/members/:userId` | 修改成员角色 |
| POST | `/api/v1/folders` | 创建文件夹 |
| GET | `/api/v1/documents` | 文档列表（支持 folder/tag/filter） |
| POST | `/api/v1/documents` | 创建空白文档 |
| POST | `/api/v1/documents/:id/upload` | 上传文档版本文件 |
| PATCH | `/api/v1/documents/:id` | 更新标题/内容/共享策略 |
| PATCH | `/api/v1/documents/:id/content` | 保存编辑草稿内容（自动保存） |
| POST | `/api/v1/documents/:id/publish` | 发布当前草稿并触发入库 |
| POST | `/api/v1/documents/:id/revert/:versionId` | 回滚到历史版本并重新索引 |
| GET | `/api/v1/documents/:id/index-status` | 查询文档索引状态 |
| POST | `/api/v1/documents/:id/lock` | 获取编辑锁（单人编辑） |
| DELETE | `/api/v1/documents/:id/lock` | 释放编辑锁 |
| GET | `/api/v1/documents/:id/versions` | 文档版本列表 |
| POST | `/api/v1/documents/:id/share` | 文档级共享设置 |
| POST | `/api/v1/crawl/jobs` | 创建网页抓取任务 |
| GET | `/api/v1/ingestion/jobs/:id` | 查询入库任务状态 |
| POST | `/api/v1/search` | 关键词+语义搜索 |
| POST | `/api/v1/qa/ask` | 发起问答（非流） |
| GET | `/api/v1/qa/stream/:sessionId` | SSE 流式问答 |
| GET | `/api/v1/documents/:id/ai-meta` | 获取摘要与标签 |

### 队列事件契约
| 事件名 | 触发时机 | Payload（固定字段） | 重试策略 |
|---|---|---|---|
| `crawl.requested` | 创建抓取任务后 | `workspaceId, jobId, seedUrl, depth, maxPages` | 3 次指数退避 |
| `document.uploaded` | 文件上传成功后 | `workspaceId, documentId, versionId, objectKey` | 3 次 |
| `document.published` | 草稿发布成功后 | `workspaceId, documentId, versionId` | 3 次 |
| `document.reverted` | 回滚版本后 | `workspaceId, documentId, targetVersionId` | 2 次 |
| `document.parsed` | 解析完成后 | `workspaceId, documentId, versionId, sections[]` | 3 次 |
| `document.embedded` | 嵌入完成后 | `workspaceId, documentId, chunkCount` | 2 次 |
| `document.indexed` | 全量索引完成后 | `workspaceId, documentId, indexVersion` | 2 次 |
| `document.auto_tag_summary` | 自动化触发 | `workspaceId, documentId` | 2 次 |

补充约束：所有队列事件 payload 建议统一包含 `eventId` 或 `idempotencyKey`，消费者按键去重，避免重试导致重复入库或重复自动化。

### 关键类型（统一定义在 `packages/shared`）
```ts
export type WorkspaceRole = "owner" | "editor" | "viewer";
export type DocumentVisibility = "private" | "workspace" | "shared";
export type SourceType = "upload_pdf" | "upload_docx" | "upload_md" | "web_crawl";
export type DocumentIndexStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";

export interface Citation {
  documentId: string;
  versionId: string;
  chunkId: string;
  title: string;
  sourceType: SourceType;
  page?: number;
  url?: string;
  snippet: string;
}

export interface QaResponse {
  answer: string;
  citations: Citation[];
  confidence: number;
  refused: boolean;
  refusalReason?: "NO_EVIDENCE" | "NO_PERMISSION" | "LOW_CONFIDENCE";
}
```

## 数据模型（PostgreSQL）
### 表结构清单
- `users`：账号信息、密码哈希、状态。
- `workspaces`：空间信息、创建者。
- `workspace_members`：`workspace_id + user_id + role` 唯一约束。
- `folders`：空间内树形目录（`parent_id` 可空）。
- `documents`：文档主信息、可见性、当前版本、已发布版本（`published_version_id`）、索引状态（`index_status`）、归属文件夹。
- `document_versions`：每次上传/保存一条版本记录，关联对象存储 key；支持发布态字段（`is_published`, `published_at`）。
- `document_shares`：文档级共享（用户粒度）。
- `document_chunks`：切块内容、`tsvector`、`embedding vector(1024)`、页码/段落位置信息。
- `ingestion_jobs`：入库任务状态机与错误信息。
- `crawl_jobs`：抓取任务与统计信息。
- `document_ai_meta`：摘要、标签、关键短语、更新时间。
- `document_edit_locks`：文档编辑软锁（`document_id, holder_user_id, expires_at`）。
- `qa_sessions`：问答会话元信息。
- `qa_messages`：问答请求/响应与引用快照。
- `audit_logs`：关键操作审计（权限变更、删除、共享）。

### 索引与约束（固定）
- `document_chunks.embedding` 建 `HNSW` 索引。
- `document_chunks.tsv` 建 `GIN` 索引。
- `documents(workspace_id, updated_at desc)` 复合索引。
- `workspace_members(workspace_id, user_id)` 唯一索引。
- `document_shares(document_id, user_id)` 唯一索引。
- `document_edit_locks(document_id)` 唯一索引。

## RAG 与 AI 详细策略
### 模型与提供方
- 接口标准：OpenAI 兼容 API。
- 默认聊天模型：`qwen-plus-latest`（可配置）。
- 默认嵌入模型：`text-embedding-v3`（固定 1024 维，禁止运行时混用维度）。
- 生成温度：`0.2`，确保稳定引用。

### 解析与切块
- PDF：`PyMuPDF` 提取文本与页码。
- DOCX：`python-docx` 提取段落与标题层级。
- Markdown：直接解析标题结构。
- Web：`trafilatura` 提取正文，保留来源 URL。
- 切块规则：优先按标题分段；超长段落按 `500 中文字符 + 100 重叠` 滑窗切块。
- 每个 chunk 固定保存：`chunk_id, content, page/url, heading_path, token_estimate`。

### 检索与回答策略（固定算法）
1. 权限与版本预过滤：仅检索用户有权访问且已发布版本可见的文档集合。
2. 语义检索：向量 Top `30`。
3. 关键词检索：全文 Top `30`。
4. 融合：`RRF` 融合得到 Top `20`。
5. 上下文构建：按 token 预算选 Top `8` chunk。
6. 生成：强约束 Prompt，答案必须输出引用标记。
7. 校验：若无合法引用或置信度 `< 0.55`，返回拒答模板。
8. 拒答文案固定：`未在可访问知识库中找到可验证依据。请上传更多资料或调整问题。`

### 自动化处理
- 触发条件：`document.indexed`。
- 动作 1：生成 `80-160` 字摘要。
- 动作 2：生成 `3-8` 个标签（先匹配系统标签字典，再补充自由标签）。
- 动作 3：提取 `5` 个关键词。
- 存储位置：`document_ai_meta`，并回写 `documents.search_keywords`。

## 权限、安全与合规
- RBAC：空间角色 `owner/editor/viewer`。
- 角色边界：`editor` 可编辑/发布/回滚文档，但不能修改空间成员角色。
- 文档可见性：`private/workspace/shared` 三档。
- 每个读写 API 都先做 `workspace membership` 校验，再做 `document visibility/share` 校验。
- 编辑锁策略：单人编辑软锁默认 `60s` 过期，前端心跳续租；锁冲突返回明确错误码。
- 对象存储下载使用预签名 URL，默认有效期 `10` 分钟。
- 删除策略：软删除 `30` 天后硬删除（MVP 固定）。
- 审计记录：成员变更、共享变更、删除操作、登录失败。

## 监控与运维
- 错误监控：Sentry（web/api/worker/parser 全接入）。
- 指标：Prometheus，至少采集 `API 延迟`、`问答成功率`、`拒答率`、`任务失败率`、`队列堆积`、`发布到可问答时延`（publish_to_indexed_latency）。
- 日志：结构化 JSON 日志，按 `traceId` 串联 API 与异步任务。
- 告警阈值：问答失败率 `>5%` 持续 10 分钟告警；队列等待 `>200` 告警。

## 测试计划与验收场景
### 自动化测试
- 单元测试：权限判断、切块器、检索融合、引用校验器。
- 集成测试：上传到索引链路、抓取到索引链路、编辑发布到索引链路、问答拒答链路。
- E2E 测试：注册登录、上传文档、编辑并发布、提问并看到引用、文档共享后可见性变化。
- 性能测试：`30` 并发问答，P95 响应 `<8s`；`20` 文档/分钟入库能力。
- 安全测试：越权访问拦截、过期签名 URL 拒绝、注入 payload 防护。

### 验收标准（必须全部通过）
1. 可上传 `PDF/DOCX/MD` 并在前端看到入库状态。
2. 可通过 URL 抓取网页并进入知识库。
3. 问答结果 `100%` 带至少 1 条引用；无证据时稳定拒答。
4. 不同权限用户看到的检索与问答结果严格隔离。
5. 入库后 `60s` 内可看到摘要与标签（中等文档，<5MB）。
6. 文档版本可追溯，切换并发布版本后问答结果基于最新已发布版本。
7. 编辑草稿默认不参与检索与问答，发布后才进入知识库。
8. 文档发布后 `60s` 内可进入可问答状态（中等文档，<5MB）。
9. 回滚版本后，问答引用必须来自回滚后的已发布版本。

## 里程碑（6-8 周执行排期）
1. 第 1-2 周：仓库与基础设施、鉴权与空间模型、文档管理基础 API、编辑草稿与发布 API、对象存储接入。
2. 第 3-4 周：解析服务、上传/编辑发布入库队列、切块与嵌入、检索 API、网页抓取任务。
3. 第 5-6 周：问答 API 与 SSE、引用校验与拒答策略、自动摘要标签、前端问答与引用展示、索引状态可视化。
4. 第 7 周：权限加固、审计日志、监控告警、性能调优。
5. 第 8 周：E2E 回归、灰度发布、首批团队试点与问题修复。

## 假设与默认值（已锁定）
- 默认语言：中文优先，英文可用但不做专门优化。
- 默认端形态：仅 Web，不做移动端 App。
- 默认编辑模型：单人编辑 + 草稿/发布双态 + 编辑锁，团队可查看与评论（无实时协作）。
- 默认部署：单区域云部署，暂不做本地私有化包。
- 默认数据源：上传文件 + 手动触发网页抓取，不做第三方系统连接器。
- 默认 AI 策略：基础 RAG + 引用溯源 + 无引用拒答，禁止“纯推测回答”。
- 默认规模：10 个团队、每团队 1 万文档以内，使用 PostgreSQL + pgvector 即可满足 MVP。
