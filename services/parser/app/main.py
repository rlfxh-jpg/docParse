from __future__ import annotations

import base64
import io
import re
from typing import List, Optional
from uuid import uuid4

import fitz
import trafilatura
from docx import Document as DocxDocument
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, HttpUrl

app = FastAPI(title="smart-doc-parser", version="0.1.0")


class ParsedSection(BaseModel):
    sectionId: str
    headingPath: List[str]
    content: str
    page: Optional[int] = None
    url: Optional[str] = None


class ParseTextRequest(BaseModel):
    sourceType: str
    content: str
    url: Optional[HttpUrl] = None


class ParseWebRequest(BaseModel):
    url: HttpUrl


class ParseFileRequest(BaseModel):
    fileName: str
    mimeType: str
    contentBase64: str = Field(min_length=1)


@app.get("/health")
def health() -> dict:
    """
    函数说明：health，负责当前模块的处理逻辑。
    执行流程：接收输入参数后完成解析/校验/转换，并返回标准化结果。
    参数约定：具体参数含义与类型以函数签名和调用方约定为准。
    返回结果：返回当前函数处理结果；异常将由上层捕获并转为错误响应。
    """
    return {"ok": True, "service": "parser"}


@app.post("/parse/text")
def parse_text(payload: ParseTextRequest) -> dict:
    """
    函数说明：parse_text，负责当前模块的处理逻辑。
    执行流程：接收输入参数后完成解析/校验/转换，并返回标准化结果。
    参数约定：具体参数含义与类型以函数签名和调用方约定为准。
    返回结果：返回当前函数处理结果；异常将由上层捕获并转为错误响应。
    """
    # 文本解析入口：
    # - Markdown：按标题层级切段，保留 headingPath
    # - 其他文本：按段落切分
    # 输出统一的 sections 结构，供后续切块与向量化使用。
    content = payload.content.strip()
    if not content:
        return {"sections": []}

    if payload.sourceType == "upload_md":
        sections = parse_markdown_sections(content)
    else:
        sections = parse_paragraph_sections(content)

    if payload.url:
        for section in sections:
            section.url = str(payload.url)

    return {"sections": [s.model_dump() for s in sections]}


@app.post("/parse/web")
def parse_web(payload: ParseWebRequest) -> dict:
    """
    函数说明：parse_web，负责当前模块的处理逻辑。
    执行流程：接收输入参数后完成解析/校验/转换，并返回标准化结果。
    参数约定：具体参数含义与类型以函数签名和调用方约定为准。
    返回结果：返回当前函数处理结果；异常将由上层捕获并转为错误响应。
    """
    # 网页解析入口：
    # 使用 trafilatura 提取正文，尽量过滤导航、广告、页脚等噪声内容。
    downloaded = trafilatura.fetch_url(str(payload.url))
    if downloaded is None:
        raise HTTPException(status_code=400, detail="Failed to fetch URL")

    extracted = trafilatura.extract(downloaded, include_comments=False, include_tables=True)
    if not extracted:
        raise HTTPException(status_code=400, detail="Failed to extract web content")

    title = derive_title(extracted, str(payload.url))
    sections = parse_paragraph_sections(extracted)
    for section in sections:
        section.url = str(payload.url)

    return {
        "title": title,
        "sections": [s.model_dump() for s in sections],
    }


@app.post("/parse/file")
def parse_file(payload: ParseFileRequest) -> dict:
    """
    函数说明：parse_file，负责当前模块的处理逻辑。
    执行流程：接收输入参数后完成解析/校验/转换，并返回标准化结果。
    参数约定：具体参数含义与类型以函数签名和调用方约定为准。
    返回结果：返回当前函数处理结果；异常将由上层捕获并转为错误响应。
    """
    # 文件解析入口（服务于 API -> Worker 的入库链路）：
    # base64 文件内容 -> 纯文本 -> 统一 sections 结构。
    try:
        data = base64.b64decode(payload.contentBase64)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Invalid base64 content: {exc}")

    mime = payload.mimeType.lower()
    name = payload.fileName.lower()

    if mime == "application/pdf" or name.endswith(".pdf"):
        text = parse_pdf(data)
    elif (
        mime
        in {
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/msword",
        }
        or name.endswith(".docx")
    ):
        text = parse_docx(data)
    elif mime in {"text/markdown", "text/plain"} or name.endswith(".md"):
        text = data.decode("utf-8", errors="ignore")
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {payload.mimeType}")

    sections = parse_markdown_sections(text) if name.endswith(".md") else parse_paragraph_sections(text)

    return {
        "sections": [s.model_dump() for s in sections],
    }


def parse_pdf(data: bytes) -> str:
    """
    函数说明：parse_pdf，负责当前模块的处理逻辑。
    执行流程：接收输入参数后完成解析/校验/转换，并返回标准化结果。
    参数约定：具体参数含义与类型以函数签名和调用方约定为准。
    返回结果：返回当前函数处理结果；异常将由上层捕获并转为错误响应。
    """
    # PDF 逐页抽取文本并拼接，尽量保留阅读顺序。
    out: List[str] = []
    with fitz.open(stream=data, filetype="pdf") as doc:
        for page in doc:
            text = page.get_text("text")
            if text:
                out.append(text)
    return "\n\n".join(out)


def parse_docx(data: bytes) -> str:
    """
    函数说明：parse_docx，负责当前模块的处理逻辑。
    执行流程：接收输入参数后完成解析/校验/转换，并返回标准化结果。
    参数约定：具体参数含义与类型以函数签名和调用方约定为准。
    返回结果：返回当前函数处理结果；异常将由上层捕获并转为错误响应。
    """
    # DOCX 仅保留非空段落，展开为纯文本，减少后续分块噪声。
    buffer = io.BytesIO(data)
    document = DocxDocument(buffer)
    paragraphs = [p.text for p in document.paragraphs if p.text and p.text.strip()]
    return "\n\n".join(paragraphs)


def parse_markdown_sections(content: str) -> List[ParsedSection]:
    """
    函数说明：parse_markdown_sections，负责当前模块的处理逻辑。
    执行流程：接收输入参数后完成解析/校验/转换，并返回标准化结果。
    参数约定：具体参数含义与类型以函数签名和调用方约定为准。
    返回结果：返回当前函数处理结果；异常将由上层捕获并转为错误响应。
    """
    lines = content.splitlines()
    sections: List[ParsedSection] = []

    current_heading: List[str] = []
    current_lines: List[str] = []

    heading_pattern = re.compile(r"^(#{1,6})\s+(.+)$")

    def flush_section() -> None:
        """
        函数说明：flush_section，负责当前模块的处理逻辑。
        执行流程：接收输入参数后完成解析/校验/转换，并返回标准化结果。
        参数约定：具体参数含义与类型以函数签名和调用方约定为准。
        返回结果：返回当前函数处理结果；异常将由上层捕获并转为错误响应。
        """
        nonlocal current_lines
        # 每遇到新标题或到达结尾时，把当前累计内容落成一个 section。
        text = "\n".join(current_lines).strip()
        if text:
            sections.append(
                ParsedSection(
                    sectionId=str(uuid4()),
                    headingPath=current_heading[:] if current_heading else ["body"],
                    content=text,
                )
            )
        current_lines = []

    for line in lines:
        match = heading_pattern.match(line.strip())
        if match:
            flush_section()
            level = len(match.group(1))
            heading = match.group(2).strip()

            # 根据 Markdown 标题层级维护 headingPath：
            # 例如 ## 子标题 会截断到父级后再追加当前标题。
            if len(current_heading) >= level:
                current_heading = current_heading[: level - 1]
            current_heading.append(heading)
            continue

        current_lines.append(line)

    flush_section()

    # 若未识别出有效 markdown section，则退化为普通段落切分。
    return sections if sections else parse_paragraph_sections(content)


def parse_paragraph_sections(content: str) -> List[ParsedSection]:
    """
    函数说明：parse_paragraph_sections，负责当前模块的处理逻辑。
    执行流程：接收输入参数后完成解析/校验/转换，并返回标准化结果。
    参数约定：具体参数含义与类型以函数签名和调用方约定为准。
    返回结果：返回当前函数处理结果；异常将由上层捕获并转为错误响应。
    """
    # 段落切分基于“空行”边界，适用于纯文本、网页正文等无层级内容。
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", content) if p.strip()]

    return [
        ParsedSection(
            sectionId=str(uuid4()),
            headingPath=["body"],
            content=paragraph,
        )
        for paragraph in paragraphs
    ]


def derive_title(text: str, fallback: str) -> str:
    """
    函数说明：derive_title，负责当前模块的处理逻辑。
    执行流程：接收输入参数后完成解析/校验/转换，并返回标准化结果。
    参数约定：具体参数含义与类型以函数签名和调用方约定为准。
    返回结果：返回当前函数处理结果；异常将由上层捕获并转为错误响应。
    """
    first = text.strip().splitlines()[0] if text.strip() else ""
    first = re.sub(r"\s+", " ", first).strip()
    if first and len(first) <= 80:
        return first
    if first:
        return first[:80]
    return fallback
