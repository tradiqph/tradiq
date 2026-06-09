# Dashboard Page Overrides

> Overrides `design-system/tradiq/MASTER.md` for the home dashboard (`/home`).

## Layout Order (top to bottom)

1. Greeting header — time-based salutation + display name + TRADIQ wordmark
2. Quick actions — Deposit/Withdraw split CTAs, then Leaderboard/Support chips
3. Wallet bento grid — hero balance tile + 3 stat tiles (no carousel dots)
4. Recent transactions — timeline list with gold connector

## Wallet Bento Grid

- Hero tile: `col-span-2`, `surface-accent`, wallet-card-bg at 20% opacity
- Stat tiles: Deposit Balance, Deposited, Withdrawn via `StatTile`
- No pagination dots or carousel behavior

## Quick Actions

- Row 1: two `GoldButton` in `grid-cols-2`
- Row 2: `ActionChip` links — never use circular 4-icon grid

## Transactions

- Use `TimelineItem` for populated list
- Empty state: `surface-flat` banner with `empty-no-transactions.png` (keep asset)

## Navigation

- Floating dock at `bottom-4` with 3D PNG icons
- Center Bot tab: elevated FAB using `smart-wallet-engine.png`
- Labels visible on active tab only
- Shell padding: `pb-28`

## Header

- Home: greeting mode only (no logo image, no shield button)
- Security Center lives on Account page
