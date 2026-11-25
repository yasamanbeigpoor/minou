// Loads class and module content and builds the learning path.
import { isDone } from './store.js';
import { frNumber } from './numbers.js';

export const DB = { classes: [], modules: [], items: {}, nodes: [] };

const NODE_ICONS = {
  letters: 'abc', 'letter-traps': 'ear', accents: 'accent', spell: 'spell',
  review: 'refresh', words: 'cards', grammar: 'key', exercises: 'pencil', reading: 'book',
  listen: 'ear', numbers: 'hash', checkpoint: 'crown',
};

export async function loadAll() {
  const res = await fetch('content/classes.json', { cache: 'no-cache' });
  const { classes } = await res.json();
  DB.classes = classes;
  DB.modules = [];
  for (const cls of classes) {
    const mods = await Promise.all(
      cls.modules.map((f) => fetch(`content/${cls.id}/${f}.json`, { cache: 'no-cache' }).then((r) => r.json()))
    );
    let mainIndex = 0;
    mods.forEach((m, i) => {
      m.classId = cls.id;
      m.className = cls.title;
      m.key = `${cls.id}.${m.id}`;
      m.file = cls.modules[i];
      m.bonus = m.track === 'bonus';
      m.index = m.bonus ? -1 : mainIndex++;
      DB.modules.push(m);
    });
  }
  indexItems();
  buildNodes();
  return DB;
}

function indexItems() {
  DB.items = {};
  for (const m of DB.modules) {
    const add = (id, item) => (DB.items[id] = { ...item, mod: m, id });
    for (const v of m.vocab || []) add(`${m.key}:v:${v.id}`, { type: 'vocab', data: v, label: `${v.fr} = ${v.en}` });
    for (const l of m.letters || []) add(`${m.key}:l:${l.l}`, { type: 'letter', data: l, label: `${l.l} = ${l.say}` });
    for (const a of m.accents || []) add(`${m.key}:a:${a.id}`, { type: 'accent', data: a, label: `${a.mark} = ${a.name}` });
    for (const w of m.spellWords || []) add(`${m.key}:w:${w}`, { type: 'spell', data: { word: w }, label: w });
    for (const s of m.sentences || []) add(`${m.key}:s:${s.id}`, { type: 'sentence', data: s, label: s.fr });
    for (const x of m.exercises || []) add(`${m.key}:x:${x.id}`, { type: 'exercise', data: x, label: x.text });
    for (const r of m.readings || []) {
      r.questions.forEach((q, qi) => add(`${m.key}:r:${r.id}:${qi}`, { type: 'reading', data: { reading: r, q }, label: q.q }));
    }
    if (m.grammar) {
      for (const rule of GRAMMAR_RULES) add(`${m.key}:g:${rule.id}`, { type: 'grammar', data: { rule: rule.id }, label: rule.label });
    }
    if (m.numbers) {
      for (let n = m.numbers[0]; n <= m.numbers[1]; n++) {
        DB.items[`num:${n}`] = { type: 'number', data: { n }, mod: m, id: `num:${n}`, label: `${n} = ${frNumber(n)}` };
      }
    }
  }
}

export const GRAMMAR_RULES = [
  { id: 'mon', label: 'mon / ton / son before masculine nouns' },
  { id: 'ma', label: 'ma / ta / sa before feminine nouns' },
  { id: 'mes', label: 'mes / tes / ses before plurals' },
  { id: 'vowel', label: 'mon / ton / son before a vowel' },
  { id: 'sonsa', label: 'son / sa agree with the thing owned' },
  { id: 'notre', label: 'notre / nos, votre / vos' },
  { id: 'leur', label: 'leur / leurs' },
];

// Main modules form one chain; each bonus track (like the alphabet) is its own chain.
function buildNodes() {
  DB.nodes = [];
  DB.chains = { main: [] };
  for (const m of DB.modules) {
    const nodes = [];
    if (m.index > 0) {
      nodes.push({ id: 'review', type: 'review', title: 'Révision', titleEn: 'Review', subtitle: `Review Modules 1–${m.number - 1}` });
    }
    nodes.push(...m.path);
    const chainId = m.bonus ? m.key : 'main';
    DB.chains[chainId] ||= [];
    m.nodes = nodes.map((n) => ({ ...n, mod: m, key: `${m.key}/${n.id}`, icon: NODE_ICONS[n.type] || 'star', chain: chainId }));
    DB.chains[chainId].push(...m.nodes);
    DB.nodes.push(...m.nodes);
  }
}

export function nodeState(node) {
  const chain = DB.chains[node.chain];
  const i = chain.indexOf(node);
  if (isDone(node.key)) return 'done';
  if (i === 0 || isDone(chain[i - 1].key)) return 'current';
  return 'locked';
}

export const currentNode = (chain = 'main') => DB.chains[chain].find((n) => nodeState(n) === 'current') || null;
export const mainModules = () => DB.modules.filter((m) => !m.bonus);

// Modules whose first node has been opened, i.e. material the learner has started.
export function startedModules() {
  return DB.modules.filter((m) => m.nodes.some((n) => isDone(n.key)));
}

export function itemsOf(mods, types) {
  return Object.values(DB.items).filter((it) => mods.includes(it.mod) && (!types || types.includes(it.type)));
}

export const moduleByKey = (key) => DB.modules.find((m) => m.key === key);
