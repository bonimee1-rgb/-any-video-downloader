# Any Video Downloader API (starter)

This is a separately deployable Vercel API for **direct HTTPS media-file links**.
It is not a universal YouTube/TikTok/Facebook/Instagram extractor and does not bypass
login, DRM, paywalls, or platform restrictions. Use only media you own or are authorized
to download. Platform-page URLs need an official API or an authorized provider integration.

## Deploy from an iPhone

1. Download and unzip this project.
2. Create a new GitHub repository named `any-video-api`.
3. Upload every file and folder from this ZIP into the repository root.
4. Open https://vercel.com, sign in, choose **Add New → Project**, and import `any-video-api`.
5. Keep the default settings and press **Deploy**.
6. When deployment is ready, copy the domain Vercel gives you, e.g. `https://your-project.vercel.app`.
7. In the app's **Backend API URL** field, enter that domain (no `/api` suffix), then save.

## Test

Open `https://YOUR-VERCEL-DOMAIN.vercel.app/api/health`.
It should return JSON with `"ok": true`.

The app can call:
- `GET /api/health`
- `POST /api/resolve` with JSON body `{ "url": "https://example.com/file.mp4" }`

Example response:
```json
{
  "ok": true,
  "type": "video",
  "format": "mp4",
  "downloadUrl": "https://example.com/file.mp4"
}
```

## Important integration note

The existing Netlify app may expect a different API contract. This starter's endpoints
must be connected to the app's actual frontend request format. If the app still reports
an API error after deployment, provide its source ZIP or GitHub repository so the
request/response contract can be matched exactly.

Optional Vercel environment variable:
- `ALLOWED_ORIGIN` = `https://anyd.netlify.app`
