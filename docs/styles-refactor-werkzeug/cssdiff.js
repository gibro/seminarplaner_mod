// Computed-Style-Diff in der ECHTEN Kaskade.
// Die Seite laedt: theme_prefix.css → styles.css (austauschbar) → theme_suffix.css,
// also genau die Reihenfolge, in der Moodle unser Plugin-CSS in die Theme-Aggregation
// einbettet. Wir fotografieren die berechneten Stile, tauschen NUR unseren Block gegen
// den Kandidaten und fotografieren erneut. Unterschiede = Optik-Regression.
window.__PROPS = [
  'color', 'background-color', 'background-image', 'border-top-color', 'border-right-color',
  'border-bottom-color', 'border-left-color', 'border-top-width', 'border-right-width',
  'border-bottom-width', 'border-left-width', 'border-radius', 'font-family', 'font-size',
  'font-weight', 'text-transform', 'letter-spacing', 'line-height', 'text-decoration-line',
  'display', 'position', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'width', 'height',
  'min-height', 'opacity', 'visibility', 'box-shadow', 'z-index', 'flex-direction',
  'justify-content', 'align-items', 'gap', 'overflow'
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
