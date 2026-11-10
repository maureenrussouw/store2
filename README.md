# store2

Built with [Grit](https://gritframework.dev).

## Quick Start

```bash
# Go hot reload, bundled by the CLI; this installs it globally instead
go install github.com/air-verse/air@latest

# The services this project talks to: PostgreSQL, Redis, MinIO, Mailhog
docker compose up -d

# Frontend dependencies
pnpm install

# Create the tables
grit migrate

# Sample data, optional
grit seed

# Run everything
grit start
```

## Cloned this project?

`.env` holds this machine's secrets and is not committed; `.env.example` is, with
`CHANGE_ME` in their place. Create yours before anything else:

```bash
grit env        # .env from .env.example, every secret freshly generated
grit migrate
grit seed
```

To share a database that already holds encrypted data, put the team's
`FIELD_ENCRYPTION_KEY` in `.env` instead of the new one.

## Project Structure

```
store2/
├── apps/
│   ├── api/          # Go backend (Gin + GORM)
│   ├── web/          # Next.js frontend
│   ├── admin/        # Next.js admin panel
│   ├── desktop/      # Wails desktop app
├── packages/
│   └── shared/       # Shared types, schemas, constants
├── docker-compose.yml
└── turbo.json
```

## Services

| Service | URL |
|---------|-----|
| API | http://localhost:8080 |
| API docs | http://localhost:8080/docs |
| GORM Studio | http://localhost:8080/studio |
| Web app | http://localhost:3000 |
| Admin panel | http://localhost:3001 |
| Desktop | `wails dev`, from apps/desktop |
| PostgreSQL | localhost:5434 |
| Redis | localhost:6380 |
| MinIO console | http://localhost:9003 |
| Mailhog | http://localhost:8025 |

## Development

```bash
# The Go API, with hot reload
cd apps/api && air

# The web app
cd apps/web && pnpm dev

# The admin panel
cd apps/admin && pnpm dev

# The desktop app
cd apps/desktop && wails dev

# Every frontend at once, via Turborepo
pnpm dev
```

## No Docker? No Problem

If you cannot run Docker, use cloud services instead:

```bash
cp .env.cloud.example .env
```

Then fill in your keys for:

- **[Neon](https://neon.tech)** — PostgreSQL (free tier)
- **[Upstash](https://upstash.com)** — Redis (free tier)
- **[Cloudflare R2](https://dash.cloudflare.com)** — File storage (free tier)
- **[Resend](https://resend.com)** — Email (free tier)

## Tech Stack

- **Backend:** Go + Gin + GORM
- **Frontend:** Next.js (App Router) + React + TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **Desktop:** Wails + React
- **Database:** PostgreSQL
- **Cache:** Redis
- **Monorepo:** Turborepo + pnpm
- **Validation:** Zod (shared schemas)
- **Data fetching:** React Query (TanStack Query)

---

*Built with Grit v3.498.0*
