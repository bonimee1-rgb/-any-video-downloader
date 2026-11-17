# Any Video Downloader Pro

A responsive web app / PWA and Android wrapper built with React, Vite and Capacitor.

## Features
- Add direct HTTP/HTTPS media file URLs
- Download queue with progress
- Pause and resume using HTTP Range requests when the server supports byte ranges
- Partial chunks persisted in IndexedDB, so a paused job can be resumed after reopening the app
- Completed download save-to-device action
- Completed, active, and failed filters
- Dark/light appearance

## Important limitations
This app downloads direct media file URLs that the server allows the browser/app to fetch. It does not extract video from YouTube, TikTok, Instagram, subscription services, DRM-protected streams, or other protected content. The remote server must allow CORS access. Resume requires HTTP Range support (`Accept-Ranges: bytes` / `206 Partial Content`). If the server does not support range requests, the app restarts that transfer from the beginning. Very large files may be limited by available browser/WebView storage and memory. Android background downloading while the app is closed requires a native background download service and is not provided by this starter.

## Run the web app
1. Install Node.js 20 or later.
2. In this folder run `npm install`.
3. Run `npm run dev` and open the local URL shown by Vite.
4. For a production build run `npm run build`.

Deploy the `dist` folder to a static host that serves HTTPS.

## Build Android APK
1. Install Node.js 20+, Android Studio, and Android SDK.
2. Run `npm install`.
3. Run `npm run build`.
4. Run `npx cap add android` (only once).
5. Run `npx cap sync android`.
6. Run `npx cap open android`.
7. In Android Studio choose Build > Build Bundle(s) / APK(s) > Build APK(s).

## Usage
Paste a direct media URL such as `https://your-domain.example/video.mp4`, then choose Add URL. Pause and Resume are available in the queue. Completed files are saved using your browser's download flow.

## Privacy
The app has no account system and does not upload a user's download list to a developer server. URLs and partial chunks are stored locally in the browser's IndexedDB.


## One-step deploy (web app + downloader together)
The web app and the yt-dlp downloader are a single service now: the backend serves the website, so users just open the site, paste a link and download. No API URL or Settings screen.

```bash
docker build -t any-video-downloader .
docker run -p 8000:8000 any-video-downloader   # open http://localhost:8000
```
Deploy the same Dockerfile to any container host (Render, Railway, Fly.io, a VPS). Without Docker: `npm install && npm run build`, then `cd backend && pip install -r requirements.txt && uvicorn main:app --port 8000` (install FFmpeg).

Direct media files (.mp4, .webm, .mp3 ...) download in-browser with pause/resume; every other link (YouTube, TikTok, Facebook, Instagram, Vimeo, X, Reddit and 1000+ more) is handled by yt-dlp on the server. Private/internal addresses are blocked, no cookies are used, and DRM/login-protected media is not supported. Use only content you are authorized to download.

Android APK: the app runs inside the phone, so build it with your deployed address: `VITE_API_BASE=https://your-site.example npm run build` before `npx cap sync android`.

Env vars: `CORS_ORIGINS`, `MAX_FILESIZE_MB` (default 1024). Add authentication and rate limits before public launch, and keep yt-dlp updated.
