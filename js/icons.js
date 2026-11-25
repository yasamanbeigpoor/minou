// Inline stroke icons (24px grid). Rounded to match Minou.
const P = {
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  sound: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 010 6M18 6.5a7.5 7.5 0 010 11"/>',
  turtle: '<path d="M4 15c0-4 3.5-7 8-7s8 3 8 7z"/><path d="M8 15v3M16 15v3M20 13.5h1.5a1.5 1.5 0 000-3H20"/><path d="M9 10.5l1.5 4.5M15 10.5L13.5 15"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21M9 21h6"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" fill="currentColor"/>',
  paw: '<ellipse cx="12" cy="15.5" rx="4.3" ry="3.6" fill="currentColor" stroke="none"/><ellipse cx="6.3" cy="10.5" rx="1.9" ry="2.4" fill="currentColor" stroke="none"/><ellipse cx="9.8" cy="6.8" rx="1.9" ry="2.5" fill="currentColor" stroke="none"/><ellipse cx="14.2" cy="6.8" rx="1.9" ry="2.5" fill="currentColor" stroke="none"/><ellipse cx="17.7" cy="10.5" rx="1.9" ry="2.4" fill="currentColor" stroke="none"/>',
  xp: '<path d="M13 2.5L5 13.5h6l-1 8 8-11h-6z" fill="currentColor"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  refresh: '<path d="M19.5 12a7.5 7.5 0 01-13.3 4.8M4.5 12a7.5 7.5 0 0113.3-4.8"/><path d="M18.5 3.5v4h-4M5.5 20.5v-4h4"/>',
  cards: '<rect x="7" y="4" width="12" height="15" rx="2.5"/><path d="M4.5 7.5v10A2.5 2.5 0 007 20h8"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l8.5-8.5M16.5 6.5l2 2M14.5 8.5l1.5 1.5"/>',
  pencil: '<path d="M4 20l1-4.5L15.5 5a2.1 2.1 0 013 3L8 18.5z"/><path d="M13.5 7l3 3"/>',
  book: '<path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5c-3.5-.5-6.5 0-8.5 1.5zM12 6.5v13"/>',
  ear: '<path d="M7 9.5a5 5 0 0110 0c0 3-3 4-3 6.5a3 3 0 01-6 0"/><path d="M10 10a2 2 0 014 0c0 1.2-1 1.6-1.4 2.4"/>',
  hash: '<path d="M9.5 4L8 20M16 4l-1.5 16M4.5 9h15M4 15h15"/>',
  crown: '<path d="M4 17.5L3 7.5l5 4 4-6 4 6 5-4-1 10z"/><path d="M5 20.5h14"/>',
  abc: '<path d="M3 17l3.5-10L10 17M4.2 13.5h4.6"/><path d="M12.5 7v10h3.2a2.6 2.6 0 000-5.2h-3.2M12.5 11.8h2.8a2.4 2.4 0 000-4.8h-2.8"/><path d="M22 8.2A4 4 0 0019.6 7"/>',
  accent: '<path d="M7.5 13.5h9a4.5 4.5 0 10-1.3 3.2"/><path d="M10.5 6.5L13.5 3"/>',
  spell: '<rect x="3" y="7" width="5" height="10" rx="1.5"/><rect x="9.5" y="7" width="5" height="10" rx="1.5"/><rect x="16" y="7" width="5" height="10" rx="1.5"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 018 0v3"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  learn: '<path d="M4 19.5V8.5L12 4l8 4.5v11"/><path d="M9 19.5v-5.5h6v5.5"/>',
  practice: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/>',
  notes: '<path d="M6.5 3.5h8l4 4v13h-12z"/><path d="M14.5 3.5v4h4M9 12h6M9 15.5h6"/>',
  me: '<circle cx="12" cy="8.5" r="4"/><path d="M4.5 20.5c1-4 4-6 7.5-6s6.5 2 7.5 6"/>',
  download: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14"/>',
  print: '<path d="M7 9V3.5h10V9M7 17H4.5V9h15v8H17"/><rect x="7" y="14" width="10" height="6.5"/>',
  back: '<path d="M14.5 5.5L8 12l6.5 6.5"/>',
  reading: '<path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5c-3.5-.5-6.5 0-8.5 1.5zM12 6.5v13"/>',
  writing: '<path d="M4 20l1-4.5L15.5 5a2.1 2.1 0 013 3L8 18.5z"/>',
  listening: '<path d="M4 14v-2a8 8 0 0116 0v2"/><rect x="3.5" y="14" width="4" height="6" rx="1.5"/><rect x="16.5" y="14" width="4" height="6" rx="1.5"/>',
  speaking: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21"/>',
  exam: '<rect x="5" y="3.5" width="14" height="17" rx="2.5"/><path d="M9 3.5V6h6V3.5M8.5 11l1.5 1.5 3-3M8.5 16h7"/>',
  bolt: '<path d="M13 2.5L5 13.5h6l-1 8 8-11h-6z"/>',
  heart: '<path d="M12 20s-7.5-4.5-7.5-10A4.3 4.3 0 0112 7.3 4.3 4.3 0 0119.5 10c0 5.5-7.5 10-7.5 10z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4L5.3 5.3"/>',
};

export function icon(name, cls = '') {
  const span = document.createElement('span');
  span.className = `ic ${cls}`;
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${P[name] || P.star}</svg>`;
  return span;
}
