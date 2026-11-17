import os, shutil, socket, tempfile, ipaddress
from pathlib import Path
from urllib.parse import urlparse
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask
import yt_dlp
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="Any Video Downloader Pro API", version="2.0.0")
origins = [x.strip() for x in os.getenv("CORS_ORIGINS", "*").split(",") if x.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=False,
                   allow_methods=["GET"], allow_headers=["*"], expose_headers=["Content-Disposition"])

MAX_MB = int(os.getenv("MAX_FILESIZE_MB", "1024"))


def validate(raw: str):
    """Accept any public http(s) site; block private/internal addresses (SSRF protection)."""
    try:
        p = urlparse(raw)
        host = (p.hostname or "").lower()
        if p.scheme not in ("http", "https") or not host or p.username or p.password:
            raise ValueError()
        for info in socket.getaddrinfo(host, None):
            ip = ipaddress.ip_address(info[4][0])
            if (ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved
                    or ip.is_multicast or ip.is_unspecified):
                raise HTTPException(400, "This address is not allowed.")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(400, "Enter a valid public http(s) URL.")


def base_opts():
    return {"quiet": True, "no_warnings": True, "noplaylist": True, "socket_timeout": 20,
            "max_filesize": MAX_MB * 1024 * 1024, "allow_unplayable_formats": False}


@app.get("/health")
def health():
    return {"ok": True, "service": "Any Video Downloader Pro API"}


@app.get("/api/platform/info")
def info(url: str = Query(..., min_length=8, max_length=3000)):
    validate(url)
    try:
        with yt_dlp.YoutubeDL(base_opts()) as y:
            d = y.extract_info(url, download=False)
        return {"title": d.get("title"), "thumbnail": d.get("thumbnail"),
                "duration": d.get("duration"),
                "filesize": d.get("filesize") or d.get("filesize_approx")}
    except Exception:
        raise HTTPException(422, "Could not access this media. It may be private, unavailable, login-required, DRM-protected, or unsupported.")


@app.get("/api/platform/download")
def download(url: str = Query(..., min_length=8, max_length=3000),
             kind: str = Query("video", pattern="^(video|audio)$")):
    validate(url)
    temp = Path(tempfile.mkdtemp(prefix="avdp-"))
    cleanup = BackgroundTask(shutil.rmtree, temp, ignore_errors=True)
    opts = base_opts()
    opts.update({"outtmpl": str(temp / "%(title).70B-%(id)s.%(ext)s"), "restrictfilenames": True})
    if kind == "audio":
        opts.update({"format": "bestaudio/best",
                     "postprocessors": [{"key": "FFmpegExtractAudio", "preferredcodec": "mp3", "preferredquality": "192"}]})
    else:
        opts.update({"format": "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b", "merge_output_format": "mp4"})
    try:
        with yt_dlp.YoutubeDL(opts) as y:
            y.download([url])
        files = [p for p in temp.iterdir() if p.is_file()]
        if not files:
            raise RuntimeError("No media file was created.")
        target = max(files, key=lambda p: p.stat().st_size)
        mt = {".mp3": "audio/mpeg", ".mp4": "video/mp4", ".webm": "video/webm", ".mkv": "video/x-matroska"}.get(target.suffix.lower(), "application/octet-stream")
        return FileResponse(target, media_type=mt, filename=target.name, background=cleanup)
    except Exception:
        shutil.rmtree(temp, ignore_errors=True)
        raise HTTPException(422, "Download failed. The source may be restricted, DRM-protected, too large, unavailable, or unsupported.")


# Serve the built web app from the same origin (no separate API setup needed).
_dist = Path(os.getenv("STATIC_DIR", Path(__file__).resolve().parent.parent / "dist"))
if _dist.is_dir():
    app.mount("/", StaticFiles(directory=_dist, html=True), name="web")
