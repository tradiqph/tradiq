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
| claimedRewardTiers | string[] | Reward tier ids already claimed (`tier_500k`, `tier_1m`, `tier_2m`). Each claimed tier's threshold is deducted from lifetime group sales when computing **reward** progress only; rank progress uses full lifetime downline sales. |
| isTestAccount | boolean | Optional; set by super-admin for `qa@tradiq.biz` QA testing only |
| qaEligibilityOverride | map | Optional; simulated rank/reward eligibility for QA (`enabled`, `enabledBy`, `enabledAt`, `expiresAt`, `target`) |

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

| Field | Type | Notes |
|-------|------|-------|
| payoutFailureAcknowledgedAt | timestamp \| null | Set when admin manually marks a failed payout as processed |
| payoutFailureAcknowledgedBy | string \| null | Admin uid that acknowledged the payout failure |

### `reward_claims/{id}`
Physical reward fulfillment queue. Created via server API on member claim.

| Field | Type | Notes |
|-------|------|-------|
| referenceNumber | string | `TRQ-RWD-000123` |
| userId | string | Claiming member |
| memberName | string | |
| memberEmail | string | |
| memberPhone | string | Captured at claim time |
| rewardType | string | `tier_500k`, `tier_1m`, `tier_2m` |
| rewardName | string | Display name of reward |
| rewardValue | number | Tier threshold (₱ group sales) |
| deliveryAddress | map | `{ street, barangay, city, postalCode }` |
| status | string | `pending`, `processing`, `shipped`, `received` |
| courier | string \| null | Set when shipped |
| trackingNumber | string \| null | Set when shipped |
| claimedAt | timestamp | |
| shippedAt | timestamp \| null | |
| receivedAt | timestamp \| null | |
| createdBy | string | Member uid |
| updatedBy | string \| null | Admin uid on status change |
| updatedAt | timestamp \| null | |

#### Subcollections
- `statusHistory/{entryId}` — audit trail per status change (`status`, `updatedBy`, `updatedAt`, optional `courier`, `trackingNumber`)

### `_meta/rewardClaimCounter`
Sequential counter for `TRQ-RWD-XXXXXX` reference numbers.

### `appConfig/platform`
Platform-wide settings (rates, presets).

### `leadershipBonusEvents/{eventId}`
Server-only idempotency ledger for daily L1 leadership bonus payouts. Key: `{uplineUid}_{botId}_{accrualDay}`.
