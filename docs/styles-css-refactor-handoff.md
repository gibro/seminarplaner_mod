# Handoff: `styles.css` — der letzte offene Refactoring-Durchgang

Stand: 16. Juli 2026, gemessen an Commit `ce26cc5` (v2026071566).
Vorgeschichte: sechs Durchgänge sind gelaufen (13.–14. Juli). Dieses Dokument
sagt, was davon erledigt ist, was **nicht**, und warum der verbliebene Punkt
seit heute anders zu bewerten ist als damals.

---

## 1. Ausgangslage (gemessen, nicht geschätzt)

| Kennzahl | Wert |
|---|---|
| Zeilen | 8.036 |
| Regeln | 1.222 |
| `!important` | **23** |
| Selektoren mit mehr als einem Vorkommen | **73** (Werkzeug-Sicht, s. u.) |
| davon **DISJUNKT** — gefahrlos faltbar | **16** |
| davon **KONFLIKT** — echte Kaskaden-Schicht | **57** |

Zur Zahl 73: `dup2.py` erkennt nur Regeln, deren Selektor in Spalte 0 beginnt
und einzeilig ist. Mehrzeilige Gruppenselektoren (`.sp-modal__field input:focus,`
+ Folgezeile) sieht es nicht. Eine vollständige Zählung über alle Regeln kommt
auf **122 mehrfach vorkommende Selektoren, verteilt auf 257 Regeln** — also
rund **jede fünfte Regel der Datei**. Die 73 sind die Teilmenge, die das
Werkzeug automatisch einordnen kann; für den Rest gilt dieselbe Mechanik.

## 2. Was bereits erledigt ist — nicht nochmal anfassen

- **`!important`-Abbau ist abgeschlossen** (Durchgang 4–6, 138 → 23). Die
  verbliebenen 23 sind legitim und sollen bleiben: Utility-Klassen
  (`.kg-hidden`, `.is-hidden`, `.sp-hidden`), z-index-Dropdown-Fixes,
  TinyMCE-Overrides. **Wer hier weiter abbaut, macht die Datei schlechter.**
- **Toter Code ist raus** (Durchgang 3): 128 Regeln gelöscht, komplettes
  `kg-plan-*`/`ig-*`-Vokabular abgelöster Ansichten.
- **Button-Spezifität ist umgebaut** (Durchgang 6): Varianten tragen ihre
  Klasse doppelt (`.kg-btn.kg-btn-primary`, 0,2,0) und stehen gebündelt am
  Dateiende. **Neue Button-Varianten gehören genau dorthin.**
- **Ein `:root`**, TOC und Kaskaden-Leitplanke stehen am Dateikopf.

## 3. Was offen ist: die gestaffelten Doppel-Definitionen

Die Datei trägt zwei Ebenen für dieselben Komponenten:

- **Basis-Block** (~Z. 5000–5700) — die ursprüngliche Sequenz-/Bibliotheks-Optik
- **CD-Handoff-Schicht** (~Z. 5850–7100) — zieht die Basis auf das
  IG-Metall-CD nach

Die zweite Schicht überschreibt die erste **allein über die Reihenfolge**, bei
gleicher Spezifität. Beispiel aus der Datei:

```
.sq-baustein   Z. 5112–5116  und  Z. 6095–6099   KONFLIKT: border, background
.sq-anchor__head  (Basis)         und  (CD-Schicht)   KONFLIKT: background, padding
```

**Das ist kein Schönheitsfehler, sondern eine Fehlerquelle mit Nachweis.**

## 4. Warum das jetzt dringlicher ist als am 13. Juli

Damals wurde die aggressive Variante (Schichten pro Selektor zu einer Regel
kollabieren) **bewusst abgelehnt** — mit zwei guten Gründen: es gab kein
Verifikationswerkzeug, und die Schichten galten als beabsichtigt.

Beides hat sich geändert:

1. **Das Werkzeug existiert seit Durchgang 4** (`cssdiff.js`, s. u.). Optik-
   neutralität ist seither *messbar*, nicht mehr nur begründbar. Der
   Ablehnungsgrund „ohne Deploy zu riskant" ist entfallen.
2. **Die Schichten haben am 16. Juli dreimal echten Schaden angerichtet:**

   - **Sequenz-Redesign, Durchgang 1** (`5ca0441`): Änderungen am Basis-Block
     wurden von der CD-Schicht still zurückgedreht. `.sq-anchor__head` setzte
     `background:#FAFAFA` erneut → der Kasten um den Abschnitt, den das
     Redesign gerade entfernt hatte, wäre zurückgekommen. `.sq-baustein` setzte
     `border:1px solid` + `border-top:3px` erneut → aus der gestrichelten
     Klammer wäre wieder eine Karte geworden. Gefunden nur, weil gezielt nach
     Duplikaten gesucht wurde — im Browser hätte es nach Schlamperei ausgesehen.
   - **Phasen-Farbpunkte** (`8071ae3`): eine **neue** Regel (`.sq-phase__dot`)
     mit neutralem `background` landete hinter den `.sq-phase-bg--*`-Regeln und
     übermalte bei gleicher Spezifität alle fünf Phasenfarben grau. Die Falle
     ist so bekannt, dass sie an `.sq-unit__phase` bereits auskommentiert im
     Code steht — und trotzdem wieder zugeschlagen hat.
   - **Klapp-Indikator** (`681c815`): `var(--sq-text)` löst im Modal anders auf
     als in der Shell (s. Abschnitt 6) → derselbe Indikator sah je Kontext
     anders aus.

   Die ersten beiden Fälle sind derselbe Mechanismus. Er kostet jeden, der die
   Datei anfasst, entweder einen Fehler oder eine Suche.

**Empfehlung:** Die Ablehnung der Schicht-Kollaps-Variante neu bewerten — nicht
pauschal, sondern für die **57 KONFLIKT-Fälle**, blockweise und je Block mit
`cssdiff.js` auf 0 Unterschiede geprüft. Die 16 DISJUNKT-Fälle sind ohnehin
gefahrlos faltbar und der offensichtliche Einstieg.

## 5. Werkzeug — liegt jetzt im Repo

**Wichtig:** Die Werkzeuge aus Durchgang 4/5 lagen bis heute ausschließlich in
Session-Scratchpads unter `/private/tmp/…`, verteilt über drei alte Sessions.
Sie hätten jeden Neustart nicht überlebt. Sie sind jetzt gerettet nach:

    docs/styles-refactor-werkzeug/

| Datei | Zweck |
|---|---|
| `cssdiff.js` | `window.__cssDiff(url)` — fotografiert 41 berechnete Eigenschaften je Element, tauscht **nur** unseren CSS-Block gegen den Kandidaten, liefert die Unterschiede. **0 Unterschiede = beweisbar optikneutral.** |
| `harness.html` | lädt `theme_prefix.css` → unser CSS → `theme_suffix.css` = die **echte** Moodle-Kaskade |
| `states.html`, `states2.html` | alle Control-Typen × Ruhe/Hover/Focus/Disabled |
| `dup2.py` | listet Mehrfach-Selektoren mit Zeilenbereichen und Einordnung DISJUNKT/KONFLIKT |
| `imp.py` | `!important`-Analyse (historisch; der Abbau ist fertig) |

Aufruf von `dup2.py`: aus dem Plugin-Wurzelverzeichnis, es liest `styles.css`
relativ:

    cd mod/seminarplaner && python3 docs/styles-refactor-werkzeug/dup2.py

Den Theme-Block für den Harness holt man sich ohne Login:

    curl -s http://moodle501umbau.localhost/ | grep -oE 'http://[^"]*theme/styles.php/[^"]*'

Dann die aggregierte CSS ziehen und an den Grenzen unseres Blocks in
`theme_prefix.css` / `theme_suffix.css` schneiden.

## 6. Harte Leitplanken

1. **Regeln nicht frei umsortieren.** Die Datei benutzt die Kaskaden-Reihenfolge
   als Mechanismus. Jede Zusammenführung einzeln verifizieren.
2. **Geänderte Eigenschaften explizit auf den Zielwert setzen, nicht nur
   entfernen.** Moodle bündelt `mod/*/styles.css` zusätzlich in die aggregierte
   Theme-CSS; eine gecachte Alt-Kopie erzwingt entfernte Deklarationen sonst
   weiter.
3. **Cache-Falle bei der Sichtprüfung:** Moodle liefert das aggregierte
   Stylesheet unter **gleichbleibender URL** aus. Nach einem Deploy hält der
   Browser die alte Kopie fest, obwohl `purge_caches` lief. Hart neu laden
   (`location.reload(true)`), sonst misst man den Cache und diagnostiziert
   Phantome. Das ist am 16. Juli passiert und hat eine Fehldiagnose gekostet.
4. **Im Harness Kandidaten-CSS immer mit `?t=`+`Date.now()` laden** — sonst misst
   man ebenfalls den Cache.
5. **Beim Transformieren per Regex zuerst Kommentare gegen Platzhalter
   tauschen.** `([^{}]+)\{([^{}]*)\}` zieht vorangehende Kommentare in die
   Selektorgruppe; ein Guard wie `'/*' not in sel` überspringt dann ausgerechnet
   die kommentierten Regeln. Das hat in Durchgang 6 zwei Fehldiagnosen gekostet.
6. **Pseudo-Zustände mitmessen.** Ein Ruhezustands-Snapshot ist wertlos für
   Hover/Focus/Disabled. `states2.html` benutzen und die Gegenprobe nicht
   vergessen (Primär-Hover *muss* sich vom Ruhezustand unterscheiden), sonst
   testet man ins Leere.
7. **Reine CSS-Änderungen brauchen keinen Versions-Bump** (Cachebuster ist
   `filemtime`), aber Theme-Cache purgen. Deploy-Weg: siehe
   `docs/claude-code-briefing-seminarplaner.md` und die Commit-/Push-Disziplin
   (Arbeitsordner → Push → Pull im Live-Checkout → Upgrade+Purge **je Instanz**).

## 7. Vorgehen (Vorschlag)

1. `dup2.py` laufen lassen, Liste nach DISJUNKT/KONFLIKT trennen.
2. **Die 16 DISJUNKT-Fälle** in das erste Vorkommen falten. Kein Konflikt, keine
   Reihenfolgenfrage — nur prüfen, dass zwischen den Vorkommen keine Regel
   gleicher Spezifität dazwischenliegt (das macht `dup2.py` bereits).
3. **Die 57 KONFLIKT-Fälle blockweise**, thematisch gebündelt (z. B. erst alle
   `.sq-baustein*`, dann `.sq-budget*`): Basis und CD-Schicht zu **einer** Regel
   mit den Endwerten kollabieren, an der Stelle der **späteren** Regel.
4. Nach jedem Block: `cssdiff.js` gegen alle vier Ansichten (Sequenz,
   Bibliothek, Überblick, Import/Export) **plus** `states2.html`. Nur bei
   **0 Unterschieden** committen.
5. Bei Unterschieden: nicht „nachjustieren", sondern den Block zurücknehmen und
   den Grund verstehen. Ein Unterschied heißt, dass die Schicht doch etwas tat.

## 8. Ein Sonderfall, der nicht in den Refactor gehört

`--sq-text` und drei weitere Token stehen zweimal:

```
.sq-shell, .sq-modal-overlay { --sq-text: #26313d; … }        /* Z. 4877 */
.sq-shell                    { --sq-text: var(--ig-anthracite); … }  /* Z. 5914 */
```

Die CD-Schicht hebt vier Token an (`--sq-text`, `--sq-text-muted`,
`--sq-border`, `--sq-border-strong`) — aber **nur für `.sq-shell`**. Das
Editor-Modal behält alle vier auf der alten bläulichen Palette, also nicht nur
die Schrift, auch seine Rahmen.

**Das ist kein Duplikat, sondern ein Geltungsbereichs-Unterschied.** Ein
mechanischer Dedup-Durchgang würde ihn erhalten, weil er wie Absicht aussieht.
Es ist eine **Design-Entscheidung**: Soll das Modal die CD-Werte bekommen? Falls
ja, ist der Fix ein Wort (`.sq-modal-overlay` in den Selektor von Z. 5914) —
aber er ändert das Aussehen des gesamten Editor-Modals und gehört deshalb
bewusst entschieden, nicht im Vorbeigehen mitgenommen.

## 9. Fertig ist es, wenn …

- `dup2.py` keine KONFLIKT-Fälle mehr meldet (oder nur noch bewusst dokumentierte),
- `cssdiff.js` über alle vier Ansichten und `states2.html` 0 Unterschiede zeigt,
- die 23 `!important` unangetastet sind,
- und im Kopf der Datei steht, **warum** es jetzt nur noch eine Ebene gibt —
  damit die nächste Feature-Welle nicht wieder eine zweite anlegt.

Der letzte Punkt ist der wichtigste. Ohne ihn ist der Refactor in drei Monaten
wieder rückgängig gemacht.
