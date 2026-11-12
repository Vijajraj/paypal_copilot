# PayPal AI Dispute Copilot — Backend Technical Documentation

**Service:** FastAPI Backend, Autonomous Copilot Agent, Search & Persistence Engine  
**Framework:** FastAPI 0.115+ / Python 3.11+ / Uvicorn  
**AI Engine:** Groq Cloud (`openai/gpt-oss-120b`)  
**Search Precedent Engine:** Elastic Cloud (Primary & Fallback Multi-Cluster)  
**Security Standard:** Strict Human-in-the-Loop Guardrail + SHA-256 Cryptographic Audit Ledger  

---

## Table of Contents
1. [Architecture & System Flow](#1-architecture--system-flow)
2. [Configuration & Credential Management](#2-configuration--credential-management)
3. [High Availability & Failover System](#3-high-availability--failover-system)
4. [API Optimization & Connection Pooling](#4-api-optimization--connection-pooling)
5. [Complete REST API Specification](#5-complete-rest-api-specification)
   - [System Health & Diagnostics](#system-health--diagnostics)
   - [Dispute Queue & Lifecycle](#dispute-queue--lifecycle)
   - [Human-in-the-Loop & Approval Gate](#human-in-the-loop--approval-gate)
   - [Evidence Studio & AI Redrafting](#evidence-studio--ai-redrafting)
   - [Audit Ledger & Compliance](#audit-ledger--compliance)
   - [Extensions & Integrations](#extensions--integrations)
6. [Data Models & Normalized Contract](#6-data-models--normalized-contract)
7. [Cryptographic Audit Ledger Mechanics](#7-cryptographic-audit-ledger-mechanics)
8. [Automated Test Suite (39 Tests)](#8-automated-test-suite-39-tests)
9. [Running Locally & Production Deployment](#9-running-locally--production-deployment)

---

## 1. Architecture & System Flow

```
┌─────────────────────────────────────────────────────────────┐
│                   PayPal Sandbox REST API                   │
│   (Webhooks, Dispute Lifecycle, Orders, Full Buyer Refund)  │
└──────────────────────────────┬──────────────────────────────┘
                               │
                Incoming Event │ Polling Sync (/sync)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Dispute Normalization Engine                │
│    Transforms raw PayPal JSON into strict DisputeContract   │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                   DisputeCopilotAgent                       │
│ 1. Queries Elastic Cloud for similar historical disputes    │
│ 2. Extracts Carrier Delivery Proof via KERNEL Engine        │
│ 3. Calculates empirical win probability (0 - 100%)          │
│ 4. Prompts Groq 120B with factual anti-hallucination rules  │
│ 5. Drafts policy-backed evidence response                   │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│             Human-in-the-Loop Security Gate                 │
│  approval_state = 'pending' | AI submission strictly locked │
└──────────────────────────────┬──────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
┌───────────────────────────────┐   ┌───────────────────────────────┐
│   Merchant Approves Evidence  │   │   Merchant Concedes Claim     │
│   POST /disputes/{id}/approve │   │   POST /disputes/{id}/reject  │
│   Requires: APPROVAL_SECRET   │   │   Issues Full Buyer Refund    │
└───────────────┬───────────────┘   └───────────────┬───────────────┘
                │                                   │
                ▼                                   ▼
┌───────────────────────────────┐   ┌───────────────────────────────┐
│ Submit Evidence to PayPal API │   │  Concede Dispute in PayPal    │
│ POST /v1/.../provide-evidence │   │  POST /v1/.../accept-claim    │
└───────────────┬───────────────┘   └───────────────┬───────────────┘
                │                                   │
                └──────────────────┬────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────┐
│          Immutable Cryptographic SHA-256 Ledger             │
│   Hash chaining: SHA256(prev_hash + actor + action + data)  │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Configuration & Credential Management

All private credentials are kept strictly isolated in `backend/app/secrets.py`. This file is **gitignored** to prevent public repository exposure. A committed template is available at `backend/app/secrets.example.py`.

### Required & Fallback Credential Keys:

| Credential | Role | Description |
|---|---|---|
| `PAYPAL_CLIENT_ID` | Primary | PayPal Sandbox Developer App Client ID |
| `PAYPAL_CLIENT_SECRET` | Primary | PayPal Sandbox Developer App Secret |
| `PAYPAL_WEBHOOK_ID` | Primary | Webhook listener ID registered in PayPal Sandbox |
| `AI_API_KEY` | Primary | Groq Cloud API Key (`openai/gpt-oss-120b`) |
| `APPROVAL_SECRET` | Guardrail | High-entropy secret token required to authorize evidence submission |
| `ELASTIC_URL` | Primary | Primary Elastic Cloud cluster endpoint (e.g., `https://...elastic.cloud:443`) |
| `ELASTIC_API_KEY` | Primary | Base64-encoded API key for Primary Elastic cluster |
| `FALLBACK_ELASTIC_URL` | Fallback | Secondary Elastic Cloud cluster endpoint |
| `FALLBACK_ELASTIC_API_KEY` | Fallback | Base64-encoded API key for Secondary Elastic cluster |
| `KERNEL_API_KEY` | Primary | KERNEL Carrier Tracking & GPS proof validation key |
| `FALLBACK_KERNEL_API_KEY` | Fallback | Secondary KERNEL verification key |

---

## 3. High Availability & Failover System

The backend features an automatic 3-tier precedence failover system (`backend/app/search.py`):

1. **Tier 1 (Primary Elastic Cloud):** Searches the primary Elasticsearch cluster over 30 indexed dispute precedents using BM25 relevance scoring.
2. **Tier 2 (Fallback Elastic Cloud):** If the primary cluster returns `401`, `403`, `404`, `429`, or encounters a connection timeout, the engine automatically fails over to `FALLBACK_ELASTIC_URL` and `FALLBACK_ELASTIC_API_KEY`.
   - *Zero-Penalty Sticky Failover:* Once failover succeeds, subsequent requests query the fallback cluster directly, avoiding repeated latency penalties.
3. **Tier 3 (In-Code Seed Database):** If both remote clusters are unreachable or network access is disabled, the engine falls back to the in-memory/JSON seed database (`backend/seed/past_disputes.json`), providing continuous operation.

---

## 4. API Optimization & Connection Pooling

1. **Persistent Connection Pooling:**
   - Both `DisputeSearchService` and `PayPalClient` utilize pooled `httpx.Client` instances configured with `httpx.Limits(max_keepalive_connections=10, max_connections=20)` and bounded connect/read timeouts.
   - Eliminates redundant TCP and TLS handshakes on every query.
2. **In-Memory LRU Query Caching:**
   - Caches precedent query results by `(reason, item_name, carrier, top_k)` with an upper bound of 500 entries.
   - Repeated lookups or redrafting actions execute in **under 1 millisecond**.
3. **Warning-Free Model Serialization (`to_dict`):**
   - Utilizes Pydantic v2 `.model_dump()`, completely eliminating deprecated `.dict()` warnings across all serialization paths.

---

## 5. Complete REST API Specification

### Authentication & Role-Based Access Control (RBAC)

FastAPI endpoints protected by RFC 7519 JSON Web Tokens (JWT) using `HS256` signing and PBKDF2-HMAC-SHA256 password hashing.

| Role | Permissions |
| :--- | :--- |
| **`admin`** | Full read/write access, dispute approvals, simulation, audit logs, and user management. |
| **`analyst`** | Review disputes, edit evidence, generate Groq AI redrafts, and submit approved evidence to PayPal. |
| **`viewer`** | Read-only access. Can inspect disputes, timelines, and AI drafts, but cannot trigger approvals or simulations. |

#### `POST /api/auth/register`
Creates a new merchant or analyst user profile and generates an immediate 24-hour JWT Bearer token.
- **Request Body:**
  ```json
  {
    "email": "analyst@yourcompany.com",
    "password": "SecurePassword123!",
    "full_name": "Jordan Miller",
    "role": "analyst"
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "bearer",
    "user": {
      "id": "usr_78a1f893bc42",
      "email": "analyst@yourcompany.com",
      "full_name": "Jordan Miller",
      "role": "analyst",
      "created_at": "2026-11-12T23:30:00Z"
    }
  }
  ```

#### `POST /api/auth/login`
Authenticates user credentials and returns a signed access token.
- **Request Body:**
  ```json
  {
    "email": "admin@paypalcopilot.com",
    "password": "Admin123!"
  }
  ```
- **Response `200 OK`:** Returns access token and user metadata.

#### `GET /api/auth/me`
Fetches the currently authenticated profile from the provided `Authorization: Bearer <token>` header.
- **Response `200 OK`:** `{ "success": true, "user": { ... } }`

#### `GET /api/auth/demo-users`
Returns metadata and pre-configured credentials for quick 1-click evaluation accounts (`admin`, `analyst`, and `viewer`).

#### `POST /api/auth/logout`
Acknowledge user session termination.

---

### System Health & Diagnostics

#### `GET /health`
Returns the basic service liveness status.
- **Response `200 OK`:**
  ```json
  {
    "status": "ok",
    "timestamp": "2026-11-12T17:00:00.000000+00:00"
  }
  ```

#### `GET /health/integrations`
Returns diagnostic health across all integrated providers (Elasticsearch clusters, Kernel engine, PayPal Sandbox).
- **Response `200 OK`:**
  ```json
  {
    "status": "ok",
    "timestamp": "2026-11-12T17:00:00.000000+00:00",
    "elastic": {
      "use_elastic": true,
      "primary_configured": true,
      "fallback_configured": true,
      "active_mode": "primary_elastic",
      "cached_queries_count": 5
    },
    "kernel": {
      "active_key_suffix": "...lZPGFY",
      "fallback_configured": true
    },
    "paypal_sandbox": {
      "token_cached": true,
      "demo_mode": false
    }
  }
  ```

---

### Dispute Queue & Lifecycle

#### `GET /disputes`
Retrieves disputes with optional status filtering.
- **Query Parameters:**
  - `status` (optional): Filter by PayPal dispute status (e.g., `WAITING_FOR_SELLER_RESPONSE`, `UNDER_REVIEW`, `RESOLVED`).
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "count": 13,
    "disputes": [ ... ]
  }
  ```

#### `GET /disputes/{dispute_id}`
Retrieves full normalized contract for a specific dispute.
- **Path Parameter:** `dispute_id` (string, e.g., `PP-D-12345`)
- **Response `200 OK`:** Returns full `DisputeContract` object.
- **Response `404 Not Found`:** Returned if dispute does not exist.

#### `POST /sync`
Forces a sync with PayPal Sandbox Disputes API (`GET /v1/customer/disputes`), normalizes incoming cases, runs the Copilot Agent on new cases, and updates local state.
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "count": 13,
    "disputes": [ ... ]
  }
  ```

#### `GET /timeline`
Returns all disputes sorted chronologically by seller response due date (`respond_by`).
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "count": 13,
    "timeline": [
      {
        "dispute_id": "PP-D-12345",
        "respond_by": "2026-11-15T10:00:00Z",
        "status": "WAITING_FOR_SELLER_RESPONSE",
        "amount": { "value": "89.50", "currency": "USD" },
        "reason": "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
        "win_score": 98,
        "approval_state": "pending"
      }
    ]
  }
  ```

---

### Human-in-the-Loop & Approval Gate

#### `POST /disputes/{dispute_id}/approve`
**The Core Security Gate:** Authorized merchant representative submits the evidence draft to PayPal.
- **Headers:** `X-Approval-Secret: <APPROVAL_SECRET>` (or provided in JSON payload)
- **Request Body:**
  ```json
  {
    "approver_id": "Authorized Merchant Director",
    "secret": "ccf085057cf069712cebc1e32b3d13a165fb63fe57282150dbb6285350bd65b9"
  }
  ```
- **Security Guardrail Checks:**
  1. Validates `secret` against `APPROVAL_SECRET`. Returns `403 Forbidden` if mismatch.
  2. Inspects `approver_id` against automated agent keywords (`ai`, `bot`, `agent`, `autonomous`). Rejects non-human approvers with `400 Bad Request`.
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "dispute": { "approval_state": "submitted", ... },
    "audit": {
      "entryId": "AUDIT-0004",
      "action": "DISPUTE_EVIDENCE_SUBMITTED",
      "actor": { "type": "HUMAN_APPROVER", "id": "Authorized Merchant Director" },
      "hash": "a4f8c92b..."
    },
    "paypal_response": { "submitted": true, "status_code": 200 }
  }
  ```

#### `POST /disputes/{dispute_id}/reject`
Concedes claim and issues full buyer refund via PayPal Disputes API (`POST /v1/customer/disputes/{id}/accept-claim`).
- **Request Body:**
  ```json
  {
    "approver_id": "Authorized Merchant Director",
    "reason": "Merchant confirmed package lost in transit and issued full concession"
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "dispute": {
      "approval_state": "rejected",
      "status": "RESOLVED",
      "seller_approval": { "conceded": true, "reason": "..." }
    },
    "audit": {
      "entryId": "AUDIT-0005",
      "action": "CLAIM_CONCEDED_FULL_REFUND",
      "hash": "b7e21a..."
    },
    "paypal_response": { "conceded": true, "status_code": 200 }
  }
  ```

---

### Evidence Studio & AI Redrafting

#### `PATCH /disputes/{dispute_id}/evidence`
Saves manual merchant modifications to the evidence defense statement.
- **Request Body:**
  ```json
  {
    "evidence_text": "Updated evidence statement with signature verification...",
    "approver_id": "Merchant Admin"
  }
  ```
- **Response `200 OK`:** Returns updated dispute object.

#### `POST /disputes/{dispute_id}/redraft`
Reruns the AI Copilot Agent with optional merchant notes to generate a fresh defense statement.
- **Request Body:**
  ```json
  {
    "merchant_notes": "Buyer confirmed receipt via support chat on Nov 3rd."
  }
  ```
- **Response `200 OK`:** Returns regenerated dispute object and new win evaluation.

---

### Audit Ledger & Compliance

#### `GET /audit`
Returns the immutable, chained audit ledger and integrity report.
- **Query Parameters:** `dispute_id` (optional): Filter entries for a specific case.
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "count": 4,
    "audit_trail": [
      {
        "entryId": "AUDIT-0004",
        "timestamp": "2026-11-12T17:00:00Z",
        "disputeId": "PP-D-12345",
        "actor": { "type": "HUMAN_APPROVER", "id": "Authorized Merchant Director" },
        "action": "DISPUTE_EVIDENCE_SUBMITTED",
        "details": "...",
        "previousHash": "7f8b9a...",
        "hash": "a4f8c92b..."
      }
    ],
    "ledger_integrity": {
      "valid": true,
      "total_entries": 4,
      "verified_at": "2026-11-12T17:00:01Z"
    }
  }
  ```

---

### Extensions & Integrations

#### `POST /disputes/simulate`
Simulation endpoint to trigger demo disputes (INR, UNAUTHORIZED, SNAD) for presentations and automated testing.
- **Request Body:**
  ```json
  {
    "reason": "ITEM_NOT_RECEIVED",
    "amount": "849.50",
    "item_name": "Sony Alpha a7 IV",
    "buyer_name": "Marcus Vance",
    "carrier": "UPS",
    "due_hours": 48
  }
  ```
- **Response `200 OK`:** Returns simulated and analyzed dispute contract.

#### `GET /restock/inventory` & `POST /restock/order`
Predictive packaging inventory management via Channel3 with a strict $500 autonomous guardrail cap.

#### `POST /webhooks/paypal`
Receives, verifies cryptographic signatures, and deduplicates incoming PayPal webhooks (`CUSTOMER.DISPUTE.CREATED`, `CUSTOMER.DISPUTE.UPDATED`, `CUSTOMER.DISPUTE.RESOLVED`).

---

## 6. Data Models & Normalized Contract

Every dispute processed conforms to `DisputeContract` (`backend/app/models.py`):

```json
{
  "id": "PP-D-12345",
  "status": "WAITING_FOR_SELLER_RESPONSE",
  "reason": "ITEM_NOT_RECEIVED",
  "amount": { "value": "89.50", "currency": "USD" },
  "created_at": "2026-11-02T10:00:00Z",
  "respond_by": "2026-11-09T10:00:00Z",
  "order": {
    "id": "ORD-99120",
    "items": [{ "name": "Handmade ceramic mug", "qty": 2 }],
    "shipping": {
      "carrier": "FEDEX",
      "tracking_number": "123456789012",
      "status": "DELIVERED",
      "delivery_date": "2026-11-03T14:30:00Z",
      "signed_by": "AUTHORIZED RECIPIENT",
      "has_signature": true
    }
  },
  "evidence_draft": {
    "text": "...",
    "proofs": [{ "type": "PROOF_OF_FULFILLMENT", "source": "carrier_page", "summary": "Delivered" }]
  },
  "win_score": 98,
  "win_reasons": [
    "Carrier proof of delivery confirmed via KERNEL (FEDEX)",
    "Recipient adult signature confirmed on file",
    "Destination postal code matches buyer verified address",
    "Elastic precedent (PREC-1) indicates 95% historical success"
  ],
  "carrier_proof": {
    "carrier": "FEDEX",
    "tracking_number": "123456789012",
    "status": "DELIVERED",
    "signed_by": "AUTHORIZED RECIPIENT",
    "kernel_audit_id": "KERNEL-FEDEX-20261112-lZPGFY"
  },
  "elastic_precedent": {
    "precedent_id": "PREC-1",
    "benchmark_win_rate": 0.95,
    "policy_citation": "PayPal Seller Protection Policy Section 11.3 (Proof of Delivery)"
  },
  "approval_state": "pending",
  "seller_approval": null
}
```

---

## 7. Cryptographic Audit Ledger Mechanics

Each operation records a chained block (`backend/app/services/audit_ledger.py`):

1. **Hash Generation Formula:**
   $$\text{Hash}_n = \text{SHA256}(\text{EntryID} + \text{Timestamp} + \text{DisputeID} + \text{ActorType} + \text{ActorID} + \text{Action} + \text{Details} + \text{Hash}_{n-1})$$
2. **Genesis Block:** Entry 0 uses `"GENESIS_PREVIOUS_HASH"`.
3. **Chain Verification:** Calling `verify_chain()` iterates over every block and recomputes the SHA-256 hash. If any bit in the database is modified or tampered with, `verify_chain()` detects the discrepancy and returns `valid: false` with the exact compromised block ID.

---

## 8. Automated Test Suite (49 Tests)

The backend features 49 automated tests guaranteeing full coverage across all functional components:

```bash
python -m pytest backend/tests -v -p no:asyncio
```

### Test Suite Structure:
- `backend/tests/test_auth.py`:
  - `test_password_hashing`: Validates PBKDF2-HMAC-SHA256 password hashing with random salt.
  - `test_jwt_token_lifecycle`: Validates JWT creation, payload encoding, expiration, and decoding.
  - `test_demo_users_endpoint`: Validates demo roles metadata.
  - `test_login_demo_admin`, `test_login_demo_analyst`, `test_login_demo_viewer`: Validates authentication for all 3 roles.
  - `test_login_invalid_password`: Validates 401 Unauthorized handling.
  - `test_auth_me_authenticated`: Validates Bearer token profile resolution.
  - `test_register_new_user`: Validates dynamic user creation.
  - `test_viewer_cannot_approve_dispute`: Validates 403 Forbidden role gate for read-only Viewers.
- `backend/tests/test_fallback_and_optimization.py`:
  - `test_health_integrations_endpoint`: Validates `/health/integrations` diagnostics.
  - `test_kernel_fallback_key_rotation`: Validates Kernel active key selection and fallback rotation.
  - `test_elastic_automatic_fallback_failover`: Validates automatic failover from Primary to Fallback Elastic.
  - `test_search_lru_caching`: Validates sub-millisecond LRU cache hits.
  - `test_paypal_client_connection_pool`: Validates keep-alive connection pooling.
- `backend/tests/test_concede_and_optimization.py`:
  - `test_concede_claim_and_refund_flow`: Validates full buyer refund concession via PayPal Disputes API.
  - `test_search_cache_optimization`: Tests cache performance.
- `backend/tests/test_disputes_and_agent.py`:
  - Core routing, update evidence, AI agent prompt rules, sync polling.
- `backend/tests/test_full_suite.py`:
  - 20 comprehensive end-to-end tests covering data contracts, guardrails, Channel3 spend caps, and audit tampering detection.

---

## 9. Running Locally & Production Deployment

### Local Development Server:
```bash
# From workspace root
python run_backend.py
```
- Listens on: **`http://127.0.0.1:8000`**
- Swagger UI Documentation: **`http://127.0.0.1:8000/docs`**
- Redoc Documentation: **`http://127.0.0.1:8000/redoc`**

### Production Command (Render / Cloud Run / VPS):
```bash
uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT --workers 4
```
