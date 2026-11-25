// Minou: screens, navigation and wiring.
import { h, $, todayKey, pick } from './util.js';
import { DB, loadAll, nodeState, currentNode, startedModules, moduleByKey, preModules, mainModules } from './data.js';
import * as store from './store.js';
import { buildNode, buildReview, buildWeak, buildExam, buildNumbersDrill, dueCount } from './build.js';
import { runLesson, showResults, skillBar } from './lesson.js';
import { minouSVG, setMood } from './minou.js';
import { icon } from './icons.js';
import { renderSummary } from './summary.js';
import { speak, sttSupported } from './speech.js';
import { sfx } from './sound.js';
import { startTour } from './tour.js';
import { applyPronClasses, prOn, faOn } from './fa.js';

// Shown on the Me tab so it's easy to check which version is running. Bump with every release.
export const APP_VERSION = '1.8 (25 Nov 2026)';

const app = $('#app');
let installEvt = null;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; });

const NODE_BLURB = {
  alphabet: 'All 26 letters with their French names, the tricky pairs like G and J, and a spelling game.',
  accents: 'Every French accent: what it looks like, how it sounds, and how to type it. Then you hear words and pick the right spelling.',
  numbers: 'Count from 0 to 100: the numbers to learn by heart, the tens, and how French builds 70, 80 and 90.',
  vocab: (n) => `${(n.items || n.mod.vocab).length} new words and phrases, in small groups with matching games, then reading, writing, listening and speaking practice.`,
  grammar: 'Minou explains the rule step by step, you drill it, then you do the textbook exercises.',
  'module-review': 'Short readings, then a mixed test of the whole module.',
  review: 'A mixed recap of everything before this module, weighted toward what you’re about to forget.',
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
    // When a new version finishes installing it takes over this page; reload once to show it.
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloaded || document.body.classList.contains('in-lesson')) return;
      reloaded = true;
      location.reload();
    });
    navigator.serviceWorker.register('sw.js').then((reg) => reg.update()).catch(() => {});
    // Check for a new version whenever the app comes back to the screen.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') navigator.serviceWorker.getRegistration().then((r) => r && r.update()).catch(() => {});
    });
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
      h('p', {}, 'I’ll be your French teacher. Start with the alphabet and numbers, then work through one module a day: vocabulary, grammar, review. Everything comes with English, and you can turn on pronunciation help in English or Persian.'),
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
  const streak = store.streakNow();
  return h('header', { class: 'stats' },
    h('div', { class: 'brand' }, h('span', { class: 'wordmark' }, 'minou'), h('span', { class: 'class-tag' }, 'Class 1')),
    h('div', { class: 'stat streak', title: `${streak}-day streak` }, icon('paw'), h('b', {}, String(streak)),
      h('span', { class: 'streak-label' }, streak === 1 ? 'day' : 'days')),
  );
}

// ---------- Learn: the path ----------

const OFFSETS = [0, 46, 72, 46, 0, -46, -72, -46];

function learnScreen() {
  const wrap = h('div', { class: 'screen learn' }, statsBar());
  const name = store.get().settings.name;
  const cur = currentNode();

  // The basics (alphabet, numbers) share one section; then one section per module.
  const sections = [];
  const pre = preModules();
  if (pre.length) sections.push({ pre: true, nodes: pre.flatMap((m) => m.nodes), title: 'Les bases', titleEn: 'The basics',
    sub: 'Start here: the alphabet, accents and numbers 0–100' });
  for (const m of mainModules()) sections.push({ m, nodes: m.nodes, title: m.title, sub: m.subtitle });

  for (const sec of sections) {
    const banner = h('div', { class: `mod-banner ${sec.pre ? 'pre' : ''}` },
      h('div', {}, h('span', { class: 'mod-num' }, sec.pre ? 'Before Module 1' : `Module ${sec.m.number}`),
        h('h2', { lang: 'fr' }, sec.title, sec.titleEn ? h('small', { class: 'banner-en' }, sec.titleEn) : null), h('p', {}, sec.sub)),
      h('a', { class: 'banner-btn', href: sec.pre ? '#/notes' : `#/notes/${sec.m.key}`, 'aria-label': `Summary of ${sec.title}` }, icon('notes'), h('span', {}, 'Summary')));
    const path = h('ol', { class: 'path' });
    sec.nodes.forEach((n, i) => {
      const st = nodeState(n);
      const done = store.get().done[n.key];
      const off = OFFSETS[i % OFFSETS.length];
      const btn = h('button', { class: `node ${st} t-${n.type}`, 'aria-label': `${n.titleEn || n.title}: ${n.subtitle}${st === 'done' ? ' (completed)' : ''}`, onclick: () => openNode(n) },
        icon(n.icon), st === 'done' ? h('span', { class: 'done-badge' }, icon('check')) : null);
      const li = h('li', { class: 'path-step', style: `--x:${off}px` },
        st === 'current' ? h('span', { class: 'start-tag' }, 'Start') : null,
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
    wrap.append(h('section', { class: `module ${sec.pre ? 'is-pre' : 'is-main'}` }, banner, path));
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
  const action = h('button', { class: 'btn primary wide', onclick: () => { close(); startNode(n); } }, done ? 'Practise again' : 'Start lesson');
  const ov = h('div', { class: 'pop-ov', onclick: (e) => { if (e.target === ov) close(); } },
    h('div', { class: `pop t-${n.type}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': n.title },
      h('div', { class: 'pop-head' }, h('span', { class: 'pop-ic' }, icon(n.icon)),
        h('div', {}, h('h3', { lang: 'fr' }, n.title, n.titleEn && n.titleEn !== n.title ? h('small', { class: 'banner-en' }, n.titleEn) : null), h('p', {}, n.subtitle))),
      h('p', { class: 'pop-blurb' }, blurb),
      done ? h('p', { class: 'pop-best' }, icon('check'), `Completed. Best score ${Math.round(done.best * 100)}%, played ${done.times} ${done.times === 1 ? 'time' : 'times'}.`) : null,
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
      store.markActive();
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
      if (mode === 'exam') store.addExam({ date: todayKey(), score: result.accuracy, total: result.graded, bySkill: result.answersBySkill });
      store.markActive();
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
    () => { const top = Math.max(...learnedNums.map((m) => m.numbers[1])); run('Numbers drill', buildNumbersDrill(top)); }, !learnedNums.length),
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
    h('header', { class: 'page-head' }, h('h1', {}, 'Notebook'), h('p', {}, 'One summary per module. Read it here, or open the PDF to save, share or print it.')),
    ...DB.classes.map((cls) => h('section', { class: 'notes-class' }, h('h2', { class: 'card-title' }, cls.title),
      ...DB.modules.filter((m) => m.classId === cls.id).map((m) =>
        h('a', { class: 'card note-link', href: `#/notes/${m.key}` },
          h('span', { class: 'note-num' }, m.pre ? (m.letters ? 'Aa' : '12') : String(m.number)),
          h('span', {}, h('b', {}, m.title), h('small', {}, m.subtitle)),
          icon('back', 'flip'))))));
}

function moduleNotes(m) {
  const pdf = `summaries/${m.classId}-${m.id}${faOn() ? '-fa' : ''}.pdf`;
  const fname = `Minou ${m.className} - ${m.pre ? '' : `Module ${m.number} - `}${m.title.replace(/'/g, '’')}.pdf`;
  // target=_blank matters on iPhone: inside a home-screen app it opens the PDF in a viewer with a Done
  // button that returns to Minou, instead of replacing the app with no way back.
  const dl = h('a', { class: 'btn primary', href: pdf, download: fname, target: '_blank', rel: 'noopener', hidden: true }, icon('download'), 'Open PDF');
  fetch(pdf, { method: 'HEAD' }).then((r) => { if (r.ok) dl.hidden = false; }).catch(() => {});
  return h('div', { class: 'screen module-notes' },
    h('div', { class: 'notes-bar' },
      h('a', { class: 'icon-btn', href: '#/notes', 'aria-label': 'Back to notebook' }, icon('back')),
      h('div', { class: 'notes-actions' }, dl)),
    renderSummary(m, { interactive: true }));
}

// ---------- Me ----------

function meScreen() {
  const s = store.get();
  const name = s.settings.name || 'toi';
  const last7 = Array.from({ length: 7 }, (_, k) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - k));
    return { label: d.toLocaleDateString('en', { weekday: 'short' }), on: !!s.days[todayKey(d)], today: k === 6 };
  });
  const streak = store.streakNow();
  const week = h('div', { class: 'paws', role: 'img', 'aria-label': `Practised on ${last7.filter((d) => d.on).length} of the last 7 days` },
    ...last7.map((d) => h('div', { class: `paw-day ${d.on ? 'on' : ''} ${d.today ? 'today' : ''}` }, icon('paw'), h('span', { class: 'paw-label' }, d.label))));

  // Settings controls
  const nameIn = h('input', { type: 'text', value: s.settings.name || '', maxlength: '30', onchange: (e) => store.setSetting('name', e.target.value.trim()) });
  const sound = h('input', { type: 'checkbox', checked: s.settings.sound || null, onchange: (e) => store.setSetting('sound', e.target.checked) });
  const pronIn = h('input', { type: 'checkbox', checked: prOn() || null, onchange: (e) => { store.setSetting('pron', e.target.checked); applyPronClasses(); } });
  const faIn = h('input', { type: 'checkbox', checked: faOn() || null, onchange: (e) => { store.setSetting('persian', e.target.checked); applyPronClasses(); } });
  const speakOff = h('input', { type: 'checkbox', checked: !s.settings.speakOff || null, onchange: (e) => store.setSetting('speakOff', !e.target.checked) });
  const rate = h('input', { type: 'range', min: '0.6', max: '1.2', step: '0.05', value: String(s.settings.rate),
    onchange: (e) => { store.setSetting('rate', Number(e.target.value)); speak('Bonjour, je suis Minou.'); } });

  const fileIn = h('input', { type: 'file', accept: 'application/json', hidden: true, onchange: async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try { store.importJSON(await f.text()); alert('Progress restored.'); route(); } catch (err) { alert(err.message); }
  } });

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;

  return h('div', { class: 'screen me' },
    h('header', { class: 'me-head' }, minouSVG({ size: 96, mood: 'happy' }),
      h('div', {}, h('h1', { lang: 'fr' }, `Salut, ${name} !`), h('p', {}, `Hi, ${name}! ${streak === 0 ? 'Do a lesson today to start your streak.' : `You’re on a ${streak}-day streak.`}`))),
    h('section', { class: 'card' }, h('h2', { class: 'card-title' }, 'Your streak'), week),
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
      h('label', { class: 'set-row' }, h('span', {}, 'Sound effects'), sound),
      h('label', { class: 'set-row' }, h('span', {}, 'Speaking exercises', h('small', {}, sttSupported() ? 'Uses your mic' : 'Your browser can’t check speech, so you’ll self-check')), speakOff),
      h('label', { class: 'set-row col' }, h('span', {}, 'Voice speed'), rate),
      h('p', { class: 'muted set-note' }, 'Minou’s voice is a recorded native French voice, so it sounds the same on every device.')),
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
    h('p', { class: 'version-line' }, `Minou version ${APP_VERSION}`),
  );
}

boot();
