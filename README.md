# MoralMaps

MoralMaps is a mapping-based research experience that guides participants through route-choice scenarios and captures survey feedback. The app presents travel alternatives on an interactive map, records selections, and stores session data for later analysis.

## Features

- **Interactive scenario flow** with map-based routes and alternative choices.
- **Participant onboarding** with consent and eligibility modals.
- **Survey capture** at the end of the experience.
- **Admin workspace** for configuring scenarios, instructions, and survey content.
- **Session persistence** backed by Redis (with an in-memory fallback for local development).

## Tech stack

- **Next.js 15** + **React 19** for the application shell and routing.
- **Leaflet / React-Leaflet** for map rendering.
- **Redis** (or Vercel KV/Cloudflare-backed Redis) for session storage.
- **Tailwind CSS** for styling.

## Getting started

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
npm install
```

### Running locally

```bash
npm start
```

The app will be available at `http://localhost:3000`.

### Production build

```bash
npm run build
npm run serve
```

## Configuration

MoralMaps uses environment variables to configure admin access and persistence.

| Variable | Purpose |
| --- | --- |
| `ADMIN_USERNAME` / `ADMIN_USER` / `NEXT_PUBLIC_ADMIN_USERNAME` | Admin basic auth username. |
| `ADMIN_PASSWORD` / `ADMIN_PASS` / `NEXT_PUBLIC_ADMIN_PASSWORD` | Admin basic auth password. |
| `REDIS_URL` | Redis connection URL for session storage. |
| `NEXT_PUBLIC_BASE_PATH` | Optional base path for deployments that serve the app under a subpath. |

If `REDIS_URL` is not set in development, the app falls back to an in-memory store and logs a warning.

## Project structure

- `app/` — Next.js routes (including `/admin` and API handlers).
- `src/` — shared UI components, scenario logic, and admin UI.
- `docs/` — reference documentation (see the user data structure guide).

## Admin access

The admin interface lives under `/admin` and is protected by HTTP basic auth. Set the admin username and password in environment variables before accessing the admin screens.

## Data model

Session storage details are documented in [`docs/user-data-structure.md`](docs/user-data-structure.md).

## Scripts

| Command | Description |
| --- | --- |
| `npm start` | Run the dev server. |
| `npm run build` | Build the production bundle. |
| `npm run serve` | Start the production server. |
| `npm run preview` | Build and run the OpenNext Cloudflare preview. |
| `npm run cf-typegen` | Generate Cloudflare environment types. |

## Deployment

This project supports standard Next.js deployments and OpenNext Cloudflare builds via the `preview` script. Ensure the required environment variables are configured in your deployment platform.

## License

This repository does not currently declare a license. Please add one if you intend to distribute this project publicly.
