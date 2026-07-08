# Einstiegs-Briefing für Claude Code: Seminarplaner-Umbau

Dieses Briefing ist für den Start einer Claude-Code-Session gedacht – als Ergänzung zu (nicht Ersatz für) `seminarplaner-umbau-konzept.md`, das vollständig ins Repository kopiert werden sollte (siehe Abschnitt „Repo-Setup" unten).

## 1. Kontext in Kürze

Umbau von `mod_seminarplaner` (Moodle-Kursaktivität) und `local_seminarplaner` (globale Bibliothek + Review-Workflow) für die IG-Metall-Bildungsarbeit. Zielgruppe: erfahrene Pädagoginnen ohne akademische Ausbildung, geringe IT-Kompetenz – didaktische statt IT-Metaphern in allen Texten/Microcopy. Kernumbau: von einer freien Zeitraster-Ansicht (Grid) zu einer geordneten Sequenzansicht mit Ankern (Vormittag/Nachmittag).

Alle Richtungsentscheidungen sind in `seminarplaner-umbau-konzept.md` nummeriert (D1–D43) und gelten als bindend, bis sie dort ausdrücklich revidiert werden. Bei technischen Zweifelsfragen: im Konzeptdokument nachschlagen, nicht neu entscheiden. Wirklich neue Konzeptfragen gehören zurück ins Ursprungs-Projekt (Claude.ai), nicht in eine Claude-Code-Session entschieden.

## 2. Das Datenmodell (D20) – Kern der gesamten Umsetzung

Ersetzt die bisherigen Start/Ende-Felder je Grid-Eintrag:

- **Anker** (Vormittag/Nachmittag eines Tages) enthält eine geordnete **Sequenz** von *Platzierungen*. Reihenfolge in der Liste ersetzt Start/Ende; Uhrzeiten werden daraus berechnet.
- **Platzierung** = atomarer Sequenz-Eintrag: optionaler Verweis auf einen **Baustein** (leer bei unbenannter Einheit) + Verweis auf eine **Einheiten-Auswahl**.
- **Einheiten-Auswahl** = Alternativen auf Einheiten-Ebene: kleine Kandidatenliste (Verweis auf Seminareinheiten-Bibliothek, keine Kopie) + Kennzeichnung der aktiven.
- **Baustein** trägt Titel, Unterthemen, Themenplan-Referenz, Archivfeld – zusätzlich **Varianten** (Alternative auf Baustein-Ebene): eigenständige, benannte Pakete mit eigener Platzierungsliste, die bei Aktivierung den gesamten zusammenhängenden Bereich ersetzen. Varianten müssen nicht gleich lang sein.
- **Baustein-Fortsetzung:** Dieselbe Baustein-Kennung an zwei nicht direkt benachbarten Sequenz-Stellen wird automatisch als „… (Fortsetzung)" erkannt – kein zweiter Datensatz nötig.
- **Kein automatisches Ausdehnen bei Zeit-Überlauf.** Stattdessen geführte Verschiebe-Aktion (Button „Auf Nachmittag verschieben" o. ä.), die betroffene Einheiten in den nächsten Abschnitt verschiebt.

JSON-Beispielstruktur steht im Konzeptdokument, Abschnitt „Getroffene Richtungsentscheidungen" bei D20.

## 3. Migration der Bestandsdaten (D20, D35, D36, D43) – Reihenfolge beachten

**Wichtigste technische Präzisierung:** Die Grid→Sequenz-Umrechnung läuft als **Upgrade-Schritt in `upgrade.php`**, nicht live beim ersten Öffnen durch die Referentin (D43). Ablauf:

1. Bestehende Grid-Einträge (Tag + Start/Ende) werden beim Plugin-Upgrade pro Tag/Anker nach Startzeit sortiert → ergibt die Sequenz-Reihenfolge. Deterministisch, verlustfrei (D20).
2. Danach beim jeweils **ersten eigenen Öffnen** eines migrierten Plans durch eine Referentin: einmalige **Übersetzungs-Anzeige** (D35) – zeigt nur den ersten Tag im Vergleich „So war es" (altes Grid-Layout) / „So ist es jetzt" (Sequenz), mit den echten eigenen Daten, Hinweistext für die übrigen Tage. Speicherung des „gesehen"-Status pro **Plan+Nutzerin**-Kombination (Anschluss an bestehende `kgen_grid_user_state`-Tabelle), nicht global je Plan – jede Referentin sieht es einmal, unabhängig von Kolleginnen.
3. **Kein Umschalter zwischen altem Grid und neuer Sequenzansicht** (D34) – das Grid bleibt als reine Lese-/Überblicksansicht bestehen (alle Tage nebeneinander), Bearbeitung findet ausschließlich in der Sequenzansicht statt.
4. **Keine gestaffelte optische Migration.** Zielbild ist dauerhaft die Chrome-Variante „Vertraut" (siehe `sequenzansicht-wireframe-vertraut.html`) – keine spätere Umstellung auf die im Workshop verwendete „Flipchart"-Optik (D36).

## 4. Themenplan-Parser (D19) – Spezifikation steht, Implementierung fehlt noch

Best-Effort-Parser für `.docx`-Themenpläne, PHP im Plugin (kein externes Tool, D13):

- Sucht die erste Tabelle mit Kopfzeile „Tag | Inhalt | Kompetenzerwartungen" bzw. Marker „Seminarplan:". Alles außerhalb wird ignoriert.
- Inhalt-Zelle: erster Absatz = Baustein-Titel ((V)/(N)-Präfix abschneiden → steuert Anker-Platzierung, D12), Folgeabsätze = Unterthemen.
- Kompetenzerwartungen-Zelle → schreibgeschützte Themenplan-Referenz am Baustein (D6), ein Textblock.
- Organisatorische Blöcke über leere Kompetenzerwartungen-Zelle erkannt.
- Wochentags-Mapping auf Seminartage, Anker-Fallback bei fehlendem (V)/(N).
- Normalisierung: Whitespace, Ellipsen-/Anführungszeichen-Varianten.
- **Ein harter Boden:** Keine erkennbare Themenplan-Struktur → Import bricht mit freundlicher Meldung ab, nichts wird angelegt. Sonst: Best-Effort, alles Unklare landet im **Import-Bericht** (Zusammenfassung + Zeilen-Hinweise), blockiert nichts.

Referenz-Fixture: `TP_2026_ki.docx` (im Projektwissen). Für Unit-Tests zusätzlich bewusst „unsaubere" Altpläne als Fixtures verwenden (Best-Effort-Pfade).

## 5. Weitere zentrale Mechaniken (Kurzreferenz)

- **Vorschlagsmechanik (D14, D41):** Harte Filter (Dauer ≤ Lücke, ggf. Phase bei Dramaturgie-Vorlage-Lücken). Weiche Sortierung: Stichwort-Abgleich + Bloom-Verb-Mapping **auf die Seminarphase** (nicht mehr auf die entfallene Kognitive Dimension, D40/D41) – Erfahrungserhebung bewusst ausgeklammert, dort nur Stichwort-Abgleich. Max. 3–5 erklärte Vorschläge, Null-Treffer-Pfad mit Schnellanlage.
- **Dramaturgie-Check (D15, D22, D23, D27):** Sieben Regeln, ausschließlich Hinweise (nie Warnungen/Blocker), Stille bei fehlenden Daten, Ein/Aus-Schalter pro Referentin über alle Pläne gespeichert.
- **Seminareinheiten-Formular (D21, D40):** Jetzt 16 statt 18 Felder (Kognitive Dimension und Komplexitätsgrad entfallen). Editor als Modal (D17), Schnellfassung offen, restliche Abschnitte zugeklappt.
- **Vier-Objekte-Modell (D28):** Seminareinheit / Methode / Methoden-Sammlung (vormals „Methodenset", D38) / Seminarkonzept. Globale Bibliothek (D29) und Freigabe-Mechanismus (D30, D32) gelten für Methoden-Sammlungen und Seminarkonzepte identisch.
- **Tab-Struktur (D16, D18, D37, D39):** Überblick · Sequenz · Seminareinheiten (mit Unterbereichen „Anlegen"/„Bibliothek") · Roter Faden · Import/Export · Einreichen (mit Flussdiagramm-Erklärung des Prüfprozesses).

## 6. Repo-Setup (Empfehlung)

```bash
git checkout umbau-sequenzansicht   # oder den tatsächlichen Feature-Branch-Namen
mkdir -p docs
cp /pfad/zu/seminarplaner-umbau-konzept.md docs/
mkdir -p .claude/skills/git-branch-guard-seminarplaner
cp /pfad/zu/SKILL.md .claude/skills/git-branch-guard-seminarplaner/
```

Nach jeder größeren Konzept-Session im Claude.ai-Projekt: aktualisierte Version von `seminarplaner-umbau-konzept.md` erneut nach `docs/` kopieren und mit den zugehörigen Code-Änderungen committen (normaler Commit auf den Feature-Branch, siehe Skill-Regeln – kein GitLab-Push, kein Merge nach `main` ohne explizite Freigabe).

## 7. Was NICHT in Claude Code entschieden werden sollte

Neue Richtungsfragen (z. B. weitere Feldänderungen, neue Tab-Umbenennungen, neue Freigabe-Workflows) gehören zurück ins Claude.ai-Projekt, wo das Konzeptdokument gepflegt wird – nicht spontan während der Implementierung entschieden. Bei Unsicherheit: Frage zurückstellen und im Konzeptdokument als offenen Punkt vermerken, statt zu improvisieren.
