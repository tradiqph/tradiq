# TradIQ Firestore Schema

Project: `tradiq-f4962`  
Database: `(default)`  
Region: `asia-southeast1`

## Collections

### `users/{uid}`
User profile and balances. Created on first sign-in.

| Field | Type | Notes |
|-------|------|-------|
| email | string | |
| displayName | string | |
| photoURL | string \| null | |
| referralCode | string | `TRD-{NAME}-{4digits}` |
| referredBy | string \| null | Referrer uid |
| memberSince | timestamp | |
| walletBalance | number | Withdrawable |
| depositBalance | number | Bot subscription only |
| totalDeposited | number | |
| totalWithdrawn | number | |
| totalEarnings | number | |
| securityPinHash | string \| null | bcrypt |
| role | string | `user` or `admin` |
| referralStats | map | `{ level1, level2to5, totalEarned }` |
| memberRank | string | `member`, `leader`, `director`, or `ambassador` (default `member`) |
| rankActivatedAt | timestamp \| null | Set when user manually activates a rank; leadership bonus applies to bot accruals scheduled on/after this time (including pre-existing L1 bots), not backfilled for earlier days |

#### Subcollections
- `transactions/{id}` — deposit, bot_subscribe, earning, referral, withdrawal
- `bots/{id}` — active copy-trading subscriptions
- `withdrawalAccounts/{id}` — max 3 saved accounts

### `botsCatalog/{botId}`
Seeded display bots (read-only for users).

### `deposits/{id}`
Paymongo QR Ph payment tracking.

### `withdrawalRequests/{id}`
Admin cashout queue.

### `appConfig/platform`
Platform-wide settings (rates, presets).

### `leadershipBonusEvents/{eventId}`
Server-only idempotency ledger for daily L1 leadership bonus payouts. Key: `{uplineUid}_{botId}_{accrualDay}`.
