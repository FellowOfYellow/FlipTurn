# FlipTurn

A swim team app for high school coaches: gear inventory and lending, a swimmer
roster, and (in later phases) competition relays and workouts. Team data is
stored as JSON files in a **FlipTurn** folder in the head coach's Google Drive.

## Run it locally

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests
npm run build      # production build in dist/
```

Without a Google client ID the app runs in local-only mode and saves to the
browser. To turn on Google sign-in, create `.env.local`:

```
VITE_GOOGLE_CLIENT_ID=<your OAuth web client ID>.apps.googleusercontent.com
```

## Deploying

Pushes to `main` build and deploy to GitHub Pages
(`https://<username>.github.io/FlipTurn/`). In the repository settings:

1. **Pages**: set Source to **GitHub Actions**.
2. **Secrets and variables → Actions → Variables**: add `GOOGLE_CLIENT_ID`.

## How data is stored

| Drive file | Contents |
| --- | --- |
| `team.json` | school name, gear inventory |
| `swimmers.json` | roster |
| `gear-loans.json` | gear lent to swimmers |

Every record has an `id` and `updatedAt`. Before writing, the app reads the
Drive copy and merges record by record (newest edit wins, deletes are kept as
tombstones), so two coaches editing at once don't overwrite each other.
Changes save to the device immediately and sync to Drive about 1.5 seconds later.

## Phases

See the implementation plan. Phase 1 (this code) covers the foundation, a
basic roster with paddle and fin sizes, and the Gear page.
