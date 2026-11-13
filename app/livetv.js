// Reel — Live TV (personal): a TV app for IPTV sources (Xtream logins or M3U playlists). Off unless switched on in
// Settings › Personal. Separate from the library: its own storage ("reel:tv"); logins live encrypted in the main process.
//
// Made for huge provider lists:
// • Duplicates ("TNT Sports 2 RAW / HD / UHD / backup") merge into ONE channel with a quality picker; if one version
//   fails, the next one plays automatically.
// • Divider rows ("#### UK SPORTS ####") and empty event channels ("PPV EVENT 7" with nothing on) are hidden.
// • Games are found in the TV guide AND in event-channel names ("NFL 03: Jaguars @ Ravens 8:15 PM ET").
// • Everything is tagged LIVE / REPLAY, and "Hide replays" keeps only what's actually live.
// Views: Home (live sports, my channels, keep watching) · Sports · TV Guide · Channels (list + player) · Multiview.
// Playback: hls.js / mpegts.js via Reel's local relay; reconnects, format fallback, auto audio fix, always at live.

// Icons used across Live TV (this used to come from the old Twitch tab, which has been removed).
const TWI = {
  chat: '<svg class="ic" viewBox="0 0 24 24"><path fill="currentColor" d="M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-8.6l-4.1 3.3A.8.8 0 0 1 5 19.7V17a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm0 2v9h2v2.3L10 15h9V6H5z"/></svg>',
  spot: '<svg class="ic" viewBox="0 0 24 24"><path fill="currentColor" d="M3 5.5A1.5 1.5 0 0 1 4.5 4h10A1.5 1.5 0 0 1 16 5.5v8a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 3 13.5zM5 6v7h9V6zm13-2h2.5A1.5 1.5 0 0 1 22 5.5V8a1.5 1.5 0 0 1-1.5 1.5H18zm0 7h2.5A1.5 1.5 0 0 1 22 12.5V15a1.5 1.5 0 0 1-1.5 1.5H18zM3 18h4v2H3zm6 0h4v2H9zm6 0h7v2h-7z"/></svg>',
  grid: '<svg class="ic" viewBox="0 0 24 24"><path fill="currentColor" d="M4 4h7v7H4zm2 2v3h3V6zm7-2h7v7h-7zm2 2v3h3V6zM4 13h7v7H4zm2 2v3h3v-3zm7-2h7v7h-7zm2 2v3h3v-3z"/></svg>',
  fill: '<svg class="ic" viewBox="0 0 24 24"><path fill="currentColor" d="M4 4h6v2H6v4H4zm10 0h6v6h-2V6h-4zM4 14h2v4h4v2H4zm14 0h2v6h-6v-2h4z"/></svg>',
  unfill: '<svg class="ic" viewBox="0 0 24 24"><path fill="currentColor" d="M8 4h2v6H4V8h4zm6 0h2v4h4v2h-6zM4 14h6v6H8v-4H4zm10 0h6v2h-4v4h-2z"/></svg>',
  side: '<svg class="ic" viewBox="0 0 24 24"><path fill="currentColor" d="M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm0 2v12h4V6zm6 0v12h8V6z"/></svg>',
  reload: '<svg class="ic" viewBox="0 0 24 24"><path fill="currentColor" d="M12 4a8 8 0 0 1 6.9 4H16v2h6V4h-2v2.3A10 10 0 1 0 22 12h-2a8 8 0 1 1-8-8z"/></svg>',
  gear: '<svg class="ic" viewBox="0 0 24 24"><path fill="currentColor" d="M10.3 2h3.4l.5 2.6c.6.2 1.2.6 1.7 1l2.5-.9 1.7 3-2 1.7a7 7 0 0 1 0 2l2 1.7-1.7 3-2.5-.9c-.5.4-1.1.8-1.7 1l-.5 2.8h-3.4l-.5-2.8c-.6-.2-1.2-.6-1.7-1l-2.5.9-1.7-3 2-1.7a7 7 0 0 1 0-2l-2-1.7 1.7-3 2.5.9c.5-.4 1.1-.8 1.7-1zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/></svg>',
  ext: '<svg class="ic" viewBox="0 0 24 24"><path fill="currentColor" d="M14 3h7v7h-2V6.4l-8.3 8.3-1.4-1.4L17.6 5H14zM5 5h6v2H6v11h11v-5h2v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/></svg>',
  copy: '<svg class="ic" viewBox="0 0 24 24"><path fill="currentColor" d="M8 3h11a1 1 0 0 1 1 1v12h-2V5H8zM4 7h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zm1 2v10h9V9z"/></svg>',
  plus: '<svg class="ic" viewBox="0 0 24 24"><path fill="currentColor" d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/></svg>',
  vol: '<svg class="ic" viewBox="0 0 24 24"><path fill="currentColor" d="M4 9h4l5-4v14l-5-4H4zm12.5-1.5a6 6 0 0 1 0 9l-1.4-1.4a4 4 0 0 0 0-6.2zM19 5a9.5 9.5 0 0 1 0 14l-1.4-1.4a7.5 7.5 0 0 0 0-11.2z"/></svg>',
  mute: '<svg class="ic" viewBox="0 0 24 24"><path fill="currentColor" d="M4 9h4l5-4v14l-5-4H4zm11.3.7 1.4-1.4 2.3 2.3 2.3-2.3 1.4 1.4-2.3 2.3 2.3 2.3-1.4 1.4-2.3-2.3-2.3 2.3-1.4-1.4 2.3-2.3z"/></svg>',
  play: '<svg class="ic" viewBox="0 0 24 24"><path fill="currentColor" d="M7 4.5v15a1 1 0 0 0 1.5.9l12-7.5a1 1 0 0 0 0-1.8l-12-7.5A1 1 0 0 0 7 4.5z"/></svg>',
  pause: '<svg class="ic" viewBox="0 0 24 24"><path fill="currentColor" d="M6 4h4v16H6zm8 0h4v16h-4z"/></svg>',
  more: '<svg class="ic" viewBox="0 0 24 24"><path fill="currentColor" d="M5 10.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm7 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm7 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z"/></svg>',
  x: '<svg class="ic" viewBox="0 0 24 24"><path fill="currentColor" d="M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6 10.6 12 5 6.4z"/></svg>',
  trash: '<svg class="ic" viewBox="0 0 24 24"><path fill="currentColor" d="M9 3h6l1 2h4v2H4V5h4zM6 9h12l-1 11a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1zm3 2v8h2v-8zm4 0v8h2v-8z"/></svg>',
  stack: '<svg class="ic" viewBox="0 0 24 24"><path fill="currentColor" d="M12 3 22 8l-10 5L2 8zm0 2.2L6.5 8 12 10.8 17.5 8zM4.2 11.4 12 15.3l7.8-3.9 2.2 1.1-10 5-10-5zm0 4.5L12 19.8l7.8-3.9 2.2 1.1-10 5-10-5z"/></svg>',
  user: '<svg class="ic" viewBox="0 0 24 24"><path fill="currentColor" d="M12 3a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9zm0 2a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zm0 8c4.4 0 8 2.2 8 5v3H4v-3c0-2.8 3.6-5 8-5zm0 2c-3.4 0-6 1.5-6 3v1h12v-1c0-1.5-2.6-3-6-3z"/></svg>',
  tv: '<svg class="ic" viewBox="0 0 24 24"><path fill="currentColor" d="M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-6v1h3v2H7v-2h3v-1H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zm0 2v10h16V7zm6 2 5 3-5 3z"/></svg>',
  theater: '<svg class="ic" viewBox="0 0 24 24"><path fill="currentColor" d="M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zm2 0v12h14V6zm2 2h10v8H7z"/></svg>',
  check: '<svg class="ic" viewBox="0 0 24 24"><path fill="currentColor" d="M9.5 16.2 4.8 11.5l-1.4 1.4 6.1 6.1L21 7.5l-1.4-1.4z"/></svg>',
  heart: '<svg class="ic" viewBox="0 0 24 24"><path fill="currentColor" d="M12 21s-7.5-4.6-9.6-9.3C.9 8.3 3 4.5 6.8 4.5c2.1 0 3.6 1.1 4.6 2.6 1-1.5 2.5-2.6 4.6-2.6 3.8 0 5.9 3.8 4.4 7.2C19.5 16.4 12 21 12 21z"/></svg>',
  fire: '<svg class="ic" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2s5 4.5 5 9.5a5 5 0 0 1-10 0c0-1.8.8-3.3 1.6-4.3.1 1.6 1 2.8 2.4 2.8 0 0-1.5-3.8 1-8zm0 20a8 8 0 0 1-8-8c0-2.4 1-4.7 2.6-6.3-.4 4.3 2.5 6.3 2.5 6.3S8 10 12 6c0 0 4 3.5 4 8a4 4 0 0 1-8 0c-1.6 1-2 3-1.4 4.6A8 8 0 0 0 12 22z"/></svg>',
  moon: '<svg class="ic" viewBox="0 0 24 24"><path fill="currentColor" d="M12.3 3a7 7 0 0 0 8.7 8.7A9 9 0 1 1 12.3 3zm-2.6 2.6a7 7 0 1 0 8.7 8.7 9 9 0 0 1-8.7-8.7z"/></svg>',
};

const TVI = {
  home: '<svg class="ic" viewBox="0 0 24 24"><path fill="currentColor" d="M12 3 3 10v11h6v-6h6v6h6V10zm0 2.5 7 5.4V19h-2v-6H7v6H5v-8.1z"/></svg>',
  tv: '<svg class="ic" viewBox="0 0 24 24"><path fill="currentColor" d="M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-6v1h3v2H7v-2h3v-1H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zm0 2v10h16V7z"/></svg>',
  trophy: '<svg class="ic" viewBox="0 0 24 24"><path fill="currentColor" d="M7 3h10v2h4v3a4 4 0 0 1-4 4h-.3A5 5 0 0 1 13 15v2h3v2H8v-2h3v-2a5 5 0 0 1-3.7-3H7a4 4 0 0 1-4-4V5h4zm0 4H5v1a2 2 0 0 0 2 2zm10 0v3a2 2 0 0 0 2-2V7zM9 5v5a3 3 0 0 0 6 0V5z"/></svg>',
  guide: '<svg class="ic" viewBox="0 0 24 24"><path fill="currentColor" d="M3 5h4v3H3zm6 0h12v3H9zM3 10.5h4v3H3zm6 0h7v3H9zm9 0h3v3h-3zM3 16h4v3H3zm6 0h4v3H9zm6 0h6v3h-6z"/></svg>',
  multi: '<svg class="ic" viewBox="0 0 24 24"><path fill="currentColor" d="M3 4h8v7H3zm2 2v3h4V6zm8-2h8v7h-8zm2 2v3h4V6zM3 13h8v7H3zm2 2v3h4v-3zm8-2h8v7h-8zm2 2v3h4v-3z"/></svg>',
  star: '<svg class="ic" viewBox="0 0 24 24"><path fill="currentColor" d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8l-5.4 2.9 1.1-6.1L3.2 9.4l6.1-.8zm0 4.5-1.4 3-3.2.4 2.4 2.2-.6 3.2 2.8-1.5 2.8 1.5-.6-3.2 2.4-2.2-3.2-.4z"/></svg>',
  starFill: '<svg class="ic" viewBox="0 0 24 24"><path fill="currentColor" d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8l-5.4 2.9 1.1-6.1L3.2 9.4l6.1-.8z"/></svg>',
  clock: '<svg class="ic" viewBox="0 0 24 24"><path fill="currentColor" d="M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zm0 2a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm1 2v4.6l3.2 1.9-1 1.7L11 12.7V7z"/></svg>',
  list: '<svg class="ic" viewBox="0 0 24 24"><path fill="currentColor" d="M4 5h2v2H4zm4 0h12v2H8zM4 11h2v2H4zm4 0h12v2H8zm-4 6h2v2H4zm4 0h12v2H8z"/></svg>',
  rewind: '<svg class="ic" viewBox="0 0 24 24"><path fill="currentColor" d="M12 5V2L7 6l5 4V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z"/><text x="12" y="16.5" font-size="6.5" text-anchor="middle" fill="currentColor" font-family="Inter,sans-serif" font-weight="700">10</text></svg>',
  bell: '<svg class="ic" viewBox="0 0 24 24"><path fill="currentColor" d="M12 3a6 6 0 0 1 6 6v4l2 3v1H4v-1l2-3V9a6 6 0 0 1 6-6zm0 2a4 4 0 0 0-4 4v4.6L7 15h10l-1-1.4V9a4 4 0 0 0-4-4zm-2 13h4a2 2 0 0 1-4 0z"/></svg>',
  bellOn: '<svg class="ic" viewBox="0 0 24 24"><path fill="currentColor" d="M12 3a6 6 0 0 1 6 6v4l2 3v1H4v-1l2-3V9a6 6 0 0 1 6-6zm-2 15h4a2 2 0 0 1-4 0z"/></svg>',
  replay: '<svg class="ic" viewBox="0 0 24 24"><path fill="currentColor" d="M12 4a8 8 0 1 1-7.7 10h2.1A6 6 0 1 0 12 6c-1.7 0-3.2.7-4.3 1.8L10 10H4V4l2.3 2.3A8 8 0 0 1 12 4zm-1 4.5 5 3.5-5 3.5z"/></svg>',
  audio: '<svg class="ic" viewBox="0 0 24 24"><path fill="currentColor" d="M3 10h3l4-4v12l-4-4H3zm13-3h2v10h-2zm-3 3h2v4h-2zm6-1h2v6h-2z"/></svg>',
  live: '<svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2" fill="currentColor"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M7.8 7.8a6 6 0 0 0 0 8.4m8.4 0a6 6 0 0 0 0-8.4M5 5a10 10 0 0 0 0 14m14 0a10 10 0 0 0 0-14"/></svg>',
  edit: '<svg class="ic" viewBox="0 0 24 24"><path fill="currentColor" d="M4 17.3V20h2.7l8-8L12 9.3zm11.4-11.4 2.7 2.7 1.5-1.5a1 1 0 0 0 0-1.4l-1.3-1.3a1 1 0 0 0-1.4 0z"/></svg>',
  link: '<svg class="ic" viewBox="0 0 24 24"><path fill="currentColor" d="M10.6 13.4a1 1 0 0 1 0-1.4l3.5-3.5a3 3 0 0 1 4.2 4.2l-2 2-1.4-1.4 2-2a1 1 0 0 0-1.4-1.4L12 13.4a1 1 0 0 1-1.4 0zm2.8-2.8a1 1 0 0 1 0 1.4l-3.5 3.5a3 3 0 0 1-4.2-4.2l2-2 1.4 1.4-2 2a1 1 0 0 0 1.4 1.4L12 10.6a1 1 0 0 1 1.4 0z"/></svg>',
  info: '<svg class="ic" viewBox="0 0 24 24"><path fill="currentColor" d="M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zm0 2a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm-1 6h2v6h-2zm0-3h2v2h-2z"/></svg>',
  wand: '<svg class="ic" viewBox="0 0 24 24"><path fill="currentColor" d="m14.5 3 .9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9zM19 9l.6 1.4L21 11l-1.4.6L19 13l-.6-1.4L17 11l1.4-.6zM6 10l1.2 2.8L10 14l-2.8 1.2L6 18l-1.2-2.8L2 14l2.8-1.2zm8.7 1.3 1.4 1.4-8.4 8.4-1.4-1.4z"/></svg>',
};
const tvTime = (t) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const tvDay = (t) => { const d = new Date(t), n = new Date(); const diff = Math.round((new Date(d.toDateString()) - new Date(n.toDateString())) / 864e5); return diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : diff === -1 ? 'Yesterday' : d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' }); };
const tvLeft = (ms) => { const m = Math.max(0, Math.round(ms / 60000)); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`; };

// ---------- channel-name cleanup (generic: works for any provider's naming) ----------
const tvNorm = (n) => String(n || '').normalize('NFKD');                 // "ᴴᴰ" → "HD", "³⁸⁴⁰ᴾ" → "3840P"
const TV_SEP = /^[\s#=*~_\-•|.]{3,}|#{3,}|={3,}|-{4,}|\*{3,}/;          // "#### UK SPORTS ####" divider rows
const TV_QUAL = /\b(uhd|fhd|hd|sd|4k|8k|raw|hevc|h\.?265|1080[pi]?|720p?|2160p?|3840p?|50 ?fps|60 ?fps|fps|backup|bk|alt|hdr|vip)\b/gi;
function tvBase(n) {
  return tvNorm(n).replace(/^\s*[A-Z]{2,4}\s*[|:]\s*/, '').replace(/[\[(][^\])]*[\])]/g, ' ').replace(TV_QUAL, ' ')
    .replace(/[^\p{L}\p{N}+&'!.:@\- ]/gu, ' ').replace(/\s+/g, ' ').replace(/[\s:\-]+$/, '').trim();
}
function tvQual(n) {
  const s = tvNorm(n).toLowerCase();
  let q = /\b(uhd|4k|8k|2160p?|3840p?)\b/.test(s) ? 'UHD' : /\braw\b/.test(s) ? 'RAW' : /\b(fhd|1080[pi]?)\b/.test(s) ? 'FHD' : /\bhd\b|\b720p?\b/.test(s) ? 'HD' : /\bsd\b/.test(s) ? 'SD' : '';
  if (/\b(backup|bk|alt)\b|\(\d\)\s*$/.test(s)) q = (q ? q + ' ' : '') + 'Backup';
  return q;
}
const tvRank = (q) => ({ FHD: 0, HD: 1, '': 2, UHD: 3, RAW: 4, SD: 5 }[q.replace(' Backup', '')] ?? 2) + (/Backup/.test(q) ? 0.5 : 0);
const TV_EVT = /\b(event|events|ppv|pay ?per ?view|eventos?)\b/i;
const TV_NUMBERED = /\b(nfl|nba|nhl|mlb|ncaa[fb]?|cfb|mls|epl|ufc|espn\+?|peacock|dazn|fifa\+?|uefa|paramount\+?|max|apple ?tv|prime|f1|masters|bally|fubo|flo\w*|nbcsn|willow|tsn\+?|sportsnet\+?|ligue ?1|laliga|serie a|bundesliga|game ?pass|league ?pass|center ?ice|ppv|match|game)\s*(\d{1,3})\b/i;
const TV_EMPTY = /no event|offline|off air|\btba\b|to be announced|not live|no (live )?stream|coming soon|stand ?by|no game|no match|no programming/i;
const TV_MATCH = /\s(vs?\.?|v|@|at)\s/i;
const TV_TIME = /(?:\s*[@|\-–]\s*|\s+)(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)|\d{1,2}:\d{2})\s*(et|est|edt|pt|pst|pdt|ct|cst|mt|uk|gmt|bst|cet|cest)?.*$/i;
const TV_LEAGUES = [['NFL', /\bnfl\b|redzone/i], ['College Football', /\bncaaf\b|\bcfb\b|college football/i], ['NBA', /\bnba\b/i], ['College Basketball', /\bncaab\b|college basketball/i],
  ['NHL', /\bnhl\b/i], ['MLB', /\bmlb\b/i], ['MLS', /\bmls\b/i], ['Premier League', /premier league|\bepl\b/i], ['Champions League', /champions league|\bucl\b/i],
  ['UFC', /\bufc\b|\bmma\b/i], ['Boxing', /boxing|\bdazn\b/i], ['F1', /\bf1\b|formula/i], ['Soccer', /soccer|uefa|fifa|laliga|serie a|bundesliga|ligue/i], ['Golf', /golf|masters|pga/i], ['Tennis', /tennis|atp|wta/i]];
const tvLeagueOf = (s) => (TV_LEAGUES.find(([, re]) => re.test(s)) || ['Sports'])[0];
const tvLogo = (c, cls = '') => `<span class="tv-logo ${cls}">${c && c.l ? `<img src="${esc(c.l)}" alt="" loading="lazy" onerror="this.remove()">` : ''}<b>${esc(String((c && c.n) || '?').replace(/[^a-z0-9 ]/gi, '').trim().slice(0, 4).toUpperCase())}</b></span>`;

// ======================================================================
// LivePlayer — one video + one engine: reconnects, format fallback, audio fix, failover to another quality, at live.
// ======================================================================
class LivePlayer {
  constructor(host, { onStatus, onPlaying, onDead, onBlack } = {}) {
    this.host = host;
    this.video = document.createElement('video');
    this.video.playsInline = true;
    this.video.autoplay = true;
    host.appendChild(this.video);
    this.onStatus = onStatus || (() => {});
    this.onPlaying = onPlaying || (() => {});
    this.onDead = onDead || (() => null);
    this.onBlack = onBlack || (() => {});
    this.canvas = document.createElement('canvas'); this.canvas.width = 32; this.canvas.height = 18;
    this.gen = 0;
  }
  profile() {
    const p = (LiveTV.st && LiveTV.st.latency) || 'balanced';
    return {
      hls: Object.assign({ enableWorker: true, backBufferLength: 1800, fragLoadingMaxRetry: 6, manifestLoadingMaxRetry: 4, levelLoadingMaxRetry: 4, startFragPrefetch: true,
        startPosition: -1, liveMaxLatencyDurationCount: Infinity, maxLiveSyncPlaybackRate: 1 },
        p === 'low' ? { lowLatencyMode: true, liveSyncDurationCount: 2, maxBufferLength: 12 } : p === 'stable' ? { liveSyncDurationCount: 4, maxBufferLength: 60, maxMaxBufferLength: 120 } : { liveSyncDurationCount: 3, maxBufferLength: 30 }),
      ts: { enableWorker: true, lazyLoad: false, autoCleanupSourceBuffer: true, autoCleanupMaxBackwardDuration: 1800, autoCleanupMinBackwardDuration: 1200,
        liveBufferLatencyChasing: false, enableStashBuffer: p !== 'low', stashInitialSize: p === 'stable' ? 1024 * 1024 : 384 * 1024 },
    };
  }
  async load(key, opts = {}) {
    this.key = key; this.opts = opts; this.attempt = 0; this.everPlayed = false; this.flipped = false; this.userBehind = false;
    this.src = String(key).split(':')[0];
    this.alt = !opts.catchup && !!(LiveTV.st.fmtAlt || {})[this.src];
    this.compat = !!(LiveTV.st.compat[key]) || !!opts.compat;
    this.transcode = !!((LiveTV.st.transcode || {})[key]);
    if (this.transcode) this.compat = true;
    this.blackReported = false; this.ignoreBlack = false;
    return this.start();
  }
  async start() {
    const gen = ++this.gen;
    this.teardown();
    this.startedAt = Date.now();
    this.onStatus('loading', this.attempt ? `Reconnecting… (${this.attempt})` : 'Connecting…');
    let info;
    try { info = await window.reel.iptv.play(this.key, { compat: this.compat, transcode: this.transcode, alt: this.alt, catchup: this.opts.catchup }); }
    catch (e) { if (gen === this.gen) this.onStatus('error', cleanErr(e)); return; }
    if (gen !== this.gen) return;
    this.type = info.type;
    const v = this.video, prof = this.profile();
    if (info.type === 'hls' && window.Hls && Hls.isSupported()) {
      const hls = this.hls = new Hls(prof.hls);
      hls.on(Hls.Events.MANIFEST_PARSED, (_, d) => {
        const ac = (d.levels || []).map((l) => l.audioCodec || '').concat((hls.audioTracks || []).map((t) => t.audioCodec || '')).join(',');
        if (/ac-3|ec-3|ac3|eac3/i.test(ac) && !this.compat) return this.fix('audio');
        const vc = (d.levels || []).map((l) => l.videoCodec).find(Boolean);
        if (vc && !this.transcode && window.MediaSource && !MediaSource.isTypeSupported(`video/mp4; codecs="${vc}"`)) return this.fixVideo();
      });
      hls.on(Hls.Events.ERROR, (_, d) => {
        if (!d.fatal) return;
        if (d.type === Hls.ErrorTypes.MEDIA_ERROR && !this.mediaRecovered) { this.mediaRecovered = true; hls.recoverMediaError(); return; }
        this.fail(d.details || 'error');
      });
      hls.loadSource(info.url);
      hls.attachMedia(v);
    } else if (window.mpegts && mpegts.isSupported()) {
      const p = this.ts = mpegts.createPlayer({ type: 'mpegts', isLive: !this.opts.catchup, url: info.url }, prof.ts);
      p.on(mpegts.Events.ERROR, (type, detail) => this.fail(`${type}:${detail}`));
      p.on(mpegts.Events.MEDIA_INFO, (mi) => { const vc = mi && mi.videoCodec; if (vc && !this.transcode && window.MediaSource && !MediaSource.isTypeSupported(`video/mp4; codecs="${vc}"`)) this.fixVideo(); });
      p.attachMediaElement(v);
      p.load();
    } else { this.onStatus('error', 'This stream type can’t be played here.'); return; }
    this.applyVolume();
    v.playbackRate = 1;
    v.play().catch(() => {});
    // Watchdog: frozen picture → reconnect · silent audio → audio fix · drifting behind → gently catch up to live.
    let lastT = -1, still = 0, okSince = 0, checkedAudio = false, checkedVideo = false, black = 0;
    this.wd = setInterval(() => {
      if (gen !== this.gen) return;
      if (this.userPaused) { still = 0; return; }
      // Paused by something other than you (a hiccup in the stream, media keys, headphones reconnecting): keep watching.
      if (v.paused && okSince) { still = 0; v.play().catch(() => {}); return; }
      if (v.currentTime !== lastT && v.readyState >= 3) {
        lastT = v.currentTime; still = 0; this.nudges = 0;
        if (!okSince) {
          okSince = Date.now(); this.everPlayed = true; this.onStatus('playing'); this.onPlaying(this.key);
          if (!this.opts.catchup && !this.compat) { const f = LiveTV.st.fmtAlt || (LiveTV.st.fmtAlt = {}); if (!!f[this.src] !== this.alt) { f[this.src] = this.alt; LiveTV.save(); } }
          // (No seek here: streams already open at live. Seeking during start-up caused a visible jump.)
        }
        if (Date.now() - okSince > 30000) this.attempt = 0;
        if (!checkedAudio && Date.now() - okSince > 5000 && LiveTV.st.autoFix) {
          checkedAudio = true;
          if (v.webkitAudioDecodedByteCount === 0 && v.webkitVideoDecodedByteCount > 0 && !this.compat && !v.muted) this.fix('audio');
        }
        // Sound but no picture → the video format isn't decodable here: convert it.
        if (!checkedVideo && Date.now() - okSince > 6000) {
          checkedVideo = true;
          if ((v.videoWidth === 0 || v.webkitVideoDecodedByteCount === 0) && !this.transcode) return this.fixVideo();
        }
        // A picture that stays completely black → tell the app (Game Day tries the next feed).
        if (!this.blackReported && !this.ignoreBlack && Date.now() - okSince > 5000 && v.videoWidth) {
          let dark = false;
          try {
            const c = this.canvas.getContext('2d', { willReadFrequently: true });
            c.drawImage(v, 0, 0, 32, 18);
            const d = c.getImageData(0, 0, 32, 18).data;
            let mx = 0; for (let i = 0; i < d.length; i += 4) mx = Math.max(mx, d[i], d[i + 1], d[i + 2]);
            dark = mx < 26;
          } catch {}
          black = dark ? black + 2 : 0;
          if (black >= 16) { this.blackReported = true; this.onBlack(this.key); }
        }
        if (this.ts && !this.opts.catchup && !this.userBehind) {
          const bh = this.behind();
          if (Date.now() - okSince > 8000) {                       // let start-up settle first
            // Always normal speed: speeding up (even 4%) makes 60 fps sports drop frames on a 60 Hz screen, which
            // looks like a constant little freeze-and-skip. Far behind live (30 s+) → one jump instead.
            if (v.playbackRate !== 1) v.playbackRate = 1;
            if (bh > 30) this.goLive();
          }
        }
        if (this.userBehind && this.behind() < 2) this.userBehind = false;
      } else if (okSince && this.skipGap()) { still = 0;                   // stuck at a small hole: hop it, don't reconnect
      } else if (++still >= (okSince || this.everPlayed ? 6 : 4)) { okSince = 0; this.fail('stall'); }
      else if (still >= 2) this.onStatus('buffering');
    }, 2000);
    v.onplaying = () => { if (gen === this.gen) this.onStatus('playing'); };
    v.onpause = () => { if (gen === this.gen && !this.userPaused && !this.dead) setTimeout(() => { if (gen === this.gen && v.paused && !this.userPaused) v.play().catch(() => {}); }, 400); };
    v.onwaiting = () => {
      if (gen !== this.gen) return;
      this.onStatus('buffering');
      clearTimeout(this.gapT); this.gapT = setTimeout(() => { if (gen === this.gen && v.readyState < 3) this.skipGap(); }, 400);
    };
  }
  fix(reason) {
    this.compat = true;
    LiveTV.st.compat[this.key] = true; LiveTV.save();
    if (reason === 'audio') toast('Fixed this channel’s audio — it uses a format your PC can’t play directly');
    this.start();
  }
  fixVideo() {
    if (this.transcode) return;
    this.transcode = true; this.compat = true;
    (LiveTV.st.transcode || (LiveTV.st.transcode = {}))[this.key] = true; LiveTV.save();
    toast('This feed uses a video format your PC can’t show — converting it');
    this.start();
  }
  fail() {
    if (this.dead) return;
    this.attempt++;
    const cu = !!this.opts.catchup;
    // A version that never starts (or keeps dying) → switch to the channel's next quality, if it has one.
    if (!cu && ((!this.everPlayed && this.attempt === 3) || this.attempt === 5)) {
      const next = this.onDead(this.key);
      if (next && next !== this.key) {
        this.key = next; this.attempt = 0; this.everPlayed = false; this.flipped = false;
        this.compat = !!LiveTV.st.compat[next];
        clearTimeout(this.retryT); this.retryT = setTimeout(() => this.start(), 300);
        return;
      }
    }
    if (cu && !this.everPlayed && this.attempt === 1 && !this.compat) this.compat = true;
    else if (!cu && !this.compat && !this.flipped && (this.attempt === 2 || (this.attempt === 1 && !this.everPlayed))) { this.alt = !this.alt; this.flipped = true; }
    else if (this.attempt >= 2 && !this.compat && LiveTV.st.autoFix) this.compat = true;
    if (this.attempt > 7) { this.teardown(); this.onStatus('error', 'This channel isn’t responding right now.'); return; }
    this.onStatus('loading', `Reconnecting… (${this.attempt})`);
    clearTimeout(this.retryT);
    this.retryT = setTimeout(() => this.start(), Math.min(8000, 600 * 2 ** Math.min(this.attempt, 4)));
  }
  teardown() {
    clearInterval(this.wd); clearTimeout(this.retryT); clearTimeout(this.gapT);
    this.mediaRecovered = false; this.userPaused = false;
    try { if (this.hls) this.hls.destroy(); } catch {}
    try { if (this.ts) { this.ts.pause(); this.ts.unload(); this.ts.detachMediaElement(); this.ts.destroy(); } } catch {}
    this.hls = null; this.ts = null;
    try { this.video.removeAttribute('src'); this.video.load(); } catch {}
  }
  running() { return !!(this.hls || this.ts); }
  stop() { this.gen++; this.teardown(); this.key = this.key; this.onStatus('idle'); }
  destroy() { this.dead = true; this.stop(); this.video.remove(); }
  applyVolume(muted) {
    const st = LiveTV.st;
    this.video.volume = Math.max(0, Math.min(1, st.volume));
    this.video.muted = muted !== undefined ? muted : st.muted;
  }
  setBehind(on) {
    this.userBehind = on;
    if (this.hls) { this.hls.config.maxLiveSyncPlaybackRate = 1; }
    if (on) this.video.playbackRate = 1;
  }
  togglePause() {
    const v = this.video;
    if (v.paused) { this.userPaused = false; v.play().catch(() => {}); }
    else { this.userPaused = true; this.setBehind(true); v.pause(); }
  }
  // How much video is really loaded past the current spot. Some channels carry a timing glitch that makes the player
  // report minutes of video ahead after only a few seconds of playing; jumping to that "live edge" lands past the real
  // footage (black picture, then a reconnect). You can't be further ahead than the time since this stream started.
  // Live streams sometimes have a tiny hole (a few frames missing). The browser stops dead at the hole even when
  // plenty of video is loaded right after it, which looks like a frozen spinner and ends in a reconnect.
  // If we're stuck at the end of a loaded piece and the next piece starts within 3 s, hop over the hole.
  skipGap() {
    const v = this.video, b = v.buffered, t = v.currentTime;
    for (let i = 0; i < b.length - 1; i++) {
      const end = b.end(i), next = b.start(i + 1);
      if (t >= b.start(i) - 0.1 && t >= end - 0.35 && t <= next + 0.05 && next - end < 3) {
        try { v.currentTime = next + 0.05; } catch { return false; }
        v.play().catch(() => {});
        return true;
      }
    }
    // Stuck just before the start of the only loaded piece (it begins a little ahead of us): move into it.
    if (b.length && t < b.start(0) && b.start(0) - t < 3) { try { v.currentTime = b.start(0) + 0.05; } catch { return false; } return true; }
    // Stuck in the middle of loaded video (the decoder hiccuped): nudge forward a little, up to 3 times, before reconnecting.
    for (let i = 0; i < b.length; i++) {
      if (t >= b.start(i) && b.end(i) - t > 1.2 && (this.nudges || 0) < 3) {
        this.nudges = (this.nudges || 0) + 1;
        try { v.currentTime = t + 0.25 * this.nudges; } catch { return false; }
        v.play().catch(() => {});
        return true;
      }
    }
    return false;
  }
  // Numbers for the Stream info panel (press I): is it the stream, or this PC?
  stats() {
    const v = this.video, q = v.getVideoPlaybackQuality ? v.getVideoPlaybackQuality() : {};
    const now = performance.now(), frames = q.totalVideoFrames || 0, dropped = q.droppedVideoFrames || 0;
    const p = this._st || { at: now, frames, dropped };
    const dt = Math.max(0.001, (now - p.at) / 1000);
    const fps = (frames - p.frames) / dt, dropRate = (dropped - p.dropped) / dt;
    this._st = { at: now, frames, dropped };
    let kbps = 0;
    try {
      if (this.ts && this.ts.statisticsInfo) kbps = (this.ts.statisticsInfo.speed || 0) * 8;   // KB/s → kbit/s
      else if (this.hls) { const lv = this.hls.levels && this.hls.levels[this.hls.currentLevel]; kbps = lv && lv.bitrate ? lv.bitrate / 1000 : (this.hls.bandwidthEstimate || 0) / 1000; }
    } catch {}
    const a = this.realAhead();
    return { w: v.videoWidth, h: v.videoHeight, fps, dropRate, dropped, kbps, ahead: a > 0 ? a : 0, rate: v.playbackRate,
      mode: this.transcode ? 'Converted (picture + sound)' : this.compat ? 'Sound converted' : this.type === 'hls' ? 'Direct (HLS)' : 'Direct (TS)' };
  }
  realAhead() {
    const v = this.video, b = v.buffered;
    if (!b.length) return 0;
    const ahead = b.end(b.length - 1) - v.currentTime;
    const possible = (Date.now() - (this.startedAt || Date.now())) / 1000 + 6;
    return ahead > possible ? -1 : ahead;          // -1 = not believable, so don't act on it
  }
  liveEdge() {
    const v = this.video;
    if (this.hls && this.hls.liveSyncPosition) return this.hls.liveSyncPosition;
    const a = this.realAhead();
    return a > 0 ? v.currentTime + a - 1 : v.currentTime;
  }
  behind() {
    if (this.hls) { const lat = this.hls.latency, tgt = this.hls.targetLatency; if (isFinite(lat) && isFinite(tgt)) return Math.max(0, lat - tgt); }
    const a = this.realAhead();
    return a > 0 ? Math.max(0, a - 1.5) : 0;
  }
  goLive() {
    this.userPaused = false; this.setBehind(false);
    const v = this.video, edge = this.liveEdge();
    try { if (edge > v.currentTime + 1) v.currentTime = edge; } catch {}   // only ever forward
    v.play().catch(() => {});
  }
  seekBy(sec) {
    const v = this.video, b = v.buffered;
    if (!b.length) return;
    if (sec < 0) this.setBehind(true);
    try { v.currentTime = Math.max(b.start(0) + 0.5, Math.min(this.liveEdge(), v.currentTime + sec)); } catch {}
  }
}

// ======================================================================
// LiveTV — "Game Day": a sports app for NFL, NBA and College Football on top of your IPTV source.
// Real schedule, live status and scores come from ESPN's public scoreboard; streams come from your channel list.
// ======================================================================
const GD_LEAGUES = [['nfl', 'NFL', 'NFL'], ['cfb', 'College Football', 'NCAAF'], ['nba', 'NBA', 'NBA'], ['cbb', 'College Basketball', 'NCAAB'], ['nhl', 'NHL', 'NHL'], ['mlb', 'MLB', 'MLB'],
  ['wnba', 'WNBA', 'WNBA'], ['mls', 'MLS', 'MLS'], ['epl', 'Premier League', 'EPL'], ['ucl', 'Champions League', 'UCL'], ['laliga', 'La Liga', 'La Liga']];
const gdLg = (k, short) => { const x = GD_LEAGUES.find((l) => l[0] === k); return x ? (short ? x[2] : x[1]) : String(k).toUpperCase(); };
const gdCollege = (lg) => lg === 'cfb' || lg === 'cbb';
const GD_NET = {   // network name (as ESPN lists it) → how it's usually named in channel lists
  'ESPN': ['espn'], 'ESPN2': ['espn2', 'espn 2'], 'ESPNU': ['espnu'], 'ESPNEWS': ['espnews'], 'ABC': ['abc'], 'CBS': ['cbs'], 'NBC': ['nbc'], 'FOX': ['fox'],
  'FS1': ['fs1', 'fox sports 1'], 'FS2': ['fs2', 'fox sports 2'], 'NFL Network': ['nfl network', 'nfln'], 'NFL NET': ['nfl network'], 'NBA TV': ['nba tv'],
  'TNT': ['tnt'], 'TBS': ['tbs'], 'truTV': ['trutv', 'tru tv'], 'SEC Network': ['sec network', 'secn'], 'SECN': ['sec network', 'secn'], 'ACC Network': ['acc network', 'accn'], 'ACCN': ['acc network', 'accn'],
  'Big Ten Network': ['big ten network', 'btn'], 'BTN': ['big ten network', 'btn'], 'CBS Sports Network': ['cbs sports network', 'cbssn', 'cbs sports'], 'CBSSN': ['cbs sports network', 'cbssn'],
  'Peacock': ['peacock'], 'Prime Video': ['prime video', 'amazon prime', 'prime'], 'Netflix': ['netflix'], 'ESPN+': ['espn+', 'espn plus'], 'Pac-12 Network': ['pac-12 network', 'pac 12'],
  'The CW': ['cw', 'the cw'], 'NBCSN': ['nbcsn'], 'ION': ['ion'], 'Max': ['max', 'hbo max'], 'Paramount+': ['paramount+', 'paramount plus'],
};
const gdEsc = (s) => esc(s == null ? '' : s);
const gdNets = (g) => { const n = g.networks.filter((x) => GD_NET[x]); return n.length ? n.slice(0, 2).join(' · ') : g.networks.length ? 'Local TV' : ''; };
const gdTime = (t) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const gdDay = (t) => { const d = new Date(t), n = new Date(); const diff = Math.round((new Date(d.toDateString()) - new Date(n.toDateString())) / 864e5); return diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : diff === -1 ? 'Yesterday' : d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' }); };
const gdIn = (ms) => { const m = Math.max(0, Math.round(ms / 60000)); return m < 1 ? 'now' : m < 60 ? `in ${m} min` : m < 1440 ? `in ${Math.floor(m / 60)}h ${m % 60 ? `${m % 60}m` : ''}`.trim() : ''; };
const gdLogo = (t, size = '') => `<span class="gd-logo ${size}" style="--tc:${gdEsc(t.color || '#666')}">${t.logo ? `<img src="${gdEsc(t.logo)}" alt="" loading="lazy" onerror="this.remove()">` : ''}<b>${gdEsc(t.abbr || (t.short || '?').slice(0, 3))}</b></span>`;
const gdKw = (t, league) => {
  const amb = /^(los angeles|new york|la|ny|bay area)$/i;
  // Pros: team name only ("Suns", "Phoenix Suns") — a city alone matches the wrong teams ("Wellington Phoenix").
  const words = gdCollege(league) ? [t.location, t.short, t.name] : [t.nick, t.name];
  void amb;
  return [...new Set(words.filter((w) => w && w.length >= 3))];
};
// English-language channel? Decided by the group/name country prefix ("US|", "UK:", "CA |") — foreign feeds are dropped.
const GD_EN = /^(us|usa|uk|gb|ca|can|au|aus|ie|nz|en|eng)$/i;
const gdLang = (text) => { const m = String(text).match(/^\s*([A-Za-z]{2,5})\s*[|:\-]/) || String(text).match(/^\s*([A-Z]{2,3})\s+(?=\S)/); if (m) return GD_EN.test(m[1]) ? 'en' : 'other'; return /arab|french|fran[cç]|espa|latin|deport|portug|deutsch|ital|t[uü]rk|polsk|hindi|urdu|persian|kurd/i.test(text) ? 'other' : '?'; };
const GD_MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const gdDateIn = (text) => {   // "Thu 05 Nov", "Nov 5", "05/11" → { d, m } (or null)
  const s = String(text).toLowerCase();
  let m = s.match(/\b(\d{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/) ; if (m) return { d: +m[1], m: GD_MON.indexOf(m[2]) };
  m = s.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})\b/); if (m) return { d: +m[2], m: GD_MON.indexOf(m[1]) };
  return null;
};
const gdRe = (w) => new RegExp(`(^|[^a-z0-9])${w.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'i');

const LiveTV = {
  el: null, raw: [], byKey: new Map(), items: [], byId: new Map(), varToId: new Map(), nn: {}, accounts: [], errors: [], loaded: false, player: null,
  games: [], streamCache: new Map(),

  // ---------- switch + storage ----------
  enabled() { try { return localStorage.getItem('reel:livetv') === '1'; } catch { return false; } },
  setEnabled(on) {
    try { localStorage.setItem('reel:livetv', on ? '1' : '0'); } catch {}
    if (on) this.addNav();
    else { this.removeNav(); this.destroy(); if (route.name === 'livetv') go('home', {}, true); }
  },
  st: null,
  state() {
    if (this.st) return this.st;
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem('reel:tv') || '{}') || {}; } catch {}
    this.st = Object.assign({ league: 'all', leagues: ['nfl', 'nba', 'cfb'], sportsChosen: false, teams: [], alerts: true, alerted: [], reminders: [], showFinals: false, pick: {}, lastVar: {},
      hidden: [], hideAdult: true, merge: true, hideEmpty: true, volume: 1, muted: false, latency: 'balanced', autoFix: true, compat: {}, sportsSetup: false }, saved);
    return this.st;
  },
  save() { try { localStorage.setItem('reel:tv', JSON.stringify(this.st)); } catch {} },
  addNav() {
    if (!TABS.includes('livetv')) TABS.push('livetv');
    if ($('#tabs [data-go=livetv]')) return;
    const b = h('<button data-go="livetv">Live TV</button>');
    b.onclick = () => go('livetv');
    $('#tabs').appendChild(b);
    moveIndicator();
  },
  removeNav() { const i = TABS.indexOf('livetv'); if (i >= 0) TABS.splice(i, 1); const b = $('#tabs [data-go=livetv]'); if (b) b.remove(); moveIndicator(); },

  // ---------- show / hide ----------
  async show() {
    this.state();
    if (!this.el) this.build();
    document.body.classList.add('tw-on');
    this.el.hidden = false;
    if (!this.loaded) await this.reload(false);
    if (!this.st.sportsChosen && this.raw.length) this.openSportsPicker(true);
    await this.refreshGames(true);
    if (this.resumeWatch) { const r = this.resumeWatch; this.resumeWatch = null; this.watch(r.gameId, r.itemId, r.var); }
    clearInterval(this.tick);
    this.tick = setInterval(() => this.refreshGames(), 20000);
    this.startAlerts();
  },
  hide() {
    if (!this.el) return;
    clearInterval(this.tick);
    if (this.watching && this.player && this.player.running()) this.resumeWatch = { ...this.watching };
    this.closeWatch(true);
    document.body.classList.remove('tw-on', 'tw-theater');
    this.el.hidden = true;
  },
  destroy() {
    clearInterval(this.tick); clearInterval(this.alertT); this.alertT = null;
    if (this.player) this.player.destroy();
    if (this.el) this.el.remove();
    this.el = null; this.player = null; this.loaded = false;
    document.body.classList.remove('tw-on', 'tw-theater');
  },

  // ---------- channels: raw → merged items (duplicates merged, dividers + empty event channels hidden) ----------
  async reload(force) {
    let r;
    try { r = await window.reel.iptv.channels(!!force); }
    catch (e) { r = { channels: [], accounts: [], errors: [{ error: cleanErr(e) }] }; }
    this.raw = r.channels.map((c) => ({ ...c, n: c.n || 'Channel', gk: `${c.src}|${c.g}` }));
    this.byKey = new Map(this.raw.map((c) => [c.k, c]));
    this.accounts = r.accounts || []; this.errors = r.errors || [];
    this.adultGroups = new Set(r.adultGroups || []);
    this.sportsGroups = new Set(r.sportsGroups || []);
    // First time: keep only sports-related groups (the rest is noise for a sports-only setup).
    if (this.raw.length && !this.st.sportsSetup) {
      const sporty = /sport|espn|nfl|nba|ncaa|cfb|college|ppv|event|fox|cbs|nbc|abc|tnt|tbs|peacock|prime|dazn|bein|sky|usa|us\b|local|network/i;
      const all = [...new Set(this.raw.map((c) => c.gk))];
      this.st.hidden = all.filter((gk) => !sporty.test(gk.split('|').slice(1).join('|')));
      this.st.sportsSetup = true; this.save();
    }
    this.buildItems();
    this.loaded = true;
    await this.refreshNowNext();
  },
  buildItems() {
    const st = this.st, hid = this.hiddenSet(), map = new Map();
    for (const c of this.raw) {
      if (TV_SEP.test(c.n) || hid.has(c.gk)) continue;
      const base = tvBase(c.n) || c.n;
      const id = st.merge ? `${c.src}|${base.toLowerCase()}` : c.k;
      let it = map.get(id);
      if (!it) map.set(id, (it = { id, n: base, full: base, g: c.g, gks: new Set(), vars: [], num: c.num, c: 0, evt: TV_EVT.test(c.n) || TV_EVT.test(c.g) || TV_NUMBERED.test(tvNorm(c.n)) }));
      it.gks.add(c.gk); it.c = Math.max(it.c, c.c || 0);
      it.vars.push({ k: c.k, q: tvQual(c.n) });
      (it.rawNames || (it.rawNames = [])).push(c.n);
      if (!it.evtText) { const t = this.eventText(c.n); if (t) it.evtText = t; else if (TV_MATCH.test(` ${base} `)) it.evtText = base; }
    }
    this.items = [...map.values()];
    for (const it of this.items) {
      it.vars.sort((a, b) => tvRank(a.q) - tvRank(b.q));
      const seen = {}; it.vars.forEach((v) => { const t = v.q || 'Main'; seen[t] = (seen[t] || 0) + 1; v.label = seen[t] > 1 ? `${t} ${seen[t]}` : t; });
      if (it.evtText) { const i = it.n.indexOf(it.evtText); const short = (i > 0 ? it.n.slice(0, i) : '').replace(/[\s:\-–|]+$/, '').trim(); if (short.length >= 2) it.n = short; }
      it.lc = it.n.toLowerCase(); it.flc = `${it.full} ${it.evtText || ''}`.toLowerCase();
      it.us = [...it.gks].some((gk) => /\|\s*(us|usa)\b/i.test(gk) || /^us/i.test(gk.split('|')[1] || ''));
      const gl = [...it.gks].map((gk) => gdLang(gk.split('|').slice(1).join('|'))), nl = it.rawNames.map(gdLang);
      it.lang = gl.includes('en') ? 'en' : gl.includes('other') ? 'other' : nl.includes('en') ? 'en' : nl.includes('other') ? 'other' : '?';   // the group's country decides
    }
    this.items.sort((a, b) => a.num - b.num);
    this.byId = new Map(this.items.map((it) => [it.id, it]));
    this.varToId = new Map(); this.items.forEach((it) => it.vars.forEach((v) => this.varToId.set(v.k, it.id)));
    this.streamCache.clear();
    this._allIdx = null;
  },
  eventText(name) { const s = tvBase(name); const m = s.match(/\b\d{1,3}\s*[:\-–|]\s*(.+)$/) || s.match(/(?:event|ppv)\s*\d*\s*[:\-–|]\s*(.+)$/i); return m && m[1].trim().length >= 3 ? m[1].trim() : ''; },
  async refreshNowNext() { try { this.nn = await window.reel.iptv.nowNext(); } catch { this.nn = {}; } },
  nnOf(it) { if (!it) return null; for (const v of it.vars) { const x = this.nn[v.k]; if (x) return x; } return null; },
  isEmptyEvent(it) { if (!it.evt) return false; const x = this.nnOf(it); if (x && x[0] && !TV_EMPTY.test(x[0][2])) return false; return !it.evtText || TV_EMPTY.test(it.evtText); },
  hiddenSet() { const s = new Set(this.st.hidden); if (this.st.hideAdult) this.raw.forEach((c) => { if (this.adultGroups && this.adultGroups.has(c.g)) s.add(c.gk); }); return s; },
  visibleItems() { return this.st.hideEmpty ? this.items.filter((it) => !this.isEmptyEvent(it)) : this.items; },

  // ---------- games ----------
  async refreshGames(force) {
    if (!this.el || this.el.hidden && !force) return;
    let r;
    try { r = await window.reel.iptv.games(this.st.leagues); } catch { r = { games: [], errors: 1 }; }
    this.games = (r.games || []).sort((a, b) => a.start - b.start);
    this.gamesErr = !this.games.length && r.errors;
    if (this.watching) this.paintBug();
    if (!this.watching || force) this.renderGames();
    else this.paintDrawer();
  },
  gamesFor(league = this.st.league) { return this.games.filter((g) => league === 'all' || g.league === league); },
  isMineTeam(g, t) { return this.st.teams.some((x) => x.id === `${g.league}:${t.id}`); },
  isMine(g) { return g.teams.some((t) => this.isMineTeam(g, t)); },
  priority(g) {
    let p = 0;
    if (g.state === 'in') p += 1000;
    if (this.isMine(g)) p += 500;
    const li = this.st.leagues.indexOf(g.league); p += li >= 0 ? (20 - li) * 15 : 0;            // your league order
    if (gdCollege(g.league)) p += g.teams.reduce((a, t) => a + (t.rank ? 40 - t.rank : 0), 0);
    if (g.state === 'in' && g.teams.every((t) => t.score != null)) p += Math.max(0, 30 - Math.abs(g.teams[0].score - g.teams[1].score));
    return p;
  },
  // Which of your channels carry this game? Event channels named after it > guide listings > the network.
  async streamsFor(g) {
    const hit = this.streamCache.get(g.id);
    if (hit && Date.now() - hit.at < 120e3) return hit.list;
    const [A, B] = g.teams, kwA = gdKw(A, g.league), kwB = gdKw(B, g.league);
    const has = (text, kws) => kws.some((w) => gdRe(w).test(text));
    const gd = new Date(g.start), gDay = { d: gd.getDate(), m: gd.getMonth() };
    const sameDay = (text) => { const d = gdDateIn(text); return !d || (d.d === gDay.d && d.m === gDay.m); };
    const ok = (it) => it && it.lang !== 'other';                                    // English feeds only
    const found = new Map();
    const add = (it, score, why) => { if (!ok(it)) return; const cur = found.get(it.id); if (!cur || cur.score < score) found.set(it.id, { id: it.id, score: score + (it.lang === 'en' ? 4 : 0) + (it.us ? 2 : 0), why, n: it.n }); };
    // 1) Channels named after this game — BOTH teams, and the right date if one is in the name.
    for (const it of this.visibleItems()) {
      const t = it.flc;
      if (has(t, kwA) && has(t, kwB) && sameDay(t)) add(it, 100, it.evtText || 'Game channel');
    }
    // 2) Guide listings around kickoff that name BOTH teams.
    try {
      const gg = await window.reel.iptv.searchGuide([kwA, kwB], g.start - 45 * 60e3, g.start + 4 * 3600e3);
      gg.filter((x) => x.hits === 2).forEach((x) => add(this.byId.get(this.varToId.get(x.k)), 90, `Guide: ${x.title}`));
    } catch {}
    // 3) The national network airing it (English channels named exactly like the network).
    for (const net of g.networks) {
      const aliases = GD_NET[net]; if (!aliases) continue;
      for (const it of this.visibleItems()) {
        if (it.lang !== 'en') continue;
        const n = it.lc.replace(/^(us|usa)\s+/, '').replace(/\s+(east|west|usa|us)$/, '').trim();
        if (aliases.includes(n)) add(it, 45, net);
      }
    }
    // Same event listed twice ("…Thu 05 Nov 20" / "…Thu 05 Nov 23") → keep one.
    const seen = new Set(), list = [];
    for (const s of [...found.values()].sort((x, y) => y.score - x.score)) {
      const key = s.n.toLowerCase().replace(/\b(mon|tue|wed|thu|fri|sat|sun)[a-z]*\b.*$/, '').replace(/[^a-z0-9]/g, '');   // "NFL 01" and "NFL 02" stay separate feeds
      if (seen.has(key)) continue;
      seen.add(key); list.push(s);
      s.label = s.score >= 100 ? null : s.score >= 90 ? s.n : s.why;   // game feeds are numbered below; networks show their name
      if (list.length >= 4) break;
    }
    let f = 0; list.forEach((s) => { if (!s.label) s.label = `Game feed ${++f}`; });
    this.streamCache.set(g.id, { at: Date.now(), list });
    return list;
  },  redzone() { return this.visibleItems().find((it) => /red ?zone/i.test(it.n)); },

  // ---------- build ----------
  build() {
    this.el = h(`<div id="livetv" class="gd" hidden>
      <div class="gd-bg"><i class="o1"></i><i class="o2"></i><i class="o3"></i></div>
      <div class="gd-scroll"><div class="gd-wrap">
        <header class="gd-head">
          <div class="gd-title"><h1>Game Day</h1><p class="gd-date"></p></div>
          <div class="gd-seg"></div>
          <div class="gd-actions"><button class="gd-ib chans" data-tip="Search channels & events · Ctrl+K">${ICON.search}</button><button class="gd-ib gear" data-tip="Live TV settings">${TWI.gear}</button></div>
        </header>
        <div class="gd-body"></div>
      </div></div>
      <div class="gd-watch" hidden></div>
      <div class="gd-sheet" hidden></div>
    </div>`);
    document.body.insertBefore(this.el, $('#modal-root'));
    $('.chans', this.el).onclick = () => this.openSearch();
    $('.gear', this.el).onclick = () => this.openSettings();
    this.buildWatch();
  },
  paintHeader() {
    const st = this.st, E = this.el, now = Date.now();
    const live = this.games.filter((g) => g.state === 'in');
    $('.gd-date', E).textContent = `${new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}${live.length ? ` · ${live.length} live` : ''}`;
    const seg = $('.gd-seg', E);
    seg.style.visibility = this.loaded && !this.raw.length ? 'hidden' : '';
    const opts = [['all', 'All'], ...st.leagues.map((k) => [k, gdLg(k, true)])];
    seg.innerHTML = `<i class="gd-seg-thumb"></i>${opts.map(([k, l]) => { const n = this.games.filter((g) => (k === 'all' || g.league === k) && g.state === 'in').length; return `<button data-v="${k}" class="${st.league === k ? 'on' : ''}">${l}${n ? `<em>${n}</em>` : ''}</button>`; }).join('')}`;
    $$('button', seg).forEach((b) => (b.onclick = () => { st.league = b.dataset.v; this.save(); this.renderGames(); }));
    requestAnimationFrame(() => { const on = $('button.on', seg), th = $('.gd-seg-thumb', seg); if (on && th) { th.style.width = `${on.offsetWidth}px`; th.style.transform = `translateX(${on.offsetLeft - 4}px)`; } });
    void now;
  },
  tintBackdrop(g) {
    const bg = $('.gd-bg', this.el);
    const c1 = (g && g.teams[0].color) || '#2a3550', c2 = (g && g.teams[1].color) || '#3b2a4a';
    bg.style.setProperty('--c1', c1); bg.style.setProperty('--c2', c2);
  },
  async renderGames() {
    if (!this.el) return;
    const st = this.st, body = $('.gd-body', this.el), now = Date.now();
    this.paintHeader();
    if (this.loaded && !this.raw.length) return this.paintNoSource(body);
    const all = this.gamesFor();
    const live = all.filter((g) => g.state === 'in').sort((a, b) => this.priority(b) - this.priority(a));
    const next = all.filter((g) => g.state === 'pre' && g.start > now).sort((a, b) => a.start - b.start).slice(0, 5);
    const hero = live[0];
    this.tintBackdrop(hero || next[0]);
    const keep = $('.gd-scroll', this.el).scrollTop;
    body.innerHTML = '';
    if (!live.length) {
      const el = h(`<div class="gd-quiet"><div class="gd-quiet-ic">${TVI.live}</div><h2>${this.gamesErr ? 'Can’t reach the scores right now' : 'Nothing live right now'}</h2><p>${this.gamesErr ? 'Check your connection — it retries on its own.' : next.length ? 'Games show up here the moment they start.' : 'No games coming up for your sports today.'}</p>${next.length ? '<div class="gd-next"><div class="gd-next-h">Up next</div></div>' : ''}</div>`);
      next.forEach((g) => {
        const [A, B] = g.teams;
        const r = h(`<button class="gd-nrow"><span class="gd-nrow-lg">${gdEsc(gdLg(g.league, true))}</span><span class="gd-nrow-m">${gdLogo(A, 'xs')}<b>${gdEsc(gdCollege(g.league) ? A.location : A.nick || A.short)}</b><i>${g.teams[1].home ? '@' : 'vs'}</i>${gdLogo(B, 'xs')}<b>${gdEsc(gdCollege(g.league) ? B.location : B.nick || B.short)}</b></span><span class="gd-nrow-t">${gdDay(g.start) === 'Today' ? '' : `${gdDay(g.start)} · `}${gdTime(g.start)}</span></button>`);
        r.onclick = () => this.watch(g.id);
        $('.gd-next', el).appendChild(r);
      });
      body.appendChild(el);
      return;
    }
    body.appendChild(this.heroCard(hero));
    const rest = live.slice(1);
    const rz = live.some((g) => g.league === 'nfl') && (st.league === 'all' || st.league === 'nfl') && this.redzone();
    if (rest.length || rz) {
      const s = h(`<section class="gd-sec"><div class="gd-sec-h"><h2><i class="gd-dot"></i> Live now</h2><span class="gd-sec-n">${live.length} game${live.length === 1 ? '' : 's'}</span></div><div class="gd-grid"></div></section>`);
      const grid = $('.gd-grid', s);
      if (rz) { const tile = h(`<button class="gd-rz"><span class="gd-rz-ic">RZ</span><span><b>NFL RedZone</b><em>Every touchdown from every game</em></span><span class="gd-rz-go">${TWI.play}</span></button>`); tile.onclick = () => this.watch(null, rz.id); grid.appendChild(tile); }
      rest.forEach((g, i) => grid.appendChild(this.gameCard(g, i)));
      body.appendChild(s);
    }
    $('.gd-scroll', this.el).scrollTop = keep;
    for (const g of live.slice(0, 30)) this.streamsFor(g).then((list) => this.paintAvail(g, list));
  },  paintNoSource(body) {
    const err = this.errors[0];
    body.innerHTML = '';
    if (!err) return this.paintSetup(body);
    const el = h(`<div class="gd-empty"><div class="gd-empty-ic">${TVI.tv}</div><h2>${err ? 'Couldn’t load your channels' : 'Connect your TV source'}</h2><p>${err ? gdEsc(err.error) : 'Add the Xtream login (server, username, password) or playlist link from your provider. Game Day finds the games in it for you.'}</p><div class="gd-empty-btns"><button class="btn primary add">${TWI.plus} ${err ? 'Edit source' : 'Add source'}</button>${err ? '<button class="btn retry">Try again</button>' : ''}</div></div>`);
    $('.add', el).onclick = () => this.openSourceSheet(err ? err.id : null);
    if ($('.retry', el)) $('.retry', el).onclick = async () => { await this.reload(true); this.renderGames(); };
    body.appendChild(el);
  },
  // First run: what Live TV needs, where to find it, and one button to connect.
  paintSetup(body) {
    const step = (n, title, text, extra = '') => `<div class="gd-step"><span class="gd-step-n">${n}</span><div><b>${title}</b><p>${text}</p>${extra}</div></div>`;
    const el = h(`<div class="gd-setup">
      <div class="gd-empty-ic">${TVI.tv}</div>
      <h2>Set up Live TV</h2>
      <p class="gd-setup-lead">Watch live games with scores, the right channel picked for you, and one click to switch feeds. Three steps and you’re in.</p>
      <div class="gd-steps">
        ${step(1, 'Have an IPTV subscription', 'Reel doesn’t come with any channels. Live TV plays the channels from an IPTV service you already pay for.')}
        ${step(2, 'Find your login', 'After you sign up, your provider emails you one of these:', `<ul class="gd-step-l"><li><b>Xtream login</b><span>a server address, username and password</span></li><li><b>M3U link</b><span>one long link, often ending in <code>type=m3u_plus</code></span></li></ul>`)}
        ${step(3, 'Connect and pick your sports', 'Paste it in below, choose the sports you follow, and Game Day shows what’s live.')}
      </div>
      <div class="gd-empty-btns"><button class="btn primary add">${TWI.plus} Connect your source</button></div>
      <div class="gd-setup-note">Your login is encrypted and stays on this PC.</div>
    </div>`);
    $('.add', el).onclick = () => this.openSourceSheet();
    body.appendChild(el);
  },
  status(g, withDay = true) {
    if (g.state === 'in') return `<span class="gd-st live"><i></i>${gdEsc(g.detail || 'Live')}</span>`;
    if (g.state === 'post') return `<span class="gd-st fin">${gdEsc(g.detail || 'Final')}</span>`;
    const d = gdDay(g.start);
    return `<span class="gd-st pre">${d === 'Today' || !withDay ? '' : `${d === 'Tomorrow' ? 'Tomorrow' : new Date(g.start).toLocaleDateString([], { weekday: 'short' })} · `}${gdTime(g.start)}</span>`;
  },
  teamLine(g, t) {
    const showScore = g.state !== 'pre' && t.score != null;
    const lost = g.state === 'post' && !t.winner;
    const poss = g.sit && g.sit.poss && g.sit.poss === t.id;
    return `<div class="gd-tm ${lost ? 'lost' : ''} ${this.isMineTeam(g, t) ? 'mine' : ''}">${gdLogo(t, 'sm')}<b>${t.rank ? `<i class="gd-rk">${t.rank}</i>` : ''}${gdEsc(gdCollege(g.league) ? t.location || t.short : t.nick || t.short)}${poss ? '<i class="gd-poss"></i>' : ''}</b><em>${gdEsc(t.record)}</em>${showScore ? `<span class="gd-sc">${t.score}</span>` : ''}</div>`;
  },
  gameCard(g, i = 0, withDay = false) {
    const [A, B] = g.teams, now = Date.now();
    const c = h(`<div class="gd-card ${g.state} ${this.isMine(g) ? 'mine' : ''}" data-g="${gdEsc(g.id)}" style="--c1:${gdEsc(A.color || '#555')};--c2:${gdEsc(B.color || '#555')};animation-delay:${Math.min(i, 12) * 30}ms">
      <div class="gd-card-top"><span class="gd-lg">${gdEsc(gdLg(g.league, true))}</span>${this.status(g, withDay)}</div>
      ${this.teamLine(g, A)}${this.teamLine(g, B)}
      <div class="gd-card-foot"><span class="gd-net">${gdEsc(gdNets(g) || (g.state === 'pre' ? gdIn(g.start - now) : ''))}</span><span class="gd-avail"></span></div>
      ${g.sit && g.sit.down && g.state === 'in' ? `<div class="gd-sit ${g.sit.redzone ? 'rz' : ''}">${gdEsc(g.sit.down)}</div>` : ''}</div>`);
    c.onclick = () => this.watch(g.id);
    c.oncontextmenu = (e) => { e.preventDefault(); this.gameMenu(g, e.clientX, e.clientY); };
    return c;
  },
  heroCard(g) {
    const [A, B] = g.teams, now = Date.now();
    const sc = g.state !== 'pre' && A.score != null;
    const el = h(`<section class="gd-hero ${g.state}" data-g="${gdEsc(g.id)}" style="--c1:${gdEsc(A.color || '#444')};--c2:${gdEsc(B.color || '#444')}">
      <div class="gd-hero-bg"></div>
      <div class="gd-hero-top"><span class="gd-lg">${gdEsc(gdLg(g.league))}${g.note ? ` · ${gdEsc(g.note)}` : ''}</span>${this.status(g)}</div>
      <div class="gd-hero-main">
        <div class="gd-ht">${gdLogo(A, 'xl')}<b>${A.rank ? `<i class="gd-rk">${A.rank}</i>` : ''}${gdEsc(gdCollege(g.league) ? A.location : A.nick || A.short)}</b><em>${gdEsc(A.record)}</em><button class="gd-star ${this.isMineTeam(g, A) ? 'on' : ''}" data-t="0" data-tip="${this.isMineTeam(g, A) ? 'Your team' : 'Add to your teams'}">${this.isMineTeam(g, A) ? TVI.starFill : TVI.star}</button></div>
        <div class="gd-hs">${sc ? `<div class="gd-hs-n"><span class="${g.state === 'post' && !A.winner ? 'lost' : ''}">${A.score}</span><i></i><span class="${g.state === 'post' && !B.winner ? 'lost' : ''}">${B.score}</span></div>` : `<div class="gd-hs-t">${gdTime(g.start)}</div><div class="gd-hs-in">${gdEsc(gdDay(g.start) === 'Today' ? gdIn(g.start - now) : gdDay(g.start))}</div>`}
          ${g.sit && g.sit.down && g.state === 'in' ? `<div class="gd-hs-sit ${g.sit.redzone ? 'rz' : ''}">${g.sit.redzone ? '<b>RED ZONE</b> · ' : ''}${gdEsc(g.sit.down)}</div>` : g.state === 'in' && g.league === 'nba' ? '' : ''}</div>
        <div class="gd-ht">${gdLogo(B, 'xl')}<b>${B.rank ? `<i class="gd-rk">${B.rank}</i>` : ''}${gdEsc(gdCollege(g.league) ? B.location : B.nick || B.short)}</b><em>${gdEsc(B.record)}</em><button class="gd-star ${this.isMineTeam(g, B) ? 'on' : ''}" data-t="1" data-tip="${this.isMineTeam(g, B) ? 'Your team' : 'Add to your teams'}">${this.isMineTeam(g, B) ? TVI.starFill : TVI.star}</button></div>
      </div>
      <div class="gd-hero-foot"><span class="gd-net">${gdEsc([gdNets(g), g.venue].filter(Boolean).join('  ·  '))}</span>
        <div class="gd-hero-btns"><span class="gd-avail"></span><button class="btn primary watch">${TWI.play} ${g.state === 'pre' ? 'Open stream' : 'Watch'}</button></div></div>
    </section>`);
    $('.watch', el).onclick = () => this.watch(g.id);
    $$('.gd-star', el).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); this.toggleTeam(g, g.teams[+b.dataset.t]); }));
    el.oncontextmenu = (e) => { e.preventDefault(); this.gameMenu(g, e.clientX, e.clientY); };
    return el;
  },
  paintAvail(g, list) {
    if (!this.el) return;
    $$(`[data-g="${CSS.escape(g.id)}"] .gd-avail`, this.el).forEach((a) => {
      a.className = `gd-avail ${list.length ? 'ok' : 'none'}`;
      a.textContent = list.length ? `${list.length} stream${list.length === 1 ? '' : 's'}` : 'No stream found';
      a.dataset.tip = list.length ? list.slice(0, 5).map((x) => x.n).join(' · ') : 'Nothing in your channel list matches this game yet — event channels often appear closer to kickoff';
    });
  },
  gameMenu(g, x, y) {
    const items = g.teams.map((t) => [this.isMineTeam(g, t) ? TVI.starFill : TVI.star, this.isMineTeam(g, t) ? `Remove ${t.name} from your teams` : `Add ${t.name} to your teams`, () => this.toggleTeam(g, t)]);
    menuAt(x, y, g.name, [[TWI.play, 'Watch', () => this.watch(g.id)], [TVI.list, 'Choose a stream…', () => this.chooseStream(g, x, y)], 'sep', ...items]);
  },
  async chooseStream(g, x, y) {
    const list = await this.streamsFor(g);
    if (!list.length) return toast('No stream found for this game in your channels yet');
    menuAt(x, y, 'Streams for this game', list.map((s) => [TVI.live, s.label || s.n, () => this.watch(g.id, s.id)]));
  },
  toggleTeam(g, t) {
    const st = this.st, id = `${g.league}:${t.id}`;
    if (st.teams.some((x) => x.id === id)) st.teams = st.teams.filter((x) => x.id !== id);
    else { st.teams.push({ id, name: t.name }); toast(`${t.name} added to your teams — you’ll get a heads-up before their games`); }
    this.save(); this.renderGames();
  },

  // ---------- watching ----------
  buildWatch() {
    const w = $('.gd-watch', this.el);
    w.innerHTML = `<div class="tv-vid"></div><div class="tv-state"></div>
      <div class="gd-osd">
        <div class="gd-osd-top"><button class="gd-back" data-tip="Back to games · Esc">${ICON.back}<span>Games</span></button><div class="gd-bug"></div></div>
        <div class="gd-osd-bot">
          <div class="gd-now"></div>
          <div class="tv-ctl">
            <button class="tv-cb pp" data-tip="Pause · Space">${TWI.pause}</button>
            <button class="tv-cb rw" data-tip="Back 10 seconds · ←">${TVI.rewind}</button>
            <button class="tv-live-btn" data-tip="You’re watching live"><i></i><span>LIVE</span></button>
            <div class="tv-vol"><button class="tv-cb mute" data-tip="Mute · M">${TWI.vol}</button><input type="range" min="0" max="1" step="0.02" class="tv-volr"></div>
            <span class="tv-ctl-sp"></span>
            <button class="tv-cb cog" data-tip="Stream & quality">${TWI.gear}</button>
            <button class="tv-cb full" data-tip="Full screen · F">${TWI.fill}</button>
          </div>
          <div class="gd-pop" hidden></div>
        </div>
      </div>`;
    this.player = new LivePlayer($('.tv-vid', w), {
      onStatus: (s, msg) => this.paintState(s, msg),
      onPlaying: (k) => { const id = this.varToId.get(k); if (id) { this.st.lastVar[id] = k; this.save(); } this.paintQuality(); },
      onDead: (k) => {
        const id = this.varToId.get(k), it = id && this.byId.get(id); if (!it || it.vars.length < 2) return null;
        const i = it.vars.findIndex((v) => v.k === k), next = it.vars[(i + 1) % it.vars.length];
        if (!next || next.k === this.playStartVar) return null;
        toast(`Switched to ${it.n} · ${next.label}`);
        return next.k;
      },
      onBlack: async () => {
        const cur = this.watching; if (!cur) return;
        this.tried = this.tried || new Set(); this.tried.add(cur.itemId);
        const g = cur.gameId && this.games.find((x) => x.id === cur.gameId);
        if (g) {
          const next = (await this.streamsFor(g)).find((s) => !this.tried.has(s.id));
          if (next) { toast(`That feed was just a black screen — switched to ${next.label || next.n}`); return this.watch(g.id, next.id, null, { auto: true }); }
        }
        this.paintState('black');
      },
    });
    const p = this.player, v = p.video;
    $('.pp', w).onclick = () => { p.togglePause(); this.paintCtl(); };
    $('.rw', w).onclick = () => { p.seekBy(-10); this.paintCtl(); };
    $('.tv-live-btn', w).onclick = () => { p.goLive(); this.paintCtl(); };
    $('.mute', w).onclick = () => { this.st.muted = !this.st.muted; this.save(); p.applyVolume(); this.paintCtl(); };
    const vr = $('.tv-volr', w);
    vr.oninput = () => { this.st.volume = +vr.value; this.st.muted = +vr.value === 0; this.save(); p.applyVolume(); this.paintCtl(); };
    $('.full', w).onclick = () => window.reel.fullscreen();
    $('.gd-back', w).onclick = () => this.closeWatch();
    $('.cog', w).onclick = (e) => { e.stopPropagation(); this.toggleCog(); };
    w.addEventListener('mousedown', (e) => { if (!e.target.closest('.gd-pop, .cog')) this.toggleCog(false); });
    v.ondblclick = () => window.reel.fullscreen();
    w.onmousemove = () => this.showOsd();
    v.onclick = () => this.showOsd();
    v.addEventListener('pause', () => this.paintCtl()); v.addEventListener('play', () => this.paintCtl());
    this.ctlT = setInterval(() => { if (this.watching && this.el && !this.el.hidden) { this.paintCtl(); } }, 1000);
  },
  async watch(gameId, itemId, varKey, wopts = {}) {
    if (!wopts.auto) this.tried = new Set();   // you picked it → start fresh; auto-switches remember what was black
    const g = gameId && this.games.find((x) => x.id === gameId);
    let id = itemId;
    if (!id && g) {
      const list = await this.streamsFor(g);
      const pick = this.st.pick[g.id];
      id = (pick && list.some((s) => s.id === pick) ? pick : (list[0] || {}).id);
      if (!id) { toast('No stream for this game in your channels yet — event channels often show up closer to kickoff'); this.chooseFallback(g); return; }
    }
    const it = this.byId.get(id); if (!it) return;
    if (g) { this.st.pick[g.id] = id; this.save(); }
    const k = varKey || (it.vars.some((x) => x.k === this.st.lastVar[id]) ? this.st.lastVar[id] : it.vars[0].k);
    this.watching = { gameId: g ? g.id : null, itemId: id, var: k };
    this.playStartVar = k;
    const w = $('.gd-watch', this.el);
    w.hidden = false;
    this.el.classList.add('watching');
    document.body.classList.add('tw-theater');
    if (g) this.tintBackdrop(g);
    this.player.load(k);
    this.paintBug(); this.paintNow(); this.toggleCog(false);
    this.showOsd(2500);
  },
  chooseFallback(g) { this.openChannels(g.teams.map((t) => t.nick || t.location).join(' ')); },
  closeWatch(silent) {
    if (!this.el) return;
    if (document.body.dataset.winfs === '1') window.reel.fullscreen(false);   // never leave the window stuck full screen
    if (this.player) this.player.stop();
    this.watching = null;
    $('.gd-watch', this.el).hidden = true;
    this.el.classList.remove('watching');
    document.body.classList.remove('tw-theater');
    if (!silent) this.renderGames();
  },
  showOsd(ms = 1800) {
    const w = $('.gd-watch', this.el); w.classList.add('osd');
    clearTimeout(this.osdT);
    const hide = () => { const pop = $('.gd-pop', w); if (this.player.video.paused || (pop && !pop.hidden) || $('.tv-ctl', w).matches(':hover')) { this.osdT = setTimeout(hide, 800); return; } w.classList.remove('osd'); };
    this.osdT = setTimeout(hide, ms);
  },
  paintBug() {
    const box = this.el && $('.gd-bug', this.el); if (!box || !this.watching) return;
    const g = this.watching.gameId && this.games.find((x) => x.id === this.watching.gameId);
    const it = this.byId.get(this.watching.itemId);
    if (!g) { box.innerHTML = `<div class="gd-bug-ch"><b>${gdEsc(it ? it.n : '')}</b></div>`; return; }
    const [A, B] = g.teams, sc = g.state !== 'pre' && A.score != null;
    box.innerHTML = `<div class="gd-bug-t">${gdLogo(A, 'xs')}<b>${gdEsc(A.abbr)}</b>${sc ? `<span>${A.score}</span>` : ''}</div>
      <div class="gd-bug-t">${sc ? `<span>${B.score}</span>` : ''}<b>${gdEsc(B.abbr)}</b>${gdLogo(B, 'xs')}</div>
      <div class="gd-bug-s ${g.state}">${g.state === 'in' ? '<i></i>' : ''}${gdEsc(g.state === 'pre' ? gdTime(g.start) : g.detail)}${g.sit && g.sit.down && g.state === 'in' ? `<em class="${g.sit.redzone ? 'rz' : ''}">${gdEsc(g.sit.down)}</em>` : ''}</div>`;
  },
  async paintStreams() {},
  paintQuality() { if (this.el && !$('.gd-pop', this.el).hidden) this.toggleCog(true); },
  // Bottom-right cog: pick another stream of this game, or another quality of the same channel.
  async toggleCog(on) {
    const pop = this.el && $('.gd-pop', this.el); if (!pop) return;
    const open = on === undefined ? pop.hidden : on;
    if (!open || !this.watching) { pop.hidden = true; $('.gd-watch .cog', this.el).classList.remove('on'); return; }
    const w = this.watching, g = w.gameId && this.games.find((x) => x.id === w.gameId), it = this.byId.get(w.itemId);
    const list = g ? await this.streamsFor(g) : [];
    const cur = this.player.key;
    pop.innerHTML = `${list.length ? `<div class="gd-pop-h">Stream</div>${list.map((x, i) => `<button class="gd-pop-r ${x.id === w.itemId ? 'on' : ''}" data-s="${gdEsc(x.id)}"><span>${gdEsc(x.label || x.n)}</span>${i === 0 ? '<em>Best match</em>' : ''}<i>${TWI.check}</i></button>`).join('')}` : ''}
      ${it && it.vars.length > 1 ? `<div class="gd-pop-h">Quality</div>${it.vars.map((v) => `<button class="gd-pop-r ${v.k === cur ? 'on' : ''}" data-q="${gdEsc(v.k)}"><span>${gdEsc(v.label === 'Main' ? 'Standard' : v.label)}</span><i>${TWI.check}</i></button>`).join('')}` : ''}
      ${!list.length && !(it && it.vars.length > 1) ? '<div class="gd-pop-none">Only one stream for this.</div>' : ''}`;
    $$('[data-s]', pop).forEach((b) => (b.onclick = () => this.watch(w.gameId, b.dataset.s)));
    $$('[data-q]', pop).forEach((b) => (b.onclick = () => this.watch(w.gameId, it.id, b.dataset.q)));
    pop.hidden = false;
    $('.gd-watch .cog', this.el).classList.add('on');
    this.showOsd();
  },  paintNow() {
    const box = this.el && $('.gd-now', this.el); if (!box || !this.watching) return;
    const g = this.watching.gameId && this.games.find((x) => x.id === this.watching.gameId);
    const it = this.byId.get(this.watching.itemId);
    box.innerHTML = g ? `<b>${gdEsc(g.name)}</b><span>${gdEsc([it && it.n, g.networks[0], g.venue].filter(Boolean).join(' · '))}</span>` : `<b>${gdEsc(it ? it.n : '')}</b>`;
  },
  paintState(s, msg) {
    const box = this.el && $('.gd-watch .tv-state', this.el); if (!box) return;
    box.className = `tv-state ${s}`;
    if (s === 'playing' || s === 'idle') { box.innerHTML = ''; return; }
    if (s === 'loading' || s === 'buffering') { box.innerHTML = `<div class="tv-st-in"><span class="spinner"></span>${s === 'loading' ? `<span>${gdEsc(msg || 'Connecting…')}</span>` : ''}</div>`; return; }
    if (s === 'black') {
      const w = this.watching || {};
      box.innerHTML = `<div class="tv-st-in err"><div class="tv-st-ic">${TVI.tv}</div><b>${w.gameId ? 'Every feed for this game is black right now' : 'This channel is showing a black screen'}</b><span>The broadcast may not have started yet — event feeds usually come on a few minutes before kickoff.</span><div class="tv-st-btns"><button class="btn small primary again">Try again</button><button class="btn small keep">Keep watching</button></div></div>`;
      $('.again', box).onclick = () => this.watch(w.gameId, w.itemId);
      $('.keep', box).onclick = () => { this.player.ignoreBlack = true; this.paintState('playing'); };
      return;
    }
    if (s === 'error') {
      const w = this.watching || {};
      box.innerHTML = `<div class="tv-st-in err"><div class="tv-st-ic">${TVI.tv}</div><b>${gdEsc(msg || 'Couldn’t play this stream')}</b><span>It may be off air, or your account is busy on another screen.</span><div class="tv-st-btns"><button class="btn small primary again">Try again</button>${w.gameId ? '<button class="btn small other">Try another stream</button>' : ''}</div></div>`;
      $('.again', box).onclick = () => this.watch(w.gameId, w.itemId);
      if ($('.other', box)) $('.other', box).onclick = () => this.nextStream(1);
    }
  },
  async nextStream(d) {
    const w = this.watching; if (!w || !w.gameId) return;
    const g = this.games.find((x) => x.id === w.gameId); if (!g) return;
    const list = await this.streamsFor(g); if (list.length < 2) return toast('This is the only stream for this game');
    const i = list.findIndex((s) => s.id === w.itemId), n = list[(i + d + list.length) % list.length];
    toast(`Stream: ${n.label || n.n}`);
    this.watch(g.id, n.id);
  },
  paintCtl() {
    if (!this.el || !this.player || !this.watching) return;
    const p = this.player, v = p.video, box = $('.gd-watch', this.el), st = this.st;
    $('.pp', box).innerHTML = v.paused ? TWI.play : TWI.pause;
    const behind = p.behind(), atLive = !(p.userBehind && behind > 3);
    const lb = $('.tv-live-btn', box);
    lb.classList.toggle('at', atLive);
    lb.dataset.tip = atLive ? 'You’re watching live' : 'Jump back to live';
    $('span', lb).textContent = atLive ? 'LIVE' : `${behind >= 60 ? `${Math.floor(behind / 60)}:${String(Math.floor(behind % 60)).padStart(2, '0')}` : `${Math.floor(behind)}s`} behind · Go live`;
    $('.mute', box).innerHTML = st.muted || st.volume === 0 ? TWI.mute : TWI.vol;
    const vr = $('.tv-volr', box); if (document.activeElement !== vr) vr.value = st.muted ? 0 : st.volume;
    vr.style.setProperty('--v', `${(st.muted ? 0 : st.volume) * 100}%`);
    if (v.paused) box.classList.add('osd');
  },
  paintDrawer() {},

  // ---------- alerts for your teams ----------
  startAlerts() {
    if (this.alertT) return;
    const run = () => {
      const st = this.st, now = Date.now();
      // Reminders set from search ("Oscars · Sun 8:00 PM").
      (st.reminders || []).filter((r) => r.s - now < 60e3).forEach((r) => { if (now - r.s < 30 * 60e3) { const e = this.allIndex().byKey.get(r.k); toast(`${r.title} is starting on ${r.n}`, false, { label: 'Watch', fn: () => { go('livetv'); setTimeout(() => e && this.watch(null, this.ensureItem(e)), 400); } }); } });
      if (st.reminders && st.reminders.some((r) => r.s - now < 60e3)) { st.reminders = st.reminders.filter((r) => r.s - now >= 60e3); this.save(); }
      if (!st.alerts || !st.teams.length) return;
      this.games.filter((g) => this.isMine(g) && g.state === 'pre' && g.start - now < 10 * 60e3 && g.start - now > -5 * 60e3 && !st.alerted.includes(g.id)).forEach((g) => {
        st.alerted = [...st.alerted, g.id].slice(-80); this.save();
        toast(`${g.short || g.name} starts ${gdIn(g.start - now) || 'now'}`, false, { label: 'Watch', fn: () => { go('livetv'); setTimeout(() => this.watch(g.id), 400); } });
      });
    };
    this.alertT = setInterval(run, 60e3); setTimeout(run, 3000);
  },

  // ---------- Search: anything in the TV guide + every channel (not just sports) ----------
  allIndex() {
    if (this._allIdx) return this._allIdx;
    const st = this.st, map = new Map();
    for (const c of this.raw) {
      if (TV_SEP.test(c.n)) continue;
      if (st.hideAdult && this.adultGroups.has(c.g)) continue;
      if (gdLang(c.g) === 'other' || gdLang(c.n) === 'other') continue;      // English channels only
      const base = tvBase(c.n) || c.n;
      const id = st.merge ? `${c.src}|${base.toLowerCase()}` : c.k;
      let e = map.get(id);
      if (!e) map.set(id, (e = { id, n: base, g: c.g, gk: c.gk, keys: [], lc: base.toLowerCase() }));
      e.keys.push(c.k);
    }
    this._allIdx = { list: [...map.values()], byKey: new Map() };
    this._allIdx.list.forEach((e) => e.keys.forEach((k) => this._allIdx.byKey.set(k, e)));
    return this._allIdx;
  },
  // A channel that Game Day's sports filter hides still needs to be playable from search.
  ensureItem(e) {
    if (this.byId.has(e.id)) return e.id;
    const it = { id: e.id, n: e.n, full: e.n, g: e.g, gks: new Set([e.gk]), vars: e.keys.map((k) => ({ k, q: tvQual((this.byKey.get(k) || {}).n || '') })), c: 0, lang: 'en', lc: e.lc, flc: e.lc };
    it.vars.sort((x, y) => tvRank(x.q) - tvRank(y.q));
    const seen = {}; it.vars.forEach((v) => { const t = v.q || 'Main'; seen[t] = (seen[t] || 0) + 1; v.label = seen[t] > 1 ? `${t} ${seen[t]}` : t; });
    this.byId.set(it.id, it); it.vars.forEach((v) => this.varToId.set(v.k, it.id));
    return it.id;
  },
  openChannels(q = '') { this.openSearch(q); },
  openSearch(q = '') {
    const sh = $('.gd-sheet', this.el);
    sh.hidden = false;
    sh.innerHTML = `<div class="gd-sheet-in gd-search"><div class="gd-sheet-h"><h2>Search</h2><button class="gd-ib sm x" data-tip="Close · Esc">${TWI.x}</button></div>
      <form class="tw-field big" autocomplete="off"><span class="tw-field-ic">${ICON.search}</span><input placeholder="Channels, shows or events — e.g. Oscars, ESPN, Lakers" spellcheck="false"></form>
      <div class="gd-ch-list"></div></div>`;
    const inp = $('input', sh), list = $('.gd-ch-list', sh);
    inp.value = q;
    const close = () => { sh.hidden = true; sh.innerHTML = ''; };
    $('.x', sh).onclick = close;
    sh.onclick = (e) => { if (e.target === sh) close(); };
    $('form', sh).onsubmit = (e) => { e.preventDefault(); const f = $('.gd-ch, .gd-hit', list); if (f) f.click(); };
    let gen = 0;
    const paint = async () => {
      const my = ++gen, query = inp.value.trim(), words = query.toLowerCase().split(/\s+/).filter(Boolean), now = Date.now();
      list.innerHTML = '';
      if (!words.length) {
        // Nothing typed: what's live on your sports channels right now.
        const live = this.visibleItems().filter((it) => { const x = this.nnOf(it); return x && x[0] && x[0][4] === 'live'; }).slice(0, 40);
        list.appendChild(h(`<div class="gd-sr-h">${live.length ? 'Live on your channels' : 'Type to search channels, shows and events'}</div>`));
        live.forEach((it) => list.appendChild(this.chanRow(it.id, it.n, this.nnOf(it)[0], close)));
        return;
      }
      // 1) The TV guide: every listing that matches (live first, then soonest).
      let hits = [];
      try { hits = await window.reel.iptv.searchListings(query, now - 60e3, now + 7 * 864e5); } catch {}
      if (my !== gen) return;
      const idx = this.allIndex(), seen = new Set(), rows = [];
      for (const x of hits) {
        const e = idx.byKey.get(x.k); if (!e) continue;
        const key = `${e.id}|${x.s}`; if (seen.has(key)) continue; seen.add(key);
        rows.push({ e, x, live: x.s <= now && x.e > now });
      }
      rows.sort((a, b) => (b.live - a.live) || (a.x.s - b.x.s));
      if (rows.length) {
        list.appendChild(h(`<div class="gd-sr-h">On TV</div>`));
        rows.slice(0, 40).forEach(({ e, x, live }) => {
          const rem = this.st.reminders && this.st.reminders.some((r) => r.k === x.k && r.s === x.s);
          const when = live ? '<em class="gd-sr-live">LIVE</em>' : `<em class="gd-sr-when">${gdDay(x.s) === 'Today' ? 'Today' : gdDay(x.s) === 'Tomorrow' ? 'Tomorrow' : new Date(x.s).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}<b>${gdTime(x.s)}</b></em>`;
          const r = h(`<button class="gd-hit ${live ? 'live' : ''}">${when}<div><b>${gdEsc(x.title)}</b><span>${gdEsc([x.sub, e.n].filter(Boolean).join(' · '))}</span></div><i>${live ? TWI.play : rem ? TVI.bellOn : TVI.bell}</i></button>`);
          r.dataset.tip = live ? 'Watch now' : rem ? 'Reminder set — click to cancel' : 'Remind me when it starts';
          r.onclick = () => {
            if (live) { close(); this.watch(null, this.ensureItem(e)); return; }
            const st = this.st; st.reminders = st.reminders || [];
            if (rem) st.reminders = st.reminders.filter((q2) => !(q2.k === x.k && q2.s === x.s));
            else { st.reminders.push({ k: x.k, s: x.s, title: x.title, n: e.n }); toast(`We’ll remind you — ${gdDay(x.s)} at ${gdTime(x.s)}`); }
            this.save(); paint();
          };
          list.appendChild(r);
        });
      }
      // 2) Channels by name (all of them, not just sports).
      const q2 = words.join(' ');
      const chans = idx.list.filter((e) => words.every((w) => e.lc.includes(w))).sort((a, b) => (b.lc.startsWith(q2) - a.lc.startsWith(q2)) || (a.n.length - b.n.length)).slice(0, 40);
      if (chans.length) {
        list.appendChild(h(`<div class="gd-sr-h">Channels</div>`));
        chans.forEach((e) => { const it = this.byId.get(e.id); list.appendChild(this.chanRow(e, e.n, it ? (this.nnOf(it) || [])[0] : (this.nn[e.keys[0]] || [])[0], close)); });
      }
      if (!rows.length && !chans.length) list.appendChild(h(`<div class="gd-sr-none">${ICON.search}<b>Nothing found for “${gdEsc(query)}”</b><span>Try fewer words, or the channel it’s on (e.g. “ABC”).</span></div>`));
    };
    let t; inp.oninput = () => { clearTimeout(t); t = setTimeout(paint, 220); };
    paint(); setTimeout(() => inp.focus(), 60);
  },
  chanRow(idOrEntry, name, cur, close) {
    const s = cur ? cur[4] : '';
    const r = h(`<button class="gd-ch"><div><b>${gdEsc(name)}</b><span>${s === 'live' ? '<em class="tv-tag live">LIVE</em>' : s === 'replay' ? '<em class="tv-tag">REPLAY</em>' : ''}${gdEsc(cur ? cur[2] : '')}</span></div>${TWI.play}</button>`);
    r.onclick = () => { close(); this.watch(null, typeof idOrEntry === 'string' ? idOrEntry : this.ensureItem(idOrEntry)); };
    return r;
  },
  // ---------- sheets: source, groups, settings ----------
  async openSourceSheet(id) {
    const existing = id ? (await window.reel.iptv.sources()).find((s) => s.id === id) : null;
    const wrap = h(`<div class="tv-src"><h3>${existing ? 'Edit source' : 'Connect your TV source'}</h3>
      <p class="muted">Use what your provider sent you — usually an <b>Xtream login</b> (server, username, password), or an <b>M3U playlist link</b>.</p>
      <div class="tw-seg tv-src-seg"><i class="tw-seg-thumb"></i><button data-v="xtream">Xtream login</button><button data-v="m3u">Playlist link</button><button data-v="file">Playlist file</button></div>
      <div class="tv-src-f" data-for="xtream"><label class="tv-f"><span>Server address</span><input class="input srv" placeholder="http://example.com:8080" spellcheck="false"></label>
        <div class="tv-f2"><label class="tv-f"><span>Username</span><input class="input usr" spellcheck="false" autocomplete="off"></label><label class="tv-f"><span>Password</span><input class="input pwd" type="password" autocomplete="new-password" placeholder="${existing && existing.type === 'xtream' ? '•••••• (unchanged)' : ''}"></label></div></div>
      <div class="tv-src-f" data-for="m3u"><label class="tv-f"><span>Playlist link (M3U)</span><input class="input url" placeholder="http://…/get.php?username=…&type=m3u_plus" spellcheck="false"></label></div>
      <div class="tv-src-f" data-for="file"><label class="tv-f"><span>Playlist file (.m3u / .m3u8)</span><div class="tv-file"><button class="btn small pick">Choose file…</button><span class="fname muted">No file chosen</span></div><input type="file" class="fin" accept=".m3u,.m3u8,.txt" hidden></label></div>
      <details class="tv-adv"><summary>Advanced</summary><label class="tv-f"><span>Name</span><input class="input nm" placeholder="My TV"></label>
        <label class="tv-f"><span>TV guide (EPG) link — optional</span><input class="input epg" placeholder="Leave empty to use the provider’s guide" spellcheck="false"></label>
        <div class="tv-f2"><label class="tv-f"><span>Stream format</span><select class="input fmt"><option value="auto">Automatic</option><option value="ts">MPEG-TS (most reliable)</option><option value="hls">HLS (m3u8)</option></select></label><label class="tv-f"><span>User agent</span><input class="input ua" placeholder="Default" spellcheck="false"></label></div></details>
      <div class="tv-src-err err"></div>
      <div class="btns" style="justify-content:flex-end;margin-top:18px"><button class="btn ghost no">Cancel</button><button class="btn primary yes">${existing ? 'Save' : 'Connect'}</button></div></div>`);
    const m = openModal(wrap);
    let type = existing ? existing.type : 'xtream', fileText = '';
    const seg = $('.tv-src-seg', wrap);
    const setType = (t) => { type = t; $$('button', seg).forEach((b) => b.classList.toggle('on', b.dataset.v === t)); $$('.tv-src-f', wrap).forEach((f) => (f.hidden = f.dataset.for !== t)); const i = ['xtream', 'm3u', 'file'].indexOf(t); $('.tw-seg-thumb', seg).style.cssText = `width:calc(33.33% - 2px);transform:translateX(${i * 100}%)`; };
    $$('button', seg).forEach((b) => (b.onclick = () => setType(b.dataset.v)));
    setType(type);
    if (existing) {
      $('.nm', wrap).value = existing.name || ''; $('.epg', wrap).value = existing.epg || ''; $('.fmt', wrap).value = existing.format || 'auto'; $('.ua', wrap).value = existing.ua || '';
      if (existing.type === 'xtream') { $('.srv', wrap).value = existing.server || ''; $('.usr', wrap).value = existing.user || ''; }
      $$('button', seg).forEach((b) => (b.disabled = b.dataset.v !== existing.type));
    }
    $('.pick', wrap).onclick = (e) => { e.preventDefault(); $('.fin', wrap).click(); };
    $('.fin', wrap).onchange = async (e) => { const f = e.target.files[0]; if (!f) return; fileText = await f.text(); $('.fname', wrap).textContent = `${f.name} · ${(f.size / 1024).toFixed(0)} KB`; };
    $('.no', wrap).onclick = m.close;
    $('.yes', wrap).onclick = async (e) => {
      const btn = e.currentTarget, err = $('.tv-src-err', wrap); err.textContent = '';
      const payload = { id: existing && existing.id, type, name: $('.nm', wrap).value, epg: $('.epg', wrap).value, format: $('.fmt', wrap).value, ua: $('.ua', wrap).value, server: $('.srv', wrap).value, user: $('.usr', wrap).value, pass: $('.pwd', wrap).value, url: $('.url', wrap).value, content: fileText };
      btn.disabled = true; btn.innerHTML = '<span class="spinner sm"></span> Connecting…';
      try {
        const r = await window.reel.iptv.saveSource(payload);
        m.close();
        toast(`Connected · ${r.count.toLocaleString()} channels`);
        if (!existing) this.st.sportsSetup = false;
        await this.reload(false); this.renderGames();
        if (!this.st.sportsChosen && this.raw.length) this.openSportsPicker(true);
      } catch (ex) { err.textContent = cleanErr(ex).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''); btn.disabled = false; btn.textContent = existing ? 'Save' : 'Connect'; }
    };
  },
  openGroupPicker() {
    const st = this.st, hid = new Set(st.hidden), all = new Map();
    for (const c of this.raw) { if (TV_SEP.test(c.n)) continue; const g = all.get(c.gk) || { key: c.gk, name: c.g, count: 0 }; g.count++; all.set(c.gk, g); }
    const groups = [...all.values()];
    const wrap = h(`<div class="tv-gp-sheet"><h3>Channel groups</h3><p class="muted">Game Day only looks for games in the groups you keep on.</p>
      <div class="tv-gp-tools"><form class="tw-field" autocomplete="off"><span class="tw-field-ic">${ICON.search}</span><input placeholder="Search groups" spellcheck="false"></form><button class="btn small sp">${TVI.trophy} Sports only</button><button class="btn small al">All</button><button class="btn small nn">None</button></div>
      <div class="tv-gp-count muted"></div><div class="tv-gp-list"></div>
      <div class="btns" style="justify-content:flex-end;margin-top:16px"><button class="btn primary done">Done</button></div></div>`);
    const m = openModal(wrap, { wide: true });
    const list = $('.tv-gp-list', wrap), inp = $('input', wrap);
    const count = () => { const on = groups.filter((g) => !hid.has(g.key)); $('.tv-gp-count', wrap).textContent = `${on.length} of ${groups.length} groups on`; };
    const paint = () => {
      const q = inp.value.trim().toLowerCase(); list.innerHTML = '';
      groups.filter((g) => !(st.hideAdult && this.adultGroups.has(g.name)) && (!q || g.name.toLowerCase().includes(q))).forEach((g) => {
        const r = h(`<label class="tv-gp-row"><input type="checkbox" class="tw-sw" ${hid.has(g.key) ? '' : 'checked'}><span class="tv-gp-n">${gdEsc(g.name)}</span><em>${g.count.toLocaleString()}</em></label>`);
        $('input', r).onchange = (e) => { if (e.target.checked) hid.delete(g.key); else hid.add(g.key); count(); };
        list.appendChild(r);
      });
      count();
    };
    inp.oninput = paint;
    const inQ = (g) => { const q = inp.value.trim().toLowerCase(); return !q || g.name.toLowerCase().includes(q); };
    $('.sp', wrap).onclick = () => { groups.forEach((g) => (this.sportsGroups.has(g.name) ? hid.delete(g.key) : hid.add(g.key))); paint(); };
    $('.al', wrap).onclick = () => { groups.forEach((g) => { if (inQ(g)) hid.delete(g.key); }); paint(); };
    $('.nn', wrap).onclick = () => { groups.forEach((g) => { if (inQ(g)) hid.add(g.key); }); paint(); };
    $('.done', wrap).onclick = () => { st.hidden = [...hid]; this.save(); this.buildItems(); m.close(); this.renderGames(); };
    paint();
  },
  sportsChips() {
    const st = this.st, box = h('<div class="gd-sports"></div>');
    GD_LEAGUES.forEach(([k, l]) => {
      const b = h(`<button class="gd-sport ${st.leagues.includes(k) ? 'on' : ''}"><i>${TWI.check}</i><span>${l}</span></button>`);
      b.onclick = () => {
        const on = !st.leagues.includes(k);
        st.leagues = on ? GD_LEAGUES.map(([x]) => x).filter((x) => x === k || st.leagues.includes(x)) : st.leagues.filter((x) => x !== k);
        if (!st.leagues.length) { st.leagues = [k]; return; }
        if (st.league !== 'all' && !st.leagues.includes(st.league)) st.league = 'all';
        b.classList.toggle('on', on); this.save();
      };
      box.appendChild(b);
    });
    return box;
  },
  // Stream info (press I while watching): tells a weak stream apart from this PC struggling.
  toggleInfo() {
    const host = this.player && this.player.host; if (!host) return;
    let box = host.querySelector('.tv-info');
    if (box) { clearInterval(this.infoT); box.remove(); return; }
    box = h('<div class="tv-info"></div>'); host.appendChild(box);
    const paint = () => {
      if (!box.isConnected || !this.player) { clearInterval(this.infoT); return; }
      const s = this.player.stats();
      const res = s.h ? `${s.w}×${s.h}` : '—';
      const verdict = !s.h ? 'Loading…'
        : s.dropRate > 1 ? 'Your PC is dropping frames: the stream is fine, the playback is struggling.'
        : (s.kbps && s.kbps < 2500) || s.h < 700 ? 'The stream itself is low quality (low data rate or resolution).'
        : 'Stream and playback both look healthy.';
      box.innerHTML = `<b>Stream info</b>
        <div><span>Picture</span><em>${res} · ${s.fps ? Math.round(s.fps) : '—'} fps</em></div>
        <div><span>Data rate</span><em>${s.kbps ? (s.kbps / 1000).toFixed(1) + ' Mbit/s' : '—'}</em></div>
        <div><span>Dropped frames</span><em>${s.dropped} total${s.dropRate > 0.05 ? ` · ${s.dropRate.toFixed(1)}/s` : ''}</em></div>
        <div><span>Loaded ahead</span><em>${s.ahead.toFixed(1)} s</em></div>
        <div><span>Speed</span><em>${s.rate}×</em></div>
        <div><span>Playing as</span><em>${s.mode}</em></div>
        <p>${verdict}</p>`;
    };
    this.player.stats();   // first reading (starts the per-second counters)
    clearInterval(this.infoT); this.infoT = setInterval(paint, 1000); setTimeout(paint, 300);
  },
  openSportsPicker(first) {
    const wrap = h(`<div class="gd-pick"><div class="gd-pick-ic">${TVI.trophy}</div><h3>What do you watch?</h3><p class="muted">Game Day only shows live games for the sports you pick. Change it any time in settings.</p><div class="gd-pick-chips"></div><div class="btns" style="justify-content:flex-end;margin-top:22px"><button class="btn primary done">Done</button></div></div>`);
    $('.gd-pick-chips', wrap).appendChild(this.sportsChips());
    const m = openModal(wrap);
    $('.done', wrap).onclick = () => { this.st.sportsChosen = true; this.save(); m.close(); this.refreshGames(true); };
    void first;
  },
  async openSettings() {
    const st = this.st;
    const srcs = await window.reel.iptv.sources();
    const wrap = h(`<div class="tv-set"><h3>Live TV settings</h3>
      <div class="tv-set-sec"><div class="tv-eyebrow">Sports</div><div class="gd-lgs"></div></div>
      <div class="tv-set-sec"><div class="tv-eyebrow">Your teams</div><div class="gd-teams"></div>
        <label class="tw-set"><div><b>Kickoff alerts</b><span>A heads-up 10 minutes before your teams play</span></div><input type="checkbox" class="tw-sw" data-o="alerts"></label></div>
      <div class="tv-set-sec"><div class="tv-eyebrow">Source</div><div class="tv-srcs"></div>
        <button class="tw-pop-b grp">${TVI.list}<span>Channel groups…</span></button>
        <button class="tw-pop-b ref">${TWI.reload}<span>Refresh channels</span></button></div>
      <div class="tv-set-sec"><div class="tv-eyebrow">Playback</div>
        <label class="tw-set"><div><b>Delay vs. smoothness</b><span>Low = closest to live · Stable = fewest hiccups</span></div><span class="lat-slot"></span></label>
        <label class="tw-set"><div><b>Fix audio automatically</b><span>Converts Dolby (AC-3) audio your PC can’t play</span></div><input type="checkbox" class="tw-sw" data-o="autoFix"></label></div>
      <div class="btns" style="justify-content:flex-end;margin-top:14px"><button class="btn primary done">Done</button></div></div>`);
    const m = openModal(wrap);
    const lgs = $('.gd-lgs', wrap);
    lgs.appendChild(this.sportsChips());
    const tb = $('.gd-teams', wrap);
    const paintTeams = () => { tb.innerHTML = st.teams.length ? '' : '<div class="tw-hint">Star a team on any game to add it here.</div>'; st.teams.forEach((t) => { const b = h(`<button class="tw-chip on">${gdEsc(t.name)} ${TWI.x}</button>`); b.onclick = () => { st.teams = st.teams.filter((x) => x.id !== t.id); this.save(); paintTeams(); }; tb.appendChild(b); }); };
    paintTeams();
    const sbox = $('.tv-srcs', wrap);
    srcs.forEach((s) => {
      const a = this.accounts.find((x) => x.id === s.id) || {};
      const r = h(`<div class="tv-srow"><span class="tv-acct-dot"></span><div class="tw-row-t"><b>${gdEsc(s.name)}</b><span class="tw-row-s">${gdEsc(s.type === 'xtream' ? `Xtream · ${s.host}` : 'Playlist')}${a.exp ? ` · until ${new Date(a.exp).toLocaleDateString()}` : ''}${a.maxConn ? ` · ${a.maxConn} screen${a.maxConn === 1 ? '' : 's'}` : ''}</span></div><button class="tw-ib sm mor">${TWI.more}</button></div>`);
      $('.mor', r).onclick = (e) => { const b = e.currentTarget.getBoundingClientRect(); menuAt(b.left - 180, b.bottom + 4, s.name, [[TVI.edit, 'Edit', () => { m.close(); this.openSourceSheet(s.id); }], 'sep', [TWI.trash, 'Remove', async () => { if (!(await confirmSheet(`Remove ${s.name}?`, 'Its channels and login are removed from Reel.', 'Remove', true))) return; await window.reel.iptv.removeSource(s.id); m.close(); await this.reload(false); this.renderGames(); }, 'danger']]); };
      sbox.appendChild(r);
    });
    if (!srcs.length) { const b = h(`<button class="btn small">${TWI.plus} Add source</button>`); b.onclick = () => { m.close(); this.openSourceSheet(); }; sbox.appendChild(b); }
    $('.grp', wrap).onclick = () => { m.close(); this.openGroupPicker(); };
    $('.ref', wrap).onclick = async () => { m.close(); toast('Refreshing channels…'); await this.reload(true); this.renderGames(); toast('Channels updated'); };
    $('.lat-slot', wrap).appendChild(glassSelect('', [['low', 'Low delay'], ['balanced', 'Balanced'], ['stable', 'Stable']], st.latency, (v) => { st.latency = v; this.save(); }));
    $$('.tw-sw[data-o]', wrap).forEach((c) => { c.checked = !!st[c.dataset.o]; c.onchange = () => { st[c.dataset.o] = c.checked; this.save(); }; });
    $('.done', wrap).onclick = () => { m.close(); this.refreshGames(true); };
  },
};

// ---------- the page ----------
OWN_ART.add('livetv');
Views.livetv = async () => {
  if (!LiveTV.enabled()) return go('home', {}, true);
  await LiveTV.show();
  onLeave(() => LiveTV.hide());
};
document.addEventListener('keydown', (e) => {
  if (route.name !== 'livetv' || !LiveTV.el || document.querySelector('.modal-back, .ctx-menu') || e.altKey || e.ctrlKey || e.metaKey) return;
  const L = LiveTV, st = L.st, k = e.key;
  if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  const sheet = $('.gd-sheet', L.el);
  if (k === 'Escape' && sheet && !sheet.hidden) { sheet.hidden = true; sheet.innerHTML = ''; return; }
  if (!L.watching) return;
  const p = L.player;
  if (k === 'Escape') { const pop = $('.gd-pop', L.el); if (pop && !pop.hidden) return L.toggleCog(false); if (document.body.dataset.winfs === '1') return window.reel.fullscreen(false); return L.closeWatch(); }
  if (k === 'f' || k === 'F') return window.reel.fullscreen();
  if (k === 'i' || k === 'I') return L.toggleInfo();
  if (k === 'ArrowUp') { e.preventDefault(); return L.nextStream(-1); }
  if (k === 'ArrowDown') { e.preventDefault(); return L.nextStream(1); }
  if (k === ' ') { e.preventDefault(); p.togglePause(); return L.paintCtl(); }
  if (k === 'm' || k === 'M') { st.muted = !st.muted; L.save(); p.applyVolume(); return L.paintCtl(); }
  if (k === 'ArrowLeft') { p.seekBy(-10); return L.showOsd(); }
  if (k === 'ArrowRight') { p.seekBy(10); return L.showOsd(); }
});
if (LiveTV.enabled()) LiveTV.addNav();
