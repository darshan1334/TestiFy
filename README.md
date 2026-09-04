# TestiFy — AI Autonomous Software Testing Agent

An AI-powered web testing platform that autonomously crawls any URL, detects bugs, and generates detailed reports — powered by **Google Gemini AI** and **Playwright**.

## Architecture

```
React (Vite + Tailwind)  →  FastAPI Backend  →  Playwright Crawler
                                    ↓                     ↓
                             Gemini AI Analysis    Collected Data
                                    ↓
                              SQLite Database
                                    ↓
                             HTML / JSON Reports
```

## Features

- 🕷️ **Smart Crawling** — Multi-page Playwright browser automation
- ⚡ **JS Error Detection** — Console error capture
- 🔗 **Broken Link Checking** — Internal + external link validation  
- ♿ **Accessibility** — axe-core powered WCAG scanning
- 📊 **Performance Metrics** — Load time analysis
- 📝 **Form Testing** — Button, label, and submit validation
- 🤖 **Gemini AI Analysis** — AI-powered issue classification and recommendations
- 📄 **Reports** — HTML & JSON export
- 🔴 **Live Progress** — WebSocket real-time streaming

### 🛡️ TestiFy Security — SAST Add-On (`/security`)

An optional static application security testing (SAST) module bolted onto the
same backend and UI. It does not touch the testing pipeline: separate routes
(`/api/security/*`), a separate database file, and a separate page section.

- 🔍 **Code Scanning** — 41 real detection rules across Python, JS/TS, Java, PHP, Go, Ruby, C#
- 🔑 **Secrets Detection** — 21 vendor signatures + Shannon-entropy pass
- 📦 **Dependency CVEs** — manifest parsing + live [OSV.dev](https://osv.dev) lookups
- 📋 **SBOM** — CycloneDX 1.5 and SPDX 2.3 generation
- 🧾 **Exports** — PDF, HTML, JSON, and SARIF 2.1.0 (GitHub Code Scanning compatible)
- ✨ **AI Fixes** — model-generated remediation via the shared Gemini/Groq layer

## Quick Start

### Easiest way (Windows) — one click

Double-click **`START-TESTIFY.bat`**.

It checks for Python, Node.js and Git (installing any that are missing via
`winget`), creates an isolated Python environment, installs every dependency,
downloads the Chromium browser, picks free ports, starts both servers and opens
your browser.

The first run takes a few minutes; after that it starts in seconds. If a
prerequisite had to be installed, close the window and double-click again so
Windows picks up the new PATH.

To stop TestiFy, close the two server windows it opened.
To force a clean reinstall, delete `.setup_complete` and `backend\venv`.

### Manual setup

#### 1. Backend Setup

```bash
cd backend

# Copy and fill in your Gemini API key
cp .env.example .env
# Edit .env and set GEMINI_API_KEY=your_key_here

# Install Python dependencies
pip install -r requirements.txt

# Install Playwright browser
playwright install chromium

# Start the backend
uvicorn main:app --reload --port 8000
```

> **Port 8000 already in use?** Some machines run Apache/XAMPP there. Start the
> backend on another port and tell the frontend where to find it:
>
> ```bash
> # terminal 1
> uvicorn main:app --reload --port 8010
> # terminal 2 (frontend)
> BACKEND_PORT=8010 npm run dev        # PowerShell: $env:BACKEND_PORT=8010; npm run dev
> ```

#### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** in your browser.

## Project Structure

```
TestiFy/
├── frontend/              # React + Vite + Tailwind
│   └── src/
│       ├── components/    # Header, TestForm, ProgressPanel, etc.
│       ├── pages/         # HomePage, ReportPage, HistoryPage
│       ├── services/      # API + WebSocket client
│       ├── hooks/         # useTestSession
│       └── security/      # TestiFy Security add-on (lazy-loaded at /security/*)
│
├── backend/               # FastAPI + Python
│   ├── main.py            # Entry point
│   ├── agent/             # Orchestrator + Analyzer
│   ├── browser/           # Playwright crawler
│   ├── ai/                # llm.py (Gemini + Groq failover), gemini_client.py
│   ├── database/          # SQLAlchemy models + SQLite
│   ├── reports/           # HTML/JSON generator
│   ├── routers/           # REST API endpoints
│   └── security/          # TestiFy Security add-on (own router + own SQLite)
│
└── README.md
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/sessions` | Start a new test session |
| `GET`  | `/api/sessions` | List all sessions |
| `GET`  | `/api/sessions/{id}` | Get session with issues |
| `WS`   | `/api/sessions/ws/{id}` | Live progress stream |
| `GET`  | `/api/reports/{id}/html` | Download HTML report |
| `GET`  | `/api/reports/{id}/json` | Download JSON report |
| `GET`  | `/api/health` | Backend health check |

### Security add-on

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/security/scan/upload` | Scan an uploaded project ZIP |
| `POST` | `/api/security/scan/git` | Scan a public Git repository URL |
| `GET`  | `/api/security/scans` | List all scans |
| `GET`  | `/api/security/scan/{id}` | Get one scan's full results |
| `WS`   | `/api/security/ws/scan/{id}` | Live scan progress stream |
| `GET`  | `/api/security/scan/{id}/report/{fmt}` | Export `json`\|`sarif`\|`html`\|`cyclonedx`\|`spdx`\|`pdf` |
| `POST` | `/api/security/ai/fix` | AI-generated fix for a finding |
| `GET`  | `/api/security/owasp-top10` | OWASP Top 10 reference list |
| `GET`  | `/api/security/health` | Security module health + rule count |

## Environment Variables

See `backend/.env.example` for all available options.

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | **Required.** Your Google Gemini API key |
| `GEMINI_MODEL` | Model to use (default: `gemini-3.6-flash`) |
| `GROQ_API_KEY` | Optional. Enables automatic fallback when Gemini is rate-limited |
| `GROQ_MODEL` | Fallback model (default: `openai/gpt-oss-120b`) |
| `MAX_CRAWL_PAGES` | Max pages per session (default: 10) |
| `DATABASE_URL` | SQLite path (default: `sqlite+aiosqlite:///./testify.db`) |

### AI provider failover

Both the test analyzer and the security add-on call through
`backend/ai/llm.py`. Gemini is primary; if a call fails with a rate limit,
quota exhaustion, or a transient 5xx, the same prompt is retried against Groq
automatically. Non-retryable errors (bad key, malformed request) surface
immediately instead of burning the fallback.
