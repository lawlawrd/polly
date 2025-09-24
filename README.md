# Polly

Polly is an internal anonymization helper for Law Law BV. It combines an Express server, Pug views, and a rich React/Tiptap anonymizer interface to help staff run anonymization jobs, redact sensitive information, and keep records synchronized. The latest UI refresh centers the anonymizer workspace as the landing page and replaces the emoji favicon with the bespoke `public/images/face.svg` icon used in the header and browser tab.

## Features
- Local email/password authentication with session management and theme preferences stored per user
- Streamlined anonymizer landing page with refreshed Law Law branding, drop-down navigation scaffolding, and Sass-compiled light/dark themes
- Rich-text anonymizer workspace powered by Tiptap that can save presets, reuse previous runs, and highlight analyzer output
- Better-sqlite3 persistence for users, anonymizer presets, saved runs, and session storage in the `data/` directory
- Integrations with Microsoft Presidio analyzer and anonymizer services for entity detection and redaction
- Tooling to compile Sass themes and bundle the anonymizer React components through Webpack

## Tech Stack
- Node.js with Express 5 for the HTTP layer and routing
- Passport Local strategy for authentication
- Pug templates for server-side rendered pages
- React 18 + Tiptap 2 for the anonymizer editor experience
- Sass for styling and theme generation
- better-sqlite3 for fast on-disk persistence without a separate database server

## Getting Started

### Prerequisites
- Node.js 20 LTS (earlier 18+ releases may work but better-sqlite3 is tested primarily on current LTS)
- npm (ships with Node.js)
- Running Presidio analyzer and anonymizer services if you want end-to-end anonymization (`docker run` images or an existing deployment)

### Installation
```bash
npm install
```
This installs both runtime and build tooling dependencies.

### Environment Variables
Set variables in your shell or via a process manager before launching the app.

| Name | Default | Description |
| --- | --- | --- |
| `PORT` | `8081` | HTTP port for the Express server. |
| `SESSION_SECRET` | `polly-dev-secret` | Cookie/session signing secret—override in production. |
| `POLLY_THEME` | `light` | Default theme (`light` or `dark`). Individual users can toggle via the UI. |
| `REQUEST_BODY_LIMIT` | `5mb` | Express body-parser limit for incoming anonymizer payloads. |
| `PRESIDIO_ANALYZER_URL` | `http://localhost:5002` | Endpoint for the Presidio analyzer service. |
| `PRESIDIO_ANONYMIZER_URL` | `http://localhost:5001` | Endpoint for the Presidio anonymizer service. |

### Development workflow
```bash
npm run dev
```
The dev script launches four concurrent watchers:
- Sass compilers for the light and dark themes (outputs in `public/styles/`)
- `nodemon` pointed at the server entry point (`mibdw` in the current script—update to `polly.js` if you prefer)
- Webpack in watch mode to rebuild `public/scripts/anonymizer.js`

If you only need the server while iterating on backend code, you can run:
```bash
npm start
```
This executes `node polly.js` without the asset watchers.

### Production build
```bash
npm run build
```
This performs a one-off Sass compilation and Webpack bundle suitable for deployment. Serve the app with `npm start` (or a process manager like pm2) and ensure environment variables are set to production values.

## Data & Persistence
- The first run creates `data/polly.db` with tables for users, anonymizer presets, and saved anonymization runs.
- Session data is stored in `data/sessions.sqlite` through `connect-sqlite3`.
- All schema creation happens automatically inside `db/index.js` when the app boots. Back up the `data/` directory to retain history.

## Presidio Integration
The anonymizer workflows call out to Presidio services. Start them locally or point the URLs at an existing deployment. A minimal local setup might look like:
```bash
export PRESIDIO_ANALYZER_URL=http://localhost:5002
export PRESIDIO_ANONYMIZER_URL=http://localhost:5001
npm start
```
If the services are unreachable, API requests under `/api/anonymize` return errors and the UI will surface the failure. The client will still allow you to edit text, but anonymization results will be empty.

## Authentication and Themes
- Users self-register through `/register`, then sign in via `/login`. Credentials are hashed with bcrypt (12 rounds).
- The `/theme-switch` route toggles the theme for the active session and redirects back to the originating page.
- Navigation (currently just the anonymizer landing entry) is defined in `utils/miscUtils.js` and rendered server-side.

## Project Layout
```
.
├── polly.js                # Express bootstrap and HTTP wiring
├── views/                  # Pug templates for auth pages and the main layout
├── routes/                 # Auth, anonymous API, and page routing
├── components/             # React components bundled into public scripts
├── public/                 # Compiled assets served statically
├── services/               # Business logic for anonymization, presets, and users
├── styles/                 # Sass source for light/dark themes and components
├── utils/                  # Shared utilities (navigation, anonymizer helpers)
├── db/                     # SQLite setup and schema creation
└── data/                   # SQLite databases created at runtime
```

## npm Scripts
- `npm start` – run the server once using the compiled assets.
- `npm run dev` – watch Sass, Webpack, and restart the server on changes.
- `npm run build` – build production-ready CSS and anonymizer bundle.

## License
This project is published under the ISC license (see `package.json`).
