// API du compte d'Eden : un seul compte, ses leçons, photos et progrès rangés dans Netlify Blobs.
// - Le code à 4 chiffres et le code parent ne sont jamais gardés : seulement leur empreinte PBKDF2 salée.
// - 5 erreurs de code bloquent le compte de plus en plus longtemps (30 s → 15 min), quel que soit l'appareil.
// - Un appareil connecté reçoit un jeton de session (90 jours), envoyé ensuite en « Authorization: Bearer ».
// - La création du compte exige le code d'activation SETUP_TOKEN (variable d'environnement), une seule fois.
import { getStore } from "@netlify/blobs";
import { pbkdf2Sync, randomBytes, createHash, timingSafeEqual } from "node:crypto";

const ITER = 200000, SESSION_DAYS = 90, MAX_JSON = 1_000_000, MAX_PHOTO = 4_000_000;
const ID = /^[A-Za-z0-9-]{8,64}$/, N = /^\d{1,2}$/;
const env = k => (globalThis.Netlify?.env?.get(k) ?? process.env[k] ?? "");
const store = () => getStore({ name: "revision6e", consistency: "strong" });
const sha = s => createHash("sha256").update(s).digest("hex");
const seal = secret => { const salt = randomBytes(16).toString("hex"); return { salt, hash: pbkdf2Sync(secret, salt, ITER, 32, "sha256").toString("hex") }; };
const same = (secret, rec) => {
  if (!rec || typeof secret !== "string") return false;
  const h = pbkdf2Sync(secret, rec.salt, ITER, 32, "sha256"), r = Buffer.from(rec.hash, "hex");
  return h.length === r.length && timingSafeEqual(h, r);
};

function cors(req) {
  const origin = req.headers.get("origin");
  const allowed = env("ALLOWED_ORIGINS").split(",").map(s => s.trim()).filter(Boolean);
  if (!origin || (!allowed.includes(origin) && origin !== new URL(req.url).origin)) return {};
  return { "access-control-allow-origin": origin, "access-control-allow-headers": "authorization, content-type",
    "access-control-allow-methods": "GET, PUT, POST, DELETE", "access-control-max-age": "86400", vary: "origin" };
}
const json = (req, status, body) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json", "cache-control": "no-store", ...cors(req) } });

async function openSession(db) {
  const token = randomBytes(32).toString("hex");
  await db.setJSON(`session/${sha(token)}`, { exp: Date.now() + SESSION_DAYS * 86400000 });
  return token;
}
async function session(req, db) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  const s = await db.get(`session/${sha(token)}`, { type: "json" });
  return s && s.exp > Date.now() ? token : null;
}
// Échec de code : compteur commun au code enfant et au code parent.
async function fail(db, acct) {
  acct.fails = (acct.fails || 0) + 1;
  if (acct.fails >= 5) acct.until = Date.now() + Math.min(900, 30 * 2 ** (acct.fails - 5)) * 1000;
  await db.setJSON("account", acct);
  return acct.until > Date.now() ? Math.ceil((acct.until - Date.now()) / 1000) : 0;
}
const waitOf = acct => (acct?.until > Date.now() ? Math.ceil((acct.until - Date.now()) / 1000) : 0);
async function readIndex(db) { return (await db.get("index", { type: "json" })) || { lessons: {}, metaAt: 0 }; }

export default async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  const path = new URL(req.url).pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const db = store();
  const acct = await db.get("account", { type: "json" });
  const body = async () => { const t = await req.text(); if (t.length > MAX_JSON) throw new Error("trop gros"); return t ? JSON.parse(t) : {}; };
  const [route, a, b] = path;

  try {
    // ---- sans session ----
    if (route === "health") return json(req, 200, { ok: true, account: !!acct });

    if (route === "setup" && req.method === "POST") {
      if (acct) return json(req, 409, { error: "compte déjà créé" });
      const { pin, parent, token } = await body();
      const expected = env("SETUP_TOKEN");
      if (!expected || typeof token !== "string" || token.trim() !== expected) return json(req, 403, { error: "code d'activation incorrect" });
      if (!/^\d{4}$/.test(pin || "") || typeof parent !== "string" || parent.trim().length < 6) return json(req, 400, { error: "codes invalides" });
      await db.setJSON("account", { pin: seal(pin), parent: seal(parent.trim()), fails: 0, until: 0, createdAt: Date.now() });
      return json(req, 200, { token: await openSession(db) });
    }

    if (route === "login" && req.method === "POST") {
      if (!acct) return json(req, 404, { error: "pas de compte" });
      if (waitOf(acct)) return json(req, 423, { wait: waitOf(acct) });
      const { pin } = await body();
      if (same(pin, acct.pin)) { acct.fails = 0; acct.until = 0; await db.setJSON("account", acct); return json(req, 200, { token: await openSession(db) }); }
      const wait = await fail(db, acct);
      return json(req, wait ? 423 : 401, { wait, fails: acct.fails });
    }

    if (route === "reset" && req.method === "POST") {   // code oublié : le code parent permet d'en choisir un nouveau
      if (!acct) return json(req, 404, { error: "pas de compte" });
      if (waitOf(acct)) return json(req, 423, { wait: waitOf(acct) });
      const { parent, pin } = await body();
      if (!same((parent || "").trim(), acct.parent)) { const wait = await fail(db, acct); return json(req, wait ? 423 : 401, { wait }); }
      if (!/^\d{4}$/.test(pin || "")) return json(req, 400, { error: "code invalide" });
      Object.assign(acct, { pin: seal(pin), fails: 0, until: 0 }); await db.setJSON("account", acct);
      return json(req, 200, { token: await openSession(db) });
    }

    // ---- avec session ----
    const token = await session(req, db);
    if (!token) return json(req, 401, { error: "session" });

    if (route === "logout" && req.method === "POST") { await db.delete(`session/${sha(token)}`); return json(req, 200, { ok: true }); }
    if (route === "pin" && req.method === "POST") {
      const { pin } = await body();
      if (!/^\d{4}$/.test(pin || "")) return json(req, 400, { error: "code invalide" });
      acct.pin = seal(pin); await db.setJSON("account", acct); return json(req, 200, { ok: true });
    }
    if (route === "parent" && req.method === "POST") {
      const { parent } = await body();
      if (typeof parent !== "string" || parent.trim().length < 6) return json(req, 400, { error: "code parent trop court" });
      acct.parent = seal(parent.trim()); await db.setJSON("account", acct); return json(req, 200, { ok: true });
    }
    if (route === "index" && req.method === "GET") return json(req, 200, await readIndex(db));

    if (route === "lesson" && ID.test(a || "")) {
      if (req.method === "GET") { const l = await db.get(`lesson/${a}`, { type: "json" }); return l ? json(req, 200, l) : json(req, 404, {}); }
      if (req.method === "PUT") {
        const l = await body(); if (l.id !== a) return json(req, 400, { error: "id" });
        const idx = await readIndex(db);
        if ((idx.lessons[a] || 0) > (l.updatedAt || 0)) return json(req, 409, { newer: idx.lessons[a] });   // le compte a plus récent
        await db.setJSON(`lesson/${a}`, l);
        idx.lessons[a] = l.updatedAt || Date.now(); await db.setJSON("index", idx);
        return json(req, 200, { ok: true });
      }
      if (req.method === "DELETE") {
        await db.delete(`lesson/${a}`);
        const { blobs } = await db.list({ prefix: `photo/${a}/` });
        for (const x of blobs) await db.delete(x.key);
        const idx = await readIndex(db); delete idx.lessons[a]; await db.setJSON("index", idx);
        return json(req, 200, { ok: true });
      }
    }
    if (route === "photo" && ID.test(a || "") && N.test(b || "")) {
      const key = `photo/${a}/${b}`;
      if (req.method === "GET") {
        const data = await db.get(key, { type: "arrayBuffer" });
        return data ? new Response(data, { headers: { "content-type": "image/jpeg", "cache-control": "private, max-age=31536000", ...cors(req) } }) : json(req, 404, {});
      }
      if (req.method === "PUT") {
        const data = await req.arrayBuffer(); if (data.byteLength > MAX_PHOTO) return json(req, 413, { error: "photo trop lourde" });
        await db.set(key, data); return json(req, 200, { ok: true });
      }
    }
    if (route === "meta") {
      if (req.method === "GET") return json(req, 200, (await db.get("meta", { type: "json" })) || {});
      if (req.method === "PUT") {
        const m = await body(), idx = await readIndex(db);
        if ((idx.metaAt || 0) > (m.at || 0)) return json(req, 409, { newer: idx.metaAt });
        await db.setJSON("meta", m);
        idx.metaAt = m.at || Date.now(); await db.setJSON("index", idx);
        return json(req, 200, { ok: true });
      }
    }
    return json(req, 404, { error: "inconnu" });
  } catch (e) {
    return json(req, 400, { error: String(e.message || e) });
  }
};

export const config = { path: "/api/*" };
