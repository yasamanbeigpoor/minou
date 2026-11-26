// Online saving for the two learners. Each learner's progress is one row in the Supabase
// table "learners" (name, data, updated_at). The publishable key below is meant to be public:
// the table only accepts the two names, and rows can be read, added and updated but not deleted.
const API = 'https://lkglcchxkcriydgrzhll.supabase.co/rest/v1/learners';
const KEY = 'sb_publishable_vkJ_jyu7EcpUNJnrLrs6bQ_xKX2m9VF';
const HEADERS = { apikey: KEY, 'Content-Type': 'application/json' };

export const LEARNERS = { yasaman: 'Yasaman', abrisham: 'Abrisham' };

// The saved progress for a learner, or null if nothing is saved yet. Throws when offline.
export async function pull(name) {
  const res = await fetch(`${API}?name=eq.${encodeURIComponent(name)}&select=data`, { headers: HEADERS, cache: 'no-store' });
  if (!res.ok) throw new Error(`Couldn’t load progress (${res.status})`);
  const rows = await res.json();
  const data = rows[0]?.data;
  return data && data.savedAt ? data : null;
}

export async function push(name, data, { keepalive = false } = {}) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { ...HEADERS, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ name, data, updated_at: new Date().toISOString() }),
    keepalive,
  });
  if (!res.ok) throw new Error(`Couldn’t save progress (${res.status})`);
}

// Combine two copies of the same learner's progress (say, phone and laptop) without losing
// work done on either: the best result for every circle, the latest review of every card,
// every practice day. "Erase all progress" wins over anything saved before it.
export function merge(a, b) {
  if (!b?.savedAt) return a;
  if (!a?.savedAt) return { ...b, settings: { ...a?.settings, ...b.settings } };
  if ((a.resetAt || 0) > b.savedAt) return a;
  if ((b.resetAt || 0) > a.savedAt) return { ...b, settings: a.settings };

  const out = { ...a };
  out.xp = Math.max(a.xp || 0, b.xp || 0);
  out.savedAt = Math.max(a.savedAt, b.savedAt);
  out.resetAt = Math.max(a.resetAt || 0, b.resetAt || 0) || undefined;

  out.days = { ...b.days };
  for (const [d, n] of Object.entries(a.days || {})) out.days[d] = Math.max(n, out.days[d] || 0);

  out.done = { ...b.done };
  for (const [k, v] of Object.entries(a.done || {})) {
    const w = out.done[k];
    out.done[k] = w ? { best: Math.max(v.best, w.best), stars: Math.max(v.stars, w.stars), times: Math.max(v.times, w.times) } : v;
  }

  out.cards = { ...b.cards };
  for (const [k, v] of Object.entries(a.cards || {})) {
    const w = out.cards[k];
    if (!w || (v.last || 0) >= (w.last || 0)) out.cards[k] = v;
  }

  out.skills = { ...b.skills };
  for (const [k, v] of Object.entries(a.skills || {})) {
    const w = out.skills[k];
    if (!w || v[1] >= w[1]) out.skills[k] = v;
  }

  out.weak = { ...b.weak };
  for (const [k, v] of Object.entries(a.weak || {})) {
    const w = out.weak[k];
    if (!w || (v.last || 0) >= (w.last || 0)) out.weak[k] = v;
  }

  const sa = a.streak || {}, sb = b.streak || {};
  out.streak = (sa.last || '') > (sb.last || '') ? sa : (sb.last || '') > (sa.last || '') ? sb
    : { last: sa.last || null, count: Math.max(sa.count || 0, sb.count || 0) };

  const seen = new Set();
  out.exams = [...(a.exams || []), ...(b.exams || [])]
    .filter((e) => { const id = `${e.date}|${e.score}|${e.total}`; if (seen.has(id)) return false; seen.add(id); return true; })
    .sort((x, y) => (y.date > x.date ? 1 : y.date < x.date ? -1 : 0))
    .slice(0, 20);

  out.settings = a.settings;   // sound, speed and pronunciation toggles stay per device
  return out;
}
