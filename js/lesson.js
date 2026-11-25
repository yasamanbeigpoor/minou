// The lesson player: renders each step, checks answers and gives feedback.
import { h, $, shuffle, checkFrench, clean, similarity, pick, sleep } from './util.js';
import { speak, listen, sttSupported, stopSpeaking } from './speech.js';
import { sfx } from './sound.js';
import { minouSVG, setMood, LINES } from './minou.js';
import { icon } from './icons.js';
import * as store from './store.js';
import { confetti } from './confetti.js';
import { pron, applyPronClasses, prOn, faOn } from './fa.js';
import { frNumber as numberWord } from './numbers.js';
import { faNumber, prNumber } from './fa.js';

// English for every French line Minou says.
const SAY_EN = {
  'Que veut dire… ?': 'What does it mean?', 'Comment dit-on… ?': 'How do you say…?', 'Écoute bien !': 'Listen carefully!',
  'Écris ce que tu entends.': 'Write what you hear.', 'En français, s’il te plaît !': 'In French, please!',
  'Masculin ou féminin ?': 'Masculine or feminine?', 'Le ou la ?': 'Le or la?', 'À toi de parler !': 'Your turn to speak!',
  'Trouve les paires !': 'Find the pairs!', 'Traduis cette phrase.': 'Translate this sentence.', 'Écoute et construis.': 'Listen and build.',
  'Écris en français.': 'Write it in French.', 'Dictée !': 'Dictation!', 'Qu’est-ce que tu entends ?': 'What do you hear?',
  'Lis à voix haute.': 'Read it out loud.', 'Complète !': 'Fill it in!', 'Complète la phrase.': 'Complete the sentence.',
  'Réécris la phrase.': 'Rewrite the sentence.', 'Lis et réponds.': 'Read and answer.', 'Lis l’histoire.': 'Read the story.',
  'Quel nombre ?': 'Which number?', 'C’est quel nombre ?': 'Which number is it?', 'Écris le nombre.': 'Write the number.',
  'Dis le nombre !': 'Say the number!', 'Les nombres !': 'The numbers!', 'Quelle lettre ?': 'Which letter?',
  'Comment ça se dit ?': 'How is it said?', 'Dis la lettre !': 'Say the letter!', 'Comment s’appelle cet accent ?': 'What is this accent called?',
  'Ajoute l’accent !': 'Add the accent!', 'Quel mot ?': 'Which word?', 'Épelle ce mot !': 'Spell this word!',
  'Épelle ton prénom !': 'Spell your first name!', 'Fais la liaison !': 'Link the sounds!', 'Nouveau mot !': 'New word!',
  'Écoute, je t’explique.': 'Listen, let me explain.', 'Nouvelle lettre !': 'New letter!', 'Un accent !': 'An accent!',
  'Chante avec moi !': 'Sing along with me!', 'Une astuce !': 'A trick!', 'Quelle orthographe ?': 'Which spelling?',
  'Les lettres !': 'The letters!', 'De 0 à 20': 'From 0 to 20', 'Les dizaines': 'The tens',
};
const sayEn = (fr) => SAY_EN[fr] || (/ ou /.test(fr) ? fr.replace(' ou ', ' or ') : '');

// append() turns null into the text "null", so filter empties first.
const put = (parent, ...kids) => parent.append(...kids.filter((k) => k != null && k !== false));

const GRADED = new Set(['mcq', 'type', 'bank', 'match', 'speak']);
const ACCENTS = ['é', 'è', 'ê', 'à', 'â', 'ç', 'î', 'ï', 'ô', 'œ', 'ù', 'û', 'ë'];

export function runLesson({ title, steps, mode = 'learn', onDone, onExit }) {
  const root = $('#lesson');
  root.innerHTML = '';
  root.hidden = false;
  document.body.classList.add('in-lesson');

  const queue = steps.filter(Boolean).map((s) => ({ ...s }));
  let i = 0, combo = 0, xp = 0, firstTry = 0, graded = 0, skipSpeak = store.get().settings.speakOff;
  const misses = [];
  const startedAt = Date.now();
  const exam = mode === 'exam';
  const answersBySkill = {};

  // ----- Frame -----
  const bar = h('i');
  const comboEl = h('span', { class: 'combo', hidden: true });
  const timerEl = exam ? h('span', { class: 'timer' }) : null;
  const closeBtn = h('button', { class: 'icon-btn', 'aria-label': 'Close lesson', onclick: confirmExit }, icon('close'));
  const prBtn = h('button', { class: 'pron-toggle', 'aria-pressed': String(prOn()), title: 'English pronunciation', onclick: () => togglePron('pron', prBtn) }, 'Aa');
  const faBtn = h('button', { class: 'pron-toggle', 'aria-pressed': String(faOn()), title: 'Persian pronunciation', lang: 'fa', onclick: () => togglePron('persian', faBtn) }, 'فا');
  const top = h('header', { class: 'l-top' }, closeBtn, h('div', { class: 'bar', role: 'progressbar', 'aria-label': 'Lesson progress' }, bar), comboEl, timerEl,
    h('div', { class: 'pron-toggles', role: 'group', 'aria-label': 'Pronunciation help' }, prBtn, faBtn));
  function togglePron(key, btn) {
    const now = key === 'pron' ? !prOn() : !faOn();
    store.setSetting(key, now);
    btn.setAttribute('aria-pressed', String(now));
    applyPronClasses();
  }
  const body = h('main', { class: 'l-body' });
  const skipBtn = h('button', { class: 'btn ghost', hidden: true }, '');
  const mainBtn = h('button', { class: 'btn primary wide' }, 'Check');
  const backBtn = h('button', { class: 'btn ghost back-btn', 'aria-label': 'Back to the previous card', hidden: true, onclick: () => back() }, icon('back'), h('span', {}, 'Back'));
  const foot = h('footer', { class: 'l-foot' }, backBtn, skipBtn, mainBtn);
  // Questions already answered once: revisiting them is practice and isn't graded again.
  const answered = new Set();
  const sheet = h('div', { class: 'sheet', hidden: true, role: 'status', 'aria-live': 'polite' });
  root.append(top, body, foot, sheet);

  let timerId = null;
  if (exam) {
    const limit = 15 * 60;
    const tick = () => {
      const left = Math.max(0, limit - Math.floor((Date.now() - startedAt) / 1000));
      timerEl.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
      timerEl.classList.toggle('low', left < 120);
      if (!left) finish();
    };
    tick();
    timerId = setInterval(tick, 1000);
  }

  let current = null;     // controller for the current step
  let phase = 'answer';   // 'answer' | 'feedback'

  function confirmExit() {
    if (i === 0 || confirm('Leave this lesson? Progress in this lesson won’t be saved.')) cleanup(true);
  }

  function cleanup(exited) {
    clearInterval(timerId);
    stopSpeaking();
    document.removeEventListener('keydown', onKey);
    root.hidden = true;
    root.innerHTML = '';
    document.body.classList.remove('in-lesson');
    if (exited && onExit) onExit();
  }

  function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      if (document.activeElement?.tagName === 'BUTTON' && document.activeElement !== mainBtn) return;
      e.preventDefault();
      if (!mainBtn.disabled) mainBtn.click();
    } else if (/^[1-9]$/.test(e.key) && phase === 'answer' && current?.choose && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
      current.choose(Number(e.key) - 1);
    }
  }
  document.addEventListener('keydown', onKey);

  function progress() {
    bar.style.width = `${Math.round((i / queue.length) * 100)}%`;
  }

  // ----- Step flow -----
  function show() {
    while (i < queue.length && skipSpeak && queue[i].kind === 'speak') i++;
    if (i >= queue.length) return finish();
    phase = 'answer';
    sheet.hidden = true;
    sheet.className = 'sheet';
    foot.hidden = false;
    progress();
    const step = queue[i];
    body.innerHTML = '';
    body.scrollTop = 0;
    skipBtn.hidden = true;
    backBtn.hidden = exam || prevIndex() < 0;
    mainBtn.disabled = false;
    mainBtn.className = 'btn primary wide';

    const ctx = {
      ready(v) { mainBtn.disabled = !v; },
      submit() { if (!mainBtn.disabled) mainBtn.click(); },
      grade: (res) => onGraded(step, res),
    };
    const render = RENDER[step.kind];
    current = render(step, body, ctx);
    if (window.__MINOU_TEST__) window.__MINOU_TEST__.step = step;

    if (GRADED.has(step.kind)) {
      mainBtn.textContent = exam ? 'Next' : 'Check';
      mainBtn.disabled = !current.auto ? true : mainBtn.disabled;
      if (step.kind === 'speak') {
        mainBtn.hidden = true;
        skipBtn.hidden = false;
        skipBtn.textContent = 'Can’t speak now';
        skipBtn.onclick = () => {
          skipSpeak = true;
          queue.splice(i, 1);
          show();
        };
      } else {
        mainBtn.hidden = !!current.hideCheck;
      }
      mainBtn.onclick = () => {
        if (phase === 'answer') {
          const res = current.check();
          if (res) onGraded(step, res);
        } else next();
      };
    } else {
      mainBtn.hidden = false;
      mainBtn.textContent = 'Continue';
      mainBtn.onclick = () => next();
    }
  }

  function onGraded(step, res) {
    if (phase !== 'answer') return;
    phase = 'feedback';
    const ok = res.ok;
    if (answered.has(step)) {
      // A second try after going back: show the feedback, record nothing.
      ok ? sfx.correct() : sfx.wrong();
      current.lock?.(res);
      showSheet(step, { ...res, note: [res.note, 'Practice only: this answer isn’t counted again.'].filter(Boolean).join(' ') });
      return;
    }
    answered.add(step);
    graded += 1;
    if (step.itemId) store.record(step.itemId, res.grade, step.skill, step.label);
    if (res.items) res.items.forEach(([id, g]) => store.record(id, g, step.skill, null));
    const sk = step.skill || 'reading';
    answersBySkill[sk] = answersBySkill[sk] || [0, 0];
    answersBySkill[sk][1] += 1;
    if (ok) answersBySkill[sk][0] += 1;

    if (ok) {
      combo += 1;
      if (!step.retry) firstTry += 1;
      xp += step.retry ? 1 : 2;
    } else {
      combo = 0;
      misses.push(step);
      if (!exam && !step.retry) queue.push({ ...step, retry: true, ...(step.kind === 'mcq' && !step.keepOrder ? { options: shuffle(step.options) } : {}) });
    }
    comboEl.hidden = combo < 3;
    comboEl.textContent = `${combo} in a row`;

    if (exam) { next(); return; }

    ok ? sfx.correct() : sfx.wrong();
    current.lock?.(res);
    showSheet(step, res);
  }

  function showSheet(step, res) {
    const ok = res.ok;
    let line = ok ? (res.grade === 2 ? pick(LINES.slip) : pick(LINES.correct)) : pick(LINES.wrong);
    if (ok && combo === 5) line = pick(LINES.streak5);
    else if (ok && combo === 3) line = pick(LINES.streak3);
    const cat = minouSVG({ size: 64, mood: ok ? 'happy' : 'sad', cls: 'm-react' });
    const answerLine = !ok || res.grade === 2 || step.reveal
      ? h('div', { class: 'fb-answer' },
        h('span', {}, ok ? 'Answer: ' : 'Correct answer: '),
        h('b', {}, step.reveal || ''),
        step.speakAnswer ? h('button', { class: 'icon-btn tiny', 'aria-label': 'Hear it', onclick: () => speak(step.speakAnswer) }, icon('sound')) : null)
      : null;
    sheet.innerHTML = '';
    sheet.append(
      h('div', { class: 'fb-row' }, cat,
        h('div', { class: 'fb-text' },
          h('div', { class: 'fb-title' }, h('span', { lang: 'fr' }, line.fr), h('span', { class: 'fb-en' }, line.en)),
          res.heard ? h('div', { class: 'fb-note' }, `Minou heard: “${res.heard}”`) : null,
          answerLine,
          pron(step.answerPr, step.answerFa, 'fb-pron'),
          res.note ? h('div', { class: 'fb-note' }, res.note) : null,
          step.explain ? h('div', { class: 'fb-note' }, step.explain) : null,
          !ok && step.trick ? trickBox(step.trick) : null)),
      h('button', { class: `btn wide ${ok ? 'good' : 'bad'}`, onclick: next }, 'Continue'),
    );
    sheet.className = `sheet ${ok ? 'ok' : 'no'}`;
    sheet.hidden = false;
    foot.hidden = true;
    if (ok && step.speakAnswer && step.kind !== 'speak' && !step.audio) speak(step.speakAnswer);
    setTimeout(() => sheet.querySelector('button.wide')?.focus({ preventScroll: true }), 50);
  }

  function prevIndex() {
    let k = i - 1;
    while (k >= 0 && skipSpeak && queue[k].kind === 'speak') k--;
    return k;
  }

  function back() {
    const k = prevIndex();
    if (k < 0) return;
    sfx.tap();
    stopSpeaking();
    i = k;
    show();
  }

  function next() {
    i += 1;
    show();
  }

  function finish() {
    const seconds = Math.round((Date.now() - startedAt) / 1000);
    cleanup(false);
    const result = { xp, graded, firstTry, misses, seconds, answersBySkill, accuracy: clampAcc(firstTryAccuracy()) };
    if (onDone) onDone(result);
  }

  function firstTryAccuracy() {
    const originals = queue.filter((s) => !s.retry && GRADED.has(s.kind)).length;
    if (!originals) return 1;
    const missedFirst = misses.filter((m) => !m.retry).length;
    return (originals - missedFirst) / originals;
  }
  const clampAcc = (a) => Math.max(0, Math.min(1, a));

  show();
}

// ---------- Shared prompt pieces ----------

function promptHead(step) {
  const cat = minouSVG({ size: 58, mood: 'idle' });
  const en = sayEn(step.say || '');
  return h('div', { class: 'prompt' }, cat,
    h('div', { class: 'bubble' },
      h('div', { class: 'say' }, h('span', { lang: 'fr' }, step.say || ''), en ? h('span', { class: 'say-en' }, en) : null),
      step.sub ? h('div', { class: 'sub' }, step.sub) : null));
}

function trickBox(text) {
  return h('div', { class: 'trick' }, h('b', {}, icon('paw'), 'Minou’s trick'), h('span', {}, text));
}

function audioBlock(text) {
  const big = h('button', { class: 'audio-btn', 'aria-label': 'Play again', onclick: () => { sfx.tap(); speak(text); } }, icon('sound'));
  const slow = h('button', { class: 'audio-btn slow', 'aria-label': 'Play slowly', onclick: () => speak(text, { slow: true }) }, icon('turtle'));
  setTimeout(() => speak(text), 350);
  return h('div', { class: 'audio-row' }, big, slow);
}

function bigText(step) {
  if (step.text) {
    return h('div', { class: 'cloze-wrap' }, h('p', { class: 'cloze', lang: 'fr' }, ...clozeParts(step.text)),
      step.en ? h('p', { class: 'cloze-en' }, step.en) : null);
  }
  if (!step.big) return null;
  const cls = `big ${step.hero ? 'hero' : ''}`;
  const kids = [h('span', { lang: step.speakBig ? 'fr' : 'en' }, step.big)];
  if (step.speakBig) kids.push(h('button', { class: 'icon-btn tiny', 'aria-label': 'Hear it', onclick: () => speak(step.speakBig) }, icon('sound')));
  return h('div', { class: 'big-wrap' }, h('div', { class: cls }, ...kids), pron(step.bigPr, step.bigFa, 'center'));
}

function clozeParts(text) {
  const [a, b] = text.split('___');
  if (b === undefined) return [text];
  return [a, h('span', { class: 'blank' }, '____'), b];
}

function passageCard(reading, { compact = false } = {}) {
  let showEn = !!reading.showEn;
  const lines = reading.lines.map((l) => {
    const en = l.en ? h('span', { class: 'en', hidden: !reading.showEn }, l.en) : h('span', { class: 'en', hidden: true });
    return h('button', { class: 'p-line', onclick: () => speak(l.fr) },
      l.who ? h('b', { class: 'who' }, l.who) : null,
      h('span', { class: 'fr', lang: 'fr' }, l.fr), pron(l.pr, l.fa), en);
  });
  const toggle = h('button', { class: 'chip', 'aria-pressed': 'false', onclick: () => {
    showEn = !showEn;
    toggle.setAttribute('aria-pressed', String(showEn));
    toggle.lastChild.textContent = showEn ? 'Hide English' : 'Show English';
    lines.forEach((ln) => (ln.querySelector('.en').hidden = !showEn));
  } }, icon('eye'), h('span', {}, showEn ? 'Hide English' : 'Show English'));
  const playAll = h('button', { class: 'chip', onclick: async () => {
    for (const l of reading.lines) await speak(l.fr);
  } }, icon('sound'), h('span', {}, 'Listen to all'));
  return h('section', { class: `passage ${compact ? 'compact' : ''}` },
    h('div', { class: 'p-head' }, h('h3', {}, reading.title), h('div', { class: 'p-tools' }, playAll, toggle)),
    ...lines);
}

function accentBar(input) {
  return h('div', { class: 'accents', role: 'group', 'aria-label': 'Accented letters' },
    ...ACCENTS.map((ch) => h('button', { class: 'key', type: 'button', tabindex: '-1', onmousedown: (e) => e.preventDefault(), onclick: () => {
      const s = input.selectionStart ?? input.value.length, e2 = input.selectionEnd ?? s;
      input.value = input.value.slice(0, s) + ch + input.value.slice(e2);
      input.focus();
      input.setSelectionRange(s + 1, s + 1);
      input.dispatchEvent(new Event('input'));
    } }, ch)));
}

// ---------- Renderers ----------

const RENDER = {
  intro(step, body) {
    const gender = { m: 'masculine', f: 'feminine', mf: 'masc. or fem.', pl: 'plural' }[step.g];
    setTimeout(() => speak(step.fr), 300);
    put(body, 
      promptHead({ say: 'Nouveau mot !', sub: 'Tap the word to hear it again.' }),
      h('div', { class: 'card intro' },
        h('span', { class: `pill g-${step.g}` }, gender),
        h('button', { class: 'intro-fr', lang: 'fr', onclick: () => speak(step.fr) }, step.fr, icon('sound')),
        pron(step.pr, step.fa, 'center big-pron'),
        h('div', { class: 'intro-en' }, step.en),
        step.tip ? h('p', { class: 'tip' }, step.tip) : null,
        step.trick ? trickBox(step.trick) : null),
    );
    return {};
  },

  letter(step, body) {
    setTimeout(() => speak(step.say), 300);
    put(body, 
      promptHead({ say: 'Nouvelle lettre !', sub: 'Tap the letter to hear it again.' }),
      h('div', { class: 'card intro letter-card' },
        h('button', { class: 'letter-big', 'aria-label': `Hear ${step.letter}`, onclick: () => speak(step.say) },
          h('span', { class: 'lb-upper' }, step.letter), h('span', { class: 'lb-lower' }, step.letter.toLowerCase())),
        h('div', { class: 'letter-say', lang: 'fr' }, `« ${step.say} »`),
        pron(step.pr, step.fa, 'center big-pron'),
        h('p', { class: 'tip' }, step.hint),
        step.word ? h('button', { class: 'chip', onclick: () => speak(step.word) }, icon('sound'),
          h('span', { lang: 'fr' }, h('b', {}, step.word.slice(0, 1)), step.word.slice(1)),
          step.wordEn ? h('span', { class: 'chip-en' }, step.wordEn) : null) : null,
        step.trick ? trickBox(step.trick) : null),
    );
    return {};
  },

  accent(step, body) {
    setTimeout(() => speak(step.name), 300);
    put(body, 
      promptHead({ say: 'Un accent !', sub: 'Tap the words to hear how it sounds.' }),
      h('div', { class: 'card intro letter-card' },
        h('button', { class: 'letter-big', 'aria-label': `Hear ${step.name}`, onclick: () => speak(step.name) }, h('span', { class: 'lb-upper' }, step.mark)),
        h('div', { class: 'letter-say', lang: 'fr' }, step.name),
        pron(step.pr, step.fa, 'center big-pron'),
        h('p', { class: 'tip' }, step.hint),
        h('div', { class: 'chip-row' }, ...step.words.map((w) => h('button', { class: 'chip', onclick: () => speak(w) }, icon('sound'),
          h('span', { lang: 'fr' }, w), step.wordsEn?.[w] ? h('span', { class: 'chip-en' }, step.wordsEn[w]) : null))),
        step.trick ? trickBox(step.trick) : null),
    );
    return {};
  },

  teach(step, body) {
    const kids = [h('h2', {}, step.title), h('p', { class: 'teach-body', html: step.body })];
    if (step.table) {
      kids.push(h('table', { class: 'ptable' },
        h('thead', {}, h('tr', {}, ...step.table.head.map((c) => h('th', {}, c)))),
        h('tbody', {}, ...step.table.rows.map((r) => h('tr', {}, ...r.map((c, ci) => ci === 0
          ? h('th', { scope: 'row' }, c)
          : h('td', {}, h('button', { class: 'word', lang: 'fr', onclick: () => speak(c) }, c))))))));
    }
    if (step.examples) {
      kids.push(h('ul', { class: 'examples' }, ...step.examples.map((e) =>
        h('li', {}, h('button', { class: 'ex', onclick: () => speak(e.fr) }, icon('sound'), h('span', { lang: 'fr' }, e.fr)), pron(e.pr, e.fa, 'indent'), h('span', { class: 'en' }, e.en)))));
    }
    if (step.trick) kids.push(trickBox(step.trick));
    put(body, promptHead({ say: 'Écoute, je t’explique.', sub: 'A quick rule from Minou.' }), h('div', { class: 'card teach' }, ...kids));
    return {};
  },

  passage(step, body) {
    put(body, promptHead(step), passageCard(step.passage));
    return {};
  },

  // A grid of tap-to-hear tiles: numbers by default, or any {big, fr, say, pr, fa} tiles.
  numbers(step, body) {
    const tiles = step.tiles || step.nums.map((n) => ({ big: String(n), fr: numberWord(n), pr: prNumber(n), fa: faNumber(n) }));
    const all = h('button', { class: 'chip', onclick: async () => { for (const t of tiles) await speak(t.say || t.fr); } },
      icon('sound'), h('span', {}, 'Listen to all'));
    put(body, promptHead(step), step.note ? h('p', { class: 'grid-note' }, step.note) : null, all,
      h('div', { class: `num-grid ${step.gridClass || ''}` }, ...tiles.map((t) =>
        h('button', { class: 'num-tile', onclick: () => speak(t.say || t.fr) },
          h('b', {}, t.big), t.fr !== t.big ? h('span', { lang: 'fr' }, t.fr) : null, pron(t.pr, t.fa, 'center')))));
    return {};
  },

  mcq(step, body, ctx) {
    let chosen = -1;
    const opts = step.options;
    const buttons = opts.map((o, idx) => h('button', { class: 'opt', lang: step.optionsFr ? 'fr' : 'en', onclick: () => choose(idx) },
      h('kbd', {}, String(idx + 1)), h('span', {}, o, step.optionsEn?.[o] ? h('small', { class: 'opt-en', hidden: true }, step.optionsEn[o]) : null)));
    const enToggle = step.optionsEn ? h('button', { class: 'chip en-toggle', 'aria-pressed': 'false', onclick: () => {
      const on = enToggle.getAttribute('aria-pressed') !== 'true';
      enToggle.setAttribute('aria-pressed', String(on));
      body.querySelectorAll('.opt-en').forEach((x) => (x.hidden = !on));
    } }, icon('eye'), h('span', {}, 'English for the answers')) : null;
    function choose(idx) {
      if (idx >= buttons.length) return;
      chosen = idx;
      buttons.forEach((b, j) => b.classList.toggle('sel', j === idx));
      sfx.tap();
      if (step.optionsFr) speak(opts[idx]);
      ctx.ready(true);
    }
    put(body, 
      promptHead(step),
      step.passage ? passageCard(step.passage, { compact: true }) : null,
      step.audio ? audioBlock(step.audio) : null,
      bigText(step),
      enToggle,
      h('div', { class: `opts ${step.letters ? 'letters' : opts.length > 3 || opts.some((o) => o.length > 22) ? 'col' : 'row'}` }, ...buttons),
    );
    return {
      choose,
      check() {
        const ok = opts[chosen] === step.answer;
        return { ok, grade: ok ? 3 : 1 };
      },
      lock() {
        buttons.forEach((b, j) => {
          b.disabled = true;
          if (opts[j] === step.answer) b.classList.add('right');
          else if (j === chosen) b.classList.add('wrong');
        });
      },
    };
  },

  type(step, body, ctx) {
    const input = step.long
      ? h('textarea', { class: 'answer', rows: '2', lang: 'fr', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', placeholder: 'Type in French' })
      : h('input', { class: 'answer', type: 'text', lang: step.numeric ? 'en' : 'fr', inputmode: step.numeric ? 'numeric' : 'text',
        autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', placeholder: step.numeric ? 'Digits' : 'Type in French' });
    input.addEventListener('input', () => ctx.ready(input.value.trim().length > 0));
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && step.long) { e.preventDefault(); ctx.submit(); } });
    put(body, 
      promptHead(step),
      step.audio ? audioBlock(step.audio) : null,
      bigText(step),
      input,
      step.numeric ? null : accentBar(input),
    );
    setTimeout(() => input.focus(), 80);
    return {
      check() {
        const v = input.value;
        if (step.numeric) {
          const ok = v.replace(/\D/g, '') === step.answers[0];
          return { ok, grade: ok ? 3 : 1 };
        }
        if (step.caseless) {
          const ok = step.answers.some((a) => clean(a) === clean(v));
          if (ok) return { ok, grade: 3 };
        }
        const res = checkFrench(v, step.answers, { needArticle: step.needArticle });
        // In accent and spelling drills the accents are the point, so a slip is a miss.
        if (step.strictAccents && res.ok && res.grade === 2) return { ok: false, grade: 1, note: res.note };
        return res;
      },
      lock(res) { input.disabled = true; input.classList.add(res.ok ? 'right' : 'wrong'); },
    };
  },

  bank(step, body, ctx) {
    const tray = h('div', { class: 'tray', 'aria-label': 'Your answer' });
    const pool = h('div', { class: 'pool' });
    const tiles = step.tiles.map((w) => {
      const t = h('button', { class: 'tile', lang: 'fr' }, w);
      t.onclick = () => {
        sfx.tap();
        (t.parentElement === pool ? tray : pool).append(t);
        if (t.parentElement === tray) speak(w);
        ctx.ready(tray.children.length > 0);
      };
      return t;
    });
    pool.append(...tiles);
    put(body, promptHead(step), step.audio ? audioBlock(step.audio) : null, bigText(step), tray, pool);
    return {
      check() {
        const said = Array.from(tray.children).map((t) => t.textContent).join(' ');
        const res = checkFrench(said, step.answers);
        // Word order must be exact for tiles: no typo leniency.
        if (res.ok && res.grade === 2 && !/accent/i.test(res.note || '')) return { ok: false, grade: 1 };
        return res.ok ? { ok: true, grade: 3 } : res;
      },
      lock(res) { tiles.forEach((t) => (t.disabled = true)); tray.classList.add(res.ok ? 'right' : 'wrong'); },
    };
  },

  match(step, body, ctx) {
    const left = shuffle(step.pairs), right = shuffle(step.pairs);
    let selL = null, selR = null, matched = 0, mistakes = 0;
    const missed = new Set();
    const mk = (p, side) => {
      const b = h('button', { class: 'm-cell', lang: side === 'fr' ? 'fr' : 'en' }, side === 'fr' ? p.fr : p.en);
      b.onclick = () => {
        if (b.disabled) return;
        if (side === 'fr') { speak(p.fr); selL = { p, b }; colL.querySelectorAll('.sel').forEach((x) => x.classList.remove('sel')); }
        else { selR = { p, b }; colR.querySelectorAll('.sel').forEach((x) => x.classList.remove('sel')); }
        b.classList.add('sel');
        if (selL && selR) {
          if (selL.p.id === selR.p.id) {
            sfx.correct();
            [selL.b, selR.b].forEach((x) => { x.classList.remove('sel'); x.classList.add('done'); x.disabled = true; });
            matched += 1;
            if (matched === step.pairs.length) {
              ctx.grade({ ok: mistakes <= 2, grade: mistakes ? 2 : 3,
                note: mistakes ? `${mistakes} mismatch${mistakes > 1 ? 'es' : ''}.` : null,
                items: step.pairs.map((pp) => [pp.id, missed.has(pp.id) ? 2 : 3]) });
            }
          } else {
            sfx.wrong();
            mistakes += 1;
            missed.add(selL.p.id); missed.add(selR.p.id);
            const a = selL.b, c = selR.b;
            [a, c].forEach((x) => x.classList.add('shake'));
            setTimeout(() => [a, c].forEach((x) => x.classList.remove('shake', 'sel')), 450);
          }
          selL = selR = null;
        }
      };
      return b;
    };
    const colL = h('div', { class: 'm-col' }, ...left.map((p) => mk(p, 'fr')));
    const colR = h('div', { class: 'm-col' }, ...right.map((p) => mk(p, 'en')));
    put(body, promptHead(step), h('div', { class: 'match' }, colL, colR));
    return { hideCheck: true, check: () => null };
  },

  speak(step, body, ctx) {
    const canListen = sttSupported() && !store.get().settings.speakOff && !step.selfCheck;
    let tries = 0;
    const status = h('p', { class: 'mic-status', role: 'status' }, canListen ? 'Tap the mic and speak.' : 'Say it out loud, then check yourself.');
    const phrase = h('div', { class: 'speak-card' },
      step.showDigits ? h('div', { class: 'big hero' }, step.digits) : h('div', { class: 'speak-fr', lang: 'fr' }, step.fr),
      step.showDigits && step.fr !== step.digits ? h('div', { class: 'speak-sub', lang: 'fr' }, step.fr) : null,
      pron(step.pr, step.fa, 'center'),
      h('div', { class: 'speak-en' }, step.showDigits ? (step.en && !/^\d+$/.test(step.en) ? step.en : 'Say it in French') : step.en),
      h('button', { class: 'chip', onclick: () => speak(step.fr) }, icon('sound'), h('span', {}, 'Hear Minou say it')));
    put(body, promptHead(step), phrase);

    if (canListen) {
      const mic = h('button', { class: 'mic', 'aria-label': 'Start speaking' }, icon('mic'));
      const giveUp = h('button', { class: 'btn ghost small', hidden: true, onclick: () => ctx.grade({ ok: true, grade: 2, note: 'Marked as said. Keep practising out loud!' }) }, 'I said it, mark it');
      mic.onclick = async () => {
        if (mic.classList.contains('on')) return;
        stopSpeaking();
        status.textContent = 'Starting the mic…';
        try {
          const alts = await listen({ onStart: () => { mic.classList.add('on'); status.textContent = 'Listening… speak now.'; } });
          mic.classList.remove('on');
          const target = step.fr;
          let best = 0, heard = alts[0];
          for (const a of alts) {
            let s = similarity(a, target);
            if (step.digits && a.replace(/\D/g, '') === step.digits) s = 1;
            if (s > best) { best = s; heard = a; }
          }
          tries += 1;
          if (best >= 0.72) {
            ctx.grade({ ok: true, grade: best >= 0.9 ? 3 : 2, heard });
          } else if (tries >= 3) {
            ctx.grade({ ok: false, grade: 1, heard, note: 'Listen to Minou, then try it again later in the lesson.' });
          } else {
            status.textContent = `Minou heard “${heard}”. Try again: ${3 - tries} ${3 - tries === 1 ? 'try' : 'tries'} left.`;
            if (tries >= 2) giveUp.hidden = false;
          }
        } catch (err) {
          mic.classList.remove('on');
          status.textContent = err.message;
          giveUp.hidden = false;
        }
      };
      put(body, h('div', { class: 'mic-wrap' }, mic, status, giveUp));
    } else {
      const yes = h('button', { class: 'btn good', onclick: () => ctx.grade({ ok: true, grade: 3 }) }, 'I said it right');
      const no = h('button', { class: 'btn bad soft', onclick: () => ctx.grade({ ok: false, grade: 1 }) }, 'Not quite');
      put(body, h('div', { class: 'mic-wrap' }, status,
        h('button', { class: 'chip', onclick: () => speak(step.fr) }, icon('sound'), h('span', {}, 'Compare with Minou')),
        h('div', { class: 'self-check' }, no, yes)));
    }
    return { auto: true, check: () => null };
  },
};

// ---------- Results ----------

export function showResults({ title, result, mode, stars, onContinue, extra }) {
  const root = $('#lesson');
  root.innerHTML = '';
  root.hidden = false;
  document.body.classList.add('in-lesson');
  const acc = Math.round(result.accuracy * 100);
  const mins = Math.floor(result.seconds / 60), secs = result.seconds % 60;
  const cat = minouSVG({ size: 150, mood: acc >= 70 ? 'cheer' : 'idle', cls: 'm-react' });
  const [headline, headEn] = mode === 'exam'
    ? (acc >= 85 ? ['C’est gagné !', 'You’ve got this!'] : acc >= 65 ? ['Pas mal du tout !', 'Not bad at all!'] : ['On continue !', 'Let’s keep going!'])
    : (acc >= 90 ? ['Parfait !', 'Perfect!'] : acc >= 70 ? ['Leçon terminée !', 'Lesson complete!'] : ['Bien joué !', 'Well played!']);
  const sub = mode === 'exam'
    ? (acc >= 85 ? 'You’re ready for the quiz.' : acc >= 65 ? 'Close. Practise your weak spots, then try again.' : 'Review your weak spots, then take it again.')
    : (acc === 100 ? 'Not a single slip. Minou is impressed.' : acc >= 90 ? 'Almost flawless. Your one slip is saved for review.' : 'Every mistake is now in your review deck.');

  const tiles = h('div', { class: 'res-tiles' },
    resTile('paw', 'Day streak', String(store.streakNow())),
    resTile('target', mode === 'exam' ? 'Score' : 'Accuracy', `${acc}%`),
    resTile('clock', 'Time', `${mins}:${String(secs).padStart(2, '0')}`));

  const starRow = stars ? h('div', { class: 'stars', 'aria-label': `${stars} of 3 stars` },
    ...[1, 2, 3].map((n) => h('span', { class: n <= stars ? 'on' : '' }, icon('star')))) : null;

  const skillRows = mode === 'exam' ? h('div', { class: 'card skills-card' }, h('h3', {}, 'By skill'),
    ...Object.entries(result.answersBySkill).map(([k, [c, t]]) => skillBar(k, c, t))) : null;

  const missList = result.misses.filter((m) => !m.retry).length
    ? h('details', { class: 'card misses', open: mode === 'exam' },
      h('summary', {}, `To review (${result.misses.filter((m) => !m.retry).length})`),
      h('ul', {}, ...result.misses.filter((m) => !m.retry).map((m) =>
        h('li', {}, h('span', { lang: 'fr' }, m.reveal || m.label || ''), m.speakAnswer
          ? h('button', { class: 'icon-btn tiny', 'aria-label': 'Hear it', onclick: () => speak(m.speakAnswer) }, icon('sound')) : null))))
    : null;

  const btn = h('button', { class: 'btn primary wide', onclick: () => {
    root.hidden = true; root.innerHTML = ''; document.body.classList.remove('in-lesson'); onContinue && onContinue();
  } }, 'Continue');

  root.append(h('div', { class: 'results' }, cat, h('h1', { lang: 'fr' }, headline), h('p', { class: 'res-en' }, headEn), h('p', { class: 'res-sub' }, sub),
    starRow, tiles, skillRows, missList, extra || null, h('div', { class: 'res-foot' }, btn)));
  if (acc >= 70) { sfx.done(); confetti(); }
  setTimeout(() => btn.focus({ preventScroll: true }), 100);
}

function resTile(ic, label, value) {
  return h('div', { class: 'res-tile' }, icon(ic), h('b', {}, value), h('span', {}, label));
}

export function skillBar(skill, c, t) {
  const pct = t ? Math.round((c / t) * 100) : 0;
  const names = { reading: 'Reading', writing: 'Writing', listening: 'Listening', speaking: 'Speaking' };
  return h('div', { class: 'skill' },
    h('div', { class: 'skill-top' }, h('span', {}, icon(skill), names[skill] || skill), h('span', { class: 'muted' }, t ? `${pct}%` : 'no answers yet')),
    h('div', { class: `meter s-${skill}` }, h('i', { style: `width:${pct}%` })));
}
