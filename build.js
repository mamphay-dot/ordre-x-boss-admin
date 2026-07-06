// Build : injecte config + bossnet + admin.js dans index.html → docs/
const fs = require("fs");

function readDotenv() {
  const p = ".env.local";
  if (!fs.existsSync(p)) return {};
  const out = {};
  fs.readFileSync(p, "utf8").split(/\r?\n/).forEach(line => {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) return;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1,-1);
    out[m[1]] = v;
  });
  return out;
}
const env = Object.assign({}, readDotenv(), process.env);
const SB_URL = env.SUPABASE_URL || "";
const SB_KEY = env.SUPABASE_ANON_KEY || "";

const configScript =
  "window.__BOSS_SUPABASE__ = window.__BOSS_SUPABASE__ || { url: " + JSON.stringify(SB_URL) +
  ", anonKey: " + JSON.stringify(SB_KEY) + " };";

const shell   = fs.readFileSync("index.html", "utf8");
const bossnet = fs.readFileSync("bossnet.js", "utf8");
const admin   = fs.readFileSync("admin.js",   "utf8");

const html = shell
  .replace("/*__SUPABASE_CONFIG__*/", () => configScript)
  .replace("/*__BOSSNET__*/",         () => bossnet)
  .replace("/*__ADMIN__*/",           () => admin);

fs.mkdirSync("docs", { recursive: true });
fs.writeFileSync("docs/index.html", html);
fs.writeFileSync("docs/CNAME", "admin.boss.ordre-x.com\n");
// Fichier .nojekyll pour GitHub Pages qui ignore les répertoires _*
fs.writeFileSync("docs/.nojekyll", "");

console.log("Build OK :", (html.length/1024).toFixed(1)+" Ko → docs/index.html");
