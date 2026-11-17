const allowedExtensions = new Set([
  "mp4", "webm", "mov", "m4v", "mp3", "m4a", "aac", "wav", "ogg", "flac"
]);

export default function handler(req, res) {
  const origin = process.env.ALLOWED_ORIGIN || "https://anyd.netlify.app";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const raw = req.body?.url;
    if (typeof raw !== "string" || raw.length > 2048) {
      return res.status(400).json({ error: "Send a valid URL in JSON: { url: 'https://...' }" });
    }
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:") {
      return res.status(400).json({ error: "Only HTTPS links are accepted." });
    }
    if (parsed.username || parsed.password) {
      return res.status(400).json({ error: "URLs containing credentials are not accepted." });
    }
    const pathname = decodeURIComponent(parsed.pathname);
    const ext = pathname.split(".").pop()?.toLowerCase();
    if (!allowedExtensions.has(ext)) {
      return res.status(422).json({
        error: "This starter accepts direct media-file URLs only (MP4, WEBM, MOV, MP3, M4A, AAC, WAV, OGG, FLAC).",
        supportedExtensions: [...allowedExtensions]
      });
    }
    return res.status(200).json({
      ok: true,
      type: ["mp3", "m4a", "aac", "wav", "ogg", "flac"].includes(ext) ? "audio" : "video",
      format: ext,
      downloadUrl: parsed.toString(),
      note: "The browser downloads from the original host. The API does not proxy or store media."
    });
  } catch {
    return res.status(400).json({ error: "Invalid URL." });
  }
}
