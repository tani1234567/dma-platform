# Swifora DMA Platform — Build Progress

**Last updated:** 2026-04-12
**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind v4 · Firebase v12 · Zustand v5 · React Hook Form v7 + Zod v4

---

## Status Legend
- ✅ Built & working
- 🟡 Built, stub / not fully wired
- ❌ Not yet built

---

## Pages

| Route | File | Status | Notes |
|---|---|---|---|
| `/` | `app/page.tsx` | 🟡 | Default Next.js landing — not customised |
| `/login` | `app/(auth)/login/page.tsx` | ✅ | Firebase error mapping, session cookie, already-logged-in redirect |
| `/register` | `app/(auth)/register/page.tsx` | ✅ | Email + password, sets session cookie on success |
| `/register/profile` | `app/(auth)/register/profile/page.tsx` | ✅ | displayName, jobTitle, phone → redirects to `/company-setup` |
| `/forgot-password` | `app/(auth)/forgot-password/page.tsx` | ✅ | sendPasswordResetEmail, success state |
| `/company-setup` | `app/(onboarding)/company-setup/page.tsx` | ✅ | 3-step wizard: basic info → resources → employees → `/dashboard` |
| `/dashboard` | `app/(dashboard)/dashboard/page.tsx` | ✅ | Welcome banner, assessment cards, empty state with CTA, loading skeletons, error state |
| `/admin` | `app/(admin)/admin/page.tsx` | ✅ | Stats cards + activity feed, loading skeletons |
| `/admin/companies` | `app/(admin)/companies/page.tsx` | ✅ | Search/filter/paginate company list |
| `/admin/companies/[companyId]` | `app/(admin)/companies/[companyId]/page.tsx` | ✅ | 3-tab: Profile, Assessments, Users; suspend/reactivate |
| `/admin/agents` | `app/(admin)/agents/page.tsx` | ✅ | List + create modal + revoke/restore |
| `/admin/topics` | `app/(admin)/topics/page.tsx` | ✅ | Toggle active + inline edit GRI ref/description |
| `/agent` | `app/(agent)/agent/page.tsx` | 🟡 | Stub page |
| `/dashboard/assessment/[fyId]/topics` | `app/(dashboard)/dashboard/assessment/[fyId]/topics/page.tsx` | ✅ | GRI topic selection (E/S/G pillars) |
| `/dashboard/assessment/[fyId]/stakeholders` | `app/(dashboard)/dashboard/assessment/[fyId]/stakeholders/page.tsx` | ✅ | Add/edit/delete stakeholders, CSV import, weightage config |
| `/dashboard/assessment/[fyId]/assign` | `app/(dashboard)/dashboard/assessment/[fyId]/assign/page.tsx` | ✅ | Topic assignment per stakeholder, pillar filter tabs, suggested presets |
| `/dashboard/assessment/[fyId]/launch` | `app/(dashboard)/dashboard/assessment/[fyId]/launch/page.tsx` | ✅ | Pre-launch checklist, confirmation modal, post-launch new stakeholder invite |
| `/dashboard/assessment/[fyId]/results` | `app/(dashboard)/dashboard/assessment/[fyId]/results/page.tsx` | ✅ | Response rate card, materiality matrix D3, ranked table, PDF/Excel download, uninvited stakeholder banner |
| `/survey` | `app/survey/page.tsx` | ✅ | Full stakeholder survey: welcome → per-topic ratings → review → submit → thank you |

---

## Layouts

| Route group | File | Status | Notes |
|---|---|---|---|
| Auth pages | `app/(auth)/layout.tsx` | ✅ | Split-panel: brand blue left, form right |
| Dashboard | `app/(dashboard)/layout.tsx` | ✅ | Navbar + Sidebar (no hardcoded role) |
| Onboarding | `app/(onboarding)/layout.tsx` | ✅ | Navbar only (no sidebar) |
| Admin | `app/(admin)/layout.tsx` | ✅ | Navbar + Sidebar shell |
| Agent | `app/(agent)/layout.tsx` | 🟡 | Navbar + Sidebar shell |
| Root | `app/layout.tsx` | ✅ | Wraps app in `<AuthProvider>` |

---

## API Routes

| Endpoint | File | Status | Notes |
|---|---|---|---|
| `POST /api/auth/init-user` | `app/api/auth/init-user/route.ts` | ✅ | Creates Firestore user doc via Admin SDK; bypasses Firebase v12 `accounts:lookup` bug |
| `POST /api/auth/session` | `app/api/auth/session/route.ts` | ✅ | Verifies ID token, fetches role from Firestore, sets `__session` + `__claims` HttpOnly cookies |
| `DELETE /api/auth/session` | `app/api/auth/session/route.ts` | ✅ | Clears session cookies on logout |
| `POST /api/survey/launch` | `app/api/survey/launch/route.ts` | ✅ | Full launch + partial re-launch for new stakeholders added post-launch |
| `POST /api/survey/remind` | `app/api/survey/remind/route.ts` | ✅ | Sends targeted/bulk reminder emails to eligible stakeholders (status sent/opened, count < 3) |
| `GET /api/survey/validate` | `app/api/survey/validate/route.ts` | ✅ | Validates token, returns stakeholder's assigned topics + company/assessment context |
| `POST /api/survey/submit` | `app/api/survey/submit/route.ts` | ✅ | Validates ratings against assignedTopics, atomic batch: response doc + stakeholder completed + responseCount++ |
| `POST /api/reports/pdf` | `app/api/reports/pdf/route.ts` | ✅ | 6-page jsPDF report → Firebase Storage → 1h signed URL |
| `POST /api/reports/excel` | `app/api/reports/excel/route.ts` | ✅ | 4-sheet ExcelJS workbook → Firebase Storage → 1h signed URL |
| `GET /api/admin/stats` | `app/api/admin/stats/route.ts` | ✅ | Platform-wide stats via count() aggregation |
| `GET /api/admin/activity` | `app/api/admin/activity/route.ts` | ✅ | Last 10 activity items (companies + assessments) |
| `GET /api/admin/companies` | `app/api/admin/companies/route.ts` | ✅ | All companies with assessment count |
| `GET /api/admin/companies/[companyId]` | `app/api/admin/companies/[companyId]/route.ts` | ✅ | Company detail + assessments + users |
| `PATCH /api/admin/companies/[companyId]` | `app/api/admin/companies/[companyId]/route.ts` | ✅ | Suspend / reactivate company |
| `GET /api/admin/agents` | `app/api/admin/agents/route.ts` | ✅ | List all field agents |
| `POST /api/admin/agents` | `app/api/admin/agents/route.ts` | ✅ | Create field agent + set custom claims + send welcome email |
| `PATCH /api/admin/agents/[uid]` | `app/api/admin/agents/[uid]/route.ts` | ✅ | Revoke or restore agent access |
| `GET /api/admin/topics` | `app/api/admin/topics/route.ts` | ✅ | All GRI topics with question count |
| `PATCH /api/admin/topics/[code]` | `app/api/admin/topics/[code]/route.ts` | ✅ | Toggle active / edit description + GRI ref |

---

## Components

| Component | File | Status | Notes |
|---|---|---|---|
| `AuthProvider` | `components/providers/AuthProvider.tsx` | ✅ | Single `onAuthStateChanged` listener; resilient to `getIdTokenResult` failures |
| `Navbar` | `components/layout/Navbar.tsx` | ✅ | Top nav with sign-out button |
| `Sidebar` | `components/layout/Sidebar.tsx` | ✅ | Role-conditional nav: company admin vs super admin; ShieldCheck icon for admin identity |
| `PageShell` | `components/layout/PageShell.tsx` | ✅ | Wrapper with heading + content area |
| `FormField` | `components/forms/FormField.tsx` | ✅ | Reusable labelled input wrapper |
| `MaterialityMatrix` | `components/charts/MaterialityMatrix.tsx` | ✅ | D3 v7 SVG scatter plot, forwardRef, threshold sliders, topic click → table highlight |
| `LoadingSkeleton` | `components/ui/LoadingSkeleton.tsx` | ✅ | Pulse skeleton — variants: card, table-row, text-line; configurable count |
| `Button` | `components/ui/button.tsx` | ✅ | shadcn/ui — variants: default, outline, ghost, orange, destructive |
| `Input` | `components/ui/input.tsx` | ✅ | shadcn/ui |
| `Label` | `components/ui/label.tsx` | ✅ | shadcn/ui |
| `Card` | `components/ui/card.tsx` | ✅ | shadcn/ui |
| `Badge` | `components/ui/badge.tsx` | ✅ | shadcn/ui |
| `Separator` | `components/ui/separator.tsx` | ✅ | shadcn/ui |

---

## Lib / Services

| Module | File | Status | Notes |
|---|---|---|---|
| Firebase client config | `lib/firebase/config.ts` | ✅ | Auth, Firestore, Storage |
| Firebase Admin | `lib/firebase/admin.ts` | ✅ | `adminAuth`, `adminDb`, `adminStorage` |
| Firebase Auth helpers | `lib/firebase/auth.ts` | ✅ | `signIn`, `signUp` (Admin SDK fallback for Firestore doc), `logOut`, `resetPassword` |
| Firestore helpers | `lib/firebase/firestore.ts` | ✅ | CRUD for users, companies, assessments, GRI topics, scores |
| Storage helpers | `lib/firebase/storage.ts` | ✅ | `uploadCompanyLogo`, `deleteCompanyLogo` |
| Brevo client | `lib/brevo/client.ts` | ✅ | `new BrevoClient({ apiKey })` |
| Brevo emails | `lib/brevo/emails.ts` | ✅ | `sendSurveyInvite`, `sendSurveyReminder`, `sendAssessmentComplete`, `sendWelcome` |
| Topic suggestions | `lib/topicSuggestions.ts` | ✅ | `TOPIC_SUGGESTIONS_BY_TYPE` — default topic presets per stakeholder type |
| Firestore indexes | `firestore.indexes.json` | ✅ | Single-field override: `stakeholders.surveyToken` ASCENDING (Collection Group scope) |

---

## State / Hooks

| Module | File | Status | Notes |
|---|---|---|---|
| Auth store | `store/authStore.ts` | ✅ | `firebaseUser`, `userDoc`, `role`, `loading` |
| Company registration store | `store/companyRegistrationStore.ts` | ✅ | Wizard state for all 3 steps |
| Assessment store | `store/assessmentStore.ts` | 🟡 | Scaffold only |
| `useAuth` hook | `hooks/useAuth.ts` | ✅ | Reads from Zustand, `logout()` clears session cookie + signs out |

---

## Data / Config

| File | Status | Notes |
|---|---|---|
| `types/index.ts` | ✅ | All interfaces: `User`, `Company`, `GRITopic`, `Assessment`, `Stakeholder`, `ScoreDocument`, etc. |
| `data/industryTypes.ts` | ✅ | 200+ NIC 2008 Indian industry types |
| `data/gri_topics_seed.json` | ✅ | 40 GRI topics (E, S, G pillars), each with 5 survey questions |
| `firestore.rules` | ✅ | Final production rules — Firestore SDK `get()` based role checks, no custom claims dependency |
| `storage.rules` | ✅ | Logo + report paths; client write blocked for reports |
| `.env.production.example` | ✅ | All production env vars with placeholders |
| `proxy.ts` | ✅ | Route protection: already-logged-in redirect from `/login`, session cookie check, role-based guards |
| `app/globals.css` | ✅ | Tailwind v4 CSS theme — brand `#333a8b` blue, `#ff6900` orange |

---

## Scripts

| Script | File | Command | Status |
|---|---|---|---|
| Seed GRI topics | `scripts/seedGRITopics.ts` | `npm run seed:topics` | ✅ Ready to run |
| Test Firestore write | `scripts/testFirestoreWrite.ts` | `npx tsx --env-file=.env.local scripts/testFirestoreWrite.ts` | ✅ Verified working |

---

## End-to-End Flows

### Assessment Wizard (5-step)
```
/topics → /stakeholders → /assign → /launch → /results
```

| Step | Route | Status |
|---|---|---|
| 1. Select GRI topics (≥5) | `/dashboard/assessment/[fyId]/topics` | ✅ |
| 2. Add stakeholders + set weightages | `/dashboard/assessment/[fyId]/stakeholders` | ✅ |
| 3. Assign topics per stakeholder | `/dashboard/assessment/[fyId]/assign` | ✅ |
| 4. Review checklist + launch (sends survey emails) | `/dashboard/assessment/[fyId]/launch` | ✅ |
| 5. Track response rate + send reminders | `/dashboard/assessment/[fyId]/results` | ✅ |

### Public Survey (stakeholder)
```
/survey?token=<uuid> → validate → welcome → per-topic ratings → review → submit → thank you
```

| Step | Status |
|---|---|
| Token validation (collectionGroup query) | ✅ |
| Welcome screen with company + stakeholder info | ✅ |
| Per-topic rating cards (impact 1-5, financial 1-5, optional comment) | ✅ |
| Review all ratings before submit | ✅ |
| Atomic submit (response doc + stakeholder completed + responseCount++) | ✅ |
| Thank you page | ✅ |

### Registration
```
/register → set session cookie → /register/profile → /company-setup → /dashboard
```

| Step | Route | Status |
|---|---|---|
| 1. Create account (email + password) | `/register` | ✅ |
| 2. Complete profile (name, title, phone) | `/register/profile` | ✅ |
| 3. Company setup wizard (3 steps + logo upload) | `/company-setup` | ✅ |
| 4. Dashboard (welcome banner + empty state) | `/dashboard` | ✅ |

### Login
```
/login → set session cookie → role-based redirect
```

| Scenario | Redirect | Status |
|---|---|---|
| `company_admin` + `registrationComplete: true` | `/dashboard` | ✅ |
| `company_admin` + `registrationComplete: false` | `/company-setup` | ✅ |
| `super_admin` | `/admin` | ✅ |
| `field_agent` | `/agent` | ✅ |
| Already logged in visiting `/login` | Role-based redirect | ✅ |

### Logout
```
DELETE /api/auth/session (clear cookies) → Firebase signOut → /login
```

---

## Deployment Checklist
- [ ] Regenerate all API keys (Firebase, Brevo, Survey Token Secret) for production
- [ ] Set NEXT_PUBLIC_APP_URL to production domain in .env.production
- [ ] Publish Firestore rules via Firebase Console
- [ ] Publish Storage rules via Firebase Console
- [ ] Run npm run seed:topics against production Firestore
- [ ] Create Super Admin user in production Firebase Auth
- [ ] Verify Brevo sender domain (sowin.world) is verified
- [ ] Test full flow end-to-end on production URL
- [ ] Enable Firebase App Check for production
- [ ] Set up Firebase Hosting with custom domain

---

## Known Issues / Notes

- **Firebase SDK v12 `accounts:lookup` bug**: Worked around via `/api/auth/init-user` API route (Admin SDK). Do not revert to direct `createUserDocument` calls from the client.
- **Firebase Storage 403**: Requires Storage rules to be published in Firebase Console → Storage → Rules (use `storage.rules`). Also ensure the Storage bucket is initialised ("Get started" in Firebase Console).
- **Firestore + Storage rules**: Both rule files must be manually published via Firebase Console — no `firebase.json` / CLI deploy configured yet.
- **Session cookie freshness**: The `__claims` cookie stores the role at login time. If a user's role changes server-side, they must log out and back in to get the updated cookie.
- **Firestore rules — role lookup**: The new rules use `get()` to read the user's role from Firestore rather than relying on custom claims token. This is more accurate but costs 1 read per rule check. For high-traffic production, consider switching back to `request.auth.token.role` after ensuring claims are always set.
- **`gri_topics_seed.json`**: Duplicate exists at project root — safe to delete, canonical copy is at `data/gri_topics_seed.json`.
