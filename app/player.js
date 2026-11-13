// Reel — stream picking (from your debrid service) and the in-app player.

const ICON = {
  play: '<svg viewBox="0 0 24 24"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><rect x="5.5" y="4" width="4.5" height="16" rx="1.2"/><rect x="14" y="4" width="4.5" height="16" rx="1.2"/></svg>',
  back10: '<svg viewBox="0 0 24 24"><path d="M12 5V2L7 6l5 4V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z"/><text x="12" y="16.5" font-size="7" font-weight="800" text-anchor="middle" font-family="Inter">10</text></svg>',
  fwd10: '<svg viewBox="0 0 24 24"><path d="M12 5V2l5 4-5 4V7a6 6 0 1 0 6 6h2a8 8 0 1 1-8-8z"/><text x="12" y="16.5" font-size="7" font-weight="800" text-anchor="middle" font-family="Inter">10</text></svg>',
  subs: '<svg viewBox="0 0 24 24"><path d="M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zm2 9v2h5v-2H6zm7 0v2h5v-2h-5zm-7-3v2h12v-2H6z"/></svg>',
  full: '<svg viewBox="0 0 24 24"><path d="M4 9V4h5v2H6v3H4zm10-5h6v5h-2V6h-4V4zM4 15h2v3h3v2H4v-5zm14 3v-3h2v5h-5v-2h3z"/></svg>',
  vol: '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4V9zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/></svg>',
  mute: '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4V9zm12.3.3 1.4-1.4L20 10.2l2.3-2.3 1.4 1.4-2.3 2.3 2.3 2.3-1.4 1.4-2.3-2.3-2.3 2.3-1.4-1.4 2.3-2.3-2.3-2.3z"/></svg>',
  streams: '<svg viewBox="0 0 24 24"><path d="M3 5h18v2H3V5zm0 6h18v2H3v-2zm0 6h12v2H3v-2z"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4L12 13.4 6.4 19 5 17.6 10.6 12 5 6.4z"/></svg>',
  // UI icons (used outside the player too)
  plus: '<svg class="ic" viewBox="0 0 24 24"><path d="M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7z"/></svg>',
  check: '<svg class="ic" viewBox="0 0 24 24"><path d="m9.5 16.2-4.2-4.2-1.4 1.4 5.6 5.6L21 7.5l-1.4-1.4z"/></svg>',
  eye: '<svg class="ic" viewBox="0 0 24 24"><path d="M12 5C6.5 5 2.7 9.3 1.5 12c1.2 2.7 5 7 10.5 7s9.3-4.3 10.5-7C21.3 9.3 17.5 5 12 5zm0 11.5a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9zm0-2.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/></svg>',
  pencil: '<svg class="ic" viewBox="0 0 24 24"><path d="M4 17.2V20h2.8l9.9-9.9-2.8-2.8L4 17.2zM19.7 7.1a1 1 0 0 0 0-1.4l-1.4-1.4a1 1 0 0 0-1.4 0l-1.2 1.2 2.8 2.8 1.2-1.2z"/></svg>',
  list: '<svg class="ic" viewBox="0 0 24 24"><path d="M3 5h2v2H3zm4 0h14v2H7zM3 11h2v2H3zm4 0h14v2H7zm-4 6h2v2H3zm4 0h14v2H7z"/></svg>',
  x: '<svg class="ic" viewBox="0 0 24 24"><path d="M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4L12 13.4 6.4 19 5 17.6 10.6 12 5 6.4z"/></svg>',
  skip: '<svg class="ic" viewBox="0 0 24 24"><path d="M5 6l8 6-8 6V6zm9 0h2v12h-2z"/></svg>',
  dice: '<svg class="ic" viewBox="0 0 24 24"><path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm2.5 3a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm9 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM12 10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM7.5 15a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm9 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/></svg>',
  playSm: '<svg class="ic" viewBox="0 0 24 24"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z"/></svg>',
  star: '<svg class="ic" viewBox="0 0 24 24"><path d="M12 17.3 6.2 20.6l1.5-6.5L2.6 9.7l6.7-.6L12 3l2.7 6.1 6.7.6-5.1 4.4 1.5 6.5zm0-2.3 3.5 2-1-3.9 3.1-2.7-4-.4L12 6.3l-1.6 3.7-4 .4 3.1 2.7-.9 3.9z"/></svg>',
  starFill: '<svg class="ic" viewBox="0 0 24 24"><path d="M12 17.3 6.2 20.6l1.5-6.5L2.6 9.7l6.7-.6L12 3l2.7 6.1 6.7.6-5.1 4.4 1.5 6.5z"/></svg>',
  heart: '<svg class="ic" viewBox="0 0 24 24"><path d="M12 20.3 10.6 19C5.4 14.4 2 11.3 2 7.5 2 4.4 4.4 2 7.5 2c1.7 0 3.4.8 4.5 2.1A6 6 0 0 1 16.5 2C19.6 2 22 4.4 22 7.5c0 3.8-3.4 6.9-8.6 11.5L12 20.3zm0-2.7c4.8-4.3 8-7.2 8-10.1C20 5.5 18.5 4 16.5 4c-1.5 0-3 1-3.6 2.4h-1.8C10.5 5 9 4 7.5 4 5.5 4 4 5.5 4 7.5c0 2.9 3.2 5.8 8 10.1z"/></svg>',
  heartFill: '<svg class="ic" viewBox="0 0 24 24"><path d="M12 20.3 10.6 19C5.4 14.4 2 11.3 2 7.5 2 4.4 4.4 2 7.5 2c1.7 0 3.4.8 4.5 2.1A6 6 0 0 1 16.5 2C19.6 2 22 4.4 22 7.5c0 3.8-3.4 6.9-8.6 11.5L12 20.3z"/></svg>',
  chevDown: '<svg class="ic" viewBox="0 0 24 24"><path d="M7.4 8.6 12 13.2l4.6-4.6L18 10l-6 6-6-6z"/></svg>',
  bookmark: '<svg class="ic" viewBox="0 0 24 24"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1zm1 2v12.5l5-2.9 5 2.9V5H7z"/></svg>',
  bookmarkFill: '<svg class="ic" viewBox="0 0 24 24"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/></svg>',
  checkCircle: '<svg class="ic" viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm0 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm4.3 4.3 1.4 1.4-7.2 7.2-4.2-4.2 1.4-1.4 2.8 2.8z"/></svg>',
  checkCircleFill: '<svg class="ic" viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm4.3 6.3-5.8 5.8-2.8-2.8-1.4 1.4 4.2 4.2 7.2-7.2z"/></svg>',
  listPlus: '<svg class="ic" viewBox="0 0 24 24"><path d="M3 6h12v2H3zm0 5h12v2H3zm0 5h8v2H3zm14-3h2v3h3v2h-3v3h-2v-3h-3v-2h3z"/></svg>',
  film: '<svg class="ic" viewBox="0 0 24 24"><path d="M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm1 2v2h2V6zm12 0v2h2V6zM5 10v4h2v-4zm12 0v4h2v-4zM5 16v2h2v-2zm12 0v2h2v-2zM9 6v12h6V6z"/></svg>',
  search: '<svg class="ic" viewBox="0 0 24 24"><path d="M10.5 3a7.5 7.5 0 0 1 6 12l4.3 4.3-1.4 1.4-4.3-4.3a7.5 7.5 0 1 1-4.6-13.4zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11z"/></svg>',
  thumbUp: '<svg class="ic" viewBox="0 0 24 24"><path d="M2 10h4v11H2zm6 11V10l5.5-8 1.2.9c.5.4.7 1 .6 1.6L14.3 9H20a2 2 0 0 1 2 2.3l-1.3 8A2 2 0 0 1 18.7 21z"/></svg>',
  thumbDown: '<svg class="ic" viewBox="0 0 24 24"><path d="M22 14h-4V3h4zM16 3v11l-5.5 8-1.2-.9a1.6 1.6 0 0 1-.6-1.6L9.7 15H4a2 2 0 0 1-2-2.3l1.3-8A2 2 0 0 1 5.3 3z"/></svg>',
  compass: '<svg class="ic" viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm0 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm4.5 3.5-2.8 6.2-6.2 2.8 2.8-6.2zM12 10.8a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4z"/></svg>',
  trophy: '<svg class="ic" viewBox="0 0 24 24"><path d="M7 3h10v2h4v3a4 4 0 0 1-4 4h-.3A5 5 0 0 1 13 14.9V17h3v2H8v-2h3v-2.1A5 5 0 0 1 7.3 12H7a4 4 0 0 1-4-4V5h4zm10 4v3a2 2 0 0 0 2-2V7zM5 7v1a2 2 0 0 0 2 2V7zm4-2v5a3 3 0 0 0 6 0V5z"/></svg>',
  layers: '<svg class="ic" viewBox="0 0 24 24"><path d="M12 2 2 7l10 5 10-5zm-7.8 9.1L2 12.2l10 5 10-5-2.2-1.1L12 15zm0 5L2 17.2l10 5 10-5-2.2-1.1L12 20z"/></svg>',
  user: '<svg class="ic" viewBox="0 0 24 24"><path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-4.4 0-8 2.2-8 5v3h16v-3c0-2.8-3.6-5-8-5z"/></svg>',
  target: '<svg class="ic" viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm0 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm0 3a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm0 2a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/></svg>',
  shuffle: '<svg class="ic" viewBox="0 0 24 24"><path d="M17 3l4 4-4 4V8h-2.6l-3.1 4 3.1 4H17v-3l4 4-4 4v-3h-3.6l-3.4-4.4L6.6 18H3v-2h2.6l3.1-4-3.1-4H3V6h3.6L10 10.4 13.4 6H17z"/></svg>',
  snow: '<svg class="ic" viewBox="0 0 24 24"><path d="M11 2h2v4.6l2.6-2.6 1.4 1.4-4 4V11h1.6l4-4 1.4 1.4-2.6 2.6H22v2h-4.6l2.6 2.6-1.4 1.4-4-4H13v1.6l4 4-1.4 1.4-2.6-2.6V22h-2v-4.6l-2.6 2.6L7 18.6l4-4V13H9.4l-4 4L4 15.6 6.6 13H2v-2h4.6L4 8.4 5.4 7l4 4H11V9.4l-4-4L8.4 4 11 6.6z"/></svg>',
  pumpkin: '<svg class="ic" viewBox="0 0 24 24"><path d="M12.6 2.2c.9-.4 2-.2 2.6.4l-1.4 1.4c-.3-.2-.6-.2-.9 0-.3.3-.4.9-.4 1.6.9-.4 2-.6 3.2-.6C19.5 5 22 8.1 22 12.5S19.5 20 15.7 20c-1.4 0-2.7-.5-3.7-1.4-1 .9-2.3 1.4-3.7 1.4C4.5 20 2 16.9 2 12.5S4.5 5 8.3 5c1 0 1.9.2 2.7.5 0-1.4.5-2.7 1.6-3.3zM8 10l-1.5 2.5h3zm8 0l-1.5 2.5h3zm-8.5 4c1 1.8 2.7 2.8 4.5 2.8s3.5-1 4.5-2.8l-1.6-.3-.9 1-1-1-1 1-1-1-.9 1z"/></svg>',
  more: '<svg class="ic" viewBox="0 0 24 24"><circle cx="5" cy="12" r="2.1"/><circle cx="12" cy="12" r="2.1"/><circle cx="19" cy="12" r="2.1"/></svg>',
  sparkle: '<svg class="ic" viewBox="0 0 24 24"><path d="M12 2l2.2 6.3L20.5 10.5 14.2 12.7 12 19l-2.2-6.3L3.5 10.5l6.3-2.2zM19 15l1 2.5 2.5 1-2.5 1L19 22l-1-2.5-2.5-1 2.5-1z"/></svg>',
  pip: '<svg viewBox="0 0 24 24"><path d="M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm1 2v10h16V7H4zm8 4h7v5h-7z"/></svg>',
  info: '<svg class="ic" viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm-1 8v7h2v-7zm0-3v2h2V7z"/></svg>',
  back: '<svg class="ic" viewBox="0 0 24 24"><path d="M15.4 4.6 8 12l7.4 7.4-1.4 1.4L5.2 12 14 3.2z"/></svg>',
  folder: '<svg class="ic" viewBox="0 0 24 24"><path d="M3 6a2 2 0 0 1 2-2h4.6l2 2H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z"/></svg>',
  people: '<svg class="ic" viewBox="0 0 24 24"><path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM9 13c-3.3 0-7 1.6-7 4v3h14v-3c0-2.4-3.7-4-7-4zm8 0c-.6 0-1.2 0-1.8.2 1.1.9 1.8 2.1 1.8 3.8v3h5v-3c0-2.2-2.9-4-5-4z"/></svg>',
  undo: '<svg class="ic" viewBox="0 0 24 24"><path d="M12.5 8c-2.6 0-5 1-6.9 2.6L2 7v9h9l-3.6-3.6A8 8 0 0 1 20.2 16l2.4-.8A10.5 10.5 0 0 0 12.5 8z"/></svg>',
  filter: '<svg class="ic" viewBox="0 0 24 24"><path d="M3 5h18l-7 8v6l-4-2v-4z"/></svg>',
  grid: '<svg class="ic" viewBox="0 0 24 24"><path d="M3 3h8v8H3zm10 0h8v8h-8zM3 13h8v8H3zm10 0h8v8h-8z"/></svg>',
  rewatch: '<svg class="ic" viewBox="0 0 24 24"><path d="M12 5V2L8 6l4 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z"/></svg>',
};

// What this PC's video engine can decode (HEVC depends on the GPU / Windows HEVC support).
const CAN_HEVC = ['hvc1.2.4.L153.B0', 'hvc1.1.6.L150.B0'].some(c => window.MediaSource && MediaSource.isTypeSupported(`video/mp4; codecs="${c}"`));

// Target bitrates (Mbps) per resolution: inside the window = sharp picture without a bloated file.
const BITRATE = { 2160: [14, 45], 1080: [6, 22], 720: [2.5, 8], 480: [1, 3] };
const SIZE_GB = { 2160: [12, 60], 1080: [3, 20], 720: [1, 5], 480: [0.5, 2] };

function rankStreams(list, runtimeMin, memKey) {
  const s = Store.settings;
  // Stream memory: the exact file you played before (movies), or the same release line (next episodes).
  const mem = memKey && Store.data.streamPick[memKey];
  const score = (x) => {
    let v = 0;
    if (mem && x.cached) {
      if (mem.filename && x.filename === mem.filename) v += 5000;
      else if (mem.group && x.group && x.group === mem.group) v += 2500;
    }
    if (x.cached) v += 1000;
    if (x.flags.includes('CAM')) v -= 3000;
    if (x.flags.includes('3D')) v -= 400;
    if (x.flags.includes('UPSCALE')) v -= 300;
    if (x.flags.includes('HC')) v -= 150;
    v += x.quality > s.maxQuality ? -400 : ({ 2160: 60, 1080: 40, 720: 20, 480: 5 }[x.quality] || 0);
    if (x.flags.includes('HEVC') && !CAN_HEVC) v -= 500;
    if (s.avoidDV && x.flags.includes('DV') && !x.flags.includes('HDR') && !x.flags.includes('HDR10+')) v -= 250;
    if (x.foreignOnly && (s.audioLang || 'eng') === 'eng') v -= 200;
    const q = BITRATE[x.quality] ? x.quality : 1080;
    if (x.sizeGB) {
      const [lo, hi] = runtimeMin ? BITRATE[q] : SIZE_GB[q];
      const val = runtimeMin ? (x.sizeGB * 8192) / (runtimeMin * 60) : x.sizeGB;
      if (val >= lo && val <= hi) v += 25;
      else if (val < lo) v -= ((lo - val) / lo) * 40;
      else v -= Math.min(30, ((val - hi) / hi) * 25);
    }
    // Popularity comes after quality/format: well-seeded releases are common, well-encoded and quick for the
    // debrid service to fetch. Log scale so it breaks ties without outranking a better picture.
    v += Math.min(10, Math.log10(1 + x.seeders) * 4);
    if (!x.cached && x.seeders < 3) v -= 8;
    return v;
  };
  return list.map(x => ({ ...x, score: score(x) })).sort((a, b) => b.score - a.score);
}

// Pick the audio track in your language (or the one you chose for this show before); otherwise the file's default.
function pickAudio(tracks, prefKey) {
  const pref = prefKey && Store.data.trackPrefs[prefKey];
  const want = ((pref && pref.audioLang) || Store.settings.audioLang || 'eng').slice(0, 2);
  const lang = tracks.filter(t => (t.lang || '').slice(0, 2) === want && !/commentary/i.test(t.title || ''));
  const best = lang.sort((a, b) => (b.channels || 0) - (a.channels || 0))[0];
  return (best || tracks.find(t => t.default) || tracks[0] || {}).index;
}

const Playback = {
  cache: new Map(), // stream id -> { list, at } so reopening a title doesn't re-query Torrentio

  async getStreams(meta, ep) {
    if (!meta.imdb) meta.imdb = await TMDB.imdbId(meta.type, meta.id);
    if (!meta.imdb) throw new Error('No IMDb ID for this title, so streams can’t be looked up.');
    const sid = meta.type === 'movie' ? meta.imdb : `${meta.imdb}:${ep.season}:${ep.episode}`;
    const stype = meta.type === 'movie' ? 'movie' : 'series';
    const hit = this.cache.get(sid);
    let raw;
    if (hit && Date.now() - hit.at < 15 * 60e3) raw = hit.raw;
    else { raw = await window.reel.streams(stype, sid); this.cache.set(sid, { raw, at: Date.now() }); }
    const list = rankStreams(raw, meta.runtime || (meta.type === 'tv' ? 45 : 115), `${meta.type}:${meta.id}`);
    return { list, stype, sid, best: list.find(x => x.cached && !x.flags.includes('CAM')) };
  },
  remember(meta, x) {
    Store.data.streamPick[`${meta.type}:${meta.id}`] = { filename: meta.type === 'movie' ? x.filename : '', group: x.group, quality: x.quality, at: Date.now() };
    Store.save();
  },
  isRemembered(meta, x) {
    const mem = Store.data.streamPick[`${meta.type}:${meta.id}`];
    return !!(mem && ((mem.filename && mem.filename === x.filename) || (!mem.filename && mem.group && mem.group === x.group)));
  },

  // Renders the stream list (used in the picker sheet and inside the player).
  renderList(box, meta, list, best, current, onPick) {
    const runtime = meta.runtime || (meta.type === 'tv' ? 45 : 115);
    list.forEach((x, i) => {
      const el = h(`<div class="stream ${x === best ? 'best' : ''} ${current && current.url === x.url ? 'current' : ''}" style="animation-delay:${Math.min(i, 12) * 25}ms">
        <div class="q">${x.quality ? (x.quality === 2160 ? '4K' : x.quality + 'p') : '?'}<small>${x.sizeGB ? x.sizeGB.toFixed(1) + ' GB' : ''}</small></div>
        <div>
          <div class="tags">${current && current.url === x.url ? '<span class="tag cached">Playing</span>' : x === best ? '<span class="tag cached">Best match</span>' : ''}${this.isRemembered(meta, x) ? '<span class="tag">Last played</span>' : ''}${x.cached ? '<span class="tag">Instant</span>' : '<span class="tag uncached">Not cached</span>'}${x.flags.map(f => `<span class="tag">${f}</span>`).join('')}</div>
          <div class="fn">${esc(x.filename)}</div>
        </div>
        <div class="meta">${x.sizeGB ? `~${Math.round((x.sizeGB * 8192) / (runtime * 60))} Mbps` : ''}<br><span class="peers" title="People sharing this release">${ICON.people}${x.seeders.toLocaleString()}</span> · ${esc(x.source)}</div>
      </div>`);
      el.onclick = () => {
        if (!x.cached) toast('Not cached yet — your debrid service will start fetching it. If it doesn’t play, try again in a few minutes.');
        onPick(x);
      };
      box.appendChild(el);
    });
  },

  // Entry point: find streams for a movie or an episode and play the best one (or show the list).
  async start(meta, ep, { manual, resumeAt } = {}) {
    const sheet = h(`<div><div class="sheet-head"><div><div class="eyebrow">${ep ? `S${ep.season}, E${ep.episode}` : 'Choose a stream'}</div><h3>${esc(meta.title)}</h3>${ep ? `<div class="muted">${esc(ep.name || '')}</div>` : ''}</div><button class="btn small round close">${ICON.x}</button></div><div class="body" style="display:flex;align-items:center;gap:14px;padding:20px 0"><div class="spinner"></div><div class="muted">Finding streams…</div></div></div>`);
    let m = null;
    const cachedQuick = !manual && Store.settings.autoPlay;
    // Only show the sheet right away when the list is needed (or the lookup is slow).
    const showT = setTimeout(() => { m = openModal(sheet, { wide: true }); $('.close', sheet).onclick = m.close; }, cachedQuick ? 350 : 0);
    try {
      const { list, stype, sid, best } = await this.getStreams(meta, ep);
      if (!list.length) throw new Error('No playable debrid streams were found for this one.');
      if (cachedQuick && best) {
        clearTimeout(showT); m && m.close();
        return Player.open(meta, ep, best, list, { stype, sid }, { resumeAt });
      }
      clearTimeout(showT);
      if (!m) { m = openModal(sheet, { wide: true }); $('.close', sheet).onclick = m.close; }
      const body = $('.body', sheet);
      body.style.display = 'block';
      body.innerHTML = `<div class="dim" style="font-size:13px;margin-bottom:14px">${list.filter(x => x.cached).length} instant · ${list.length} total · sorted by picture quality, then popularity</div><div class="stream-list"></div>`;
      this.renderList($('.stream-list', body), meta, list, best, null, (x) => { m.close(); Player.open(meta, ep, x, list, { stype, sid }, { resumeAt }); });
    } catch (e) {
      clearTimeout(showT);
      if (!m) { m = openModal(sheet, { wide: true }); $('.close', sheet).onclick = m.close; }
      $('.body', sheet).innerHTML = `<div><div style="font-weight:600;margin-bottom:6px">Couldn’t load streams</div><div class="muted">${esc(cleanErr(e))}</div>${/Settings/.test(cleanErr(e)) ? '<button class="btn small primary" style="margin-top:14px" id="to-settings">Open Settings</button>' : ''}</div>`;
      const b = $('#to-settings', sheet); if (b) b.onclick = () => { m.close(); go('settings', { tab: 'account' }); };
    }
  },
};

function cleanErr(e) { return String((e && e.message) || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''); }

function parseSubs(text) {
  const cues = [];
  const toSec = (t) => { const m = t.trim().replace(',', '.').match(/(?:(\d+):)?(\d+):(\d+)\.(\d+)/); if (!m) return 0; return (+m[1] || 0) * 3600 + (+m[2]) * 60 + (+m[3]) + (+('0.' + m[4])); };
  for (const block of text.replace(/\r/g, '').split(/\n\n+/)) {
    const lines = block.split('\n');
    const i = lines.findIndex(l => l.includes('-->'));
    if (i < 0) continue;
    const [a, b] = lines[i].split('-->');
    const body = lines.slice(i + 1).join('\n').replace(/<[^>]+>/g, '').replace(/\{\\[^}]+\}/g, '').trim();
    if (body) cues.push({ s: toSec(a), e: toSec(b), t: body });
  }
  return cues;
}

const LANGS = { eng: 'English', spa: 'Spanish', fre: 'French', fra: 'French', ger: 'German', deu: 'German', ita: 'Italian', por: 'Portuguese', pob: 'Portuguese (BR)', dut: 'Dutch', rus: 'Russian', ara: 'Arabic', hin: 'Hindi', jpn: 'Japanese', kor: 'Korean', chi: 'Chinese', zho: 'Chinese', tur: 'Turkish', pol: 'Polish', swe: 'Swedish', nor: 'Norwegian', dan: 'Danish', fin: 'Finnish', gre: 'Greek', heb: 'Hebrew', vie: 'Vietnamese', ind: 'Indonesian', tha: 'Thai', rum: 'Romanian', hun: 'Hungarian', cze: 'Czech' };

const langDisplay = new Intl.DisplayNames(['en'], { type: 'language' });
function langName(code) {
  if (!code || code === 'und') return 'Unknown';
  if (LANGS[code]) return LANGS[code];
  try { return langDisplay.of(code) || code; } catch { return code; }
}

const Player = {
  cur: null,

  async open(meta, ep, stream, list, ids, { resumeAt } = {}) {
    const wasOpen = !!this.cur;
    this.close(true, true);
    const pkey = meta.type === 'movie' ? `movie:${meta.id}` : `tv:${meta.id}:${ep.season}:${ep.episode}`;
    const prog = Store.data.progress[pkey];
    const sub = ep ? `S${ep.season}, E${ep.episode}${ep.name ? ' · ' + ep.name : ''}` : (meta.year || '');
    const root = h(`<div class="player">
      <div class="p-art" style="background-image:url('${TMDB.img((ep && ep.still) || meta.backdrop, 'original')}')"></div>
      <video playsinline></video>
      <div class="subs"><span style="display:none"></span></div>
      <div class="flash"></div>
      <div class="loading"><div class="load-card">
        <div class="load-logo"><div class="load-title">${esc(meta.title)}</div></div>
        ${ep ? `<div class="load-sub">${esc(sub)}</div>` : ''}
        <div class="spinner"></div><div class="msg">Preparing stream…</div>
      </div></div>
      <div class="chrome">
        <div class="p-top">
          <button class="pbtn x" title="Back (Esc)">${ICON.back}</button>
          <button class="btn small restart" style="display:none">${ICON.rewatch} Start over</button>
          <div class="p-vol p-glass">
            <input type="range" class="volume" min="0" max="1" step="0.05" value="1">
            <button class="pbtn mute" title="Mute (M)">${ICON.vol}</button>
          </div>
        </div>
        <div class="p-center">
          <button class="pbtn ring b10" title="Back 10s (←)">${ICON.back10}</button>
          <button class="pbtn ring big pp" title="Play/Pause (Space)">${ICON.pause}</button>
          <button class="pbtn ring f10" title="Forward 10s (→)">${ICON.fwd10}</button>
        </div>
        <div class="p-bottom">
          <div class="p-info">
            <div><div class="st">${esc(sub)}</div><div class="t">${esc(meta.title)}</div></div>
            <div class="qbadges"></div>
            <div class="p-tools p-glass">
              <button class="pbtn sbtn" title="Subtitles & audio (S)">${ICON.subs}</button>
              <button class="pbtn strbtn" title="Change stream">${ICON.streams}</button>
              <button class="pbtn pipbtn" title="Picture in picture (P)">${ICON.pip}</button>
              <button class="pbtn fs" title="Fullscreen (F)">${ICON.full}</button>
            </div>
          </div>
          <div class="p-float"><button class="btn next-early" style="display:none">${ICON.skip} Next episode</button></div>
          <div class="p-timeline">
            <span class="el">0:00</span>
            <div class="scrub"><div class="track"><div class="buf"></div><div class="cur"></div></div><div class="knob"></div><div class="hover-time"></div></div>
            <span class="rem">-0:00</span>
          </div>
        </div>
      </div>
    </div>`);
    $('#player-root').appendChild(root);
    TMDB.logo(meta.type, meta.id).then(p => { if (p && root.isConnected) $('.load-logo', root).innerHTML = `<img src="${TMDB.img(p, 'w500')}" alt="${esc(meta.title)}">`; });
    const video = $('video', root);
    const st = this.cur = {
      root, video, meta, ep, stream, list, ids, pkey,
      info: null, offset: 0, audio: null, cues: [], subId: null, subsAvail: null, cueIdx: 0,
      subDelay: Store.data.subDelay[`${meta.type}:${meta.id}`] || 0,
      finished: false, idleT: null, saveT: null, closed: false,
    };
    video.volume = Store.settings.volume ?? 1;
    $('.volume', root).value = video.volume;
    this.wire();
    if (!wasOpen) window.reel.fullscreen(true);

    // Prepare, falling back to the next cached stream if a link fails.
    const candidates = [stream, ...list.filter(x => x !== stream && x.cached && !x.flags.includes('CAM'))].slice(0, 4);
    for (const cand of candidates) {
      try {
        $('.loading .msg', root).textContent = cand === stream ? 'Preparing stream…' : 'That link failed, trying the next one…';
        st.info = await window.reel.prepare(cand.url);
        st.stream = cand;
        break;
      } catch (e) { st.lastErr = e; }
      if (st.closed) return;
    }
    if (st.closed) return;
    if (!st.info) return this.fail(cleanErr(st.lastErr || 'No playable stream.'));
    const i = st.info;
    st.prefKey = `${meta.type}:${meta.id}`;
    st.audio = pickAudio(i.audioTracks, st.prefKey);
    Playback.remember(meta, st.stream);
    this.badges();
    const start = resumeAt != null ? resumeAt : (prog && prog.pos > 60 && prog.pos < (prog.dur || i.duration) * 0.92 ? prog.pos : 0);
    if (start && resumeAt == null) { const r = $('.restart', root); r.style.display = ''; setTimeout(() => (r.style.display = 'none'), 12000); }
    this.load(start);
    this.loadSubs();
    document.dispatchEvent(new CustomEvent('reel:play', { detail: st }));
  },

  // Quality badges: resolution, HDR, audio channels.
  badges() {
    const s = this.cur, i = s.info;
    const a = i.audioTracks.find(t => t.index === s.audio) || {};
    const b = [];
    if (i.height >= 1600 || i.width >= 3200) b.push('4K'); else if (i.height >= 1000 || i.width >= 1900) b.push('HD');
    if (i.hdr === 'dv' || s.stream.flags.includes('DV')) b.push('Dolby Vision');
    else if (i.hdr || s.stream.flags.some(f => f.startsWith('HDR'))) b.push('HDR');
    if (a.channels >= 6) b.push(a.channels >= 8 ? '7.1' : '5.1');
    if (s.stream.flags.includes('Atmos')) b.push('Atmos');
    $('.qbadges', s.root).innerHTML = b.map(x => `<span>${x}</span>`).join('');
  },

  flash(icon) {
    const f = $('.flash', this.cur.root);
    f.innerHTML = icon;
    f.classList.remove('on'); void f.offsetWidth; f.classList.add('on');
  },

  // Seconds of video already loaded past the current spot.
  ahead() {
    const s = this.cur; if (!s || s.pendingSeek != null) return 0;
    const v = s.video, b = v.buffered, t = v.currentTime;
    for (let i = 0; i < b.length; i++) if (b.start(i) <= t + 0.3 && b.end(i) >= t) return b.end(i) - t;
    return 0;
  },
  // Jump to a time without reloading the stream, if that spot is already loaded. Returns false if it isn't.
  jumpLoaded(t) {
    const s = this.cur; if (!s || !s.info || s.pendingSeek != null) return false;
    const v = s.video, rel = (s.info.mode === 'remux' || s.needTx) ? t - (s.offset || 0) : t;
    const inside = (r) => { for (let i = 0; i < r.length; i++) if (r.start(i) <= rel && r.end(i) >= rel + 0.5) return true; return false; };
    if (rel < 0 || !inside(v.buffered) || !inside(v.seekable)) return false;
    v.currentTime = rel; this.subsFollow && this.subsFollow(t); this.paint();
    return true;
  },
  duration() { const s = this.cur; return (s.info && s.info.duration) || s.video.duration || 0; },
  time() {
    const s = this.cur;
    if (s.pendingSeek != null) return s.pendingSeek;
    return s.info && (s.info.mode === 'remux' || s.needTx) ? s.offset + s.video.currentTime : s.video.currentTime;
  },

  load(t, play = true) {
    const s = this.cur, v = s.video;
    s.root.classList.add('buffering');
    // HEVC on a PC without HEVC decoding (common on laptops) would play as sound over a black screen: convert it.
    if (s.needTx == null) s.needTx = s.info.videoCodec === 'hevc' && !CAN_HEVC;
    if (s.info.mode === 'direct' && !s.needTx) {
      v.removeAttribute('crossorigin');
      v.src = s.info.directUrl;
      if (t) v.addEventListener('loadedmetadata', () => (v.currentTime = t), { once: true });
    } else {
      s.offset = t;
      v.crossOrigin = 'anonymous'; // lets audio boost process the local stream
      v.src = `${s.info.streamBase}?t=${t.toFixed(2)}&a=${s.audio ?? ''}${s.needTx ? '&tx=1' : ''}`;
    }
    const rate = v.playbackRate;
    if (play) v.play().catch(() => {});
    v.playbackRate = rate;
    this.subsFollow(t);
  },
  seek(t) {
    const s = this.cur; if (!s || !s.info) return;
    t = Math.max(0, Math.min(this.duration() - 2, t));
    s.cueIdx = 0;
    if (s.info.mode === 'direct' && !s.needTx) { s.video.currentTime = t; this.subsFollow(t); }
    else {
      // Remux mode restarts the stream at the new spot; batch rapid presses into one restart.
      if (s.pendingSeek == null) s.seekPlay = !s.video.paused;
      s.pendingSeek = t;
      s.offset = t; s.video.pause();
      clearTimeout(s.seekT);
      s.seekT = setTimeout(() => { this.load(s.pendingSeek, s.seekPlay !== false); s.pendingSeek = null; }, 350);
    }
    this.paint();
  },
  skip(d) {
    const s = this.cur; if (!s || !s.info) return;
    const from = s.pendingSeek != null ? s.pendingSeek : this.time();
    this.seek(from + d);
    this.flash(`<b>${d > 0 ? '+' : '−'}${Math.abs(d)}</b>`);
  },

  // Panels (subtitle menu, stream list) — at most one open. Clicking outside closes it without touching playback.
  panel() { return this.cur && $('.popover, .p-panel', this.cur.root); },
  closePanel() { const p = this.panel(); if (p) { p.classList.add('closing'); setTimeout(() => p.remove(), 180); } },

  wire() {
    const s = this.cur, { root, video } = s;
    const pp = $('.pp', root);
    const toggle = () => {
      if (!s.info) return;
      if (video.paused) { video.play(); this.flash(ICON.play); } else { video.pause(); this.flash(ICON.pause); }
    };
    pp.onclick = toggle;
    video.onclick = toggle;
    video.ondblclick = () => window.reel.fullscreen();
    video.onplay = () => (pp.innerHTML = ICON.pause);
    video.onpause = () => (pp.innerHTML = ICON.play);
    video.onwaiting = () => root.classList.add('buffering');
    video.onplaying = () => {
      root.classList.remove('buffering'); root.classList.add('started');
      // Safety net: if time is moving but no picture ever shows up, switch to the converted video (once).
      clearTimeout(s.blackT);
      if (!s.needTx) s.blackT = setTimeout(() => {
        if (!this.cur || this.cur !== s || s.needTx || video.paused) return;
        const q = video.getVideoPlaybackQuality ? video.getVideoPlaybackQuality() : null;
        if (video.videoWidth === 0 || (q && q.totalVideoFrames === 0)) { s.needTx = true; toast('Converting the picture for this PC…'); this.load(this.time()); }
      }, 5000);
    };
    video.ontimeupdate = () => this.paint();
    video.onended = () => this.ended();
    video.onerror = () => {
      if (!s.info || s.switching) return;
      this.fail(s.info.mode === 'direct' ? 'This file wouldn’t play. Try another stream.' : 'This video format isn’t supported on your PC (often Dolby Vision–only or an unusual codec). Try another stream.');
    };
    // An open panel swallows the first outside click: it just closes the panel.
    root.addEventListener('pointerdown', (e) => {
      const p = this.panel();
      if (!p || p.contains(e.target) || e.target.closest('.sbtn, .strbtn')) return;
      e.stopPropagation(); e.preventDefault();
      s.swallow = true;
      this.closePanel();
    }, true);
    root.addEventListener('click', (e) => { if (s.swallow) { s.swallow = false; e.stopPropagation(); e.preventDefault(); } }, true);

    $('.b10', root).onclick = () => this.skip(-10);
    $('.f10', root).onclick = () => this.skip(10);
    $('.x', root).onclick = () => this.close();
    $('.fs', root).onclick = () => window.reel.fullscreen();
    $('.restart', root).onclick = (e) => { e.currentTarget.style.display = 'none'; this.seek(0); };
    $('.sbtn', root).onclick = () => this.menu();
    $('.strbtn', root).onclick = () => this.streamPanel();
    $('.pipbtn', root).onclick = () => this.pip();
    $('.next-early', root).onclick = async () => { const next = await this.nextEpisode(); if (next) { if (!s.finished) this.markFinished(); Playback.start(s.meta, next); } };
    // Picture in picture: the player hides so you can keep browsing; closing the mini window brings it back.
    video.addEventListener('enterpictureinpicture', () => {
      s.pip = true; root.classList.add('pip-hidden'); window.reel.fullscreen(false);
      const pill = h(`<button class="pip-pill">${ICON.pip.replace('<svg', '<svg class="ic"')} Back to ${esc(s.meta.title)}</button>`);
      pill.onclick = () => document.exitPictureInPicture().catch(() => {});
      document.body.appendChild(pill); s.pipPill = pill;
    });
    video.addEventListener('leavepictureinpicture', () => {
      s.pip = false; if (s.pipPill) s.pipPill.remove();
      if (!s.closed) { root.classList.remove('pip-hidden'); window.reel.fullscreen(true); }
    });
    const vol = $('.volume', root), mute = $('.mute', root);
    const paintVol = () => vol.style.setProperty('--v', `${video.muted ? 0 : video.volume * 100}%`);
    vol.oninput = () => { video.volume = +vol.value; video.muted = false; Store.settings.volume = video.volume; Store.save(); mute.innerHTML = ICON.vol; paintVol(); };
    mute.onclick = () => { video.muted = !video.muted; mute.innerHTML = video.muted ? ICON.mute : ICON.vol; paintVol(); };
    paintVol();

    const scrub = $('.scrub', root), ht = $('.hover-time', root);
    const at = (e) => { const r = scrub.getBoundingClientRect(); return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * this.duration(); };
    scrub.onmousemove = (e) => { ht.textContent = fmtTime(at(e)); ht.style.left = `${e.clientX - scrub.getBoundingClientRect().left}px`; };
    scrub.onclick = (e) => this.seek(at(e));

    const wake = () => {
      root.classList.remove('idle');
      clearTimeout(s.idleT);
      s.idleT = setTimeout(() => { if (!video.paused && !this.panel()) root.classList.add('idle'); }, 3000);
    };
    root.onmousemove = wake; wake();

    // Pause screen (Apple TV / Netflix style): a few seconds after pausing, the picture dims and shows what you're
    // watching — title or logo, episode, a short summary, how far in you are and when it would end.
    const pinfo = h('<div class="pause-info"><div class="pi-body"></div></div>');
    root.appendChild(pinfo);
    const details = async () => {
      if (s.pdetail) return s.pdetail;
      const m = s.meta;
      try {
        if (m.type === 'tv' && s.ep) {
          const sd = await TMDB.season(m.id, s.ep.season);
          const e = (sd.episodes || []).find(x => x.episode_number === s.ep.episode) || {};
          s.pdetail = { overview: e.overview || m.overview || '', runtime: e.runtime, rating: e.vote_average, air: e.air_date };
        } else {
          const d = await TMDB.get(`/movie/${m.id}`);
          s.pdetail = { overview: d.overview || m.overview || '', runtime: d.runtime, rating: d.vote_average, genres: (d.genres || []).map(g => g.name).slice(0, 2) };
        }
      } catch { s.pdetail = { overview: s.meta.overview || '' }; }
      return s.pdetail;
    };
    const showInfo = async () => {
      if (!video.paused || !s.info || s.closed || s.pip || this.panel() || video.ended) return;
      const d = await details();
      if (!video.paused || s.closed) return;
      const dur = this.duration(), t = this.time();
      const left = Math.max(0, dur - t) / (video.playbackRate || 1);
      const ends = new Date(Date.now() + left * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      const logo = $('.load-logo img', root);
      const m = s.meta;
      $('.pi-body', pinfo).innerHTML = `
        <div class="pi-eyebrow">${ICON.pause} Paused</div>
        ${logo ? `<img class="pi-logo" src="${logo.src}" alt="${esc(m.title)}">` : `<h1 class="pi-title">${esc(m.title)}</h1>`}
        ${s.ep ? `<div class="pi-ep">Season ${s.ep.season}, Episode ${s.ep.episode}${s.ep.name ? ` · <b>${esc(s.ep.name)}</b>` : ''}</div>` : ''}
        <div class="pi-meta">${[m.type === 'movie' ? m.year : '', d.genres && d.genres.join(', '), d.runtime ? fmtRuntime(d.runtime) : '', d.rating ? `TMDB ${d.rating.toFixed(1)}` : ''].filter(Boolean).map(x => `<span>${esc(x)}</span>`).join('')}</div>
        ${d.overview ? `<p class="pi-overview">${esc(d.overview)}</p>` : ''}
        <div class="pi-progress"><div class="pi-bar"><i style="width:${dur ? (t / dur) * 100 : 0}%"></i></div>
          <span>${fmtTime(t)} of ${fmtTime(dur)}</span><span class="dot">·</span><span>${fmtTime(dur - t)} left</span><span class="dot">·</span><span>Ends at <b>${ends}</b></span></div>
        <div class="pi-hint"><kbd>Space</kbd> to resume</div>`;
      root.classList.add('pinfo');
    };
    const hideInfo = () => { clearTimeout(s.pinfoT); root.classList.remove('pinfo'); if (video.paused && s.info) s.pinfoT = setTimeout(showInfo, 6000); };
    video.addEventListener('pause', () => { clearTimeout(s.pinfoT); s.pinfoT = setTimeout(showInfo, 4000); });
    video.addEventListener('play', () => { clearTimeout(s.pinfoT); root.classList.remove('pinfo'); });
    root.addEventListener('mousemove', hideInfo);
    root.addEventListener('pointerdown', () => { if (root.classList.contains('pinfo')) hideInfo(); }, true);
    s.showPauseInfo = showInfo;

    s.onKey = (e) => {
      if (s.pip) return; // browsing the app while the mini player runs
      if (e.target.tagName === 'INPUT' && e.target.type !== 'range') return;
      if (e.key.toLowerCase() === 'p') { e.preventDefault(); return this.pip(); }
      const k = e.key.toLowerCase();
      const map = {
        ' ': toggle, k: toggle,
        arrowleft: () => this.skip(-10), j: () => this.skip(-10),
        arrowright: () => this.skip(10), l: () => this.skip(10),
        arrowup: () => { video.volume = Math.min(1, video.volume + .1); vol.value = video.volume; paintVol(); },
        arrowdown: () => { video.volume = Math.max(0, video.volume - .1); vol.value = video.volume; paintVol(); },
        f: () => window.reel.fullscreen(), m: () => mute.click(), s: () => this.menu(),
        g: () => this.nudgeSubs(-0.25), h: () => this.nudgeSubs(0.25),
        escape: () => { if (this.panel()) this.closePanel(); else this.close(); },
      };
      if (map[k]) { e.preventDefault(); e.stopPropagation(); if (root.classList.contains('pinfo') && k !== ' ' && k !== 'k') hideInfo(); map[k](); wake(); }
    };
    document.addEventListener('keydown', s.onKey, true);
    s.saveT = setInterval(() => this.saveProgress(), 5000);
    s.subLoop = () => { if (s.closed) return; this.paintSubs(); requestAnimationFrame(s.subLoop); };
    requestAnimationFrame(s.subLoop);
  },

  paint() {
    const s = this.cur; if (!s) return;
    const d = this.duration(), t = this.time();
    const pct = d ? `${(t / d) * 100}%` : '0';
    $('.cur', s.root).style.width = pct;
    $('.knob', s.root).style.left = pct;
    $('.el', s.root).textContent = fmtTime(t);
    $('.rem', s.root).textContent = '-' + fmtTime(d - t);
    const v = s.video;
    if (v.buffered.length) {
      const end = (s.info && (s.info.mode === 'remux' || s.needTx) ? s.offset : 0) + v.buffered.end(v.buffered.length - 1);
      $('.buf', s.root).style.width = d ? `${(end / d) * 100}%` : '0';
    }
    if (!s.finished && d && t / d > 0.92) this.markFinished();
    // "Next episode" for the last ~50 seconds of an episode.
    if (s.meta.type === 'tv' && s.info) $('.next-early', s.root).style.display = d && d - t < 50 && d - t > 3 ? '' : 'none';
  },

  pip() {
    const s = this.cur; if (!s) return;
    if (document.pictureInPictureElement) document.exitPictureInPicture().catch(() => {});
    else s.video.requestPictureInPicture().catch(() => toast('Picture in picture isn’t available right now', true));
  },
  active() { return !!(this.cur && !this.cur.pip); },

  // ---------- Subtitles ----------
  paintSubs() {
    const s = this.cur; const span = $('.subs span', s.root);
    if (!s.cues.length) { span.style.display = 'none'; return; }
    const t = this.time() - s.subDelay;
    const cue = s.cues.find(c => t >= c.s && t <= c.e);
    if (cue) { if (span.textContent !== cue.t) span.textContent = cue.t; span.style.display = ''; } else span.style.display = 'none';
  },
  nudgeSubs(d) {
    const s = this.cur;
    s.subDelay = Math.round((s.subDelay + d) * 100) / 100;
    Store.data.subDelay[`${s.meta.type}:${s.meta.id}`] = s.subDelay; Store.save();
    toast(`Subtitle timing ${s.subDelay > 0 ? '+' : ''}${s.subDelay.toFixed(2)}s`);
    const v = $('.timing-val', s.root); if (v) v.textContent = `${s.subDelay > 0 ? '+' : ''}${s.subDelay.toFixed(2)}s`;
  },
  async loadSubs() {
    const s = this.cur, i = s.info;
    // Per-show choice wins ("off", or a language from the file / from OpenSubtitles); otherwise the global setting.
    const pref = (Store.data.trackPrefs[s.prefKey] || {}).sub;
    const on = pref ? pref !== 'off' : Store.settings.subsOn;
    const lang = pref && pref !== 'off' ? pref.split(':')[1] : Store.settings.subLang;
    const same = (a) => (a || '').slice(0, 2) === (lang || '').slice(0, 2);
    if (on && (!pref || pref.startsWith('emb:'))) {
      const emb = i.subTracks.filter(t => same(t.lang) && !t.forced)[0];
      if (emb) this.setEmbedded(emb);
    }
    s.subsAvail = await window.reel.subsList(s.ids.stype, s.ids.sid, i.id, s.stream.filename);
    if (on && !s.subId) {
      const pick = s.subsAvail.find(x => same(x.lang));
      if (pick) this.setSub(pick);
    }
  },
  saveSubPref(v) { const s = this.cur; Store.data.trackPrefs[s.prefKey] = Object.assign(Store.data.trackPrefs[s.prefKey] || {}, { sub: v }); Store.save(); },
  stopEmbedded() { const s = this.cur; if (s && s.subAbort) { s.subAbort.abort(); s.subAbort = null; } },
  async setSub(sub) {
    const s = this.cur;
    this.stopEmbedded();
    if (!sub) { s.cues = []; s.subId = null; return; }
    try { s.cues = parseSubs(await window.reel.subsGet(sub.url)); s.subId = sub.id; s.embedded = null; }
    catch { toast('Couldn’t load that subtitle', true); }
  },
  // Subtitles inside the video file: streamed out by ffmpeg, perfectly in sync.
  setEmbedded(track, from) {
    const s = this.cur;
    this.stopEmbedded();
    if (from == null) s.cues = [];
    s.embedded = track; s.subId = `emb:${track.index}`;
    const start = Math.max(0, (from ?? this.time()) - 15);
    s.subRange = { start, end: start };
    const ctl = new AbortController(); s.subAbort = ctl;
    (async () => {
      try {
        const res = await fetch(`${s.info.subsBase}?s=${track.index}&t=${start.toFixed(1)}`, { signal: ctl.signal });
        const reader = res.body.getReader(), dec = new TextDecoder();
        let buf = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true }).replace(/\r/g, '');
          const cut = buf.lastIndexOf('\n\n');
          if (cut < 0) continue;
          const fresh = parseSubs(buf.slice(0, cut));
          buf = buf.slice(cut + 2);
          if (fresh.length) {
            const seen = new Set(s.cues.map(c => c.s));
            s.cues.push(...fresh.filter(c => !seen.has(c.s)));
            s.subRange.end = fresh[fresh.length - 1].e;
          }
        }
      } catch {}
    })();
  },
  // After a seek, restart extraction if the new spot isn't covered yet.
  subsFollow(t) {
    const s = this.cur;
    if (!s || !s.embedded || !s.subRange) return;
    if (t < s.subRange.start || t > s.subRange.end + 30) this.setEmbedded(s.embedded, t);
  },

  menu() {
    const s = this.cur, root = s.root;
    if ($('.popover', root)) return this.closePanel();
    this.closePanel();
    const pop = h('<div class="popover"></div>');
    if (s.info && s.info.audioTracks.length > 1) {
      pop.appendChild(h('<h5>Audio</h5>'));
      s.info.audioTracks.forEach(a => {
        const ch = a.channels >= 8 ? '7.1' : a.channels >= 6 ? '5.1' : a.channels === 2 ? 'Stereo' : a.channels === 1 ? 'Mono' : '';
        const b = h(`<button class="${a.index === s.audio ? 'on' : ''}">${esc(langName(a.lang))} <span class="dim">· ${esc([ch, (a.codec || '').toUpperCase().replace('EAC3', 'Dolby Digital+').replace('AC3', 'Dolby Digital').replace('TRUEHD', 'Dolby TrueHD'), a.title].filter(Boolean).join(' · '))}</span></button>`);
        b.onclick = () => {
          s.audio = a.index; this.closePanel(); this.badges();
          if (a.lang) { Store.data.trackPrefs[s.prefKey] = Object.assign(Store.data.trackPrefs[s.prefKey] || {}, { audioLang: a.lang }); Store.save(); }
          if (s.info.mode === 'remux' || s.needTx) this.load(this.time(), !s.video.paused);
        };
        pop.appendChild(b);
      });
    }
    pop.appendChild(h('<h5>Subtitles</h5>'));
    const off = h(`<button class="${!s.subId ? 'on' : ''}">Off</button>`);
    off.onclick = () => { this.setSub(null); this.saveSubPref('off'); this.closePanel(); };
    pop.appendChild(off);
    const emb = (s.info && s.info.subTracks) || [];
    emb.forEach(t => {
      const b = h(`<button class="${s.subId === `emb:${t.index}` ? 'on' : ''}">${esc(langName(t.lang))} <span class="dim">· ${esc([t.forced ? 'Forced' : '', t.title, 'In the file · always in sync'].filter(Boolean).join(' · '))}</span></button>`);
      b.onclick = () => { this.setEmbedded(t); this.saveSubPref(`emb:${t.lang || 'und'}`); this.closePanel(); };
      pop.appendChild(b);
    });
    const avail = s.subsAvail || [];
    if (!avail.length && !emb.length) pop.appendChild(h(`<div class="dim" style="padding:8px 12px;font-size:13px">${s.subsAvail ? 'No subtitles found' : 'Searching…'}</div>`));
    const pref = Store.settings.subLang;
    const sorted = [...avail].sort((a, b) => (b.lang === pref) - (a.lang === pref) || langName(a.lang).localeCompare(langName(b.lang)));
    const counts = {};
    // Up to 4 options for your language (best matches first), 1 for every other language.
    sorted.filter(x => (counts[x.lang] = (counts[x.lang] || 0) + 1) <= (x.lang === pref ? 4 : 1)).forEach(x => {
      const n = sorted.filter(y => y.lang === x.lang).indexOf(x) + 1;
      const note = x.matched && n === 1 ? 'Best match for this file' : n > 1 ? `Option ${n}` : '';
      const b = h(`<button class="${x.id === s.subId ? 'on' : ''}">${esc(langName(x.lang))}${note ? ` <span class="dim">· ${note}</span>` : ''}</button>`);
      b.onclick = () => { this.setSub(x); this.saveSubPref(`os:${x.lang}`); this.closePanel(); };
      pop.appendChild(b);
    });
    const timing = h(`<div class="timing"><span>Timing</span><button class="tm minus" title="Earlier (G)">−</button><b class="timing-val">${s.subDelay > 0 ? '+' : ''}${s.subDelay.toFixed(2)}s</b><button class="tm plus" title="Later (H)">+</button><button class="tm reset" title="Reset">${ICON.rewatch}</button></div>`);
    $('.minus', timing).onclick = (e) => { e.stopPropagation(); this.nudgeSubs(-0.25); };
    $('.plus', timing).onclick = (e) => { e.stopPropagation(); this.nudgeSubs(0.25); };
    $('.reset', timing).onclick = (e) => { e.stopPropagation(); this.nudgeSubs(-s.subDelay); };
    pop.appendChild(timing);
    // Playback speed
    pop.appendChild(h('<h5>Speed</h5>'));
    const sp = h(`<div class="pill-row">${[0.75, 1, 1.25, 1.5, 2].map(r => `<button data-r="${r}" class="${s.video.playbackRate === r ? 'on' : ''}">${r === 1 ? 'Normal' : r + '×'}</button>`).join('')}</div>`);
    $$('button', sp).forEach(b => (b.onclick = (e) => { e.stopPropagation(); s.video.playbackRate = +b.dataset.r; $$('button', sp).forEach(x => x.classList.toggle('on', x === b)); }));
    pop.appendChild(sp);
    // Audio boost (needs the converted stream, which allows audio processing)
    pop.appendChild(h('<h5>Audio</h5>'));
    if (s.info && (s.info.mode === 'remux' || s.needTx)) {
      const modes = [['off', 'Normal'], ['boost', 'Boost'], ['max', 'Max boost'], ['night', 'Night mode']];
      const ab = h(`<div class="pill-row">${modes.map(([k, l]) => `<button data-k="${k}" class="${(s.boost || 'off') === k ? 'on' : ''}">${l}</button>`).join('')}</div>`);
      $$('button', ab).forEach(b => (b.onclick = (e) => { e.stopPropagation(); this.setBoost(b.dataset.k); $$('button', ab).forEach(x => x.classList.toggle('on', x === b)); }));
      pop.appendChild(ab);
      pop.appendChild(h('<div class="dim" style="padding:2px 12px 8px;font-size:11.5px">Night mode evens out loud effects and quiet dialogue.</div>'));
    } else pop.appendChild(h('<div class="dim" style="padding:4px 12px 8px;font-size:12px">Boost isn’t available for this file format.</div>'));
    root.appendChild(pop);
  },

  // Volume boost / night mode via Web Audio (gain + compressor).
  setBoost(mode) {
    const s = this.cur, v = s.video;
    if (!s.ac) {
      try {
        s.ac = new AudioContext();
        const src = s.ac.createMediaElementSource(v);
        s.comp = s.ac.createDynamicsCompressor();
        s.gain = s.ac.createGain();
        src.connect(s.comp); s.comp.connect(s.gain); s.gain.connect(s.ac.destination);
      } catch { toast('Audio boost isn’t available here', true); return; }
    }
    const c = s.comp, g = s.gain;
    const set = (th, ratio, gain) => { c.threshold.value = th; c.ratio.value = ratio; c.knee.value = 20; c.attack.value = .005; c.release.value = .25; g.gain.value = gain; };
    if (mode === 'off') set(0, 1, 1);
    if (mode === 'boost') set(-12, 3, 1.7);
    if (mode === 'max') set(-18, 6, 2.6);
    if (mode === 'night') set(-38, 10, 2.2);
    s.boost = mode;
    s.ac.resume();
  },

  // Stream list inside the player. The current stream keeps playing until the new one is ready.
  streamPanel() {
    const s = this.cur, root = s.root;
    if ($('.p-panel', root)) return this.closePanel();
    this.closePanel();
    const panel = h(`<div class="p-panel"><div class="pp-head"><div><div class="eyebrow">Streams</div><b>${esc(s.meta.title)}</b></div><button class="pbtn pp-close">${ICON.close}</button></div><div class="stream-list"></div></div>`);
    $('.pp-close', panel).onclick = () => this.closePanel();
    const best = s.list.find(x => x.cached && !x.flags.includes('CAM'));
    Playback.renderList($('.stream-list', panel), s.meta, s.list, best, s.stream, (x) => { this.closePanel(); if (x.url !== s.stream.url) this.switchStream(x); });
    root.appendChild(panel);
  },
  async switchStream(x) {
    const s = this.cur, t = this.time(), wasPlaying = !s.video.paused;
    toast('Switching stream…');
    let info;
    try { info = await window.reel.prepare(x.url); } catch (e) { toast(`That stream didn’t work — still playing the current one.`, true); return; }
    if (s.closed || this.cur !== s) return;
    s.switching = true;
    if (s.info) window.reel.endPlayback(s.info.id);
    this.stopEmbedded();
    if (s.ac) info.mode = 'remux'; // keep audio boost working on the new file
    s.info = info; s.stream = x; s.audio = pickAudio(info.audioTracks, s.prefKey); s.subsAvail = null;
    Playback.remember(s.meta, x);
    this.badges();
    s.video.removeAttribute('src');
    this.load(t, wasPlaying);
    setTimeout(() => (s.switching = false), 1500);
    const prevSub = s.subId;
    s.cues = []; s.subId = null;
    s.subsAvail = await window.reel.subsList(s.ids.stype, s.ids.sid, info.id, x.filename);
    if (prevSub) { const p = s.subsAvail.find(y => y.lang === Store.settings.subLang); if (p) this.setSub(p); }
  },

  saveProgress() {
    const s = this.cur; if (!s || !s.info || s.finished) return;
    const t = this.time(), d = this.duration();
    if (t < 30) return;
    const m = s.meta;
    Store.data.progress[s.pkey] = {
      key: `${m.type}:${m.id}`, type: m.type, id: m.id, title: m.title, poster: m.poster, backdrop: m.backdrop, year: m.year, imdb: m.imdb,
      pos: t, dur: d, updatedAt: Date.now(),
      season: s.ep && s.ep.season, episode: s.ep && s.ep.episode, epName: s.ep && s.ep.name, still: s.ep && s.ep.still,
    };
    Store.save();
  },

  markFinished() {
    const s = this.cur;
    s.finished = true;
    delete Store.data.progress[s.pkey];
    const m = s.meta;
    if (m.type === 'tv') {
      const k = `tv:${m.id}`;
      Store.data.episodes[k] = Store.data.episodes[k] || {};
      Store.data.episodes[k][`${s.ep.season}:${s.ep.episode}`] = Object.assign(Store.data.episodes[k][`${s.ep.season}:${s.ep.episode}`] || {}, { watched: true, at: today() });
      Store.upsert(m, { lastEp: `${s.ep.season}:${s.ep.episode}`, watched: true, watchedAt: (Store.item(`tv:${m.id}`) || {}).watchedAt || today() });
    } else if (Store.settings.autoLog) {
      // Auto-log: the diary entry is written for you (today, rewatch detected); you only add stars.
      const key = `movie:${m.id}`;
      const already = Store.data.diary.find(e => e.key === key && e.date === today());
      if (already) s.autoEntry = already.id;
      else {
        const prior = Store.data.diary.some(e => e.key === key) || !!(Store.item(key) || {}).watched;
        Store.logDiary(m, { date: today(), rewatch: prior, auto: true });
        s.autoEntry = Store.data.diary[Store.data.diary.length - 1].id;
        Recs.cache = null;
      }
    }
    Store.save();
  },

  async nextEpisode() {
    const { meta, ep } = this.cur;
    try {
      const season = await TMDB.season(meta.id, ep.season);
      let next = season.episodes.find(e => e.episode_number === ep.episode + 1);
      if (!next) {
        const s2 = await TMDB.season(meta.id, ep.season + 1).catch(() => null);
        next = s2 && s2.episodes && s2.episodes[0];
      }
      if (!next || (next.air_date && next.air_date > today())) return null;
      return { season: next.season_number, episode: next.episode_number, name: next.name, still: next.still_path };
    } catch { return null; }
  },

  async ended() {
    const s = this.cur;
    if (!s.finished) this.markFinished();
    if (s.meta.type !== 'tv') return this.close();
    const next = await this.nextEpisode();
    if (!next) return this.close();
    let n = Store.settings.nextEpSeconds || 0;
    const card = h(`<div class="next-up"><div class="still" style="background-image:url('${TMDB.img(next.still, 'w500')}')"></div>
      <div class="eyebrow">Up next · S${next.season}, E${next.episode}</div>
      <div style="font-weight:600;margin:4px 0 14px">${esc(next.name || '')}</div>
      <div class="btns"><button class="btn primary small go">${ICON.playSm} Play${n ? ` <span class="cd">(${n})</span>` : ''}</button><button class="btn small stop">Not now</button></div></div>`);
    s.root.appendChild(card);
    const goNext = () => { clearInterval(tick); const meta = s.meta; Playback.start(meta, next); };
    const tick = n ? setInterval(() => { n--; const cd = $('.cd', card); if (cd) cd.textContent = `(${n})`; if (n <= 0) goNext(); }, 1000) : null;
    $('.go', card).onclick = goNext;
    $('.stop', card).onclick = () => { clearInterval(tick); this.close(); };
  },

  fail(msg) {
    const s = this.cur; if (!s) return;
    const l = $('.loading', s.root);
    l.style.display = 'grid'; l.style.pointerEvents = 'auto';
    l.innerHTML = `<div class="load-card"><div style="font-size:22px;font-weight:700;margin-bottom:8px">Playback problem</div><div class="msg" style="margin-bottom:20px">${esc(msg)}</div><div class="btns"><button class="btn primary other">Choose another stream</button><button class="btn closep">Back</button></div></div>`;
    $('.other', l).onclick = () => { l.style.display = ''; l.style.pointerEvents = ''; this.streamPanel(); };
    $('.closep', l).onclick = () => this.close();
  },

  close(silent, keepFullscreen) {
    const s = this.cur; if (!s) return;
    this.saveProgress();
    s.closed = true;
    s.silentClose = !!silent;   // quiet close = switching to another episode/stream
    document.dispatchEvent(new CustomEvent('reel:stop', { detail: s }));
    this.cur = null;
    clearInterval(s.saveT); clearTimeout(s.idleT); clearTimeout(s.seekT); clearTimeout(s.pinfoT); clearTimeout(s.blackT);
    if (s.subAbort) s.subAbort.abort();
    if (s.pip && document.pictureInPictureElement) document.exitPictureInPicture().catch(() => {});
    if (s.pipPill) s.pipPill.remove();
    if (s.ac) s.ac.close().catch(() => {});
    document.removeEventListener('keydown', s.onKey, true);
    s.video.pause(); s.video.removeAttribute('src'); s.video.load();
    if (s.info) window.reel.endPlayback(s.info.id);
    s.root.classList.add('closing');
    setTimeout(() => s.root.remove(), silent ? 0 : 250);
    if (!keepFullscreen) window.reel.fullscreen(false);
    if (silent) return;
    rerender();
    if (s.finished && s.meta.type === 'movie' && s.autoEntry) openAfterWatch(s.meta, s.autoEntry);
    else if (s.finished && s.meta.type === 'tv') toast(`Marked S${s.ep.season}, E${s.ep.episode} as watched`);
  },
};
