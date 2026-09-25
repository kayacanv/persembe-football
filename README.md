# Perşembe Halısaha

A web app for organising our weekly Thursday five-a-side (halı saha) football match: sign-ups, payments, team building, player cards and MVP voting.

**Live at [halisaha.klpir.com](https://halisaha.klpir.com)**

## Features

- **Weekly matches**: the next Thursday match is created automatically. Players join or leave, and anyone past the 16-player cap goes on the reserve list.
- **Payments**: players pay their pitch fee by card (Stripe) or bank transfer (Starling). Starling transfers are matched to players automatically by payment reference or payer name.
- **Kumbara (piggy bank)**: one-off whip-rounds for pitch fees that have to be paid even when a match doesn't go ahead.
- **Team builder**: drag-and-drop team organising with free-form formations and jersey numbers.
- **Player cards**: FIFA-style player cards with photos, club logos and stats that players rate for each other.
- **Teammate preferences**: signed-in players privately mark who they'd like to play alongside.
- **MVP voting**: players vote for the man of the match after each game.
- **Accounts**: players claim their existing profile and sign in with a username and password. Phone numbers are kept private and used only for contact.
- **Bilingual**: Turkish (default) and English.

## Tech stack

- [Next.js 15](https://nextjs.org) (App Router) with React 19 and TypeScript
- [Tailwind CSS v4](https://tailwindcss.com) and [shadcn/ui](https://ui.shadcn.com) components
- [Supabase](https://supabase.com) for the Postgres database, auth, storage and `pg_cron` jobs
- [Stripe](https://stripe.com) for card payments
- [Starling Bank](https://developer.starlingbank.com) API and webhooks for bank-transfer payments

## Getting started

```bash
pnpm install
pnpm dev
```

The app runs at [http://localhost:3000](http://localhost:3000).

### Environment variables

Put these in `.env.local`:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (public) key |
| `SUPABASE_URL` | Supabase project URL, for server-side use |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key, for server-side use |
| `NEXT_PUBLIC_APP_URL` | Public base URL of the app (e.g. `https://halisaha.klpir.com`) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for `/api/webhooks/stripe` |
| `NEXT_PUBLIC_STARLING_ACCOUNT_NAME` | Account name shown on the bank-transfer tab |
| `NEXT_PUBLIC_STARLING_ACCOUNT_NUMBER` | Account number shown on the bank-transfer tab |
| `NEXT_PUBLIC_STARLING_SORT_CODE` | Sort code shown on the bank-transfer tab |
| `STARLING_API_BASE` | Starling API base URL |
| `STARLING_WEBHOOK_PUBLIC_KEY` | Public key used to verify Starling webhook signatures |
| `CRON_SECRET` | Bearer token that protects `/api/cron/starling-sync` |

### Database

The `*.sql` files in the repository root are Supabase migrations. Run them in the Supabase SQL editor. Some of them schedule `pg_cron` jobs (automatic match creation, marking matches as done, and a Starling sync every 15 minutes that calls `https://halisaha.klpir.com/api/cron/starling-sync`).

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Start the development server |
| `pnpm build` | Build for production |
| `pnpm start` | Serve the production build |
| `pnpm lint` | Run ESLint |
