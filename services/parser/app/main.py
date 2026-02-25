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
    return {"ok": True, "service": "parser"}


@app.post("/parse/text")
def parse_text(payload: ParseTextRequest) -> dict:
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
    try:
        data = base64.b64decode(payload.contentBase64)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Invalid base64 content: {exc}")

    mime = payload.mimeType.lower()
    name = payload.fileName.lower()

    if mime == "application/pdf" or name.endswith(".pdf"):
        text = parse_pdf(data)
    elif (
        mime in {
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
    out: List[str] = []
    with fitz.open(stream=data, filetype="pdf") as doc:
        for page in doc:
            text = page.get_text("text")
            if text:
                out.append(text)
    return "\n\n".join(out)


def parse_docx(data: bytes) -> str:
    buffer = io.BytesIO(data)
    document = DocxDocument(buffer)
    paragraphs = [p.text for p in document.paragraphs if p.text and p.text.strip()]
    return "\n\n".join(paragraphs)


def parse_markdown_sections(content: str) -> List[ParsedSection]:
    lines = content.splitlines()
    sections: List[ParsedSection] = []

    current_heading: List[str] = []
    current_lines: List[str] = []

    heading_pattern = re.compile(r"^(#{1,6})\s+(.+)$")

    def flush_section() -> None:
        nonlocal current_lines
        text = "\n".join(current_lines).strip()
        if text:
            sections.append(
                ParsedSection(
                    sectionId=str(uuid4()),
                    headingPath=current_heading[:] if current_heading else ["正文"],
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

            if len(current_heading) >= level:
                current_heading = current_heading[: level - 1]
            current_heading.append(heading)
            continue

        current_lines.append(line)

    flush_section()

    return sections if sections else parse_paragraph_sections(content)


def parse_paragraph_sections(content: str) -> List[ParsedSection]:
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", content) if p.strip()]

    return [
        ParsedSection(
            sectionId=str(uuid4()),
            headingPath=["正文"],
            content=paragraph,
        )
        for paragraph in paragraphs
    ]


def derive_title(text: str, fallback: str) -> str:
    first = text.strip().splitlines()[0] if text.strip() else ""
    first = re.sub(r"\s+", " ", first).strip()
    if first and len(first) <= 80:
        return first
    if first:
        return first[:80]
    return fallback
