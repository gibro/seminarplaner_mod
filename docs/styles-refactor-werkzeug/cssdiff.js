// Computed-Style-Diff in der ECHTEN Kaskade.
// Die Seite laedt: theme_prefix.css → styles.css (austauschbar) → theme_suffix.css,
// also genau die Reihenfolge, in der Moodle unser Plugin-CSS in die Theme-Aggregation
// einbettet. Wir fotografieren die berechneten Stile, tauschen NUR unseren Block gegen
// den Kandidaten und fotografieren erneut. Unterschiede = Optik-Regression.
// ACHTUNG: Was hier nicht steht, wird nicht gemessen — eine Regression in einer
// fehlenden Eigenschaft meldet das Werkzeug als „0 Unterschiede". Die Liste hatte
// bis 17. Juli fuenf blinde Flecken (outline, flex, list-style, max-width,
// min-width), obwohl dup2.py genau diese als KONFLIKT meldet: `.sp-slot--over`
// und `.kg-library-card--selected` kollidieren auf `outline`. Ein Kanarienvogel-
// Test (absichtliche Aenderung, die auffallen MUSS) deckte das auf.
// Wer eine Eigenschaft neu in Konflikt sieht, ergaenzt sie hier ZUERST.
window.__PROPS = [
  'color', 'background-color', 'background-image', 'border-top-color', 'border-right-color',
  'border-bottom-color', 'border-left-color', 'border-top-width', 'border-right-width',
  'border-bottom-width', 'border-left-width', 'border-radius', 'font-family', 'font-size',
  'font-weight', 'text-transform', 'letter-spacing', 'line-height', 'text-decoration-line',
  'display', 'position', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'width', 'height',
  'min-height', 'opacity', 'visibility', 'box-shadow', 'z-index', 'flex-direction',
  'justify-content', 'align-items', 'gap', 'overflow',
  // Ab 17. Juli ergaenzt — die vormals blinden Flecken:
  'outline-color', 'outline-width', 'outline-style', 'outline-offset',
  'flex-grow', 'flex-shrink', 'flex-basis',
  'list-style-type', 'list-style-position',
  'max-width', 'min-width', 'max-height',
  // Randstile (border:none vs. border:1px solid faellt sonst nur ueber die Breite auf,
  // border-style:dashed vs. solid gar nicht) und weitere sichtbare Groessen:
  'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
  'text-align', 'white-space', 'flex-wrap', 'cursor', 'transform', 'float', 'clear',
  'grid-template-columns', 'grid-template-rows', 'order', 'align-self', 'vertical-align'
];

window.__snapshot = () => {
  const shot = [];
  document.querySelectorAll('*').forEach((el, idx) => {
    const cs = getComputedStyle(el);
    const rec = {};
    window.__PROPS.forEach((p) => { rec[p] = cs.getPropertyValue(p); });
    shot.push({idx, tag: el.tagName, cls: el.className && el.className.baseVal !== undefined
      ? el.className.baseVal : String(el.className || ''), rec});
  });
  return shot;
};

// Transitions/Animationen stilllegen. OHNE DAS IST JEDE MESSUNG WERTLOS:
// styles.css hat 18 transition-Regeln, u.a. `.sp-modal__section { transition:
// all 0.2s ease }`. Beim Stylesheet-Tausch animieren die Farben vom alten zum
// neuen Wert, und der Schnappschuss trifft die Animation mitten im Flug -- die
// alte Wartezeit von 150ms war kuerzer als die 200ms-Transition. Gemessen am
// 17. Juli: outline-color rgb(30, 33, 38), ein Zwischenwert, der in KEINER
// beteiligten Datei steht. Das erzeugt Phantom-Unterschiede und kann echte
// ebenso verdecken. Gilt fuer Basis- und Kandidaten-Aufnahme gleichermassen,
// verfaelscht den Vergleich also nicht -- gemessen wird der Endzustand.
window.__stillstand = () => {
  if (document.querySelector('#__stillstand')) { return; }
  const s = document.createElement('style');
  s.id = '__stillstand';
  s.textContent = '*, *::before, *::after { transition: none !important;' +
                  ' animation: none !important; }';
  document.head.appendChild(s);
};

// Setzt #plugincss auf url und wartet, bis das Stylesheet WIRKLICH angewandt ist.
window.__ladeCss = (url) => new Promise((resolve, reject) => {
  const link = document.querySelector('#plugincss');
  if (link.getAttribute('href') === url) {
    // Gleiche URL nochmal setzen loest KEIN load-Ereignis aus -> das Promise
    // wuerde nie erfuellt und der ganze Lauf haengt (30s-Timeout).
    reject(new Error('__ladeCss: URL ist bereits gesetzt: ' + url));
    return;
  }
  const fertig = () => setTimeout(resolve, 50);
  link.addEventListener('load', () => {
    // Zwei rAF = ein sicher durchgelaufener Renderzyklus. ABER: rAF wird in
    // NICHT SICHTBAREN Tabs pausiert -- ohne den Timeout-Notausgang haengt der
    // Lauf dann bis zum Timeout, ohne dass irgendwas kaputt waere. (17. Juli
    // mehrfach genau so passiert, sobald das Browser-Fenster in den Hintergrund
    // rutschte.) Das load-Ereignis allein garantiert bereits, dass das
    // Stylesheet geparst und angewandt ist; die rAF sind nur Sicherheitsgurt.
    let gelaufen = false;
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        gelaufen = true;
        requestAnimationFrame(fertig);
      });
      setTimeout(() => { if (!gelaufen) { fertig(); } }, 250);
    } else {
      fertig();
    }
  }, {once: true});
  // Ohne error-Handler haengt ein Tippfehler im Dateinamen still bis zum
  // Timeout, statt zu sagen, was los ist.
  link.addEventListener('error', () => reject(new Error('__ladeCss: laedt nicht: ' + url)), {once: true});
  link.setAttribute('href', url);
});

window.__cssDiff = async (candidateUrl) => {
  const link = document.querySelector('#plugincss');
  window.__stillstand();
  const original = link.getAttribute('href');
  const before = window.__snapshot();
  await window.__ladeCss(candidateUrl);
  const after = window.__snapshot();
  const diffs = [];
  before.forEach((b, i) => {
    const a = after[i];
    if (!a) { return; }
    window.__PROPS.forEach((p) => {
      if (b.rec[p] !== a.rec[p]) {
        diffs.push({el: `${b.tag}.${b.cls}`.slice(0, 70), prop: p, vorher: b.rec[p], nachher: a.rec[p]});
      }
    });
  });
  // WICHTIG: das Zuruecksetzen ABWARTEN. Vorher lieferte die Funktion sofort
  // zurueck und das Neuladen lief noch; ein direkt folgender zweiter Aufruf
  // fotografierte dann als "Basis" noch den vorigen Kandidaten. Ergebnis waren
  // Phantom-Unterschiede (gemessen 17. Juli: "vorher: magenta") -- oder, je nach
  // Timing, ein falsches "0 Unterschiede". Beides unbrauchbar als Freigabe.
  await window.__ladeCss(original);
  return {geprueft: before.length, unterschiede: diffs.length, diffs: diffs.slice(0, 40)};
};
