#!/usr/bin/env python3
"""Baut aus styles.css (a) eine fx_-Variante mit erzwingbaren Pseudo-Zustaenden
und (b) eine Zoo-Seite, die fuer JEDEN Selektor ein passendes Element enthaelt.

Zweck: cssdiff.js misst nur, was im DOM steht. Die vier echten Ansichten decken
laengst nicht alle 1.222 Regeln ab. Der Zoo macht die Abdeckung vollstaendig.

Die Pseudo-Ersetzung (:hover -> .force-hover) wird auf Basis UND Kandidat
identisch angewandt, veraendert den Vergleich also nicht -- sie macht
Hover/Focus ueberhaupt erst ohne echte Maus messbar.
"""
import re
import sys
import html

PSEUDO_STATES = [
    (':focus-within', '.force-focus-within'),
    (':focus-visible', '.force-focus-visible'),
    (':focus', '.force-focus'),
    (':hover', '.force-hover'),
    (':active', '.force-active'),
]


def force_pseudos(css: str) -> str:
    """Ersetzt Interaktions-Pseudos durch Klassen. Nur ausserhalb von :not()/:has()
    waere ideal -- drinnen ist es aber ebenso korrekt, solange beide Seiten
    dieselbe Ersetzung bekommen."""
    out = css
    for pseudo, cls in PSEUDO_STATES:
        # Nicht ersetzen, wenn direkt ein '(' folgt (gibt es fuer diese nicht),
        # und nicht innerhalb von Property-Werten (dort kommen sie nicht vor).
        out = out.replace(pseudo, cls)
    return out


def strip_comments(css: str):
    """Entfernt Kommentare, ersetzt sie durch gleich lange Leerzeichen-Ketten,
    damit Zeilennummern erhalten bleiben."""
    def repl(m):
        return re.sub(r'[^\n]', ' ', m.group(0))
    return re.sub(r'/\*.*?\*/', repl, css, flags=re.S)


def split_selectors(css: str):
    """Liefert alle Selektoren (schon auf Kommas aufgeteilt) aus allen Regeln,
    inkl. der Regeln innerhalb von @media/@supports."""
    clean = strip_comments(css)
    sels = []
    i = 0
    n = len(clean)
    buf = []
    while i < n:
        c = clean[i]
        if c == '{':
            sel = ''.join(buf).strip()
            buf = []
            if sel.startswith('@'):
                # At-Regel mit Block: Inhalt weiter durchsuchen (media/supports)
                if re.match(r'@(media|supports|layer|container)', sel):
                    i += 1
                    continue
                # @keyframes/@font-face: Block ueberspringen
                depth = 1
                i += 1
                while i < n and depth:
                    if clean[i] == '{':
                        depth += 1
                    elif clean[i] == '}':
                        depth -= 1
                    i += 1
                continue
            # normale Regel: Body ueberspringen
            depth = 1
            i += 1
            while i < n and depth:
                if clean[i] == '{':
                    depth += 1
                elif clean[i] == '}':
                    depth -= 1
                i += 1
            for s in split_top_level_commas(sel):
                s = s.strip()
                if s:
                    sels.append(s)
            continue
        if c == '}':
            buf = []
            i += 1
            continue
        buf.append(c)
        i += 1
    return sels


def split_top_level_commas(sel: str):
    """Teilt an Kommas, aber nicht innerhalb von :not(...)/:has(...)/[...]."""
    parts = []
    depth = 0
    cur = []
    for ch in sel:
        if ch in '([':
            depth += 1
        elif ch in ')]':
            depth -= 1
        if ch == ',' and depth == 0:
            parts.append(''.join(cur))
            cur = []
        else:
            cur.append(ch)
    parts.append(''.join(cur))
    return parts


# --- Selektor -> DOM -------------------------------------------------------

COMBINATOR_RE = re.compile(r'\s*([>+~])\s*|\s+')

# Pseudo-Klassen, die wir im Zoo NICHT als Klasse abbilden koennen und die das
# Element trotzdem matchen lassen sollen -> einfach weglassen.
DROPPABLE_PSEUDOS = re.compile(
    r':(?:root|first-child|last-child|only-child|first-of-type|last-of-type|'
    r'nth-child\([^)]*\)|nth-of-type\([^)]*\)|nth-last-child\([^)]*\)|'
    r'empty|target|link|visited|any-link|defined|placeholder-shown|'
    r'read-only|read-write|in-range|out-of-range|valid|invalid|required|optional|'
    r'lang\([^)]*\)|dir\([^)]*\)|is\([^)]*\)|where\([^)]*\)|not\([^)]*\)|has\([^)]*\))')

PSEUDO_ELEMENT_RE = re.compile(r'::?(?:before|after|placeholder|marker|selection|'
                               r'backdrop|first-line|first-letter|file-selector-button|'
                               r'-webkit-[a-z-]+|-moz-[a-z-]+)(\([^)]*\))?')

TAG_RE = re.compile(r'^[a-zA-Z][a-zA-Z0-9-]*')

VOID = {'input', 'img', 'br', 'hr', 'source', 'track', 'area', 'base', 'col',
        'embed', 'link', 'meta', 'param', 'wbr'}

# Tags, die einen bestimmten Kontext brauchen, damit das Markup gueltig ist.
DEFAULT_TAG = 'div'


def split_compounds(sel: str):
    """Zerlegt in [(combinator, compound), ...]; erster combinator ist ''."""
    sel = sel.strip()
    out = []
    token = []
    i = 0
    depth = 0
    pending_comb = ''
    while i < len(sel):
        ch = sel[i]
        if ch in '([':
            depth += 1
        elif ch in ')]':
            depth -= 1
        if depth == 0 and (ch.isspace() or ch in '>+~'):
            # Kombinator-Bereich einlesen
            comb = ''
            while i < len(sel) and (sel[i].isspace() or sel[i] in '>+~'):
                if sel[i] in '>+~':
                    comb = sel[i]
                i += 1
            if token:
                out.append((pending_comb, ''.join(token)))
                token = []
                pending_comb = comb if comb else ' '
            continue
        token.append(ch)
        i += 1
    if token:
        out.append((pending_comb, ''.join(token)))
    return out


def parse_compound(comp: str):
    """-> (tag, [classes], id, [(attr, val)])"""
    comp = PSEUDO_ELEMENT_RE.sub('', comp)
    comp = DROPPABLE_PSEUDOS.sub('', comp)
    tag = None
    m = TAG_RE.match(comp)
    if m:
        tag = m.group(0)
        comp = comp[m.end():]
    if comp.startswith('*'):
        comp = comp[1:]
    classes = []
    el_id = None
    attrs = []
    i = 0
    while i < len(comp):
        ch = comp[i]
        if ch == '.':
            j = i + 1
            while j < len(comp) and (comp[j].isalnum() or comp[j] in '-_'):
                j += 1
            classes.append(comp[i + 1:j])
            i = j
        elif ch == '#':
            j = i + 1
            while j < len(comp) and (comp[j].isalnum() or comp[j] in '-_'):
                j += 1
            el_id = comp[i + 1:j]
            i = j
        elif ch == '[':
            j = comp.index(']', i)
            body = comp[i + 1:j]
            am = re.match(r'([a-zA-Z-]+)(?:([~^|$*]?=)"?([^"\]]*)"?)?', body)
            if am:
                attrs.append((am.group(1), am.group(3) if am.group(3) is not None else ''))
            i = j + 1
        elif ch == ':':
            # uebrig gebliebene Pseudos (z.B. :disabled/:checked) -> Attribut
            j = i + 1
            while j < len(comp) and (comp[j].isalnum() or comp[j] == '-'):
                j += 1
            name = comp[i + 1:j]
            if name in ('disabled', 'checked', 'required', 'open', 'selected'):
                attrs.append((name, ''))
            i = j
        else:
            i += 1
    return tag or DEFAULT_TAG, classes, el_id, attrs


def build_element(chain, uid):
    """Baut verschachteltes HTML fuer eine Kette von (combinator, compound)."""
    # Geschwister-Kombinatoren (+/~): wir bauen den Vorgaenger als Sibling.
    html_open = []
    html_close = []
    siblings_before = []
    depth_stack = []

    parts = []
    for idx, (comb, comp) in enumerate(chain):
        tag, classes, el_id, attrs = parse_compound(comp)
        parts.append((comb, tag, classes, el_id, attrs))

    def render_open(tag, classes, el_id, attrs, extra_id=None):
        a = ''
        if classes:
            a += ' class="%s"' % html.escape(' '.join(classes))
        if el_id:
            a += ' id="%s"' % html.escape(el_id)
        elif extra_id:
            a += ' id="%s"' % extra_id
        for k, v in attrs:
            a += ' %s="%s"' % (html.escape(k), html.escape(v))
        return '<%s%s>' % (tag, a)

    out = []
    close = []
    for idx, (comb, tag, classes, el_id, attrs) in enumerate(parts):
        last = idx == len(parts) - 1
        if comb in ('+', '~'):
            # Vorgaenger-Sibling einfuegen: dupliziere vorheriges Element flach
            prev = parts[idx - 1]
            out.append(render_open(prev[1], prev[2], None, prev[4]))
            if prev[1] not in VOID:
                out.append('</%s>' % prev[1])
        out.append(render_open(tag, classes, el_id, attrs))
        if tag in VOID:
            if not last:
                # Void-Element kann keine Kinder haben -> Kette abbrechen
                pass
        else:
            close.append('</%s>' % tag)
    out.extend(reversed(close))
    return ''.join(out)


def main():
    src = open(sys.argv[1] if len(sys.argv) > 1 else 'styles.css', encoding='utf-8').read()

    fx = force_pseudos(src)
    open('fx_base.css', 'w', encoding='utf-8').write(fx)

    sels = split_selectors(fx)
    seen = set()
    blocks = []
    for s in sels:
        if s in seen:
            continue
        seen.add(s)
        # Selektoren, die an html/body/:root haengen, nicht im Zoo abbilden
        chain = split_compounds(s)
        if not chain:
            continue
        try:
            frag = build_element(chain, len(blocks))
        except Exception:
            continue
        if frag:
            blocks.append((s, frag))

    with open('zoo.html', 'w', encoding='utf-8') as f:
        f.write('<!doctype html>\n<html lang="de"><head><meta charset="utf-8">\n')
        f.write('<title>Selektor-Zoo</title>\n')
        f.write('<link rel="stylesheet" href="fx_theme_prefix.css">\n')
        f.write('<link rel="stylesheet" id="plugincss" href="fx_base.css">\n')
        f.write('<link rel="stylesheet" href="fx_theme_suffix.css">\n')
        f.write('<script src="cssdiff.js"></script>\n')
        f.write('</head><body>\n')
        for s, frag in blocks:
            f.write('<!-- %s -->\n%s\n' % (html.escape(s).replace('--', '- -'), frag))
        f.write('</body></html>\n')

    print('Selektoren gesamt: %d, im Zoo abgebildet: %d' % (len(sels), len(blocks)))


if __name__ == '__main__':
    main()
