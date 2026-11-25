// Minou, the black-cat teacher. One SVG, several moods switched by a data attribute.

export function minouSVG({ size = 96, mood = 'idle', cls = '' } = {}) {
  const wrap = document.createElement('div');
  wrap.className = `minou ${cls}`;
  wrap.dataset.mood = mood;
  wrap.style.width = wrap.style.height = size + 'px';
  wrap.setAttribute('aria-hidden', 'true');
  wrap.innerHTML = `
<svg viewBox="0 0 120 124" xmlns="http://www.w3.org/2000/svg">
  <g class="m-tail"><path d="M84 106 C112 108 114 76 101 66" fill="none" stroke="var(--fur)" stroke-width="9" stroke-linecap="round"/></g>
  <g class="m-body">
    <ellipse cx="60" cy="97" rx="30" ry="22" fill="var(--fur)"/>
    <ellipse cx="60" cy="101" rx="14" ry="12" fill="var(--fur-belly)"/>
    <ellipse cx="47" cy="117" rx="9" ry="5.5" fill="var(--fur)"/>
    <ellipse cx="73" cy="117" rx="9" ry="5.5" fill="var(--fur)"/>
  </g>
  <g class="m-head">
    <path d="M30 40 L33 9 L54 27 Z" fill="var(--fur)" stroke="var(--fur)" stroke-width="6" stroke-linejoin="round"/>
    <path d="M90 40 L87 9 L66 27 Z" fill="var(--fur)" stroke="var(--fur)" stroke-width="6" stroke-linejoin="round"/>
    <path d="M36 31 L37.5 16 L47 26 Z" fill="var(--ear)"/>
    <path d="M84 31 L82.5 16 L73 26 Z" fill="var(--ear)"/>
    <ellipse cx="60" cy="53" rx="35" ry="30" fill="var(--fur)"/>
    <g class="m-beret">
      <ellipse cx="68" cy="23" rx="21" ry="7.5" transform="rotate(-14 68 23)" fill="var(--beret)"/>
      <circle cx="72" cy="13.5" r="2.6" fill="var(--beret)"/>
    </g>
    <ellipse cx="37" cy="65" rx="6" ry="3.5" fill="var(--ear)" opacity=".55"/>
    <ellipse cx="83" cy="65" rx="6" ry="3.5" fill="var(--ear)" opacity=".55"/>
    <g class="m-eyes m-eyes-open">
      <ellipse cx="46" cy="53" rx="8.5" ry="9.5" fill="var(--eye)"/>
      <ellipse cx="74" cy="53" rx="8.5" ry="9.5" fill="var(--eye)"/>
      <ellipse class="m-pupil" cx="46.5" cy="54" rx="2.8" ry="7" fill="var(--fur)"/>
      <ellipse class="m-pupil" cx="74.5" cy="54" rx="2.8" ry="7" fill="var(--fur)"/>
      <circle cx="49" cy="49.5" r="2" fill="#fff"/>
      <circle cx="77" cy="49.5" r="2" fill="#fff"/>
    </g>
    <g class="m-eyes m-eyes-happy">
      <path d="M38 56 Q46 45 54 56" fill="none" stroke="var(--eye)" stroke-width="4" stroke-linecap="round"/>
      <path d="M66 56 Q74 45 82 56" fill="none" stroke="var(--eye)" stroke-width="4" stroke-linecap="round"/>
    </g>
    <g class="m-eyes m-eyes-sad">
      <ellipse cx="46" cy="56" rx="8" ry="7" fill="var(--eye)"/>
      <ellipse cx="74" cy="56" rx="8" ry="7" fill="var(--eye)"/>
      <ellipse cx="46" cy="58" rx="2.6" ry="5" fill="var(--fur)"/>
      <ellipse cx="74" cy="58" rx="2.6" ry="5" fill="var(--fur)"/>
      <path d="M36 50 L56 54 L56 46 L36 46 Z" fill="var(--fur)"/>
      <path d="M84 50 L64 54 L64 46 L84 46 Z" fill="var(--fur)"/>
    </g>
    <path d="M57 62 L63 62 L60 65.5 Z" fill="var(--ear)" stroke="var(--ear)" stroke-width="1.5" stroke-linejoin="round"/>
    <path class="m-mouth" d="M54 68 Q57 71.5 60 68 Q63 71.5 66 68" fill="none" stroke="var(--whisker)" stroke-width="1.6" stroke-linecap="round"/>
    <path class="m-mouth-open" d="M55 68 Q60 77 65 68 Z" fill="var(--ear)" stroke="var(--whisker)" stroke-width="1.2" stroke-linejoin="round"/>
    <g stroke="var(--whisker)" stroke-width="1.1" stroke-linecap="round" opacity=".7">
      <path d="M30 62 L15 59"/><path d="M30 66 L14 67"/>
      <path d="M90 62 L105 59"/><path d="M90 66 L106 67"/>
    </g>
  </g>
</svg>`;
  return wrap;
}

export function setMood(el, mood) {
  if (!el) return;
  el.dataset.mood = mood;
  // Restart the one-shot animation for the mood.
  el.classList.remove('m-react');
  void el.offsetWidth;
  el.classList.add('m-react');
}

const L = (fr, en) => ({ fr, en });
export const LINES = {
  correct: [L('Bravo !', 'Well done!'), L('Très bien !', 'Very good!'), L('Parfait !', 'Perfect!'), L('Super !', 'Great!'),
    L('Miaou, exactement !', 'Meow, exactly!'), L('C’est ça !', 'That’s it!'), L('Magnifique !', 'Wonderful!')],
  slip: [L('Presque parfait !', 'Almost perfect!'), L('Bien, mais attention…', 'Good, but careful…'), L('Pas mal !', 'Not bad!')],
  wrong: [L('Pas tout à fait…', 'Not quite…'), L('Oups !', 'Oops!'), L('Presque…', 'Almost…'), L('On réessaie plus tard.', 'We’ll try again later.')],
  streak3: [L('Trois de suite !', 'Three in a row!'), L('Tu es en feu !', 'You’re on fire!')],
  streak5: [L('Cinq de suite ! Incroyable !', 'Five in a row! Amazing!')],
};
