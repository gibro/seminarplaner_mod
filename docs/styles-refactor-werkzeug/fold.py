#!/usr/bin/env python3
"""Entfernt tote Deklarationen aus gestaffelten Doppel-Definitionen.

DAS PRINZIP (und warum es ohne Sichtprüfung beweisbar ist)
----------------------------------------------------------
styles.css definiert viele Komponenten zweimal: einmal im Basis-Block und
einmal in der CD-Handoff-Schicht ~900 Zeilen weiter unten, bei GLEICHER
Spezifitaet. Setzen beide dieselbe Eigenschaft P, gewinnt immer das spaetere
Vorkommen. Das gilt unabhaengig davon, was dazwischen steht:

  - dazwischenliegende Regel gleicher Spezifitaet -> verliert ebenfalls gegen occ2
  - dazwischenliegende Regel hoeherer Spezifitaet -> gewinnt gegen beide
  - dazwischenliegende Regel niedrigerer Spezifitaet -> verliert gegen beide

In jedem Fall ist die Deklaration im FRUEHEREN Vorkommen tot: sie kann das
Ergebnis nicht beeinflussen. Loeschen ist damit rechnerisch optikneutral --
kein Markup-Wissen noetig, keine Annahme darueber, welche Klassen zusammen
auftreten.

Genau das ist die Fehlerquelle aus dem Handoff: Wer den Basis-Block bearbeitet,
aendert toten Code, und die CD-Schicht dreht es still zurueck (17. Juli:
.sq-anchor__head und .sq-baustein, Commit 5ca0441). Steht die Eigenschaft nur
noch an EINER Stelle, ist dieser Fehler konstruktiv unmoeglich.

Was das Werkzeug NICHT tut: Deklarationen verschieben. Das waere der Schritt,
der die zwei Regeln zu einer macht -- er ist NICHT beweisbar neutral, weil
dabei Eigenschaften ueber dazwischenliegende Regeln hinweg wandern. dup2.py
behauptet, das zu pruefen; es tut es nicht.

!important wird beruecksichtigt: eine wichtige Deklaration stirbt nicht an
einer spaeteren unwichtigen.

Aufruf (aus mod/seminarplaner/):
    python3 docs/styles-refactor-werkzeug/fold.py analyse
    python3 docs/styles-refactor-werkzeug/fold.py prune            # schreibt styles.css
    python3 docs/styles-refactor-werkzeug/fold.py prune ziel.css
"""
import re
import sys
from collections import defaultdict

CSS = 'styles.css'

# Shorthand -> die Langformen, die es vollstaendig ueberschreibt.
LONGHANDS = {
    'background': ['background-color', 'background-image', 'background-position',
                   'background-size', 'background-repeat', 'background-attachment',
                   'background-clip', 'background-origin'],
    'border': ['border-width', 'border-style', 'border-color',
               'border-top', 'border-right', 'border-bottom', 'border-left',
               'border-top-width', 'border-top-color', 'border-top-style',
               'border-right-width', 'border-right-color', 'border-right-style',
               'border-bottom-width', 'border-bottom-color', 'border-bottom-style',
               'border-left-width', 'border-left-color', 'border-left-style'],
    'border-top': ['border-top-width', 'border-top-color', 'border-top-style'],
    'border-right': ['border-right-width', 'border-right-color', 'border-right-style'],
    'border-bottom': ['border-bottom-width', 'border-bottom-color', 'border-bottom-style'],
    'border-left': ['border-left-width', 'border-left-color', 'border-left-style'],
    'border-width': ['border-top-width', 'border-right-width', 'border-bottom-width',
                     'border-left-width'],
    'border-color': ['border-top-color', 'border-right-color', 'border-bottom-color',
                     'border-left-color'],
    'border-style': ['border-top-style', 'border-right-style', 'border-bottom-style',
                     'border-left-style'],
    'border-radius': ['border-top-left-radius', 'border-top-right-radius',
                      'border-bottom-left-radius', 'border-bottom-right-radius'],
    'padding': ['padding-top', 'padding-right', 'padding-bottom', 'padding-left'],
    'margin': ['margin-top', 'margin-right', 'margin-bottom', 'margin-left'],
    'font': ['font-family', 'font-size', 'font-weight', 'font-style', 'line-height',
             'font-variant'],
    'flex': ['flex-grow', 'flex-shrink', 'flex-basis'],
    'flex-flow': ['flex-direction', 'flex-wrap'],
    'gap': ['row-gap', 'column-gap'],
    'outline': ['outline-width', 'outline-style', 'outline-color'],
    'list-style': ['list-style-type', 'list-style-position', 'list-style-image'],
    'overflow': ['overflow-x', 'overflow-y'],
    'inset': ['top', 'right', 'bottom', 'left'],
    'place-items': ['align-items', 'justify-items'],
    'place-content': ['align-content', 'justify-content'],
    'transition': ['transition-property', 'transition-duration',
                   'transition-timing-function', 'transition-delay'],
}


def covers(q, p):
    """Ueberschreibt eine Deklaration mit Eigenschaft q die mit Eigenschaft p
    vollstaendig?"""
    if q == p:
        return True
    return p in LONGHANDS.get(q, [])


class Decl:
    """span = (a, b): Zeichenbereich der Deklaration IM QUELLTEXT, inklusive
    abschliessendem Semikolon. Zeichenbereiche statt Zeilen, weil Regeln wie
    `.sq-baustein__units { display: flex; gap: 6px; padding: 8px; }` komplett
    auf einer Zeile stehen -- zeilenweises Loeschen wuerde dort lebende
    Deklarationen mitreissen."""
    __slots__ = ('prop', 'val', 'important', 'line', 'span')

    def __init__(self, prop, val, important, line, span):
        self.prop = prop
        self.val = val
        self.important = important
        self.line = line
        self.span = span


class Rule:
    def __init__(self, sel, start, end, decls, context, span):
        self.sel = sel
        self.start = start
        self.end = end
        self.decls = decls
        self.context = context
        self.span = span       # Zeichenbereich der GESAMTEN Regel

    def __repr__(self):
        return f'<{self.sel} {self.start+1}-{self.end+1}>'


def blank_comments(text):
    """Kommentare durch Leerzeichen ersetzen, Zeilenstruktur erhalten.
    (Handoff-Leitplanke 5: sonst zieht jede Regex Kommentare in den Selektor.)"""
    return re.sub(r'/\*.*?\*/', lambda m: re.sub(r'[^\n]', ' ', m.group(0)), text, flags=re.S)


def split_top(text, sep):
    out, depth, cur = [], 0, []
    for ch in text:
        if ch in '([':
            depth += 1
        elif ch in ')]':
            depth -= 1
        if ch == sep and depth == 0:
            out.append(''.join(cur))
            cur = []
        else:
            cur.append(ch)
    if ''.join(cur).strip():
        out.append(''.join(cur))
    return out


def parse(text):
    clean = blank_comments(text)
    rules, stack = [], []
    i, n, tok = 0, len(clean), 0
    while i < n:
        c = clean[i]
        if c == '{':
            head_raw = clean[tok:i]
            head = head_raw.strip()
            if head.startswith('@'):
                if re.match(r'@(media|supports|layer|container|document)', head):
                    stack.append(head)
                    i += 1
                    tok = i
                    continue
                depth = 1
                i += 1
                while i < n and depth:
                    depth += (clean[i] == '{') - (clean[i] == '}')
                    i += 1
                tok = i
                continue
            body_start = i + 1
            depth = 1
            i += 1
            while i < n and depth:
                depth += (clean[i] == '{') - (clean[i] == '}')
                i += 1
            body_end = i - 1
            sel_start = tok + (len(head_raw) - len(head_raw.lstrip()))
            sel_line = clean.count('\n', 0, sel_start)
            decls = []
            body_clean = blank_comments(text[body_start:body_end])
            off = body_start
            for part in split_top(body_clean, ';'):
                seg_start = off
                seg_end = off + len(part) + 1        # inkl. Semikolon
                off = seg_end
                if ':' not in part:
                    continue
                prop, val = part.split(':', 1)
                prop = prop.strip().lower()
                val = val.strip()
                if not prop:
                    continue
                imp = bool(re.search(r'!\s*important\s*$', val, re.I))
                # Fuehrende Umbrueche/Leerzeichen ueberspringen: das Segment der
                # ERSTEN Deklaration beginnt direkt hinter der '{' und liegt damit
                # noch auf der Selektorzeile. Ohne das loescht prune die
                # Selektorzeile statt der Deklaration und laesst die '}' verwaist
                # stehen (16 verwaiste Klammern, 1.152 Optik-Unterschiede).
                seg_start += len(part) - len(part.lstrip())
                decls.append(Decl(prop, val, imp, text.count('\n', 0, seg_start),
                                  (seg_start, min(seg_end, body_end))))
            rules.append(Rule(head, sel_line, text.count('\n', 0, body_end), decls,
                              ' | '.join(stack), (sel_start, i)))
            tok = i
            continue
        if c == '}':
            if stack:
                stack.pop()
            i += 1
            tok = i
            continue
        i += 1
    return rules


def teile(r):
    """Die Einzelselektoren einer Regel (Gruppenselektor -> mehrere)."""
    return [p.strip() for p in split_top(r.sel, ',') if p.strip()]


def opfer_und_taeter(rules):
    """-> [(opfer_regel, [killer_decl, ...]), ...]

    Eine spaetere Regel K kann eine Deklaration der frueheren Regel R nur dann
    RESTLOS toeten, wenn sie ALLE Selektoren von R abdeckt -- formal:
    menge(teile(K)) ist eine Obermenge von menge(teile(R)), bei gleichem
    At-Regel-Kontext. Dann gilt fuer jedes Element, das R trifft: K trifft es
    auch, steht spaeter und hat fuer den gemeinsamen Selektor dieselbe
    Spezifitaet -> K gewinnt.

    Das deckt beide Bauformen ab, die in styles.css vorkommen:
      - Einzelselektor-Opfer, Gruppen-Taeter: `.kg-library-step` (Z.946) stirbt
        an `.kg-ie-block, .kg-library-step` (Z.6386).
      - Gruppen-Opfer, identische Gruppe als Taeter: `#sq-prev-day, #sq-next-day`
        steht zweimal mit derselben Gruppe.

    Bewusst NICHT abgedeckt (und das ist korrekt): eine Gruppe, von der nur ein
    Mitglied spaeter ueberschrieben wird. `.sq-goals__summary, ...,
    .sq-gap__summary { list-style: none }` (Z.4734) behaelt seine Deklaration,
    weil sie fuer die drei anderen Mitglieder weiterlebt. dup2.py meldet den
    Fall trotzdem als KONFLIKT -- ein Fehlalarm, der aus seinem zeilenweisen
    Lesen der Gruppen-Selektoren stammt.
    """
    vorbereitet = [(i, r, frozenset(teile(r))) for i, r in enumerate(rules)]
    out = []
    for pos, (i, r, teile_r) in enumerate(vorbereitet):
        killer = []
        for j, k, teile_k in vorbereitet[pos + 1:]:
            if k.context != r.context:
                continue
            if teile_k >= teile_r:
                killer.extend(k.decls)
        if killer:
            out.append((r, killer))
    return out


def tote_decls_von(r, killer):
    """-> [(tote_decl, killer_decl), ...] fuer eine einzelne Regel."""
    treffer = []
    for d in r.decls:
        for s in killer:
            if not covers(s.prop, d.prop):
                continue
            # Eine wichtige Deklaration stirbt nicht an einer unwichtigen.
            if d.important and not s.important:
                continue
            treffer.append((d, s))
            break
    return treffer


def analyse(rules):
    ges_tot = 0
    ges_leer = 0
    betroffen = 0
    for r, killer in opfer_und_taeter(rules):
        treffer = tote_decls_von(r, killer)
        if not treffer:
            continue
        betroffen += 1
        leer = len(treffer) == len(r.decls)
        ges_tot += len(treffer)
        if leer:
            ges_leer += 1
        sel = r.sel.replace('\n', ' ')
        print(f'{sel[:52]:52s} Z.{r.start+1}-{r.end+1}: '
              + ('KOMPLETT tot -> Regel faellt weg' if leer
                 else f'{len(treffer)} von {len(r.decls)} tot'))
        for d, k in treffer:
            print(f'      {d.prop}: {d.val}   (ueberschrieben von Z.{k.line+1}: {k.prop}: {k.val})')
    print(f'\n{betroffen} Regeln mit totem Code, {ges_tot} tote Deklarationen, '
          f'{ges_leer} Regeln fallen komplett weg.')


def ganze_zeilen(text, a, b):
    """Weitet (a,b) auf volle Zeilen aus, sofern davor und danach auf denselben
    Zeilen nur Weissraum steht -- so bleibt keine leere Zeile in der Regel stehen.

    Bei Einzeiler-Regeln (`.sq-daylabel { a: 1; b: 2; }`) greift das bewusst
    nicht, weil neben der toten Deklaration noch lebender Code auf der Zeile
    steht. Dort wird stattdessen der nachfolgende Leerraum mitgenommen, damit
    keine doppelten Leerzeichen zurueckbleiben.

    Absichtlich KEINE globale Whitespace-Kosmetik: ein Versuch mit
    `[ \\t]{2,}\\}` -> ` }` und `;[ \\t]{2,}` -> `; ` hat die Einrueckung
    verschachtelter @media-Klammern und die Spaltenausrichtung der
    `.kg-ie-card--*`-Regeln zerstoert -- an Code, der gar nicht angefasst werden
    sollte. Ein Aufraeum-Werkzeug, das unbeteiligte Zeilen umformatiert, macht
    seinen eigenen Diff unpruefbar.
    """
    zeilen_anfang = text.rfind('\n', 0, a) + 1
    zeilen_ende = text.find('\n', b)
    if zeilen_ende == -1:
        zeilen_ende = len(text)
    if not text[zeilen_anfang:a].strip() and not text[b:zeilen_ende].strip():
        return (zeilen_anfang, zeilen_ende + 1)
    # Einzeiler: nachfolgenden horizontalen Leerraum einsammeln.
    while b < len(text) and text[b] in ' \t':
        b += 1
    return (a, b)


def prune(text, rules):
    """Loescht alle beweisbar toten Deklarationen.

    Arbeitet auf Zeichenbereichen (nicht Zeilen) und schneidet von hinten nach
    vorne, damit frueher liegende Bereiche gueltig bleiben.
    """
    schnitte = []                # (a, b) zu entfernende Zeichenbereiche
    for r, killer in opfer_und_taeter(rules):
        treffer = tote_decls_von(r, killer)
        if not treffer:
            continue
        if len(treffer) == len(r.decls):
            schnitte.append(r.span)                   # ganze Regel faellt weg
        else:
            schnitte.extend(d.span for d, _ in treffer)

    # Schnitt auf ganze Zeilen ausdehnen, wo sonst nur Weissraum stehen bliebe.
    # Ohne das hinterlaesst jede geloeschte Deklaration eine Leerzeile mitten in
    # der Regel. Bei Einzeiler-Regeln greift es bewusst NICHT (dort steht neben
    # der toten Deklaration noch lebender Code auf derselben Zeile).
    schnitte = [ganze_zeilen(text, a, b) for a, b in schnitte]

    # Ueberlappungen (ganze Regel + einzelne Decl darin) verschmelzen
    schnitte.sort()
    verschmolzen = []
    for a, b in schnitte:
        if verschmolzen and a <= verschmolzen[-1][1]:
            verschmolzen[-1] = (verschmolzen[-1][0], max(verschmolzen[-1][1], b))
        else:
            verschmolzen.append((a, b))

    out = text
    for a, b in reversed(verschmolzen):
        out = out[:a] + out[b:]

    # Aufraeumen: Zeilen, die nur noch aus Rest-Weissraum bestehen, und die
    # Leerzeilen-Luecken entfernter Regeln einsammeln.
    out = re.sub(r'\n{3,}', '\n\n', out)
    return out


def main():
    text = open(CSS, encoding='utf-8').read()
    rules = parse(text)
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'analyse'
    if cmd == 'analyse':
        analyse(rules)
    elif cmd == 'prune':
        ziel = sys.argv[2] if len(sys.argv) > 2 else CSS
        neu = prune(text, rules)
        open(ziel, 'w', encoding='utf-8').write(neu)
        print(f'geschrieben: {ziel} ({len(text.splitlines())} -> {len(neu.splitlines())} Zeilen)')
    else:
        print(__doc__)


if __name__ == '__main__':
    main()
