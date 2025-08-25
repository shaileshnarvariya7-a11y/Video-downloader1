import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { lookup as lookupMime } from "mime-types";
import fetch from "node-fetch"; // ✅ Render ke liye fetch fix

const app = express();
const PORT = process.env.PORT || 4000;

// Security middlewares
app.use(helmet());
app.use(express.json({ limit: "10kb" }));
app.use(cors());
app.use(express.static("public"));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

const MAX_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

function safeFilenameFromUrl(u) {
  try {
    const { pathname } = new URL(u);
    const base = pathname.split("/").pop() || "video";
    const clean = base.split("?")[0].split("#")[0];
    return clean.replace(/[^a-zA-Z0-9._-]/g, "_");
  } catch {
    return "video";
  }
}

function validateUrl(raw) {
  if (!raw || typeof raw !== "string") throw new Error("URL required");
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Invalid URL");
  }
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) throw new Error("Only http/https allowed");
  return url.toString();
}

async function headRequest(url) {
  try {
    const res = await fetch(url, { method: "HEAD" });
    if (!res.ok || !res.headers?.get("content-type")) {
      const res2 = await fetch(url, { method: "GET" });
      return res2;
    }
    return res;
  } catch {
    const res2 = await fetch(url, { method: "GET" });
    return res2;
  }
}

// Probe endpoint
app.get("/probe", async (req, res) => {
  try {
    const target = validateUrl(req.query.url);
    const head = await headRequest(target);
    const type = head.headers.get("content-type") || "";
    const len = parseInt(head.headers.get("content-length") || "0", 10) || 0;

    const filenameHint = safeFilenameFromUrl(target);
    let ext = lookupMime(type) ? "." + lookupMime(type).split("/").pop() : "";
    if (ext.includes("/")) ext = "";
    const filename = filenameHint.includes(".") ? filenameHint : filenameHint + ext;

    res.json({
      ok: true,
      contentType: type,
      contentLength: len,
      filename,
      tooLarge: len > 0 && len > MAX_SIZE_BYTES,
      isLikelyVideo: type.startsWith("video/"),
    });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message || "Probe failed" });
  }
});

// Download endpoint
app.get("/download", async (req, res) => {
  try {
    const target = validateUrl(req.query.url);
    const head = await headRequest(target);
    const type = head.headers.get("content-type") || "application/octet-stream";
    const len = parseInt(head.headers.get("content-length") || "0", 10) || 0;

    if (len && len > MAX_SIZE_BYTES)
      return res.status(413).json({ ok: false, error: "File too large (over 500MB)." });

    if (!type.startsWith("video/") && type !== "application/octet-stream")
      return res.status(415).json({ ok: false, error: "The URL does not appear to be a video." });

    const filenameHint = safeFilenameFromUrl(target);
    let ext = lookupMime(type) ? "." + lookupMime(type).split("/").pop() : "";
    if (ext.includes("/")) ext = "";
    const filename = filenameHint.includes(".") ? filenameHint : filenameHint + ext;

    const upstream = await fetch(target);
    if (!upstream.ok || !upstream.body)
      return res.status(502).json({ ok: false, error: "Source fetch failed." });

    res.setHeader("Content-Type", type);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    if (upstream.headers.get("content-length"))
      res.setHeader("Content-Length", upstream.headers.get("content-length"));

    const reader = upstream.body.getReader();
    res.on("close", () => {
      try {
        reader.cancel();
      } catch {}
    });

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      res.write(value);
      
    }
    res.end();
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message || "Download failed" });
  }
});

// Health check
app.get("/health", (_req, res) => res.json({ ok: true }));

// Start server
app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
const PORT = process.env.PORT || 4000;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});

        
