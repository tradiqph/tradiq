# TradIQ

Mobile-first investment platform with copy-trading bots, QR Ph deposits (Paymongo), multi-level referrals, and black/gold glassmorphism UI.

## Stack

- **Next.js 15** (App Router)
- **Firebase** (Auth, Firestore, Cloud Functions)
- **Paymongo** (QR Ph deposits)
- **shadcn/ui** + [21st.dev](https://21st.dev/) components
- **UI/UX Pro Max** design skill

## Setup

> **Firebase:** See [SETUP_FIREBASE.md](SETUP_FIREBASE.md) for database creation, billing, and seeding steps.

1. Copy `.env.example` to `.env.local` and fill in Firebase + Paymongo keys.

2. Install dependencies:
   ```bash
   npm install
   cd functions && npm install && cd ..
   ```

3. Deploy Firestore rules:
   ```bash
   npx firebase deploy --only firestore:rules
   ```

4. Seed bot catalog (optional):
   ```bash
   npx tsx src/scripts/seed-bots-catalog.ts
   ```

5. Run dev server:
   ```bash
   npm run dev
   ```

## Admin Console

Hidden at `/console` — set `role: "admin"` on your user document in Firestore.

## Paymongo Webhook

Point webhook to `https://your-domain.com/api/paymongo/webhook` with events:
- `payment.paid`
- `qrph.expired`
- `payment.failed`

## Daily Bot Earnings

Cloud Function `dailyBotEarnings` runs every 15 minutes (Asia/Manila) and credits 3% per bot once each 24h cycle has elapsed. One-time backfill: `npm run accrual:run` (dry-run) or `npm run accrual:run -- --confirm`.
