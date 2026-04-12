# Deploying Swifora DMA Platform

## Prerequisites

- Node.js 18+
- Firebase project created at console.firebase.google.com
- Brevo account with sender domain verified
- All environment variables from `.env.production.example` filled in

---

## Option A — Vercel (Recommended)

Next.js App Router deploys best on Vercel. Server Components, API routes, and
middleware all work out of the box with zero configuration.

1. **Push code to GitHub**
   - Ensure `.env.local` is listed in `.gitignore` (it is by default)
   - Do not commit any real API keys

2. **Create Vercel project**
   - Go to vercel.com → New Project → Import from GitHub
   - Select the `dma-platform` repository

3. **Set environment variables**
   - Go to Project Settings → Environment Variables
   - Add every variable from `.env.production.example` with production values
   - Set `NEXT_PUBLIC_APP_URL` to your Vercel URL (e.g. `https://swifora.vercel.app`)
     or your custom domain once DNS is configured

4. **Deploy**
   - Click Deploy — Vercel auto-builds on every push to `main`
   - First build takes ~2 minutes; subsequent builds are faster

5. **Custom domain (optional)**
   - Vercel Dashboard → Domains → Add your domain
   - Update `NEXT_PUBLIC_APP_URL` env var to the custom domain

---

## Option B — Firebase Hosting + Cloud Run

For teams already on Google Cloud and wanting Firebase-native hosting.

1. **Install Firebase CLI**
   ```bash
   npm install -g firebase-tools
   firebase login
   ```

2. **Build the Next.js app**
   ```bash
   npm run build
   ```

3. **Configure `firebase.json`**
   The `firebase.json` at the project root is already set up with hosting,
   Firestore rules, and Storage rules sections.

4. **Deploy Firestore + Storage rules**
   ```bash
   firebase deploy --only firestore:rules,storage
   ```

5. **Deploy to Cloud Run (for SSR)**
   Firebase Hosting does not natively support Next.js SSR. Use Cloud Run:
   ```bash
   # Build container
   gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/dma-platform

   # Deploy to Cloud Run
   gcloud run deploy dma-platform \
     --image gcr.io/YOUR_PROJECT_ID/dma-platform \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --set-env-vars "NODE_ENV=production,NEXT_PUBLIC_APP_URL=https://yourdomain.com"

   # Add all other env vars via Secret Manager or --set-env-vars
   ```

6. **Connect Firebase Hosting to Cloud Run**
   In `firebase.json` hosting section, replace the static rewrite with:
   ```json
   "rewrites": [{
     "source": "**",
     "run": { "serviceId": "dma-platform", "region": "us-central1" }
   }]
   ```
   Then deploy hosting:
   ```bash
   firebase deploy --only hosting
   ```

---

## Post-Deployment Steps

Run these after the first successful deployment:

### 1. Update app URL
Set `NEXT_PUBLIC_APP_URL` to the final production domain in your hosting
environment variables. Survey invitation links in emails are generated from
this value.

### 2. Brevo templates
Templates already use `{{ params.SURVEY_LINK }}` — no template changes needed.
Verify the sender domain (`sowin.world`) is authenticated in Brevo:
Brevo → Senders & IPs → Domains.

### 3. Seed GRI topics into production Firestore
```bash
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json npm run seed:topics
```
Or with the inline env var approach:
```bash
npm run seed:topics  # if .env.local points to production project
```

### 4. Publish Firestore + Storage rules
Via Firebase Console:
- Firestore → Rules → paste contents of `firestore.rules` → Publish
- Storage → Rules → paste contents of `storage.rules` → Publish

Or via CLI (if Firebase project is configured):
```bash
firebase deploy --only firestore:rules,storage
```

### 5. Create Super Admin
Run the seed script once to create the platform Super Admin account:
```bash
npm run seed:admin
```
This reads `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` from `.env.local`,
creates the Firebase Auth user, sets the `super_admin` custom claim, and
writes the Firestore user doc.

After running, the super admin can log in at `/login` and will be redirected
to `/admin`.

### 6. Enable Firebase App Check (recommended for production)
Firebase Console → App Check → Register your web app with reCAPTCHA v3.
This prevents unauthenticated abuse of Firestore and Storage.

---

## Rollback

Vercel: previous deployments are preserved — click "Promote to Production"
on any prior deployment in the Vercel dashboard.

Firebase Hosting: `firebase hosting:clone SOURCE_SITE:SOURCE_VERSION TARGET_SITE:live`
