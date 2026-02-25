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
    <main className="page-shell">
      <section className="hero-card">
        <h1>Smart Document Platform</h1>
        <p>Document Management + AI Understanding + QA + Automation</p>
        <span className="status">{status}</span>
      </section>

      <section className="grid-layout">
        <article className="panel">
          <h2>1. Auth</h2>
          <form onSubmit={handleAuth} className="stack">
            <div className="switch-row">
              <button
                type="button"
                className={authMode === "register" ? "active" : ""}
                onClick={() => setAuthMode("register")}
              >
                Register
              </button>
              <button
                type="button"
                className={authMode === "login" ? "active" : ""}
                onClick={() => setAuthMode("login")}
              >
                Login
              </button>
            </div>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              type="password"
            />
            {authMode === "register" ? (
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
            ) : null}
            <button type="submit">Submit</button>
          </form>
        </article>

        <article className="panel">
          <h2>2. Workspaces</h2>
          <div className="stack">
            <button onClick={loadWorkspaces} disabled={!token}>
              Load Workspaces
            </button>
            <form onSubmit={createWorkspace} className="stack">
              <input
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                placeholder="Workspace name"
              />
              <button type="submit" disabled={!token}>
                Create Workspace
              </button>
            </form>
            <select
              value={selectedWorkspaceId}
              onChange={(e) => setSelectedWorkspaceId(e.target.value)}
              disabled={workspaces.length === 0}
            >
              <option value="">Select workspace</option>
              {workspaces.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.role})
                </option>
              ))}
            </select>
            <div className="hint">Current: {selectedWorkspace?.name ?? "-"}</div>
          </div>
        </article>

        <article className="panel">
          <h2>3. Documents</h2>
          <div className="stack">
            <button onClick={loadDocuments} disabled={!token || !selectedWorkspaceId}>
              Load Documents
            </button>
            <form onSubmit={createDocument} className="stack">
              <input value={docTitle} onChange={(e) => setDocTitle(e.target.value)} placeholder="Document title" />
              <button type="submit" disabled={!token || !selectedWorkspaceId}>
                Create Document
              </button>
            </form>
            <select
              value={selectedDocumentId}
              onChange={(e) => setSelectedDocumentId(e.target.value)}
              disabled={documents.length === 0}
            >
              <option value="">Select document</option>
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.title}
                </option>
              ))}
            </select>
            <input
              type="file"
              accept=".md,.pdf,.docx"
              onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
            />
            <div className="hint">
              {uploadFile ? `File mode: ${uploadFile.name}` : "No file selected. Editor text will be uploaded as markdown."}
            </div>
            <button onClick={uploadVersion} disabled={!selectedDocumentId || !token}>
              Upload New Version
            </button>
          </div>
        </article>
      </section>

      <section className="editor-card">
        <h2>Online Editor</h2>
        <DocumentEditor value={docContent} onChange={setDocContent} />
        <div className="hint">Selected document: {selectedDoc?.title ?? "None"}</div>
      </section>

      <section className="qa-card">
        <h2>Q&A with Citations</h2>
        <div className="qa-row">
          <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask a question" />
          <button onClick={askQuestion} disabled={!token || !selectedWorkspaceId}>
            Ask
          </button>
        </div>
        <pre>{answer || "Answer will appear here."}</pre>
        <ul>
          {citations.map((citation, index) => (
            <li key={`${citation.title}-${index}`}>
              <strong>{citation.title}</strong>
              <p>{citation.snippet}</p>
            </li>
          ))}
        </ul>
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
