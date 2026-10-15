// Prépare dist/ pour Netlify : uniquement les fichiers de l'application (pas node_modules, ni le code serveur).
import { cpSync, mkdirSync, rmSync } from "node:fs";

const FILES = ["index.html", "sw.js", "manifest.webmanifest", "icon.svg", "icon-192.png", "icon-512.png"];
rmSync("dist", { recursive: true, force: true });
mkdirSync("dist");
for (const f of FILES) cpSync(f, `dist/${f}`);
console.log(`dist/ : ${FILES.length} fichiers`);
