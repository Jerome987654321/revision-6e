// Banc d'essai local : sert dist/ et la fonction netlify/functions/api.mjs, avec le simulateur
// de stockage de Netlify Blobs (dossier .netlify/blobs-dev). Ne touche jamais au vrai compte en ligne.
// Usage : node scripts/build.mjs && SETUP_TOKEN=TEST-1234 node scripts/dev-server.mjs [port]
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { BlobsServer } from "@netlify/blobs/server";

const PORT = +(process.argv[2] || 8890);
const blobs = new BlobsServer({ directory: ".netlify/blobs-dev", token: "dev" });
const { port: blobsPort } = await blobs.start();
const edge = `http://localhost:${blobsPort}`;
process.env.NETLIFY_BLOBS_CONTEXT = Buffer.from(JSON.stringify({ siteID: "dev", token: "dev", edgeURL: edge, uncachedEdgeURL: edge })).toString("base64");
const { default: api } = await import("../netlify/functions/api.mjs");

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png" };
createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname.startsWith("/api/")) {
    const chunks = []; for await (const c of req) chunks.push(c);
    const body = ["GET", "HEAD", "OPTIONS"].includes(req.method) ? undefined : Buffer.concat(chunks);
    const r = await api(new Request(url, { method: req.method, headers: req.headers, body }));
    res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer()));
    return;
  }
  try {
    const file = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    const data = await readFile(join("dist", file));
    res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream" }); res.end(data);
  } catch { res.writeHead(404); res.end("introuvable"); }
}).listen(PORT, "127.0.0.1", () => console.log(`banc d'essai : http://localhost:${PORT}`));
