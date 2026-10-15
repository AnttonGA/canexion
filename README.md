# Familia Canexion — Veterinary Loyalty CRM

A production CRM and membership platform for **Familia Canexion**, the loyalty program of a
veterinary group (clinic + shop + grooming) in Gipuzkoa, Spain. It manages members and their
pets, runs targeted WhatsApp campaigns, tracks health and nutrition plans, maps the member
base, and issues digital wallet cards — all integrated with the clinic's management software
(Wakyma).

Built with no framework: static HTML/CSS/JS on the front end and serverless functions on the
back, with Supabase (PostgreSQL) as the database.

## Features

- **Member management** — members, multiple pets per member, services, benefits, internal notes.
- **Public sign-up form** — self-service membership registration with welcome benefits and discovery coupons.
- **Campaigns** — audience segmentation (by service, spend, pet data…) and WhatsApp send tracking.
- **Benefits & coupons** — configurable welcome benefits and per-service discovery coupons.
- **Member map** — geocoded member locations (Leaflet + Photon/Nominatim), with address cleanup and a retry chain.
- **Health & nutrition plans** — per-pet plans with quarterly check-ins.
- **Daily action feed** — birthdays, anniversaries, deworming reminders, Wakyma invitations.
- **Digital wallet card** — Apple Wallet & Google Wallet membership cards (via WalletWallet), delivered by WhatsApp; the card's QR deep-links to the member's profile.
- **Wakyma integration** — links/creates clients and pets, pulls spending stats, scans sales for deworming reminders, creates appointment-based invitations.

## Tech stack

- **Front end:** vanilla HTML / CSS / JavaScript (no build step), Leaflet for maps.
- **Back end:** Netlify Functions (Node.js) — a thin serverless layer for integrations and privileged operations.
- **Database & auth:** Supabase (PostgreSQL) with Row Level Security; staff authenticate via Supabase Auth.
- **Integrations:** Wakyma (veterinary management API), WalletWallet (wallet passes), Photon / Nominatim (geocoding), WhatsApp (`wa.me`).
- **Hosting:** Netlify (static site + functions + a scheduled function).

## Architecture

```
Public form ─┐
             ├─►  Netlify Functions  ─►  Supabase (Postgres + RLS)
Staff CRM ───┘           │
                         └─►  Wakyma API  /  WalletWallet API
```

- The public Supabase *publishable* key is constrained by **Row Level Security**: anonymous
  visitors can only read the two tables the sign-up form needs; everything else requires an
  authenticated staff session.
- Privileged server operations (member creation, scheduled scans) run in Netlify Functions
  using Supabase's `service_role` key, kept in environment variables — never in the client.
- A scheduled function scans Wakyma sales daily to generate deworming reminders.

## Project structure

| Path | What |
|---|---|
| `canexion_crm.html` | The staff CRM (single-page app). |
| `canexion_registro.html` | Public membership sign-up form. |
| `netlify/functions/` | Serverless functions: registration, Wakyma proxy & scheduled jobs, wallet pass. |
| `schema.sql`, `migration_*.sql` | Database schema and incremental migrations. |

## Configuration

Secrets are provided as Netlify environment variables and are never committed:
`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `WAKYMA_KEY`, `WALLETWALLET_KEY`.

---

*A real-world project in active use by the business.*
