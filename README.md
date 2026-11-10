# PayPal AI Dispute Copilot

> **An AI dispute assistant for small PayPal sellers with strict human-in-the-loop guardrails.**  
> **Hackathon:** Build What's Next with PayPal and AI  
> **Submission Date:** 13 Nov 2026 (Aim to submit Thu 12 Nov)

An intuitive, enterprise-grade merchant dashboard inspired by PayPal's Business Resolution Center and styled with high-precision typography (**Plus Jakarta Sans**). The copilot analyzes incoming disputes, gathers carrier proof, computes empirical win probabilities, and drafts policy-backed evidence—**strictly requiring human seller approval** before any settlement action or submission to PayPal.

---

## Architecture Overview

```
┌─────────────────────────────────┐
│     PayPal Webhook / /sync      │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│  Dispute Normalization Engine   │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐      ┌───────────────────────────────┐
│    AI Dispute Copilot Agent     │◄────▶│ Elastic Cloud Search Engine   │
│  (Factual Draft + Win Estimate) │      │ (30 Synced past_disputes)     │
└────────────────┬────────────────┘      └───────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│   Human-in-the-Loop Gate        │
│   (Code-enforced approval state)│
└────────────────┬────────────────┘
                 │
       [Human Seller Signs Off]
                 │
                 ▼
┌─────────────────────────────────┐      ┌───────────────────────────────┐
│   Submit Evidence to PayPal     │─────▶│ Chained SHA-256 Audit Ledger  │
│   POST /v1/.../provide-evidence │      │ (Cryptographic Proof of Sign) │
└─────────────────────────────────┘      └───────────────────────────────┘
```

---

## Key Features

- **AG Grid Dispute Queue**: High-performance table with real-time dispute status badges, win-rate progress indicators, multi-field filtering, and sorting.
- **Response Deadline Radar**: Timeline view highlighting critical upcoming deadlines so time-sensitive disputes (< 24 hours) are resolved first.
- **AI Evidence Studio**: Gathers carrier tracking proofs via KERNEL, searches precedent cases on Elastic Cloud, computes estimated win chances, and generates formal legal defense statements.
- **Groq AI Live Re-Drafting**: 1-click evidence regeneration powered by Groq (`openai/gpt-oss-120b`) taking merchant-specific notes into account.
- **Human-in-the-Loop Guardrail**: Protects merchant funds with mandatory human authorization (`approval_state = 'pending'`). AI is strictly blocked in code from autonomously submitting disputes.
- **Cryptographic Audit Ledger**: Records each AI draft, merchant revision, and human authorization in an immutable, chained SHA-256 audit ledger.
- **Channel3 Supply Restock**: Predictive inventory replenishment for packaging materials to prevent fulfillment delay disputes, backed by an autonomous spending cap ($500).
- **Dispute Simulator**: Built-in test harness to instantly simulate incoming PayPal dispute webhook scenarios for live demos.

---

## Shared Data Contract (Person A & Person B)

```json
{
  "id": "PP-D-12345",
  "status": "PENDING_REVIEW",
  "reason": "ITEM_NOT_RECEIVED",
  "amount": { "value": "89.50", "currency": "USD" },
  "created_at": "2026-11-02T10:00:00Z",
  "respond_by": "2026-11-09T10:00:00Z",
  "order": {
    "id": "5O190127TN364715T",
    "items": [{ "name": "Handmade ceramic mug", "qty": 2 }],
    "shipping": { "carrier": "FEDEX", "tracking_number": "123456789012", "address_summary": "Chennai, IN" }
  },
  "evidence_draft": {
    "text": "...",
    "proofs": [{ "type": "PROOF_OF_FULFILLMENT", "source": "carrier_page", "summary": "Delivered 2026-10-30" }]
  },
  "win_score": 78,
  "win_reasons": ["Tracking shows delivery", "Similar cases won with delivery proof"],
  "approval_state": "pending"
}
```

*Valid `approval_state` values:* `pending`, `approved`, `rejected`, `submitted`.

---

## Quick Start

### 1. Clone & Setup
```bash
git clone https://github.com/Vijajraj/paypal_copilot.git
cd paypal_copilot
```

### 2. Configure Secrets (Backend)
All secrets live in one file: `backend/app/secrets.py` (which is **gitignored**).
```bash
cp backend/app/secrets.example.py backend/app/secrets.py
```
Fill in your credentials in `backend/app/secrets.py`:
- `PAYPAL_CLIENT_ID` & `PAYPAL_CLIENT_SECRET`
- `AI_API_KEY` (Groq API Key)
- `ELASTIC_URL` & `ELASTIC_API_KEY`
- `KERNEL_API_KEY`
- `APPROVAL_SECRET` (Internal security token for the human approval gate)

### 3. Install & Start Backend
```bash
python -m pip install -r backend/requirements.txt
python run_backend.py
```
The FastAPI backend starts at **[http://127.0.0.1:8000](http://127.0.0.1:8000)** (docs at `/docs`).

### 4. Install & Start Frontend
In a new terminal:
```bash
cd frontend
npm install
npm run dev
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser.

---

## Testing & Verification

Run the automated test suite verifying Person A endpoints, guardrail gates, search, and agent logic:
```bash
python -m pytest backend/tests -v -p no:asyncio
```
**Test Results:** 12/12 passing unit tests.

---

## REST API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/disputes` | List disputes with optional `?status=` filter |
| `GET` | `/disputes/{id}` | Full dispute detail conforming to shared contract |
| `PATCH` | `/disputes/{id}/evidence` | Save seller edits to evidence draft |
| `POST` | `/disputes/{id}/redraft` | Re-run Groq AI agent with merchant notes |
| `POST` | `/disputes/{id}/approve` | **Approval Gate**: Human signs off, submits to PayPal |
| `POST` | `/disputes/{id}/reject` | Reject draft / concede claim |
| `POST` | `/sync` | Force pull/refresh from PayPal Sandbox |
| `GET` | `/timeline` | Dispute response deadlines sorted chronologically |
| `GET` | `/audit` | SHA-256 chained audit ledger and integrity report |
| `POST` | `/webhooks/paypal` | PayPal webhook receiver (signature verification + deduplication) |
| `POST` | `/disputes/simulate` | Demo test harness to simulate incoming PayPal dispute |

---

## Sponsor Tools Used

- **PayPal Sandbox REST API**: Dispute resolution API (`/v1/customer/disputes`), webhook verification (`/v1/notifications/verify-webhook-signature`), and OAuth2 client credentials authentication.
- **Elastic Cloud**: Real-time legal precedent search over 30 synthetic dispute datasets indexed into `past_disputes` (`USE_ELASTIC = True`), with in-code fallback.
- **Groq AI Engine**: Fast inference using `openai/gpt-oss-120b` for agentic evidence drafting using few-shot prompt guardrails that strictly prohibit hallucinating tracking or documents.
- **KERNEL**: Carrier tracking proof and GPS destination verification engine across UPS, FedEx, USPS, and DHL.
- **AG Grid Community**: High-performance merchant data grid with sorting, filtering, and custom cell renderers.

---

## Repository Layout

```
├── backend/
│   ├── app/
│   │   ├── main.py              # REST API endpoints & CORS
│   │   ├── config.py            # Hardcoded settings (no secrets)
│   │   ├── secrets.example.py   # Committed secrets template
│   │   ├── secrets.py           # GITIGNORED local secrets
│   │   ├── models.py            # Pydantic dispute data contract
│   │   ├── agent.py             # AI Dispute Copilot Agent (Groq 120B)
│   │   ├── search.py            # Precedent search (Elastic Cloud & in-code)
│   │   ├── paypal_client.py     # PayPal Sandbox client
│   │   ├── sync.py              # Polling sync fallback
│   │   ├── webhooks.py          # PayPal webhook receiver
│   │   ├── database.py          # Seeded storage
│   │   └── services/            # Guardrails, audit ledger, carrier verification
│   ├── seed/
│   │   └── past_disputes.json   # 30 synthetic dispute precedent fixtures
│   ├── tests/
│   │   └── test_disputes_and_agent.py
│   └── requirements.txt
├── frontend/                    # React 18 + Vite + AG Grid UI
│   ├── apiClient.js             # Connects to backend with mock fallback
│   └── vite.config.js           # API proxy configuration
├── run_backend.py               # Backend startup entrypoint
├── LICENSE
└── README.md
```

---

## License

This project is licensed under the [MIT License](LICENSE).
