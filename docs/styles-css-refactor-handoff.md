# Handoff: `styles.css` — der letzte offene Refactoring-Durchgang

> **ERLEDIGT am 17. Juli 2026** (Commits `f353fa8`, `b05e13c`, `96ae815`).
> Der in diesem Dokument beschriebene offene Punkt ist abgearbeitet: 311 tote
> Deklarationen sind raus, `dup2.py` meldet statt 57 nur noch 1 KONFLIKT — und
> der ist ein Fehlalarm (s. u.). Das Dokument bleibt als Begründungs- und
> Fehlerprotokoll stehen. **Abschnitt 10 unten korrigiert drei Aussagen, die
> sich beim Umsetzen als falsch herausgestellt haben — wer hier weiterarbeitet,
> liest zuerst Abschnitt 10.**
>
> Auch der Sonderfall aus Abschnitt 8 (Modal-Tokens) ist entschieden und
> umgesetzt (Commit `9d548cc`) — siehe Abschnitt 11. Damit ist dieses Dokument
> vollständig abgearbeitet.

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

---

## 10. Nachtrag 17. Juli: was beim Umsetzen anders war

### 10.1 Der Weg war nicht „kollabieren", sondern „toten Code löschen"

Abschnitt 7 schlägt vor, Basis und CD-Schicht zu **einer** Regel zu
verschmelzen. Das ist der riskante Weg — er verschiebt Deklarationen über
dazwischenliegende Regeln hinweg und braucht für jeden Block einen Beweis, dass
keine davon dasselbe Element trifft.

Der gefahrlose Weg war ein anderer: Setzen zwei Regeln mit demselben Selektor
dieselbe Eigenschaft, **gewinnt die spätere immer** — egal was dazwischen
liegt (gleiche Spezifität dazwischen verliert ebenfalls gegen die spätere,
höhere gewinnt gegen beide). Die frühere Deklaration ist damit toter Code und
kann rechnerisch beweisbar gelöscht werden, ganz ohne Markup-Annahmen. Genau
das behebt auch den Schaden aus Abschnitt 4: Was nur noch an einer Stelle
steht, kann nicht mehr still zurückgedreht werden.

Ergebnis: 311 Deklarationen weg, 35 Regeln komplett, KONFLIKT 57 → 1. Werkzeug:
`fold.py analyse` / `fold.py prune`.

### 10.2 Drei Behauptungen dieses Dokuments stimmen nicht

- **Abschnitt 7.2: „nur prüfen, dass zwischen den Vorkommen keine Regel
  gleicher Spezifität dazwischenliegt (das macht `dup2.py` bereits)"** — nein.
  `dup2.py` vergleicht ausschließlich die Eigenschaften der Duplikate
  untereinander. Dazwischenliegende Regeln sieht es nie an. Wer sich darauf
  verlassen hätte, hätte DISJUNKT-Fälle für gefahrlos gehalten, die es nicht
  sind.

- **Abschnitt 5: „`cssdiff.js` … 0 Unterschiede = beweisbar optikneutral"** —
  galt so nicht. Das Werkzeug hatte drei Fehler, die es als Freigabe-Instanz
  untauglich machten (s. 10.3). Ein Kanarienvogel-Test deckte sie auf. Wer ohne
  diesen Gegentest misst, misst womöglich nichts.

- **Die Zahl 16 DISJUNKT / 57 KONFLIKT** ist eine Werkzeug-Sicht, keine
  Eigenschaft der Datei. `dup2.py` liest mehrzeilige Gruppenselektoren
  fälschlich als eigenständige Regeln — `.kg-library-step` erscheint als
  Duplikat, obwohl das zweite Vorkommen `.kg-ie-block, .kg-library-step` ist.
  Der verbliebene „KONFLIKT" ist genau so ein Fehlalarm.

### 10.3 Die Fehler in `cssdiff.js` (behoben, aber lehrreich)

1. **Fünf blinde Flecken.** `outline`, `flex`, `list-style`, `max-width`,
   `min-width` standen nicht in der Messliste — obwohl `dup2.py` genau auf
   ihnen Konflikte meldet (`.sp-slot--over`, `.kg-library-card--selected` auf
   `outline`). Eine 7px-Magenta-Outline lief als „0 Unterschiede" durch.
   Messliste jetzt 41 → 69 Eigenschaften.

2. **Transitions wurden mitgemessen.** Die Wartezeit betrug 150 ms, aber
   `.sp-modal__section` hat `transition: all 0.2s ease`. Der Schnappschuss traf
   die Animation im Flug und meldete 25 reproduzierbare Phantom-Unterschiede an
   einem neutralen Kandidaten — erkennbar an `outline-color rgb(30, 33, 38)`,
   einem Wert, der in keiner beteiligten Datei steht. Jetzt legt
   `__stillstand()` Transitions still.

3. **Rennen beim Zurücksetzen.** `__cssDiff` kehrte zurück, während das
   Zurücksetzen noch lief; ein direkt folgender Aufruf fotografierte als
   „Basis" noch den vorigen Kandidaten. Je nach Timing: Phantom-Unterschiede
   **oder ein falsches „0 Unterschiede"** — der gefährlichere Fall.

**Konsequenz für künftige Läufe:** Ein „0 Unterschiede" ohne gleichzeitig
anschlagenden Kanarienvogel ist wertlos. Beide Kontrollen gehören in denselben
Durchlauf.

### 10.4 Neu: `zoo.py` — Abdeckung statt Stichprobe

`cssdiff.js` misst nur, was im DOM steht; die vier Ansichten decken bei weitem
nicht alle Regeln ab. `zoo.py` erzeugt aus `styles.css` eine Seite mit einem
Element je Selektor (1.189 Stück, 1.639 Elemente) und ersetzt `:hover`/`:focus`
durch Klassen — auf Basis und Kandidat identisch, damit Pseudo-Zustände ohne
echte Maus messbar werden.

Grenze, die man kennen muss: Der Zoo baut ein Element **pro Selektor** und
kennt keine echten Klassenkombinationen. Für das Löschen toten Codes ist das
unerheblich (der Beweis hängt nicht am Markup). Wer doch verschmelzen will,
braucht zusätzlich echtes Markup — `states.html`/`states2.html` decken einen
Teil ab.

### 10.5 Werkzeuge neu bauen

`theme_prefix.css`/`theme_suffix.css` liegen bewusst nicht im Repo (1,5 MB
generiert). So entstehen sie:

    curl -s http://moodle501umbau.localhost/ | grep -oE 'http://[^"]*theme/styles.php/[^"]*'
    curl -s "<URL>" -o theme_all.css

Unser Block beginnt bei `/* Moodle plugin UI wrappers */` und endet dort, wo
das nächste Plugin anfängt. Prefix = alles davor, Suffix = alles danach (dem
Suffix ein `/*` voranstellen — Moodles CSS-Optimierer frisst den Kommentar-
Öffner des Folge-Plugins). **Achtung:** Die im Aggregat eingebettete Kopie
unseres CSS ist veraltet; sie wird ohnehin herausgeschnitten und ist kein
Grund zur Sorge.

---

## 11. Nachtrag 17. Juli: Abschnitt 8 ist entschieden — Modal bekommt die CD-Token

Auftraggeber-Entscheidung: ja, das Modal soll die CD-Werte bekommen. Umgesetzt
in Commit `9d548cc` — `.sq-modal-overlay` steht jetzt neben `.sq-shell` im
Selektor der Token-Anhebung. Betroffen sind alle drei Overlays: Editor- und
Intro-Modal (`sequenz.js`) sowie der Lernziel-Editor (`lernzieleditor.js`,
`sq-lz-overlay`).

Abschnitt 8 nennt es einen „Geltungsbereichs-Unterschied … der wie Absicht
aussieht". Nach dem Blick in den Code war es keine: beide Selektoren hängen am
selben frühen Token-Block, nur die spätere Anhebung ließ das Modal aus. Ein
vergessener Selektor, kein Design.

**Wie man eine ABSICHTLICHE Optik-Änderung prüft** — hier ist „0 Unterschiede"
das falsche Kriterium, das war der ganze Punkt:

1. **Eingrenzung analytisch:** Die Regel setzt ausschließlich Custom Properties.
   Die können per CSS-Semantik nur Nachfahren von `.sq-modal-overlay`
   erreichen — außerhalb ist eine Wirkung ausgeschlossen, nicht nur unwahr-
   scheinlich. Zoo und `states2.html` bestätigen es mit 0 Unterschieden.
2. **Wirkung gezielt gemessen**, an echtem Modal-Markup (1:1 aus `sequenz.js`):
   alle vier Token wechseln in allen drei Overlays; `.sq-shell` als Gegenprobe
   bleibt unverändert.
3. **Lesbarkeit gerechnet** statt geschätzt: Fließtext 13,21 → 11,03 Kontrast
   auf Weiß (AAA ab 7,0), gedämpfter Text 5,49 → 5,92 — also besser als vorher.

**Der Zoo kann diese Änderung NICHT sehen** (er meldet 0 Unterschiede). Er baut
ein Element je Selektor, ohne Verschachtelung — vererbte Token wirken aber nur
auf Nachfahren. Für so etwas braucht es eine Seite mit echtem, verschachteltem
Markup. Das ist die in 10.4 genannte Grenze, hier konkret geworden.

Rückgängig: `git revert 9d548cc` — die Änderung ist ein einzelner Selektor.
