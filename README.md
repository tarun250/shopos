# ShopOS

A production-ready ERP and billing platform built for hardware, electrical, and automobile spare parts businesses. ShopOS combines a full-featured POS, inventory management, GST-compliant reporting, supplier/customer ledgers, and an AI assistant — all in a single offline-capable application.

---

## Screenshots

> POS Billing · Inventory · Reports · AI Assistant

---

## Features

### 🧾 POS & Billing
- Fast barcode / SKU search with hardware scanner support
- Multi-payment split (Cash + UPI + Card + Credit) in a single bill
- Hold & resume bills, credit sales, quotations
- Offline billing — bills queued on-device and auto-synced when back online
- Idempotent `clientRef` prevents duplicate bills after reconnection
- Printable A4 GST invoice and 80 mm thermal receipt with UPI QR
- WhatsApp bill sharing from checkout and order history

### 📦 Inventory & Products
- Multi-warehouse stock levels with weighted-average cost price
- Product categories, variants, aliases, and barcode labels (A4 / thermal)
- Camera barcode scanner built into the browser
- Stock adjustment, reconciliation, and full inventory history
- Reorder suggestions with configurable minimum stock levels
- Product relationships: compatible, alternative, accessory, upsell

### 🛒 Purchases
- Purchase orders with partial receiving
- Supplier invoice photo → AI-parsed structured purchase (Gemini OCR)
- Weighted-average cost updated on every receipt
- Supplier ledger with payment tracking

### 👥 Customers & Suppliers
- Customer ledger with running balance, credit limit, and price levels (Retail / Wholesale / Contractor / Distributor)
- Supplier ledger with payable tracking
- GST-compliant GSTIN fields on both

### 💰 Expenses & Cash Drawer
- Day session: opening cash → closing reconciliation
- Expense categories (Electricity, Fuel, Salary, Rent, Custom…)
- Cash drawer transaction log per session

### 📊 Reports & GST
- Sales dashboard: revenue, profit, top products, trend chart
- GST working: B2B / B2C, rate-wise, HSN summary, ITC
- Day-close report with cash difference alert
- Export-ready data for GSTR-1 / GSTR-3B filing

### ✅ Approvals & RBAC
- Four roles: **Owner · Manager · Cashier · Inventory Clerk**
- Approval engine for below-cost sales, large discounts, and returns
- Manager PIN override for guarded actions
- Session revocation from the owner dashboard

### 🤖 AI Assistant
- Floating panel (keyboard shortcut `Ctrl + K`)
- Natural language search: *"Show bearings below minimum stock"*, *"Customers who owe more than ₹5000"*
- Guarded business actions with confirm-before-execute: create customer, create purchase order, adjust stock
- Supplier invoice photo upload → structured purchase proposal
- Morning brief with day summary
- Voice input (English / Hindi)
- Provider-agnostic: **OpenRouter → Groq → Gemini** failover chain
- Full conversation history, feedback (👍 / 👎), and AI quality dashboard

### ⚙️ Settings & Dev Console
- API keys and AI provider settings editable from the UI
- System audit logs
- Knowledge base management (RAG)
- AI evaluation suite (13 test cases) with pass/fail dashboard

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, React 19, Tailwind CSS 4, Framer Motion |
| Backend | NestJS 10, Prisma ORM |
| Database | SQLite (file-based, zero-config) |
| Auth | JWT + Refresh tokens, bcrypt |
| Offline | Dexie (IndexedDB), service worker sync |
| AI | OpenRouter / Groq / Gemini (provider-agnostic) |
| Scanning | ZXing (camera barcode), jsBarcode (label print) |
| Testing | Jest, 46 API integration tests |
| Monorepo | npm workspaces |

---

## Project Structure

```
shopos/
├── apps/
│   ├── api/          # NestJS REST API
│   │   └── src/
│   │       ├── agent/        # AI agent tools & conversations
│   │       ├── ai/           # Provider factory, cost logging
│   │       ├── auth/         # JWT, RBAC guards
│   │       ├── billing/      # Bills, payments, returns
│   │       ├── expenses/     # Expense management
│   │       ├── products/     # Catalogue, inventory, stock
│   │       ├── purchases/    # POs, receiving, supplier ledger
│   │       ├── reports/      # Sales, GST, reorder reports
│   │       ├── session/      # Day open/close, cash drawer
│   │       ├── settings/     # Shop profile, system settings
│   │       └── users/        # Staff management
│   └── web/          # Next.js frontend (single-page app)
│       └── src/app/
│           ├── components/   # Tabs, modals, drawers
│           └── page.tsx      # App shell
└── packages/
    ├── common/       # Shared types & utilities
    └── db/           # Prisma schema & migrations
```

---

## Getting Started

### Prerequisites
- Node.js 20+
- npm 10+

### Install

```bash
git clone https://github.com/tarun250/shopos.git
cd shopos
npm install
```

### Environment — API (`apps/api/.env`)

```env
JWT_SECRET=your_jwt_secret
REFRESH_TOKEN_SECRET=your_refresh_secret

# AI providers (at least one required for the assistant)
OPENROUTER_API_KEY=sk-or-...
GROQ_API_KEY=gsk_...
GEMINI_API_KEY=AIza...
```

### Database setup

```bash
cd packages/db
npx prisma migrate deploy
node seed.js          # creates default owner account and seed data
```

### Run (development)

```bash
# From repo root — starts API (port 3001) and web (port 3000) together
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000)

Default owner login: **username** `owner` · **password** `owner123`

### Build (production)

```bash
npm run build
npm run start
```

---

## AI Assistant Setup

The assistant works with any combination of:

| Provider | Used for | Key env var |
|---|---|---|
| OpenRouter | Reasoning, complex queries | `OPENROUTER_API_KEY` |
| Groq | Fast autocomplete | `GROQ_API_KEY` |
| Gemini | OCR, invoice photos | `GEMINI_API_KEY` |

Keys can also be set at runtime from **Dev Console → AI Provider Keys & Settings** in the app — no restart needed.

The assistant falls back automatically if a provider is unavailable and never crashes the UI.

---

## Running Tests

```bash
npm run test --workspace=@shopos/api
```

46 integration tests covering billing, purchases, agent tools, and RBAC — each test runs against a throwaway SQLite database built from migrations.

---

## License

MIT
