# Smart Document Platform (MVP)

Monorepo for a smart document platform with:

- document management
- AI understanding pipeline
- RAG Q&A with citations
- automated summarization and tagging

## Monorepo Layout

- `apps/web` - Next.js web app
- `apps/api` - NestJS API (Fastify + Prisma)
- `apps/worker` - BullMQ workers for ingestion pipeline
- `services/parser` - FastAPI parsing service
- `packages/shared` - shared types, contracts, constants
- `infra` - local docker compose and infra docs

## MVP Scope Implemented

- auth: register/login/refresh/logout (`JWT access + refresh cookie`)
- workspace: list/create/invite/update member role
- document: create/list/update/version/share/AI metadata
- ingestion job and crawl job APIs
- hybrid search (semantic + keyword) and QA with citations
- refusal on no evidence or low confidence
- automation on `document.indexed` for summary/tags/keywords
- parser service for `markdown/docx/pdf/web`

## Event Contracts Implemented

- `crawl.requested`
- `document.uploaded`
- `document.parsed`
- `document.embedded`
- `document.indexed`
- `document.auto_tag_summary`

## Quick Start

1. Copy env files:
   - copy root `.env.example` to `.env`
   - copy `apps/api/.env.example` to `apps/api/.env`
   - copy `apps/worker/.env.example` to `apps/worker/.env`
   - copy `apps/web/.env.example` to `apps/web/.env.local`
2. Start infrastructure (PostgreSQL + Redis + MinIO):
   - `docker compose -f infra/docker-compose.yml up -d`
3. Install dependencies:
   - `pnpm install`
4. Generate Prisma client and push schema:
   - `pnpm prisma:generate`
   - `pnpm prisma:push`
5. Start parser service:
   - `python -m venv .venv`
   - `.\\.venv\\Scripts\\activate`
   - `pip install -r services/parser/requirements.txt`
   - `uvicorn app.main:app --app-dir services/parser --host 0.0.0.0 --port 8000`
6. Start platform services:
   - `pnpm dev:api`
   - `pnpm dev:worker`
   - `pnpm dev:web`

## API Prefix

- all routes are under `/api/v1`

## Validation Status

- `pnpm -r typecheck` passed
- `pnpm -r build` passed
- `python -m py_compile services/parser/app/main.py` passed

## Notes

This repository is MVP-oriented and intentionally keeps some production hardening tasks for later:

- file upload currently emphasizes metadata/raw-text ingestion workflow
- object storage pre-signed upload/download flow needs expansion
- no enterprise SSO/compliance controls yet
- `/documents/:id/upload` currently accepts JSON payload (`rawText` or `contentBase64`) rather than direct multipart upload
