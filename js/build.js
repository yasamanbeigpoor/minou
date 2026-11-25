// Builds the step list for each kind of lesson.
import { DB, GRAMMAR_RULES, itemsOf, modulesBefore } from './data.js';
import { get } from './store.js';
import { prioritize } from './srs.js';
import { shuffle, sample, pick } from './util.js';
import { range, frNumber, frDigits } from './numbers.js';
import { prNumber, faNumber } from './fa.js';
import {
  vocabQ, matchQ, sentenceQ, grammarQ, exerciseQ, readingQ, passageStep, numberQ, numberTable, numberList, questionFor,
  letterQ, trapQ, accentQ, spellQ, spellOut,
} from './questions.js';

const vid = (m, id) => `${m.key}:v:${id}`;
const SKILL_ROTATION = ['writing', 'listening', 'speaking', 'reading'];

// A circle already finished once is replayed as practice: no intro cards, and the weakest items first.
const replaying = (node) => !!get().done[node.key];

export function buildNode(node) {
  const m = node.mod;
  const again = replaying(node);
  switch (node.type) {
    case 'alphabet': return buildAlphabet(m, again);
    case 'accents': return buildAccents(m, again);
    case 'numbers': return buildNumbersLesson(m, again);
    case 'vocab': return buildVocab(m, again, node.items);
    case 'grammar': return node.grammar ? buildGrammarLesson(m, m.grammars.find((g) => g.id === node.grammar), again) : buildGrammar(m, again);
    case 'module-review': return buildModuleReview(m);
    case 'review': return buildReview(modulesBefore(m), 20);
    default: return [];
  }
}

const chantStep = (chant, sub) => chant ? { kind: 'passage', say: 'Chante avec moi !',
  sub: sub || 'Tap a line to hear it, or play them all. Say it along with Minou.', passage: { ...chant, showEn: true } } : null;

// Pick n item ids, weakest and most overdue first once they've been seen.
function weakest(ids, n) {
  const { cards } = get();
  return prioritize(ids, cards).slice(0, n);
}

// ---------- Alphabet: one circle ----------

const stripAcc = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/g, 'oe');

function buildAlphabet(m, again) {
  const lid = (L) => `${m.key}:l:${L}`;
  const aid = (a) => `${m.key}:a:${a.id}`;
  const letters = (m.letters || []).map((x) => x.l);
  const steps = [];
  if (!again) {
    steps.push(chantStep(m.chant, 'The alphabet song, to the tune of Twinkle, Twinkle. Tap a line to hear it.'));
    steps.push({ kind: 'numbers', say: 'Les lettres !', sub: 'Tap each letter to hear its French name.', gridClass: 'letters',
      tiles: m.letters.map((x) => ({ big: x.l, fr: x.say, say: x.say, pr: x.pr, fa: x.fa })) });
    steps.push({ kind: 'teach', title: 'The tricky pairs', body:
      'Some French letter names sound like <i>other</i> English letters. <b>G</b> is “zhay” and <b>J</b> is “zhee”, the opposite of English. <b>E</b> is “uh”, <b>I</b> is “ee”, and <b>U</b> is “ee” said with rounded lips.',
      examples: ['G', 'J', 'E', 'I', 'U', 'R'].map((L) => { const x = m.letters.find((y) => y.l === L); return { fr: x.say, en: `${L}: ${x.hint}`, pr: x.pr, fa: x.fa }; }) });
  }
  // Letters: by ear and by sight, weighted to the ones that get mixed up.
  const trapLetters = [...new Set((m.traps || []).flat())];
  const pickLetters = again ? weakest(letters.map(lid), 12) : [...shuffle(trapLetters).slice(0, 6), ...sample(letters.filter((L) => !trapLetters.includes(L)), 6)].map(lid);
  pickLetters.forEach((id, i) => steps.push(letterQ(id, ['hear-letter', 'letter-name', 'hear-letter', 'say-letter'][i % 4])));
  sample(m.traps || [], 4).forEach((p) => steps.push(trapQ(m, p)));
  // Spelling.
  const spellIds = (m.spellWords || []).map((w) => `${m.key}:w:${w}`);
  (again ? weakest(spellIds, 3) : sample(spellIds, 3)).forEach((id) => steps.push(spellQ(id)));
  return steps.filter(Boolean);
}

// ---------- Accents: one circle ----------

function buildAccents(m, again) {
  const aid = (a) => `${m.key}:a:${a.id}`;
  const acc = m.accents || [];
  const steps = [];
  if (!again) {
    steps.push({ kind: 'teach', title: 'Why accents matter', body:
      'French accents change how a vowel sounds, or tell two words apart: <b>ou</b> (or) and <b>où</b> (where), <b>a</b> (has) and <b>à</b> (to). Leaving one out is a spelling mistake, so Minou checks them strictly here.',
      trick: 'On a phone, hold a letter down to pick its accent. On a Mac, hold the key down too. In Minou you can also tap the accent buttons under the answer box.' });
    // Meet them in families: the e's, then a, u, i, o, and the cédille.
    const families = [['aigu', 'grave', 'circ', 'trema'], ['agrave', 'acirc'], ['ugrave', 'ucirc'], ['icirc', 'itrema', 'ocirc'], ['cedille']];
    for (const fam of families) {
      const group = fam.map((id) => acc.find((a) => a.id === id)).filter(Boolean);
      group.forEach((a) => steps.push(accentQ(aid(a), 'intro')));
      group.forEach((a) => steps.push(accentQ(aid(a), 'spot')));
    }
  }
  const pool = again ? weakest(acc.map(aid), 8) : shuffle(acc.map(aid)).slice(0, 8);
  pool.forEach((id, i) => steps.push(accentQ(id, ['word', 'name', 'spot', 'hear'][i % 4])));
  const spellIds = (m.spellWords || []).filter((w) => /[éèêëàâùûîïôç]/.test(w)).map((w) => `${m.key}:w:${w}`);
  (again ? weakest(spellIds, 3) : sample(spellIds, 3)).forEach((id) => steps.push(spellQ(id)));
  return steps;
}

// ---------- Numbers 0–100: one circle ----------

function buildNumbersLesson(m, again) {
  const [a, b] = m.numbers;
  const steps = [];
  const tens = [20, 30, 40, 50, 60, 70, 80, 90, 100];
  if (!again) {
    steps.push(numberTable(0, 20, { say: 'De 0 à 20', sub: 'These you just learn by heart. Tap each to hear it.' }));
    steps.push(chantStep(m.numberChant, 'A French counting rhyme. Tap a line to hear it.'));
    steps.push(numberList(tens, { say: 'Les dizaines', sub: 'The tens. Notice 70, 80 and 90!' }));
    steps.push({ kind: 'teach', title: 'Building the rest', body:
      'After 20, glue the tens and units with a hyphen: <b>vingt-deux</b> (22). For 21, 31, 41, 51, 61 and 71 you say <b>et un</b>: <b>vingt et un</b>. From 70, French does maths: <b>70 = 60 + 10</b>, <b>80 = 4 × 20</b>, <b>90 = 4 × 20 + 10</b>.',
      examples: [21, 22, 35, 71, 75, 80, 81, 92, 99].map((n) => ({ fr: frNumber(n), en: String(n), pr: prNumber(n), fa: faNumber(n) })),
      trick: 'Seventy is “sixty-ten”, eighty is “four twenties”, ninety is “four twenties ten”. Ninety-seven is quatre-vingt-dix-sept: 4 × 20 + 10 + 7.' });
  }
  const all = range(a, b);
  const ids = all.map((n) => `num:${n}`);
  // Mix: a third 0–20, a sixth round tens, half the rest, leaning on 70–99.
  const plan = again
    ? weakest(ids, 20)
    : [...sample(range(0, 20), 7), ...sample(tens, 3), ...sample(range(21, 69).filter((n) => n % 10), 4), ...sample(range(70, 99).filter((n) => n % 10), 6)].map((n) => `num:${n}`);
  const kinds = ['num-read', 'num-listen', 'num-word', 'num-write', 'num-speak'];
  shuffle(plan).forEach((id, i) => steps.push(numberQ(id, kinds[i % kinds.length], all)));
  return steps.filter(Boolean);
}

export function buildNumbersDrill(top) {
  const all = range(0, top);
  const ids = weakest(all.map((n) => `num:${n}`), 16);
  const kinds = ['num-listen', 'num-read', 'num-write', 'num-word', 'num-speak'];
  return ids.map((id, i) => numberQ(id, kinds[i % kinds.length], all));
}

// ---------- Module vocabulary: one circle ----------

function buildVocab(m, again, only) {
  const ids = (m.vocab || []).filter((v) => !only || only.includes(v.id)).map((v) => vid(m, v.id));
  const steps = [];
  if (!again) {
    // Meet the words in small groups, each group closed by a matching game.
    for (let g = 0; g < ids.length; g += 6) {
      const group = ids.slice(g, g + 6);
      group.forEach((id) => steps.push(vocabQ(id, 'intro')));
      if (group.length >= 3) steps.push(matchQ(shuffle(group).slice(0, 5)));
    }
  }
  const practice = again ? weakest(ids, 18) : sample(ids, 12);
  practice.forEach((id, i) => {
    const skill = SKILL_ROTATION[i % SKILL_ROTATION.length];
    if (skill === 'reading') steps.push(vocabQ(id, i % 8 === 3 ? 'gender' : 'fr-en'));
    else if (skill === 'writing') steps.push(vocabQ(id, 'write'));
    else if (skill === 'listening') steps.push(vocabQ(id, i % 3 ? 'listen-type' : 'listen-pick'));
    else steps.push(vocabQ(id, 'speak'));
  });
  // A few whole sentences to hear and say.
  const sids = sample((m.sentences || []).map((s) => `${m.key}:s:${s.id}`), 4);
  ['listen-bank', 'speak', 'listen-mean', 'bank'].forEach((k, i) => sids[i] && steps.push(sentenceQ(sids[i], k)));
  return steps;
}

// ---------- Module grammar: one circle (rule + textbook exercises) ----------

function buildGrammar(m, again) {
  const g = m.grammar;
  const gid = (r) => `${m.key}:g:${r}`;
  const tricks = g.tricks || {};
  const teachTricks = [tricks.mon, tricks.sonsa, tricks.vowel, null];
  const teach = g.teach.map((t, i) => ({ kind: 'teach', ...t, trick: teachTricks[i] }));
  const exercises = (m.exercises || []).map((x) => exerciseQ(`${m.key}:x:${x.id}`));
  if (again) {
    return [teach[0], ...shuffle(['mon', 'ma', 'mes', 'vowel', 'sonsa', 'notre', 'leur', 'sonsa', 'vowel'].map((r) => grammarQ(gid(r)))),
      ...sample(exercises, 8)].filter(Boolean);
  }
  return [
    teach[0],
    grammarQ(gid('mon'), { type: false }), grammarQ(gid('ma'), { type: false }), grammarQ(gid('mes'), { type: false }),
    grammarQ(gid('notre'), { type: false }), grammarQ(gid('leur'), { type: false }),
    teach[1],
    grammarQ(gid('sonsa')), grammarQ(gid('sonsa')),
    teach[2],
    grammarQ(gid('vowel'), { type: false }), grammarQ(gid('vowel'), { type: true }),
    teach[3],
    chantStep(g.chant, 'A little chant to remember all six. Tap Listen to all.'),
    ...['mes enfants', 'mon oncle'].map((p) => ({
      kind: 'speak', skill: 'speaking', say: 'Fais la liaison !', sub: 'Say it, linking the sounds.',
      fr: p, en: 'link the sounds', itemId: gid('vowel'), label: p,
    })),
    { kind: 'teach', title: 'Exercices du manuel', body: 'Now the exercises from pages 65–66 of your textbook. Every blank gets instant feedback.' },
    ...exercises,
  ].filter(Boolean);
}

// ---------- Grammar lessons described in content (Module 2 on) ----------

function buildGrammarLesson(m, g, again) {
  const xid = (x) => `${m.key}:x:${x.id}`;
  const teach = (g.teach || []).map((t, i) => {
    if (t.tiles) return { kind: 'numbers', say: t.say, sub: t.sub, tiles: t.tiles.map((x) => ({ ...x, say: x.fr })) };
    const step = { kind: 'teach', ...t };
    if (t.numbers) {
      step.examples = [...(t.examples || []), ...t.numbers.map((n) => ({ fr: frNumber(n), en: frDigits(n), pr: prNumber(n), fa: faNumber(n) }))];
    }
    return step;
  });
  const drills = g.drills || [];
  const exercises = (g.exercises || []).map((x) => exerciseQ(xid(x)));
  if (again) {
    const ids = weakest([...drills, ...(g.exercises || [])].map(xid), 16);
    return [teach.find((t) => t.kind === 'teach'), ...shuffle(ids.map((id) => exerciseQ(id)))].filter(Boolean);
  }
  const steps = [];
  teach.forEach((t, i) => {
    steps.push(t);
    drills.filter((d) => (d.after ?? teach.length - 1) === i).forEach((d) => steps.push(exerciseQ(xid(d))));
  });
  if (g.chant) steps.push(chantStep(g.chant, 'A little song to remember it. Tap Listen to all.'));
  if (exercises.length) {
    steps.push({ kind: 'teach', title: 'Exercices du manuel', body: `Now the exercises from your textbook (${g.section}, ${g.pages}). Every answer gets instant feedback.` });
    steps.push(...exercises);
  }
  return steps.filter(Boolean);
}

// ---------- Module review: one circle ----------

function buildModuleReview(m) {
  const steps = [];
  for (const r of m.readings || []) {
    steps.push(passageStep(r));
    r.questions.forEach((_, qi) => steps.push(readingQ(`${m.key}:r:${r.id}:${qi}`)));
  }
  const items = itemsOf([m]);
  const by = (t) => items.filter((it) => it.type === t).map((it) => it.id);
  const mix = [
    ...weakest(by('vocab'), 6).map((id, i) => questionFor(id, SKILL_ROTATION[i % 4])),
    ...weakest(by('grammar'), 4).map((id) => grammarQ(id)),
    ...weakest(by('exercise'), 3).map((id) => exerciseQ(id)),
    ...sample(by('sentence'), 4).map((id, i) => sentenceQ(id, ['dictation', 'speak', 'write-sentence', 'listen-bank'][i])),
  ];
  return [...steps, ...shuffle(mix.filter(Boolean))];
}

// Mixed review across modules, weighted toward what's due or was missed, balanced across skills.
export function buildReview(mods, n = 18) {
  if (!mods.length) return [];
  const { cards } = get();
  const ids = itemsOf(mods).filter((it) => it.type !== 'reading').map((it) => it.id);
  const seen = ids.filter((id) => cards[id]);
  const ordered = prioritize(seen.length >= n ? seen : ids, cards);
  return ordered.slice(0, n).map((id, i) => questionFor(id, SKILL_ROTATION[i % 4])).filter(Boolean);
}

export function buildWeak(limit = 15) {
  const weak = get().weak;
  const ids = Object.keys(weak).filter((id) => DB.items[id])
    .sort((a, b) => weak[b].misses - weak[a].misses).slice(0, limit);
  return shuffle(ids).map((id, i) => questionFor(id, SKILL_ROTATION[i % 4])).filter(Boolean);
}

export function buildExam(mods, n = 25) {
  const items = itemsOf(mods);
  const by = (t) => shuffle(items.filter((it) => it.type === t).map((it) => it.id));
  const vocab = by('vocab'), sent = by('sentence'), gram = by('grammar'), ex = by('exercise'), read = by('reading'), num = by('number');
  const steps = [
    ...vocab.slice(0, 8).map((id, i) => questionFor(id, SKILL_ROTATION[i % 4])),
    ...gram.slice(0, 4).map((id) => grammarQ(id)),
    ...ex.slice(0, 3).map((id) => exerciseQ(id)),
    ...read.slice(0, 3).map((id) => readingQ(id)),
    ...sent.slice(0, 4).map((id, i) => questionFor(id, SKILL_ROTATION[i % 4])),
    ...num.slice(0, 3).map((id) => questionFor(id)),
  ].filter(Boolean);
  return shuffle(steps).slice(0, n);
}

export const dueCount = (mods) => {
  const now = Date.now();
  const { cards } = get();
  return itemsOf(mods).filter((it) => cards[it.id] && cards[it.id].due <= now).length;
};

export { GRAMMAR_RULES };
