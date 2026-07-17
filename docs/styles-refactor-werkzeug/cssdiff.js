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

window.__cssDiff = (candidateUrl) => {
  const link = document.querySelector('#plugincss');
  const before = window.__snapshot();
  const original = link.getAttribute('href');
  return new Promise((resolve) => {
    link.addEventListener('load', () => setTimeout(resolve, 150), {once: true});
    link.setAttribute('href', candidateUrl);
  }).then(() => {
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
    link.setAttribute('href', original);
    return {geprueft: before.length, unterschiede: diffs.length, diffs: diffs.slice(0, 40)};
  });
};
