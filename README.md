# Swifora DMA Platform

A full-stack **Double Materiality Assessment (DMA)** platform for GRI-aligned ESG reporting.
Built for Sowin Enterprises — enables companies to run stakeholder surveys, score ESG topics,
and generate materiality matrices and reports in a single workflow.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript strict) |
| Styling | Tailwind CSS v4 |
| Auth | Firebase Authentication v12 |
| Database | Cloud Firestore (Firebase Admin SDK v13) |
| Storage | Firebase Storage |
| State | Zustand v5 |
| Forms | React Hook Form v7 + Zod v4 |
| Email | Brevo (Sendinblue) transactional API |
| Charts | D3.js v7 |
| Reports | jsPDF + jspdf-autotable, ExcelJS |

---

## Key Features

- **GRI Topic Bank** — 40 pre-loaded ESG topics across Environmental, Social, and Governance pillars
- **Assessment Wizard** — 5-step flow: topic selection → stakeholder management → topic assignment → launch → results
- **Stakeholder Surveys** — Secure one-time survey links, email delivery via Brevo, reminder scheduling
- **Weighted Scoring** — Configurable stakeholder type weightages, impact + financial materiality scoring
- **Materiality Matrix** — Interactive D3 2×2 scatter plot with adjustable thresholds
- **PDF Reports** — 6-page branded jsPDF report uploaded to Firebase Storage
- **Excel Export** — 4-sheet ExcelJS workbook (scores, breakdown, raw responses, company profile)
- **Super Admin Panel** — Manage companies, field agents, and GRI topic bank
- **Role-based Access** — `company_admin`, `field_agent`, `super_admin` with Firestore security rules

---

## Local Development

### 1. Clone and install

```bash
git clone https://github.com/your-org/dma-platform.git
cd dma-platform
npm install
```

### 2. Configure environment variables

```bash
cp .env.production.example .env.local
```

Fill in `.env.local` with your Firebase project credentials and Brevo API key.
See `.env.production.example` for all required variables.

### 3. Seed GRI topics

```bash
npm run seed:topics
```

This writes 40 GRI topics to `/gri_topics` in Firestore. Run once per
Firebase project (dev and production separately).

### 4. Create Super Admin (first time)

```bash
npm run seed:admin
```

Reads `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` from `.env.local`.

### 5. Start development server

```bash
npm run dev
```

Open http://localhost:3000.

---

## Folder Structure

```
dma-platform/
├── app/
│   ├── (auth)/              # Login, register, forgot-password
│   ├── (onboarding)/        # Company setup wizard
│   ├── (dashboard)/         # Company admin dashboard + assessment wizard
│   ├── (admin)/             # Super admin panel
│   ├── (agent)/             # Field agent panel (stub)
│   ├── api/                 # Next.js API routes (auth, survey, reports, admin)
│   ├── survey/              # Public stakeholder survey page
│   ├── page.tsx             # Landing page
│   └── not-found.tsx        # 404 page
├── components/
│   ├── charts/              # D3 MaterialityMatrix
│   ├── forms/               # Shared form components
│   ├── layout/              # Navbar, Sidebar, PageShell
│   ├── providers/           # AuthProvider
│   └── ui/                  # shadcn/ui + LoadingSkeleton
├── data/                    # GRI topic seed JSON, industry types
├── hooks/                   # useAuth
├── lib/
│   ├── brevo/               # Email client + template helpers
│   └── firebase/            # Client config, Admin SDK, Firestore helpers
├── scripts/                 # seedGRITopics.ts, seedSuperAdmin.ts
├── store/                   # Zustand stores (auth, companyRegistration)
├── types/                   # Shared TypeScript interfaces and enums
├── firestore.rules          # Firestore security rules
├── storage.rules            # Firebase Storage rules
├── vercel.json              # Vercel deployment config
└── firebase.json            # Firebase CLI config (rules deploy + hosting)
```

---

## npm Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run seed:topics` | Seed 40 GRI topics to Firestore |
| `npm run seed:admin` | Create Super Admin user in Firebase Auth + Firestore |

---

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for full deployment instructions.

**Quick start (Vercel):**
1. Push to GitHub
2. Import to Vercel, add env vars
3. Deploy

---

## Security Notes

- All Firestore writes from clients are validated by `firestore.rules`
- Survey responses and scores can only be written by server-side API routes (Admin SDK)
- Session cookies (`__session`, `__claims`) are `HttpOnly; Secure; SameSite=Strict`
- API routes re-verify the `__claims` cookie on every request
- Never commit `.env.local` — it is in `.gitignore`
