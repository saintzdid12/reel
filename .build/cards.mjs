// Builds the site for GitHub Pages: copies everything into _site, then adds a small page at /@username for each
// person who has shared their profile, so the link shows a real preview (name, picture, favorites) in Discord,
// iMessage and so on. These pages exist only in the deployed site, never in the repo, so nobody can list users.
import fs from 'fs';
import path from 'path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const out = path.join(root, '_site');
const SKIP = new Set(['.git', '.github', '.build', '_site']);

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);
for (const name of fs.readdirSync(root)) if (!SKIP.has(name)) fs.cpSync(path.join(root, name), path.join(out, name), { recursive: true });

const token = process.env.REEL_CARDS_TOKEN;
if (!token) { console.log('No REEL_CARDS_TOKEN: built without profile previews.'); process.exit(0); }

const SB = 'https://tsuyeypohzfcjikuuknh.supabase.co', KEY = 'sb_publishable_mc8VFdYKE_sMALLgRGsZhw_QqkJPlTm';
const res = await fetch(`${SB}/rest/v1/rpc/profile_cards`, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_token: token }) });
if (!res.ok) { console.log(`Profile cards unavailable (${res.status}): built without previews.`); process.exit(0); }
const cards = await res.json();

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const list = (a) => (a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);
let n = 0;
for (const c of cards || []) {
  if (!/^[a-z0-9_.]{2,24}$/.test(c.username || '')) continue;
  const name = c.name || c.username;
  const bits = [];
  if (c.films != null) bits.push(`${c.films} film${c.films === 1 ? '' : 's'} watched`);
  if (c.avg != null) bits.push(`${c.avg} average rating`);
  const fav = (c.fav || []).filter(Boolean).slice(0, 4);
  const desc = [bits.length ? `${bits.join(', ')}.` : '', fav.length ? `Favorites: ${list(fav)}.` : '', !bits.length && !fav.length ? (c.bio || 'Ratings, reviews and favorites on Reel.') : ''].filter(Boolean).join(' ');
  const image = /^https:\/\//.test(c.avatar || '') ? c.avatar : c.poster ? `https://image.tmdb.org/t/p/w500${c.poster}` : 'https://reelwatch.stream/og.png';
  const url = `https://reelwatch.stream/@${c.username}`;
  const to = `/u/?${c.username}`;
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(name)} on Reel</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="profile">
<meta property="og:site_name" content="Reel">
<meta property="og:title" content="${esc(name)} on Reel">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${esc(image)}">
<meta name="twitter:card" content="summary">
<meta name="theme-color" content="#000000">
<link rel="icon" href="/icon.png">
<link rel="canonical" href="${url}">
<meta http-equiv="refresh" content="0; url=${to}">
<script>location.replace(${JSON.stringify(to)});</script>
<style>html,body{margin:0;background:#000;color:#f5f5f7;font:16px system-ui,sans-serif}</style>
</head>
<body><p style="padding:24px"><a href="${to}" style="color:#fff">${esc(name)}’s profile on Reel</a></p></body>
</html>
`;
  const dir = path.join(out, `@${c.username}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  n++;
}
console.log(`Built ${n} profile preview page(s).`);
