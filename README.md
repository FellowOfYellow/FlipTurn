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

Google sign-in is configured in `.env` (public values only). Without a client
ID the app runs in local-only mode and saves to the browser. To point a local
copy at a different Google Cloud project, override them in `.env.local`:

```
VITE_GOOGLE_CLIENT_ID=<your OAuth web client ID>.apps.googleusercontent.com
VITE_GOOGLE_API_KEY=<API key, used by the Google Picker>
VITE_GOOGLE_APP_ID=<Google Cloud project number>
```

The API key and project number are only needed for assistant coaches joining
a team folder that was shared with them.

## Deploying

Pushes to `main` build and deploy to GitHub Pages; **Actions → Test and
deploy → Run workflow** redeploys without a code change
(`https://<username>.github.io/FlipTurn/`). In the repository settings:

1. **Pages**: set Source to **GitHub Actions**.
2. Google Cloud: the OAuth client's Authorized JavaScript origins must include
   `https://<username>.github.io`.

## iPhone app (App Store)

The App Store version wraps this same app with [Capacitor](https://capacitorjs.com). The Xcode project lives in `ios/`. You need a Mac with Xcode and an Apple Developer account.

One-time setup:

1. In Google Cloud ([Credentials](https://console.cloud.google.com/apis/credentials?project=flipturn-515208)), create an OAuth client of type **iOS** with bundle ID `com.fellowofyellow.flipturn`. Put its client ID in `.env` as `VITE_GOOGLE_IOS_CLIENT_ID`. It is public, like the web client ID.
2. On the Mac: `npm install`, then `npm run ios`. This builds the app, copies it into the Xcode project, writes the Google sign-in callback into `Info.plist`, and opens Xcode.
3. In Xcode, select the **App** target, open **Signing & Capabilities**, and choose your team.
4. Run it on your iPhone, or choose **Product → Archive** to upload to App Store Connect.

After changing app code, run `npm run ios` again before building in Xcode.

In the app, sign-in uses Google's native iOS sign-in. Drive access is shared across the website and the app because they belong to the same Google Cloud project, so a team folder that an assistant coach joined on the website also opens in the app.

## How data is stored

| Drive file | Contents |
| --- | --- |
| `team.json` | school name, gear inventory |
| `coaches.json` | coach profiles |
| `swimmers.json` | roster and swimmer profiles |
| `gear-loans.json` | gear lent to swimmers |
| `photos.json` | swimmer and coach photos (320px JPEG) |
| `competitions.json`, `workouts.json` | reserved for later phases |

FlipTurn uses the `drive.file` scope, so it only sees files it created or that
a coach picked. The head coach's first sign-in creates every file above. An
assistant coach is shared the folder as Editor, signs in, taps **Join a team**
and picks it with the Google Picker (and, if Google doesn't grant the folder's
contents with it, selects the files too). Only the folder's owner creates
missing files, since a file an assistant created would be invisible to the
head coach.

Every record has an `id` and `updatedAt`. Before writing, the app reads the
Drive copy and merges record by record (newest edit wins, deletes are kept as
tombstones), so two coaches editing at once don't overwrite each other.
Changes save to the device immediately and sync to Drive about 1.5 seconds
later; only files whose contents changed are uploaded.

## Phases

See the implementation plan. Phase 1 covers the foundation, a basic roster
with paddle and fin sizes, and the Gear page. Phase 2 adds the team folder
setup (start or join), full swimmer profiles, and coach profiles.
