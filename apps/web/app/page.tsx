"use client";

import { FormEvent, useMemo, useState } from "react";
import { DocumentEditor } from "@/components/document-editor";
import { apiRequest } from "@/lib/api";

interface Workspace {
  id: string;
  name: string;
  role: "owner" | "editor" | "viewer";
}

interface DocumentItem {
  id: string;
  title: string;
  visibility: "private" | "workspace" | "shared";
  updatedAt: string;
  aiMeta?: {
    summary?: string;
    labels?: string[];
  } | null;
}

export default function HomePage() {
  const [authMode, setAuthMode] = useState<"login" | "register">("register");
  const [email, setEmail] = useState("demo@example.com");
  const [password, setPassword] = useState("Password123");
  const [name, setName] = useState("Demo User");
  const [token, setToken] = useState("");
  const [status, setStatus] = useState("Ready");

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceName, setWorkspaceName] = useState("Product Knowledge Base");
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [docTitle, setDocTitle] = useState("Getting Started");
  const [docContent, setDocContent] = useState("<h2>Welcome</h2><p>Edit team content here.</p>");
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const [question, setQuestion] = useState("What is the core message of this document?");
  const [answer, setAnswer] = useState("");
  const [citations, setCitations] = useState<Array<{ title: string; snippet: string }>>([]);

  const selectedWorkspace = useMemo(
    () => workspaces.find((w) => w.id === selectedWorkspaceId),
    [workspaces, selectedWorkspaceId],
  );

  const selectedDoc = useMemo(
    () => documents.find((doc) => doc.id === selectedDocumentId),
    [documents, selectedDocumentId],
  );

  /**
   * 函数说明：handleAuth，负责当前模块的业务处理逻辑。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setStatus("Authenticating...");
      const data = await apiRequest<{ accessToken: string }>(
        authMode === "register" ? "/auth/register" : "/auth/login",
        {
          method: "POST",
          body: authMode === "register" ? { email, password, name } : { email, password },
        },
      );

      setToken(data.accessToken);
      setStatus("Authenticated.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Authentication failed");
    }
  }

  /**
   * 函数说明：loadWorkspaces，负责当前模块的业务处理逻辑。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
  async function loadWorkspaces() {
    try {
      setStatus("Loading workspaces...");
      const data = await apiRequest<Workspace[]>("/workspaces", { token });
      setWorkspaces(data);
      if (data.length > 0 && !selectedWorkspaceId) {
        setSelectedWorkspaceId(data[0].id);
      }
      setStatus("Workspaces loaded.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to load workspaces");
    }
  }

  /**
   * 函数说明：createWorkspace，负责当前模块的业务处理逻辑。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
  async function createWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspaceName.trim()) {
      return;
    }

    try {
      setStatus("Creating workspace...");
      const workspace = await apiRequest<Workspace>("/workspaces", {
        method: "POST",
        token,
        body: { name: workspaceName },
      });
      setWorkspaces((prev) => [workspace, ...prev]);
      setSelectedWorkspaceId(workspace.id);
      setStatus("Workspace created.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Workspace create failed");
    }
  }

  /**
   * 函数说明：loadDocuments，负责当前模块的业务处理逻辑。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
  async function loadDocuments() {
    if (!selectedWorkspaceId) {
      return;
    }

    try {
      setStatus("Loading documents...");
      const data = await apiRequest<{ items: DocumentItem[] }>(
        `/documents?workspaceId=${selectedWorkspaceId}&page=1&pageSize=20`,
        { token },
      );
      setDocuments(data.items);
      if (data.items.length > 0 && !selectedDocumentId) {
        setSelectedDocumentId(data.items[0].id);
      }
      setStatus("Documents loaded.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to load documents");
    }
  }

  /**
   * 函数说明：createDocument，负责当前模块的业务处理逻辑。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
  async function createDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedWorkspaceId) {
      setStatus("Select workspace first");
      return;
    }

    try {
      setStatus("Creating document...");
      const doc = await apiRequest<DocumentItem>("/documents", {
        method: "POST",
        token,
        body: {
          workspaceId: selectedWorkspaceId,
          title: docTitle,
          content: docContent,
          visibility: "workspace",
        },
      });

      setDocuments((prev) => [doc, ...prev]);
      setSelectedDocumentId(doc.id);
      setStatus("Document created.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Create document failed");
    }
  }

  /**
   * 函数说明：uploadVersion，负责当前模块的业务处理逻辑。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
  async function uploadVersion() {
    if (!selectedWorkspaceId || !selectedDocumentId) {
      setStatus("Select workspace and document first");
      return;
    }

    try {
      setStatus("Submitting ingestion job...");

      if (uploadFile) {
        const contentBase64 = await fileToBase64(uploadFile);
        const sourceType = inferSourceType(uploadFile.name, uploadFile.type);

        await apiRequest(`/documents/${selectedDocumentId}/upload`, {
          method: "POST",
          token,
          body: {
            workspaceId: selectedWorkspaceId,
            sourceType,
            mimeType: uploadFile.type || mimeBySourceType(sourceType),
            fileName: uploadFile.name,
            contentBase64,
          },
        });
      } else {
        await apiRequest(`/documents/${selectedDocumentId}/upload`, {
          method: "POST",
          token,
          body: {
            workspaceId: selectedWorkspaceId,
            sourceType: "upload_md",
            mimeType: "text/markdown",
            rawText: stripHtml(docContent),
          },
        });
      }

      setStatus("Version uploaded and ingestion queued.");
      setUploadFile(null);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Upload failed");
    }
  }

  /**
   * 函数说明：askQuestion，负责当前模块的业务处理逻辑。
   * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
   * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
   * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
   */
  async function askQuestion() {
    if (!selectedWorkspaceId) {
      setStatus("Select workspace first");
      return;
    }

    try {
      setStatus("Asking AI...");
      const result = await apiRequest<{
        answer: string;
        citations: Array<{ title: string; snippet: string }>;
      }>("/qa/ask", {
        method: "POST",
        token,
        body: {
          workspaceId: selectedWorkspaceId,
          question,
        },
      });

      setAnswer(result.answer);
      setCitations(result.citations ?? []);
      setStatus("Answer ready.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "QA failed");
    }
  }

  return (
    <main className="app-shell">
      <header className="hero reveal-1">
        <div className="hero-heading">
          <span className="eyebrow">SMART DOC CONTROL ROOM</span>
          <h1>智能文档工作台</h1>
          <p>管理文档、驱动入库、执行知识问答，一屏完成 MVP 全链路验证。</p>
        </div>
        <div className="hero-metrics">
          <article className="metric-card">
            <span>Auth</span>
            <strong>{token ? "Connected" : "Guest"}</strong>
          </article>
          <article className="metric-card">
            <span>Workspace</span>
            <strong>{workspaces.length}</strong>
          </article>
          <article className="metric-card">
            <span>Documents</span>
            <strong>{documents.length}</strong>
          </article>
          <article className="metric-card">
            <span>Selected</span>
            <strong>{selectedDoc ? "1" : "0"}</strong>
          </article>
        </div>
        <div className="status-ribbon">
          <span className="status-dot" />
          {status}
        </div>
      </header>

      <section className="control-grid reveal-2">
        <article className="panel auth-panel">
          <h2>身份认证</h2>
          <p className="panel-subtitle">先获取访问令牌，再执行后续所有工作台动作。</p>
          <form onSubmit={handleAuth} className="stack">
            <div className="switch-row">
              <button
                type="button"
                className={authMode === "register" ? "active" : ""}
                onClick={() => setAuthMode("register")}
              >
                注册
              </button>
              <button
                type="button"
                className={authMode === "login" ? "active" : ""}
                onClick={() => setAuthMode("login")}
              >
                登录
              </button>
            </div>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="邮箱" />
            <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="密码" type="password" />
            {authMode === "register" ? (
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="昵称" />
            ) : null}
            <button type="submit">提交</button>
          </form>
        </article>

        <article className="panel workspace-panel">
          <h2>空间管理</h2>
          <p className="panel-subtitle">加载空间、创建空间并切换当前工作空间。</p>
          <div className="stack">
            <button onClick={loadWorkspaces} disabled={!token}>
              加载空间列表
            </button>
            <form onSubmit={createWorkspace} className="stack compact-form">
              <input
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                placeholder="新空间名称"
              />
              <button type="submit" disabled={!token}>
                创建空间
              </button>
            </form>
            <div className="chip-wrap">
              {workspaces.length === 0 ? (
                <span className="hint">暂无空间，先点击“加载空间列表”或创建一个新空间。</span>
              ) : (
                workspaces.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`chip ${selectedWorkspaceId === item.id ? "active" : ""}`}
                    onClick={() => setSelectedWorkspaceId(item.id)}
                  >
                    {item.name}
                    <em>{item.role}</em>
                  </button>
                ))
              )}
            </div>
            <div className="hint">当前空间: {selectedWorkspace?.name ?? "未选择"}</div>
          </div>
        </article>

        <article className="panel document-panel">
          <h2>文档与版本</h2>
          <p className="panel-subtitle">创建文档、选中文档并提交新版本进入入库队列。</p>
          <div className="stack">
            <button onClick={loadDocuments} disabled={!token || !selectedWorkspaceId}>
              加载文档列表
            </button>
            <form onSubmit={createDocument} className="stack compact-form">
              <input value={docTitle} onChange={(e) => setDocTitle(e.target.value)} placeholder="文档标题" />
              <button type="submit" disabled={!token || !selectedWorkspaceId}>
                创建文档
              </button>
            </form>
            <div className="doc-list">
              {documents.length === 0 ? (
                <span className="hint">暂无文档，可先创建文档再编辑。</span>
              ) : (
                documents.map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    className={`doc-card ${selectedDocumentId === doc.id ? "active" : ""}`}
                    onClick={() => setSelectedDocumentId(doc.id)}
                  >
                    <strong>{doc.title}</strong>
                    <span>{doc.visibility}</span>
                  </button>
                ))
              )}
            </div>
            <input
              type="file"
              accept=".md,.pdf,.docx"
              onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
            />
            <div className="hint">
              {uploadFile
                ? `文件模式: ${uploadFile.name}`
                : "未选择文件时，将把编辑器内容按 Markdown 文本上传。"}
            </div>
            <button onClick={uploadVersion} disabled={!selectedDocumentId || !token}>
              提交新版本入库
            </button>
          </div>
        </article>
      </section>

      <section className="workspace-stage reveal-3">
        <div className="stage-head">
          <h2>在线编辑区</h2>
          <span>{selectedDoc?.title ?? "未选择文档"}</span>
        </div>
        <DocumentEditor value={docContent} onChange={setDocContent} />
      </section>

      <section className="qa-stage reveal-4">
        <div className="stage-head">
          <h2>智能问答与引用</h2>
          <span>仅在已选空间内检索</span>
        </div>
        <div className="qa-row">
          <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="输入问题并发起问答" />
          <button onClick={askQuestion} disabled={!token || !selectedWorkspaceId}>
            立即提问
          </button>
        </div>

        <div className="answer-wrap">
          <pre>{answer || "答案将展示在这里。"}</pre>
          <aside className="citation-panel">
            <h3>引用来源</h3>
            {citations.length === 0 ? (
              <div className="hint">暂无引用</div>
            ) : (
              <ul>
                {citations.map((citation, index) => (
                  <li key={`${citation.title}-${index}`}>
                    <strong>{citation.title}</strong>
                    <p>{citation.snippet}</p>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      </section>
    </main>
  );
}

/**
 * 函数说明：stripHtml，负责当前模块的业务处理逻辑。
 * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
 * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
 * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
 */
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * 函数说明：fileToBase64，负责当前模块的业务处理逻辑。
 * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
 * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
 * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
 */
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Failed to read file"));
        return;
      }
      const base64 = result.split(",")[1] ?? "";
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

/**
 * 函数说明：inferSourceType，负责当前模块的业务处理逻辑。
 * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
 * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
 * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
 */
function inferSourceType(fileName: string, mimeType: string): "upload_pdf" | "upload_docx" | "upload_md" {
  const lower = fileName.toLowerCase();
  if (mimeType.includes("pdf") || lower.endsWith(".pdf")) {
    return "upload_pdf";
  }
  if (mimeType.includes("word") || lower.endsWith(".docx")) {
    return "upload_docx";
  }
  return "upload_md";
}

/**
 * 函数说明：mimeBySourceType，负责当前模块的业务处理逻辑。
 * 执行流程：基于入参进行校验与处理，必要时调用下游服务或数据层。
 * 参数约定：参数类型与约束以函数签名、DTO 与类型定义为准。
 * 返回结果：返回当前处理阶段的结果；异常由上层统一捕获并转换为错误响应。
 */
function mimeBySourceType(sourceType: "upload_pdf" | "upload_docx" | "upload_md"): string {
  if (sourceType === "upload_pdf") {
    return "application/pdf";
  }
  if (sourceType === "upload_docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return "text/markdown";
}
