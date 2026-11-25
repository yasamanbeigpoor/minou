// Module summary: used for the in-app notebook and for the downloadable PDF.
import { h } from './util.js';
import { frNumber, range } from './numbers.js';
import { speak } from './speech.js';
import { icon } from './icons.js';
import { pron, prNumber, faNumber } from './fa.js';

const G = { m: 'm.', f: 'f.', mf: 'm./f.', pl: 'pl.' };

export function renderSummary(m, { interactive = true } = {}) {
  const say = (fr, label = fr) => interactive
    ? h('button', { class: 'say-btn', lang: 'fr', onclick: () => speak(fr) }, label, icon('sound'))
    : h('span', { lang: 'fr' }, label);

  const out = h('article', { class: 'summary' });

  out.append(h('header', { class: 'sum-head' },
    h('p', { class: 'sum-kicker' }, `${m.className}, ${m.pre ? 'the basics' : `Module ${m.number}`}`),
    h('h1', {}, m.title),
    h('p', { class: 'sum-sub' }, m.subtitle),
    m.source && !m.pre ? h('p', { class: 'sum-source' }, `From: ${m.source}`) : null));

  if (m.letters?.length) {
    out.append(h('section', { class: 'sum-sec' }, h('h2', {}, 'The alphabet'),
      h('div', { class: 'sum-letters' }, ...m.letters.map((x) => h('div', { class: 'sum-letter' },
        h('b', {}, x.l), h('span', {}, say(x.say), pron(x.pr, x.fa)),
        h('small', {}, x.trick || x.hint, x.word ? h('em', {}, ` ${x.word} = ${x.wordEn}`) : null))))));
    if (m.chant) {
      out.append(h('section', { class: 'sum-sec' }, h('h2', {}, m.chant.title),
        h('ul', { class: 'sum-pairs' }, ...m.chant.lines.map((l) => h('li', {}, say(l.fr), pron(l.pr, l.fa), l.en ? h('span', { class: 'en' }, l.en) : null)))));
    }
    if (m.traps?.length) {
      out.append(h('section', { class: 'sum-sec' }, h('h2', {}, 'Watch out for'),
        h('ul', { class: 'sum-rules' },
          h('li', {}, 'G is “zhay” and J is “zhee”: the reverse of English.'),
          h('li', {}, 'E is “uh”, I is “ee”, and U is “ee” with rounded lips.'),
          h('li', {}, 'W is “double vé” and Y is “i grec”.'),
          h('li', {}, 'H is silent inside words: homme sounds like “om”.'))));
    }
  }

  if (m.accents?.length) {
    out.append(h('section', { class: 'sum-sec' }, h('h2', {}, 'Accents'),
      h('table', { class: 'vtable' }, h('tbody', {}, ...m.accents.map((a) => h('tr', {},
        h('td', { class: 'fr mark' }, a.mark),
        h('td', { class: 'fr' }, say(a.name), pron(a.pr, a.fa)),
        h('td', { class: 'en' }, a.trick || a.hint, h('small', {}, a.words.map((w) => `${w} (${a.wordsEn?.[w] || ''})`).join(', ')))))))));
    out.append(h('section', { class: 'sum-sec' }, h('h2', {}, 'Spelling out loud'),
      h('p', {}, 'Say each letter by its French name and name the accents: m, e accent grave, r, e = mère. Œ is said “o e dans l’o”, a hyphen is “trait d’union”.')));
  }

  if (m.grammar) {
    const g = m.grammar;
    const sec = h('section', { class: 'sum-sec' }, h('h2', {}, g.title));
    const tableCard = g.teach.find((t) => t.table);
    if (tableCard) {
      sec.append(h('table', { class: 'ptable' },
        h('thead', {}, h('tr', {}, ...tableCard.table.head.map((c) => h('th', {}, c)))),
        h('tbody', {}, ...tableCard.table.rows.map((r) => h('tr', {}, ...r.map((c, i) => i === 0 ? h('th', { scope: 'row' }, c) : h('td', {}, say(c))))))));
    }
    if (g.notes) sec.append(h('ul', { class: 'sum-rules' }, ...g.notes.map((n) => h('li', {}, n))));
    if (g.tricks) sec.append(h('h3', {}, 'Minou’s tricks'), h('ul', { class: 'sum-rules tricks' }, ...Object.values(g.tricks).map((t) => h('li', {}, t))));
    const examples = g.teach.flatMap((t) => t.examples || []);
    if (examples.length) {
      sec.append(h('h3', {}, 'Examples'), h('ul', { class: 'sum-pairs' },
        ...examples.map((e) => h('li', {}, say(e.fr), pron(e.pr, e.fa), h('span', { class: 'en' }, e.en)))));
    }
    if (g.chant) {
      sec.append(h('h3', {}, g.chant.title), h('ul', { class: 'sum-pairs' },
        ...g.chant.lines.map((l) => h('li', {}, say(l.fr), pron(l.pr, l.fa), h('span', { class: 'en' }, l.en || '')))));
    }
    out.append(sec);
  }

  if (m.vocab?.length) {
    out.append(h('section', { class: 'sum-sec' }, h('h2', {}, 'Vocabulary'),
      h('table', { class: 'vtable' },
        h('tbody', {}, ...m.vocab.map((v) => h('tr', {},
          h('td', { class: 'fr' }, say(v.fr), pron(v.pr, v.fa)),
          h('td', { class: 'g' }, G[v.g] || ''),
          h('td', { class: 'en' }, v.en, v.trick ? h('small', { class: 'sum-trick' }, v.trick) : v.tip ? h('small', {}, v.tip) : null)))))));
  }

  if (m.numbers) {
    const nums = range(m.numbers[0], m.numbers[1]);
    out.append(h('section', { class: 'sum-sec' }, h('h2', {}, `Numbers ${m.numbers[0]}–${m.numbers[1]}`),
      h('div', { class: 'sum-nums' }, ...nums.map((n) => h('div', { class: 'sum-num' }, h('b', {}, String(n)), h('span', {}, say(frNumber(n)), pron(prNumber(n), faNumber(n)))))),
      m.numberChant ? h('div', {}, h('h3', {}, m.numberChant.title), h('ul', { class: 'sum-pairs' },
        ...m.numberChant.lines.map((l) => h('li', {}, say(l.fr), pron(l.pr, l.fa), h('span', { class: 'en' }, l.en))))) : null));
  }

  if (m.sentences?.length) {
    out.append(h('section', { class: 'sum-sec' }, h('h2', {}, 'Useful sentences'),
      h('ul', { class: 'sum-pairs' }, ...m.sentences.map((s) => h('li', {}, say(s.fr), pron(s.pr, s.fa), h('span', { class: 'en' }, s.en))))));
  }

  if (m.exercises?.length) {
    const sets = {};
    for (const x of m.exercises) (sets[x.set] ||= []).push(x);
    out.append(h('section', { class: 'sum-sec' }, h('h2', {}, 'Textbook answers'),
      ...Object.entries(sets).map(([name, xs]) => h('div', { class: 'sum-ex' }, h('h3', {}, name),
        h('ol', {}, ...xs.map((x) => h('li', {},
          h('span', { lang: 'fr' }, x.type === 'sentence' ? x.answer : x.text.replace(/^.*Report it: /, '').replace('___', x.answer)),
          x.en ? h('span', { class: 'en' }, x.en.replace(/^.*→ /, '')) : null
        )))))));
  }

  if (m.readings?.length) {
    out.append(h('section', { class: 'sum-sec' }, h('h2', {}, 'Readings'),
      ...m.readings.map((r) => h('div', { class: 'sum-read' }, h('h3', {}, r.title),
        ...r.lines.map((l) => h('p', {}, l.who ? h('b', {}, `${l.who} : `) : null, h('span', { lang: 'fr' }, l.fr), pron(l.pr, l.fa), h('span', { class: 'en' }, l.en)))))));
  }

  return out;
}
