// A short guided tour of the app, led by Minou. Replayable from the Me tab.
import { h, $ } from './util.js';
import { minouSVG } from './minou.js';
import * as store from './store.js';
import { sfx } from './sound.js';

const STEPS = [
  { fr: 'Bienvenue !', en: 'Welcome!', text: 'Here’s a quick tour so you know where everything is. It takes 30 seconds.' },
  { sel: '.module:not(.is-bonus) .path-step .node', fr: 'Ton chemin', en: 'Your path',
    text: 'Each circle is a short lesson. Tap the one marked Start. Every module follows your routine: review, new words, grammar, textbook exercises, reading, listening and speaking, numbers, then a checkpoint that unlocks the next module.' },
  { sel: '.module.is-bonus .mod-banner', fr: 'L’alphabet', en: 'The alphabet',
    text: 'A bonus track you can do any time: every letter with its sound, the tricky pairs, accents, and a spelling game.' },
  { sel: '.module:not(.is-bonus) .banner-btn', fr: 'Le résumé', en: 'The summary',
    text: 'One page with everything from the module: grammar, words, numbers and textbook answers. Download it as a PDF to review anywhere.' },
  { sel: '.stat.streak', fr: 'Ta série', en: 'Your streak', text: 'One paw for every day in a row you practise. Don’t break the chain!' },
  { sel: '.stat.goal', fr: 'Ton objectif', en: 'Your daily goal', text: 'Earn XP in lessons to fill this ring every day. You can change the goal in Me.' },
  { sel: '.tabbar a[href="#/practice"]', fr: 'Pratiquer', en: 'Practise',
    text: 'Daily review, your weak spots, a timed mock exam, and a numbers drill. Minou brings back what you’re about to forget.' },
  { sel: '.tabbar a[href="#/notes"]', fr: 'Le carnet', en: 'The notebook', text: 'All your module summaries in one place, with PDF downloads.' },
  { sel: '.tabbar a[href="#/me"]', fr: 'Moi', en: 'Me',
    text: 'Your progress and settings. Turn on English or Persian pronunciation here, or with the Aa and فا buttons at the top of any lesson.' },
  { fr: 'C’est parti !', en: 'Let’s go!',
    text: 'In lessons: the speaker plays the French, the turtle plays it slowly, the mic checks your speaking. Missed something? It comes back until you get it. Look for “Minou’s trick” to help it stick.' },
];

export function startTour(onEnd) {
  let i = 0;
  const spot = h('div', { class: 'tour-spot' });
  const cat = minouSVG({ size: 56, mood: 'happy' });
  const title = h('h3', {});
  const text = h('p', {});
  const count = h('span', { class: 'tour-count' });
  const back = h('button', { class: 'btn ghost small' }, 'Back');
  const next = h('button', { class: 'btn primary small' }, 'Next');
  const skip = h('button', { class: 'btn text' }, 'Skip tour');
  const card = h('div', { class: 'tour-card', role: 'dialog', 'aria-modal': 'true', 'aria-live': 'polite' },
    h('div', { class: 'tour-top' }, cat, h('div', {}, title, count)), text,
    h('div', { class: 'tour-btns' }, skip, h('span', { class: 'grow' }), back, next));
  const ov = h('div', { class: 'tour' }, spot, card);
  document.body.append(ov);

  const end = () => {
    ov.remove();
    removeEventListener('resize', place);
    removeEventListener('keydown', onKey);
    store.setSetting('toured', true);
    onEnd && onEnd();
  };
  const onKey = (e) => { if (e.key === 'Escape') end(); if (e.key === 'ArrowRight') next.click(); if (e.key === 'ArrowLeft') back.click(); };
  addEventListener('keydown', onKey);
  skip.onclick = end;
  back.onclick = () => { if (i > 0) { i--; show(); } };
  next.onclick = () => { sfx.tap(); if (i < STEPS.length - 1) { i++; show(); } else end(); };

  function place() {
    const s = STEPS[i];
    const el = s.sel ? $(s.sel) : null;
    if (!el) {
      spot.style.cssText = 'left:50%;top:40%;width:0;height:0;';
      card.style.cssText = 'left:50%;top:50%;transform:translate(-50%,-50%);';
      return;
    }
    const r = el.getBoundingClientRect();
    const pad = 8;
    spot.style.cssText = `left:${r.left - pad}px;top:${r.top - pad}px;width:${r.width + pad * 2}px;height:${r.height + pad * 2}px;`;
    const below = r.bottom + 230 < innerHeight;
    const left = Math.min(Math.max(12, r.left + r.width / 2 - 170), innerWidth - 352);
    card.style.cssText = below
      ? `left:${Math.max(12, left)}px;top:${r.bottom + 16}px;`
      : `left:${Math.max(12, left)}px;bottom:${innerHeight - r.top + 16}px;`;
  }

  function show() {
    const s = STEPS[i];
    title.innerHTML = '';
    title.append(h('span', { lang: 'fr' }, s.fr), h('span', { class: 'tour-en' }, s.en));
    text.textContent = s.text;
    count.textContent = `${i + 1} of ${STEPS.length}`;
    back.hidden = i === 0;
    next.textContent = i === STEPS.length - 1 ? 'Start learning' : 'Next';
    const el = s.sel ? $(s.sel) : null;
    if (el) el.scrollIntoView({ block: 'center' });
    requestAnimationFrame(place);
    next.focus();
  }
  addEventListener('resize', place);
  show();
}
