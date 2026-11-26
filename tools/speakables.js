// Lists every piece of French the app can say aloud, so tools/build_audio.py can record it.
// Keep in step with the speak() calls in js/lesson.js, js/questions.js, js/build.js and js/summary.js.
import { DB } from '../js/data.js';
import { frNumber } from '../js/numbers.js';
import { spellOut } from '../js/questions.js';

const POSS = { m: ['mon', 'ton', 'son', 'notre', 'votre', 'leur'], f: ['ma', 'ta', 'sa', 'notre', 'votre', 'leur'],
  pl: ['mes', 'tes', 'ses', 'nos', 'vos', 'leurs'] };
const isVowel = (w) => /^[aeiouyhéèêàâîôû]/i.test(w);

export function speakables() {
  const out = new Set();
  const add = (t) => { if (t && /[a-zà-ÿœ]/i.test(t)) out.add(String(t).normalize('NFC').replace(/\s+/g, ' ').trim()); };

  ['Bonjour, je suis Minou.', 'le', 'la', 'les'].forEach(add);
  Object.values(POSS).flat().forEach((p) => { add(p); add(p[0].toUpperCase() + p.slice(1)); });
  for (let n = 0; n <= 100; n++) add(frNumber(n));

  for (const m of DB.modules) {
    for (const v of m.vocab || []) { add(v.fr); add(v.noun); }
    for (const s of m.sentences || []) {
      add(s.fr);
      s.fr.replace(/([.!?])$/, '').split(' ').forEach(add);   // word tiles
    }
    for (const v of m.vocab || []) if (v.noun && !v.noun.includes('-')) add(v.noun);  // distractor tiles
    for (const v of m.vocab || []) (v.alts || []).forEach(add);
    // Possessive + noun answers for the grammar drills.
    if (m.grammar) {
      const nouns = [...(m.vocab || []).filter((v) => v.g !== 'pl').map((v) => ({ noun: v.noun, pl: v.pl, g: v.g === 'mf' ? 'm' : v.g })),
        ...(m.grammar.extraNouns || [])];
      for (const n of nouns) {
        const sing = n.g === 'f' && !isVowel(n.noun) ? POSS.f : POSS.m;
        sing.forEach((p) => add(`${p} ${n.noun}`));
        if (n.pl !== n.noun) POSS.pl.forEach((p) => add(`${p} ${n.pl}`));
      }
      for (const t of m.grammar.teach || []) {
        (t.examples || []).forEach((e) => add(e.fr));
        (t.table?.rows || []).forEach((r) => r.slice(1).forEach(add));
      }
      (m.grammar.chant?.lines || []).forEach((l) => add(l.fr));
      ['mes enfants', 'mon oncle', 'mes filles'].forEach(add);
    }
    for (const x of m.exercises || []) {
      (x.options || []).forEach(add);
      const filled = x.text.replace('___', x.answer);
      add(filled.replace(/^—\s*/, ''));
      if (x.type === 'sentence') add(x.answer);
    }
    for (const r of m.readings || []) {
      r.lines.forEach((l) => add(l.fr));
      r.questions.forEach((q) => { add(q.q); q.options.forEach(add); });
    }
    (m.numberChant?.lines || []).forEach((l) => add(l.fr));
    (m.bigNumbers || []).forEach((n) => add(frNumber(n)));
    for (const g of m.grammars || []) {
      for (const t of g.teach || []) {
        (t.examples || []).forEach((e) => add(e.fr));
        (t.table?.rows || []).forEach((r) => r.slice(1).forEach(add));
        (t.tiles || []).forEach((x) => add(x.fr));
        (t.numbers || []).forEach((n) => add(frNumber(n)));
      }
      (g.chant?.lines || []).forEach((l) => add(l.fr));
      (g.exercisesIntro?.examples || []).forEach((e) => add(e.fr));
      for (const x of [...(g.drills || []), ...(g.exercises || [])]) {
        if (x.quiet) continue;
        if (x.type === 'listen-digits' || x.type === 'speak') { add(x.say || x.fr); continue; }
        (x.options || []).forEach(add);
        add(x.answer);
        if (x.text?.includes('___')) add(x.text.replace('___', x.answer).replace(/^—\s*/, '').replace(/\s*\([^)]*\)\s*$/, '').replace(/^[\d.]+\s*=\s*/, ''));
      }
    }
    for (const x of m.letters || []) { add(x.say); add(x.word); }
    (m.chant?.lines || []).forEach((l) => add(l.fr));
    for (const a of m.accents || []) { add(a.name); a.words.forEach(add); }
    for (const w of m.spellWords || []) { add(w); add(spellOut(w, m)); }
  }
  return [...out].sort();
}
