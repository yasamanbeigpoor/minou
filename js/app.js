// Minou: screens, navigation and wiring.
import { h, $, todayKey, pick } from './util.js';
import { DB, loadAll, nodeState, currentNode, startedModules, moduleByKey } from './data.js';
import * as store from './store.js';
import { buildNode, buildReview, buildWeak, buildExam, buildNumbers, dueCount } from './build.js';
import { runLesson, showResults, skillBar } from './lesson.js';
import { minouSVG, setMood } from './minou.js';
import { icon } from './icons.js';
import { renderSummary } from './summary.js';
import { speak, frenchVoices, refreshVoice, ttsSupported, sttSupported } from './speech.js';
import { sfx } from './sound.js';
import { startTour } from './tour.js';
import { applyPronClasses, prOn, faOn } from './fa.js';

const app = $('#app');
let installEvt = null;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; });

const NODE_BLURB = {
  review: 'A mixed quiz on everything you learned before this module.',
  words: (n) => `Meet ${n.items.length} new words, then practise them by reading, writing, listening and speaking.`,
  grammar: 'Minou explains the rule step by step, then you drill it.',
  exercises: 'The textbook exercises, with instant feedback on every blank.',
  reading: 'Read short texts, hear every line, and answer questions.',
  listen: 'Build, hear, type and say full sentences.',
  numbers: (n) => `Learn the numbers ${n.mod.numbers[0]} to ${n.mod.numbers[1]}, then hear, read, write and say them.`,
  checkpoint: 'A mixed test of the whole module. Pass it to unlock the next module.',
  letters: (n) => `Meet ${n.letters.length} letters: how to say each one, then hear them, name them and say them.`,
  'letter-traps': 'The letters English speakers mix up, drilled by ear until they stick.',
  accents: 'What each accent looks like, how it sounds, and how to type it.',
  spell: 'Minou spells words from your lessons letter by letter. You type the word, then spell some yourself.',
};

// ---------- Boot ----------

async function boot() {
  try {
    await loadAll();
  } catch (e) {
    app.innerHTML = '';
    app.append(h('div', { class: 'boot-error' }, minouSVG({ size: 120, mood: 'sad' }),
      h('h1', {}, 'Minou couldn’t load the lessons'),
      h('p', {}, 'Check your connection and reload. If you opened the file directly, serve the folder with a local web server instead.'),
      h('button', { class: 'btn primary', onclick: () => location.reload() }, 'Reload')));
    console.error(e);
    return;
  }
  applyPronClasses();
  addEventListener('hashchange', route);
  route();
  if (!store.get().settings.name) onboarding();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

function onboarding() {
  const input = h('input', { class: 'answer', type: 'text', placeholder: 'Your name', autocomplete: 'given-name', maxlength: '30' });
  const go = h('button', { class: 'btn primary wide', disabled: true }, 'C’est parti !', h('small', { class: 'btn-en' }, 'Let’s go!'));
  input.addEventListener('input', () => (go.disabled = !input.value.trim()));
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && input.value.trim()) go.click(); });
  const cat = minouSVG({ size: 170, mood: 'happy', cls: 'm-react' });
  const ov = h('div', { class: 'onboard', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'ob-title' },
    h('div', { class: 'onboard-card' }, cat,
      h('h1', { id: 'ob-title', lang: 'fr' }, 'Bonjour ! Je suis Minou.'),
      h('p', { class: 'ob-en' }, 'Hello! I’m Minou.'),
      h('p', {}, 'I’ll be your French teacher. Every day: a quick review, a new module, and ten new numbers. Everything comes with English, and you can turn on pronunciation help in English or Persian.'),
      h('label', { class: 'field' }, h('span', { lang: 'fr' }, 'Et toi, comment tu t’appelles ?'), h('small', {}, 'And you, what’s your name?'), input),
      go));
  go.onclick = () => {
    store.setSetting('name', input.value.trim());
    sfx.meow();
    speak(`Enchanté, ${input.value.trim()} !`);
    ov.remove();
    route();
    setTimeout(() => startTour(), 350);
  };
  document.body.append(ov);
  setTimeout(() => input.focus(), 100);
}

// ---------- Router ----------

function route() {
  const [, tab = 'learn', arg] = location.hash.split('/');
  app.innerHTML = '';
  const screens = { learn: learnScreen, practice: practiceScreen, notes: notesScreen, me: meScreen };
  const view = (screens[tab] || learnScreen)(arg);
  app.append(view, tabBar(tab in screens ? tab : 'learn'));
  window.scrollTo(0, 0);
  if (tab === 'learn' || !(tab in screens)) setTimeout(scrollToCurrent, 60);
}

function tabBar(active) {
  const tabs = [['learn', 'learn', 'Learn'], ['practice', 'practice', 'Practise'], ['notes', 'notes', 'Notebook'], ['me', 'me', 'Me']];
  return h('nav', { class: 'tabbar', 'aria-label': 'Main' }, ...tabs.map(([id, ic, label]) =>
    h('a', { href: `#/${id}`, class: id === active ? 'on' : '', 'aria-current': id === active ? 'page' : null }, icon(ic), h('span', {}, label))));
}

function statsBar() {
  const s = store.get();
  const goal = s.settings.goal;
  const today = store.todayXP();
  const pct = Math.min(1, today / goal);
  const r = 15, circ = 2 * Math.PI * r;
  const ring = h('span', { class: 'ring', title: `${today} of ${goal} XP today`, html:
    `<svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="${r}" class="ring-bg"/><circle cx="18" cy="18" r="${r}" class="ring-fg" stroke-dasharray="${circ}" stroke-dashoffset="${circ * (1 - pct)}"/></svg>` });
  ring.append(icon('xp'));
  return h('header', { class: 'stats' },
    h('div', { class: 'brand' }, h('span', { class: 'wordmark' }, 'minou'), h('span', { class: 'class-tag' }, 'Class 1')),
    h('div', { class: 'stat streak', title: 'Day streak' }, icon('paw'), h('b', {}, String(store.streakNow()))),
    h('div', { class: 'stat goal' }, ring, h('b', {}, `${today}/${goal}`)),
  );
}

// ---------- Learn: the path ----------

const OFFSETS = [0, 46, 72, 46, 0, -46, -72, -46];

function learnScreen() {
  const wrap = h('div', { class: 'screen learn' }, statsBar());
  const name = store.get().settings.name;
  const cur = currentNode();

  for (const m of DB.modules) {
    const banner = h('div', { class: 'mod-banner' },
      h('div', {}, h('span', { class: 'mod-num' }, m.bonus ? 'Bonus track' : `Module ${m.number}`), h('h2', {}, m.title), h('p', {}, m.subtitle)),
      h('a', { class: 'banner-btn', href: `#/notes/${m.key}`, 'aria-label': `Summary of ${m.title}` }, icon('notes'), h('span', {}, 'Summary')));
    banner.classList.toggle('bonus', !!m.bonus);
    const path = h('ol', { class: 'path' });
    m.nodes.forEach((n, i) => {
      const st = nodeState(n);
      const done = store.get().done[n.key];
      const off = OFFSETS[i % OFFSETS.length];
      const btn = h('button', { class: `node ${st} t-${n.type}`, 'aria-label': `${n.title}: ${n.subtitle}${st === 'locked' ? ' (locked)' : ''}`, onclick: () => openNode(n) },
        icon(st === 'locked' ? 'lock' : n.icon));
      const li = h('li', { class: 'path-step', style: `--x:${off}px` },
        st === 'current' ? h('span', { class: 'start-tag' }, done ? 'Again' : 'Start') : null,
        btn,
        h('span', { class: 'node-label' }, h('span', { lang: 'fr' }, n.title), n.titleEn && n.titleEn !== n.title ? h('small', {}, n.titleEn) : null),
        done ? h('span', { class: 'node-stars', 'aria-label': `${done.stars} stars` }, ...[1, 2, 3].map((k) => h('i', { class: k <= done.stars ? 'on' : '' }))) : null);
      if (n === cur) {
        li.classList.add('is-current');
        const greet = timeGreeting(name);
        const cat = minouSVG({ size: 92, mood: 'idle', cls: 'path-cat' });
        const bubble = h('div', { class: 'path-bubble' }, h('span', { lang: 'fr' }, greet.fr), h('small', {}, greet.en));
        li.append(h('div', { class: `path-minou ${off >= 0 ? 'left' : 'right'}` }, bubble, cat));
        cat.addEventListener('click', () => { setMood(cat, 'happy'); sfx.meow(); setTimeout(() => setMood(cat, 'idle'), 1400); });
      }
      path.append(li);
    });
    wrap.append(h('section', { class: `module ${m.bonus ? 'is-bonus' : ''}` }, banner, path));
  }

  wrap.append(h('div', { class: 'path-end' }, minouSVG({ size: 64, mood: 'idle' }),
    h('p', {}, 'Send Minou the next module’s pages and it will appear here.')));
  return wrap;
}

function timeGreeting(name) {
  const hr = new Date().getHours();
  const [hello, helloEn] = hr < 5 ? ['Encore debout', 'Still up'] : hr < 12 ? ['Bonjour', 'Good morning'] : hr < 18 ? ['Salut', 'Hi'] : ['Bonsoir', 'Good evening'];
  const [extra, extraEn] = pick([['On continue ?', 'Shall we continue?'], ['C’est parti !', 'Let’s go!'], ['Allez, une leçon !', 'Come on, one lesson!']]);
  const who = name ? `, ${name}` : '';
  return { fr: `${hello}${who} ! ${extra}`, en: `${helloEn}${who}! ${extraEn}` };
}

function scrollToCurrent() {
  const el = $('.path-step.is-current');
  if (el) el.scrollIntoView({ block: 'center', behavior: 'instant' in window ? 'instant' : 'auto' });
}

function openNode(n) {
  const st = nodeState(n);
  sfx.tap();
  const done = store.get().done[n.key];
  const blurb = typeof NODE_BLURB[n.type] === 'function' ? NODE_BLURB[n.type](n) : NODE_BLURB[n.type];
  const close = () => { ov.remove(); };
  const action = st === 'locked'
    ? h('p', { class: 'locked-note' }, icon('lock'), 'Finish the step before this one to unlock it.')
    : h('button', { class: 'btn primary wide', onclick: () => { close(); startNode(n); } }, done ? 'Practise again' : 'Start lesson');
  const ov = h('div', { class: 'pop-ov', onclick: (e) => { if (e.target === ov) close(); } },
    h('div', { class: `pop t-${n.type}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': n.title },
      h('div', { class: 'pop-head' }, h('span', { class: 'pop-ic' }, icon(n.icon)),
        h('div', {}, h('h3', {}, n.title), h('p', {}, n.subtitle))),
      h('p', { class: 'pop-blurb' }, blurb),
      done ? h('p', { class: 'pop-best' }, `Best: ${Math.round(done.best * 100)}%  ·  Played ${done.times}×`) : null,
      action));
  document.body.append(ov);
  ov.querySelector('button')?.focus();
  const esc = (e) => { if (e.key === 'Escape') { close(); removeEventListener('keydown', esc); } };
  addEventListener('keydown', esc);
}

function startNode(n) {
  const steps = buildNode(n);
  if (!steps.length) return;
  runLesson({
    title: n.title, steps, mode: 'learn',
    onExit: route,
    onDone: (result) => {
      const bonus = 10 + (result.accuracy >= 0.95 ? 5 : 0);
      result.xp += bonus;
      store.addXP(result.xp);
      const stars = store.finishNode(n.key, result.accuracy);
      showResults({ title: n.title, result, mode: 'learn', stars, onContinue: route });
    },
  });
}

// ---------- Practise ----------

function practiceScreen() {
  const mods = startedModules();
  const s = store.get();
  const weakIds = Object.keys(s.weak).filter((id) => DB.items[id]);
  const due = dueCount(mods);
  const none = !mods.length;

  const run = (title, steps, mode = 'review') => {
    if (!steps.length) return;
    runLesson({ title, steps, mode, onExit: route, onDone: (result) => {
      if (mode === 'exam') {
        store.addExam({ date: todayKey(), score: result.accuracy, total: result.graded, bySkill: result.answersBySkill });
        result.xp += 20;
      } else result.xp += 5;
      store.addXP(result.xp);
      showResults({ title, result, mode, onContinue: route });
    } });
  };

  const card = (cls, ic, title, text, btnLabel, onClick, disabled) => h('section', { class: `card pcard ${cls}` },
    h('div', { class: 'pcard-head' }, h('span', { class: 'pcard-ic' }, icon(ic)), h('h2', {}, title)),
    h('p', {}, text),
    h('button', { class: 'btn primary', disabled: disabled || null, onclick: onClick }, btnLabel));

  const learnedNums = mods.filter((m) => m.numbers);
  const lastExam = s.exams[0];

  return h('div', { class: 'screen practice' },
    h('header', { class: 'page-head' }, h('h1', {}, 'Practise'), h('p', {}, 'Minou mixes what you’ve learned so it sticks.')),
    none ? h('div', { class: 'empty' }, minouSVG({ size: 110, mood: 'idle' }), h('p', {}, 'Finish your first lesson and your reviews will show up here.'),
      h('a', { class: 'btn primary', href: '#/learn' }, 'Go to lesson 1')) : null,
    card('daily', 'refresh', 'Daily review', due
      ? `${due} item${due > 1 ? 's are' : ' is'} ready for review. Mixed skills, weighted toward what you missed.`
      : 'Nothing is due, but a mixed round keeps it fresh.', 'Start review',
    () => run('Daily review', buildReview(mods, 18)), none),
    card('weak', 'target', 'Weak spots', weakIds.length
      ? `${weakIds.length} thing${weakIds.length > 1 ? 's' : ''} you missed recently. Two clean answers clears one.`
      : 'No weak spots right now. Mistakes you make will collect here.', 'Practise weak spots',
    () => run('Weak spots', buildWeak(15)), !weakIds.length),
    card('exam', 'exam', 'Mock exam', `25 questions across all your modules, 15 minutes, no hints until the end.${lastExam ? ` Last score: ${Math.round(lastExam.score * 100)}%.` : ''}`,
      'Start mock exam', () => run('Mock exam', buildExam(mods, 25), 'exam'), none),
    card('nums', 'hash', 'Numbers drill', learnedNums.length
      ? `Every number you’ve learned so far, up to ${Math.max(...learnedNums.map((m) => m.numbers[1]))}.`
      : 'Unlocks with your first numbers lesson.', 'Drill numbers',
    () => { const top = Math.max(...learnedNums.map((m) => m.numbers[1])); run('Numbers drill', buildNumbers(0, top, false)); }, !learnedNums.length),
    h('section', { class: 'card' }, h('h2', { class: 'card-title' }, 'Your four skills'),
      ...Object.entries(s.skills).map(([k, [c, t]]) => skillBar(k, c, t))),
  );
}

// ---------- Notebook ----------

function notesScreen(key) {
  if (key) {
    const m = moduleByKey(decodeURIComponent(key));
    if (m) return moduleNotes(m);
  }
  return h('div', { class: 'screen notes' },
    h('header', { class: 'page-head' }, h('h1', {}, 'Notebook'), h('p', {}, 'One summary per module. Read it here or download it as a PDF.')),
    ...DB.classes.map((cls) => h('section', { class: 'notes-class' }, h('h2', { class: 'card-title' }, cls.title),
      ...DB.modules.filter((m) => m.classId === cls.id).map((m) =>
        h('a', { class: 'card note-link', href: `#/notes/${m.key}` },
          h('span', { class: 'note-num' }, m.bonus ? 'Aa' : String(m.number)),
          h('span', {}, h('b', {}, m.title), h('small', {}, m.subtitle)),
          icon('back', 'flip'))))));
}

function moduleNotes(m) {
  const pdf = `summaries/${m.classId}-${m.id}${faOn() ? '-fa' : ''}.pdf`;
  const fname = `Minou ${m.className} - ${m.bonus ? '' : `Module ${m.number} - `}${m.title.replace(/'/g, '’')}.pdf`;
  const dl = h('a', { class: 'btn primary', href: pdf, download: fname, hidden: true }, icon('download'), 'Download PDF');
  fetch(pdf, { method: 'HEAD' }).then((r) => { if (r.ok) dl.hidden = false; }).catch(() => {});
  return h('div', { class: 'screen module-notes' },
    h('div', { class: 'notes-bar' },
      h('a', { class: 'icon-btn', href: '#/notes', 'aria-label': 'Back to notebook' }, icon('back')),
      h('div', { class: 'notes-actions' }, dl,
        h('button', { class: 'btn ghost', onclick: () => print() }, icon('print'), 'Print'))),
    renderSummary(m, { interactive: true }));
}

// ---------- Me ----------

function meScreen() {
  const s = store.get();
  const name = s.settings.name || 'toi';
  const last7 = Array.from({ length: 7 }, (_, k) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - k));
    return { label: d.toLocaleDateString('en', { weekday: 'narrow' }), xp: s.days[todayKey(d)] || 0 };
  });
  const maxXP = Math.max(s.settings.goal, ...last7.map((d) => d.xp));
  const week = h('div', { class: 'week', role: 'img', 'aria-label': 'XP over the last 7 days' },
    ...last7.map((d) => h('div', { class: 'week-col' },
      h('div', { class: 'week-bar' }, h('i', { style: `height:${Math.round((d.xp / maxXP) * 100)}%`, class: d.xp >= s.settings.goal ? 'met' : '' })),
      h('span', {}, d.label))));

  // Settings controls
  const nameIn = h('input', { type: 'text', value: s.settings.name || '', maxlength: '30', onchange: (e) => store.setSetting('name', e.target.value.trim()) });
  const sound = h('input', { type: 'checkbox', checked: s.settings.sound || null, onchange: (e) => store.setSetting('sound', e.target.checked) });
  const pronIn = h('input', { type: 'checkbox', checked: prOn() || null, onchange: (e) => { store.setSetting('pron', e.target.checked); applyPronClasses(); } });
  const faIn = h('input', { type: 'checkbox', checked: faOn() || null, onchange: (e) => { store.setSetting('persian', e.target.checked); applyPronClasses(); } });
  const speakOff = h('input', { type: 'checkbox', checked: !s.settings.speakOff || null, onchange: (e) => store.setSetting('speakOff', !e.target.checked) });
  const rate = h('input', { type: 'range', min: '0.6', max: '1.2', step: '0.05', value: String(s.settings.rate),
    onchange: (e) => { store.setSetting('rate', Number(e.target.value)); speak('Bonjour, je suis Minou.'); } });
  const goal = h('select', { onchange: (e) => store.setSetting('goal', Number(e.target.value)) },
    ...[[30, 'Easy · 30 XP'], [60, 'Steady · 60 XP'], [100, 'Serious · 100 XP'], [150, 'Exam week · 150 XP']].map(([v, l]) =>
      h('option', { value: String(v), selected: s.settings.goal === v || null }, l)));
  const voiceSel = h('select', { onchange: (e) => { store.setSetting('voice', e.target.value); refreshVoice(); speak('Bonjour !'); } },
    h('option', { value: '' }, 'Automatic'),
    ...frenchVoices().map((v) => h('option', { value: v.name, selected: s.settings.voice === v.name || null }, `${v.name} (${v.lang})`)));

  const fileIn = h('input', { type: 'file', accept: 'application/json', hidden: true, onchange: async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try { store.importJSON(await f.text()); alert('Progress restored.'); route(); } catch (err) { alert(err.message); }
  } });

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;

  return h('div', { class: 'screen me' },
    h('header', { class: 'me-head' }, minouSVG({ size: 96, mood: 'happy' }),
      h('div', {}, h('h1', { lang: 'fr' }, `Salut, ${name} !`), h('p', {}, `Hi, ${name}! ${store.streakNow()}-day streak, ${s.xp} XP in total.`))),
    h('section', { class: 'card' }, h('h2', { class: 'card-title' }, 'This week'), week),
    h('section', { class: 'card' }, h('h2', { class: 'card-title' }, 'Skills'), ...Object.entries(s.skills).map(([k, [c, t]]) => skillBar(k, c, t))),
    s.exams.length ? h('section', { class: 'card' }, h('h2', { class: 'card-title' }, 'Mock exams'),
      h('ul', { class: 'exam-list' }, ...s.exams.slice(0, 5).map((e) => h('li', {}, h('span', {}, e.date), h('b', {}, `${Math.round(e.score * 100)}%`))))) : null,
    !standalone ? h('section', { class: 'card install' }, h('h2', { class: 'card-title' }, 'Put Minou on your home screen'),
      installEvt
        ? h('button', { class: 'btn primary', onclick: async () => { installEvt.prompt(); await installEvt.userChoice; installEvt = null; route(); } }, 'Install app')
        : h('p', {}, isIOS ? 'In Safari, tap Share, then “Add to Home Screen”. Minou works offline after that.' : 'Open your browser menu and choose “Install app” or “Add to Home screen”.')) : null,
    h('section', { class: 'card settings' }, h('h2', { class: 'card-title' }, 'Settings'),
      h('label', { class: 'set-row' }, h('span', {}, 'English pronunciation', h('small', {}, 'Sound-it-out spelling, like “luh PEHR”')), pronIn),
      h('label', { class: 'set-row' }, h('span', {}, 'Persian pronunciation', h('small', { lang: 'fa', dir: 'rtl' }, 'تلفظ به خط فارسی، مثل «لُ پِر»')), faIn),
      h('label', { class: 'set-row' }, h('span', {}, 'Your name'), nameIn),
      h('label', { class: 'set-row' }, h('span', {}, 'Daily goal'), goal),
      h('label', { class: 'set-row' }, h('span', {}, 'Sound effects'), sound),
      h('label', { class: 'set-row' }, h('span', {}, 'Speaking exercises', h('small', {}, sttSupported() ? 'Uses your mic' : 'Your browser can’t check speech, so you’ll self-check')), speakOff),
      h('label', { class: 'set-row col' }, h('span', {}, 'Voice speed'), rate),
      ttsSupported() ? h('label', { class: 'set-row' }, h('span', {}, 'French voice'), voiceSel) : h('p', { class: 'muted' }, 'This browser has no text-to-speech.')),
    h('section', { class: 'card' }, h('h2', { class: 'card-title' }, 'Help'),
      h('p', { class: 'muted' }, 'A 30-second walk through the app with Minou.'),
      h('div', { class: 'btn-row' }, h('button', { class: 'btn ghost', onclick: () => { location.hash = '#/learn'; setTimeout(() => startTour(), 250); } }, 'Show the tour again'))),
    h('section', { class: 'card' }, h('h2', { class: 'card-title' }, 'Backup'),
      h('p', { class: 'muted' }, 'Progress lives in this browser. Save a backup to move it to another device.'),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn ghost', onclick: () => {
          const blob = new Blob([store.exportJSON()], { type: 'application/json' });
          const a = h('a', { href: URL.createObjectURL(blob), download: `minou-backup-${todayKey()}.json` });
          a.click();
        } }, icon('download'), 'Save backup'),
        h('button', { class: 'btn ghost', onclick: () => fileIn.click() }, 'Restore'), fileIn),
      h('button', { class: 'btn text danger', onclick: () => {
        if (confirm('Erase all progress? This can’t be undone.')) { store.resetAll(); location.hash = '#/learn'; location.reload(); }
      } }, 'Erase all progress')),
  );
}

boot();
