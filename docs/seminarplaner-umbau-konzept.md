# Seminarplaner-Umbau – Konzept- und Entscheidungsdokument

Stand: 12. Juli 2026 · Grundlage: Code-Review `mod_seminarplaner` 0.6.6-beta / `local_seminarplaner` 0.2.2-beta, Analyse eines Original-Themenplans (TP_2026_ki.docx), Vergleich mit SessionLab, Analyse von zwei realen Beispiel-Methodensets (183 Methoden) und vier realen Beispiel-Seminarkonzepten.

Zweck: Dieses Dokument hält den Stand der konzeptionellen Überlegungen zum Umbau des Moodle-Plugins Seminarplaner fest. Es dient als Projektwissen für die Weiterarbeit in einem Claude-Projekt und trennt bewusst zwischen **getroffenen Richtungsentscheidungen**, **offenen Fragen** und **Backlog**. Es soll fortgeschrieben werden, wenn neue Entscheidungen fallen.

Änderungshistorie:
- 13. Juli 2026 (bk): **Aufräumpunkt erledigt** (Claude Code, Versionen 2026071509/2026071510): `planningmode.php` stillgelegt (jetzt Redirect auf die Sequenz, Muster wie `methods.php` → Bibliothek) – kompatibilitätssicher gewählt, weil der Überblick (`grid.js`) noch dorthin verlinkt; ein Löschen hätte einen 404 erzeugt. Zusätzlich `role="status"`/`aria-live="polite"` an allen `kg-status`-Statuszeilen (Überblick, Import/Export, Roter Faden, Bibliothek, Einreichen). **Wichtig:** Die Update-Migration alt→neu bleibt unberührt (sie läuft über die Upgrade-Schritte und den Grid→Sequenz-Konverter, nicht über diese Seiten) – auf Staging verifiziert: alter migrierter Plan lädt und ist weiter nutzbar. Die nun toten AMD-Dateien `methods.js` und `planningmode.js` (+ Builds) wurden auf Nutzer-Wunsch gelöscht (Version 2026071510; nachweislich von nichts geladen, alle betroffenen Seiten laden fehlerfrei). Damit ist der Aufräumpunkt komplett abgeschlossen.
- 13. Juli 2026 (bj): **D61 und D62 umgesetzt** (Claude Code, Version 2026071508). **D61:** aufklappbarer „Seminarziele"-Bereich oben in der Sequenz (Ziele als Freitext anlegen/bearbeiten/löschen, je Ziel eine Verknüpfungs-Checkliste der platzierten Seminareinheiten); Speicherung als `seminarziele`-Liste im `statejson` des Plans (kein DB-Schema-Eingriff); neue neunte Regel „Zielabdeckung" in den Didaktischen Empfehlungen (💡 wenn ein Ziel mit keiner Einheit verknüpft ist, still ohne Ziele). **D62:** geführter Lernziel-Editor als modaler Baukasten (Phase → Verb → Inhalt → Satz-Vorschau), aufrufbar am Lernziele-Feld des Einheiten-Modals (D21) und an den Seminarzielen (D61); die fünf Seminarphasen dienen als Stufen (Nutzer-Entscheidung: Phasen statt der klassischen Bloom-Stufen – Erfahrungserhebung eingeschlossen), die gewählte Phase wird im Einheiten-Modal als Seminarphase vorbelegt (D41). Präzisierung gegenüber D62 Punkt 2: Der Satz lautet grammatisch korrekt „Die Teilnehmenden können [Inhalt] [Verb]" (deutscher Infinitiv am Satzende), nicht „[Verb] [Inhalt]". Beides auf Staging (moodle501umbau) browser-verifiziert. Damit ist der gesamte Umsetzungs-Backlog abgearbeitet (offen nur noch technische Aufräumpunkte).
- 13. Juli 2026 (bi): Die unter (bh) beschriebene Verfeinerung als **formale Entscheidung D63** ins Dokument aufgenommen (Abschnitt 3). D-Range in Abschnitt 9 auf D1–D63 aktualisiert.
- 13. Juli 2026 (bh): **Verfeinerung der Vorschlagsmechanik (D14/D6)** auf Nutzer-Befund (Claude Code, Version 2026071505): Die Einheiten, die laut Themenplan zu einem reservierten Baustein gehören („GEPLANT, NOCH NICHT PLATZIERT"), waren bisher reine Info-Zeilen und verschwanden zudem komplett, sobald man EINE Einheit platzierte (der „teilweise gefüllt"-Zweig zeigte sie nicht mehr). Sie tauchten auch nicht in den generischen Bibliotheks-Vorschlägen auf (die matchen per Stichwort/Bloom, nicht die Baustein-eigenen Einheiten). Jetzt: jede noch nicht platzierte geplante Einheit bekommt einen **„＋ Platzieren"-Button** (setzt genau diese Einheit in die Reservierung, verkleinert sie um ihre Dauer – wie beim Vorschlag-Übernehmen); die Liste **bleibt nach dem Platzieren sichtbar** und zeigt die übrigen offenen Einheiten (bis die Reservierung aufgebraucht ist); die generischen Bibliotheks-Vorschläge bleiben darunter (Nutzer-Wahl: geplant zuerst, Vorschläge darunter; kein Sammel-„Alle platzieren"-Button). Zusätzlich (Nutzer-Wunsch): die Baustein-eigenen geplanten Einheiten werden aus den generischen Bibliotheks-Vorschlägen **ausgeschlossen** (`renderSuggestions` gibt die Planungs-Refs als `excluderefs` an `suggestFor`), damit dieselbe Einheit nicht doppelt (oben als „＋ Platzieren", unten als Vorschlag) erscheint. Kandidat für eine formale eigene Entscheidung (D63), falls gewünscht. Auf Staging browser-verifiziert (90→80 Min. Reservierung nach Platzieren einer 10-Min.-Einheit, restliche geplante Einheiten sichtbar geblieben).
- 13. Juli 2026 (bg): **D53 umgesetzt** (Claude Code, Version 2026071504): achte Regel „Zeitrahmen-Hinweis" in den Didaktischen Empfehlungen (nach dem Pausenhinweis). Kapazität = Summe aller Vormittag-/Nachmittag-Anker-Fenster über alle Tage (D45-An-/Abreise-Anker zählen 0), verplant = Summe aller Platzierungen (Einheiten + Pausen), analog zum Anker-Budget-Balken. Drei Fälle im etablierten Ton: überfüllt → 💡 „etwas mehr geplant, als der Zeitrahmen hergibt", deutlich zu leer (>25 % und >1 Std. frei) → 💡 „noch reichlich Platz", sonst ✓ „passt gut in den Zeitrahmen" (jeweils mit „verplant/Rahmen" in Std./Min.). Still bei fehlenden Anker-Zeiten oder leerem Plan. Info-Text des Empfehlungs-Toggles um „Zeitrahmen" ergänzt. Auf Staging (moodle501umbau, cmid 83) browser-verifiziert. Damit ist im Umsetzungs-Backlog nur noch D61+D62 offen (plus Aufräumpunkte).
- 13. Juli 2026 (bf): **D52 umgesetzt** (Claude Code, Version 2026071503): dritter PDF-Button „Materialliste-PDF erstellen" im Import/Export-Tab neben ZIM/Konzeptsammlung — je Seminartag eine über alle Einheiten **deduplizierte** Materialliste im Abgabelisten-Layout (Kästchen zum Abhaken), leerer Plan bekommt eine Hinweisseite. Dazu **dauerhaftes Logo-Setting je Aktivität**: Upload (Bild) + Positions-Auswahl (oben rechts/links) im Aktivitäts-Bearbeiten-Formular (neue Spalte `logoposition`, Datei in Filearea `logo`); das Logo fließt automatisch in den Seitenkopf **aller** PDF-Exporte (ZIM, Konzeptsammlung, Materialliste). Auf Staging (moodle501umbau) browser-verifiziert (Materialliste mit Echtdaten inkl. Dedup, Logo als Bild in allen drei Exporten, Fallback bei leerem Plan). Damit ist Thema C (D51/D54/D58/D52) vollständig umgesetzt; offener Umsetzungs-Backlog nur noch D53, D61, D62.
- 13. Juli 2026 (be): Gruppengröße-Feld (D26/D40) von der im Code vorhandenen 7-Werte-Skala (1 / 2-3 / 3–5 / 6–12 / 13–24 / 25+ / beliebig) auf **drei Cluster** umgestellt: **Gruppenarbeit (2-5)**, **Plenum (10-20)**, **beliebig**. Gilt für Editor (Bibliothek + Sequenz-Modal), beide Filter (Bibliothek + Grid), Bulk-Bearbeitung und Import-Validierung. Bestandsdaten werden beim Upgrade umgerechnet (Nutzer-Entscheidung: 2–5 → Gruppenarbeit, 6+ → Plenum, Einzelarbeit/unbekannt → beliebig) — in mod (Method-Cards-JSON) und local (`local_kgen_method`). Reine Umsetzung/Vereinfachung, kein Widerspruch zu D40 (Feld bleibt bestehen, nur die Skala wird zu Clustern). Auf Staging verifiziert.
- 13. Juli 2026 (bd): Umsetzung von Thema C „Einreichen/Austausch abschließen" gestartet (Claude Code). **D51 umgesetzt und dabei präzisiert:** Die Weggabelung „Was möchtest du einreichen?" bekommt **drei** statt zwei Optionen – die dritte („Ein Seminarkonzept einreichen") deckt den seit D51 hinzugekommenen D32-Block ab, der sonst als dauerhaft sichtbarer vierter Kasten die von D51 bekämpfte Verwirrung reproduziert hätte (vom Auftraggeber am 13. Juli bestätigt). D51 Punkt 1 entsprechend angepasst. Die beiden „bestehende Sammlung"-Blöcke sind zu einem durchgängigen Ablauf (1. Sammlung wählen → 2. Kandidaten prüfen → 3. Update-Hinweis → einreichen) verschmolzen. **D58 umgesetzt:** öffentliche Konzeptverantwortlichen-Liste im Einreichen-Tab (nur Name, kein Kontaktweg), neue Opt-in-User-Preference `mod_seminarplaner_konzeptverantwortliche_public` (Default aus), Opt-in-Schalter nur für Nutzer:innen mit `local/seminarplaner:reviewset`-Capability sichtbar. Beide auf Staging (moodle501umbau) browser-verifiziert. Backlog-Punkte D51/D58 damit erledigt. Verbleibend in Thema C: D54 (Auto-Update-Hinweis) und D52 (PDF-Materialliste + Logo).
- 12. Juli 2026 (bc): D61 und D62 ergänzt. D61: neues Feld „Seminarziele" am Gesamtplan (Freitext, manuell gepflegt, unabhängig von D19), manuelle Verknüpfung mit Seminareinheiten statt automatischem Freitext-Abgleich, neue neunte Regel „Zielabdeckung" in den Didaktischen Empfehlungen. D62: Lernziel-Editor nach Vorbild von `moodle-local_differentiator`/„The Differentiator" (Bloom-Stufe → Verb → Inhalt frei, Satz-Zusammenbau), gilt für D21-Lernziele und D61-Seminarziele gleichermaßen, nutzt die D41-Tabelle für eine Seminarphasen-Vorbelegung mit, kein neues Datenfeld (kein Widerspruch zu D40), Bestandsdaten migrieren nicht automatisch. Backlog um zwei Umsetzungspunkte ergänzt. D-Range in Abschnitt 9 auf D1–D62 aktualisiert.
- 12. Juli 2026 (bb): D60 um expliziten Umsetzungsstand ergänzt, auf Nachfrage: Die Umbenennung ist bereits vollständig im Code umgesetzt (Commit 12d9b6c) – D60 zieht nur das Konzeptdokument nach, kein Arbeitsauftrag für Claude Code, kein Backlog-Punkt.
- 12. Juli 2026 (ba): D60 ergänzt: Begriff „Dramaturgie-Check"/„Dramaturgie-Blick" durchgängig auf „Didaktische Empfehlungen" umgestellt – bestätigt eine bereits in Claude Code auf Nutzerwunsch umgesetzte Umbenennung (Commit 12d9b6c, 10. Juli). Fachliche Grundidee aus D15 unverändert, nur der Name ändert sich. Alle Fließtext-Erwähnungen in D15, D22, D23, D25, D27, D53 sowie Abschnitt 1, 6, 8, 10 umgestellt (Änderungshistorie unverändert, wie schon bei D38). „Dramaturgie" (pädagogischer Grundbegriff) und „Dramaturgie-Vorlage" (D3/D4) bleiben unberührt, da eigenständige Begriffe. D-Range in Abschnitt 9 auf D1–D60 aktualisiert.
- 12. Juli 2026 (az): Abgleich mit dem von Claude Code geschriebenen Arbeitsstand (`seminarplaner-umbau-stand.md`, Stand 10. Juli). Backlog (Abschnitt 7) aktualisiert: Bausteine-Tab-Aufräumpunkt als erledigt markiert (Commit 4b2f8ff), neuer technischer Folgepunkt „planningmode.php/methods.js stilllegen" ergänzt; neuer A11y-Punkt „Touch-Alternative für Drag & Drop" ergänzt; D57-Umsetzungspunkt als bereits erledigt markiert – die Spalte `concepttype` existierte schon vor der D57-Entscheidung (Commits 9f67f79/689303d, 10. Juli), D57 bestätigt nachträglich eine bereits gebaute Lösung; neue offene Konzeptfrage „Eigener Seitenkopf mit Logo in der Weboberfläche" aufgenommen (von D52/PDF-Logo zu unterscheiden). Abschnitt 8 (Rollout-Status) aktualisiert: Block 3 jetzt als abgeschlossen markiert, Block 4 als „in Arbeit" mit Stand der Etappe 1. Offene Rückfrage gestellt: Umbenennung „Dramaturgie-Check"/„Dramaturgie-Blick" → „Didaktische Empfehlungen" in der Weboberfläche (Nutzerwunsch, in Claude Code direkt umgesetzt) – noch nicht ins Konzeptdokument übernommen, da das mehrere bestehende Entscheidungen (D15, D22, D23, D53) betrifft.
- 12. Juli 2026 (ay): D59 ergänzt, angestoßen durch Rückmeldung aus Claude Code (letzte offene Frage aus den „Nächsten Schritten", Punkt 10): UX-Konzept „Bibliothek beim Planbau" final entschieden – Suchen-und-Ablegen direkt an der D14-Vorschlagsstelle in der Sequenzansicht (Erweiterung eines bestehenden Musters statt neuem Bedienkonzept), zusätzlich bleibt der Bibliothek-Tab (D50/D55) als zweiter, unabhängiger Weg zum freien Stöbern vollständig erhalten. Löst D33-UX, Punkt 10 der „Nächsten Schritte" (Abschnitt 8) und den entsprechenden Backlog-Punkt final ab. D-Range in Abschnitt 9 auf D1–D59 aktualisiert.
- 12. Juli 2026 (ax): Rückfrage zu „D32 ebenfalls" aus (aw) geklärt: gemeint war die Unterscheidung zwischen Seminarkonzept und Methodensammlung, an der kurz zuvor bereits gearbeitet wurde – als durch **D57** (explizites Typ-Feld in `local_seminarplaner`) abgedeckt eingestuft, kein separater Backlog-Punkt nötig.
- 12. Juli 2026 (aw): Drei Umsetzungslücken laut Rückmeldung aus Claude Code als erledigt im Backlog (Abschnitt 7) vermerkt: Drag & Drop (seit Commit `4a179a8` wieder funktionsfähig, beide Bedienwege aus D47 funktionieren jetzt nebeneinander), Überblick/Sequenz-Synchronisation (D49 vollständig einsatzbereit), Rich-Text-Editor im Sequenz-Modal (D17-Grundsatz an allen drei Einstiegen erfüllt). Reine Ist-Stand-Aktualisierung, keine neuen Konzeptentscheidungen. Rückfrage zu einem vierten genannten Punkt („D32 ebenfalls") gestellt, da unklar, welcher Backlog-Bezug dort gemeint ist.
- 12. Juli 2026 (av): D58 ergänzt (vierter und letzter der priorisierten Schnellpunkte): Konzeptverantwortliche werden über eine allgemeine, opt-in-basierte Übersichtsliste sichtbar gemacht (nicht objektbezogen am einzelnen Konzept), Opt-in gilt pro Person für alle ihre betreuten Konzepte, reines Vertrauens-/Orientierungssignal ohne Kontaktweg-Funktion. Backlog-Punkt ergänzt. Damit sind alle vier priorisierten Schnellpunkte (D52–D54, D58) sowie die daraus entstandenen Folgethemen (D55–D57) abgeschlossen. D-Range in Abschnitt 9 auf D1–D58 aktualisiert.
- 12. Juli 2026 (au): D55, D56 und D57 ergänzt (letzter der vier priorisierten Schnellpunkte war D54; diese drei kamen als direkte Folgethemen dazu, Nachtrag korrigiert eine Auslassung – D55/D56 waren zuvor nur besprochen, nicht geschrieben worden). D55: Bibliothek bekommt drei Tabs („Methodensammlungen" immer durchsuchbar, „Globale Seminarkonzepte" nur nach explizitem Import, „Lokale Seminareinheiten" für alle eigenständigen lokalen Kopien) statt einer durchgehenden Liste – präzisiert D50. D56: Vorschlagsmechanik (D14) durchsucht künftig auch globale Methodensammlungen, nicht nur lokal Vorhandenes. D57: `local_seminarplaner` bekommt ein explizites Typ-Feld Methodensammlung/Seminarkonzept (bisher nur Titel-Konvention) – Konsequenz aus D55, D32 unverändert. Backlog um drei Umsetzungspunkte ergänzt. D-Range in Abschnitt 9 auf D1–D57 aktualisiert.
- 12. Juli 2026 (at): D54 ergänzt (dritter von vier priorisierten Schnellpunkten, löst zugleich den zurückgestellten Backlog-Punkt „Konfliktfall beim Auto-Update"): Auto-Update-Checkbox entfällt ersatzlos aus dem Import/Export-Tab; stattdessen automatischer Hinweis in der Bibliotheks-Kartenansicht, sobald eine übernommene globale Seminareinheit aktualisiert wurde. Lokale Änderungen haben immer Vorrang, keine stille Überschreibung – konkretisiert D30. Backlog entsprechend bereinigt (Konfliktfall-Punkt als final beantwortet markiert, neuer Umsetzungs-Punkt ergänzt). D-Range in Abschnitt 9 auf D1–D54 aktualisiert.
- 12. Juli 2026 (as): D53 ergänzt (zweiter von vier priorisierten Schnellpunkten): neue, achte Dramaturgie-Check-Regel „Zeitrahmen-Hinweis" – gleicht die Summe aller geplanten Bausteine gegen den automatisch aus Seminartagen + Anker-Zeiten (D45) ermittelten Zeitrahmen ab, kein zusätzliches Eingabefeld für offiziell gebuchte Stunden. Gleicher Hinweis-Ton wie D15/D22/D23. Backlog-Punkt ergänzt. D-Range in Abschnitt 9 auf D1–D53 aktualisiert.
- 12. Juli 2026 (ar): D52 ergänzt (erster von vier priorisierten Schnellpunkten aus der Lücken-Analyse): PDF-Export bekommt eine eigenständige, dritte Export-Option „Materialliste-PDF" (dedupliziert, den Seminartagen zugeordnet, Layout als Abgabeliste), dazu ein dauerhaft pro Aktivität gespeichertes Logo-Setting (Upload + Position rechts/links im Seitenkopf), das automatisch in alle PDF-Exporte einfließt. Backlog-Punkt für die Umsetzung ergänzt, Sequenzansicht-für-Referentinnen-Idee als Konkretisierung beim bestehenden Backlog-Punkt „Durchführungsmodus" nachgetragen (kein eigener Beschluss). D-Range in Abschnitt 9 auf D1–D52 aktualisiert.
- 12. Juli 2026 (aq): Acht offene konzeptionelle Fragen aus der Lücken-Analyse (Perspektive Bildungsreferentin bei Neuerstellung / ehrenamtlicher Referent bei Durchführung) in den Backlog (Abschnitt 7) aufgenommen: Entwurfsstatus für neue Seminarkonzepte, „Als Vorlage nehmen" für ganze Konzepte, Durchführungsmodus (inkl. Sessionplan.de-Live-Modus als Referenz), Live-Abweichungen während der Durchführung, Rückkanal nach der Durchführung, Konfliktfall beim Auto-Update, offene Schnittstelle als OER-Prinzip, Anbindung an Sessionplan.de. Noch keine Entscheidungen – bewusst zurückgestellt, vier eng umrissene Punkte (Materialcheck, Gesamtzeit-Check, Sichtbarkeit bei Auto-Update, Transparenz der Konzeptverantwortlichen) werden als Nächstes einzeln durchgegangen.
- 12. Juli 2026 (ap): D51 ergänzt (Screenshot-Anlass, Tab „Einreichen"): Weggabelung vor den Formularen der Einreichen-Seite („Was möchtest du einreichen?" mit den Optionen „bestehende Sammlung ergänzen" / „neue Sammlung zusammenstellen") sowie Zusammenführung der beiden bislang getrennten, fast wortgleich betitelten „bestehende Sammlung"-Blöcke zu einem einzigen Ablauf. Der obere Info-Bereich (4-Schritte-Erklärung, Statusliste) bleibt unverändert, da er ein anderes Verständnisproblem bereits gut löst. Neuer Backlog-Punkt für die Umsetzung durch Claude Code ergänzt. D-Range in Abschnitt 9 auf D1–D51 aktualisiert.
- 10. Juli 2026 (ao): Neue offene Umsetzungslücke im Backlog (Abschnitt 7) ergänzt: Rich-Text-Editor fehlt im aus der Sequenzansicht geöffneten Einheiten-Editor-Modal (Screenshot-Anlass) – Lernziele, Kurzbeschreibung, Ablauf, Risiken, Debrief und Materialien/Technik zeigen aktuell rohe HTML-Tags statt des Moodle-Editors, obwohl dieser in library.php/methodlibrary.php für dieselben Felder bereits korrekt eingebunden ist. Kein neuer Konzeptbeschluss, sondern technischer Nachholbedarf (Anschluss an D17), analog zu D47/Überblick-Sync vermerkt.
- 10. Juli 2026 (an): D50 ergänzt (Revision von D39, Screenshot-Anlass): Tab „Seminareinheiten" heißt künftig „Bibliothek" und enthält nur noch die durchsuchbare Sammlung – der separate „Anlegen"-Bereich aus D39 entfällt, „Neue Seminareinheit anlegen" wird stattdessen Button innerhalb der Bibliothek (öffnet weiterhin den D17-Modal). Zusätzlich neuer, gleichwertiger Einstiegspunkt in der Sequenzansicht direkt an der bestehenden „Einheit/Pause hinzufügen"-Stelle. Beantwortet damit final den bisher offenen Backlog-Punkt „vierter Einstieg zum Einheiten-Editor". D16-Tabelle und Backlog-Punkt entsprechend angepasst. D-Range in Abschnitt 9 auf D1–D50 aktualisiert.
- 5. Juli 2026 (a): D8 bis D13 ergänzt (Auflösung der Fragen 1, 2, 3, 5, 6), D5 durch D13 revidiert, Backlog und nächste Schritte aktualisiert.
- 5. Juli 2026 (b): D3 präzisiert – Baustein-Fortsetzung über Anker/Tage hinweg möglich; kein automatisches Ausdehnen bei Überlauf, stattdessen geführte Verschiebe-Aktion.
- 5. Juli 2026 (c): Zwei neue offene Fragen aufgenommen – Frage 7 (Vorschlagsmechanik aus D4 konkretisieren) und Frage 8 (D7-Tab-Benennung präzisieren: Tabs bleiben, Benennung nach Tätigkeiten).
- 5. Juli 2026 (d): D14 ergänzt (Vorschlagsmechanik, Auflösung von Frage 7); Gruppengröße als Vorschlagskriterium gestrichen, D4 entsprechend angepasst.
- 5. Juli 2026 (e): D14-Praxiskontext korrigiert – Bibliothek kann über importierte globale Methodensets auch große Pools enthalten (Filternetz trennt die Sets); Vorschlagsmechanik muss kleine und große Pools bedienen.
- 5. Juli 2026 (f): D15 ergänzt (Dramaturgie-Check, Auflösung von Frage 4): nur Hinweise, sechs Kandidaten-Regeln, Stille bei fehlenden Daten, positive Formulierung; Schwellenwerte und Feinschliff für den Referentinnen-Workshop reserviert.
- 5. Juli 2026 (g): D16 ergänzt (Tab-Struktur, Auflösung von Frage 8): sechs Tabs entlang des Zielflusses, Bausteine-Tab entfällt, Seminareinheiten + Bibliothek verschmelzen zu „Methoden", Grid wird eigener Tab „Überblick", Review wird „Einreichen" (Alternative: „Weitergeben"). Alle offenen Fragen aufgelöst.
- 5. Juli 2026 (h): D17 ergänzt (Einheiten-Editor als Modal über der Sequenz, ein Editor mit drei Einstiegen) und D18 (Tab heißt „Seminareinheiten" statt „Methoden"; „Seminareinheit" wird führender UI-Begriff). D16-Tabelle entsprechend angepasst.
- 5. Juli 2026 (i): Merker im Backlog ergänzt – Editor-UX der Seminareinheiten-Felder (Feld-für-Feld-Gestaltung des D17-Modals) für später vorgemerkt.
- 5. Juli 2026 (j): Wireframe v2 fertiggestellt – Einheiten-Editor-Modal (D17) mit drei Einstiegen eingebaut, Tab-Beschriftung auf „Seminareinheiten" (D18) korrigiert. Schritt 4 abgeschlossen.
- 5. Juli 2026 (k): D16 um Abgrenzung „Austauschen" (alles, was die Plugin-Grenze überquert) vs. „Seminareinheiten" (Arbeiten mit dem, was da ist) ergänzt.
- 5. Juli 2026 (l): Begleitdokument „workshop-fragen.md" angelegt – sammelt alle für den Referentinnen-Workshop reservierten Fragen (D15-Regeln, Begriffe, Wireframe-Test).
- 6. Juli 2026 (m): D19 ergänzt (Themenplan-Parser-Spezifikation, Abschluss von Schritt 5): Best-Effort mit Import-Bericht, Erkennung organisatorischer Blöcke über leere Kompetenzerwartungen-Zelle, Wochentags-Mapping auf Seminartage, Kopfblock wird ignoriert. Abschnitt 4 auf D19 verwiesen, Backlog-Punkt Parser aktualisiert.
- 6. Juli 2026 (n): D20 ergänzt (Datenmodell für Sequenz, Anker-Platzierung und zweistufige Alternativen; Abschluss von Schritt 6): Platzierung liegt an der einzelnen Seminareinheit, nicht am Baustein – löst Baustein-Fortsetzung ohne Sonderfall; Baustein-Varianten (D8) tauschen als unterschiedlich lange Pakete auf einmal. Abschnitt 5 und Backlog-Punkt „Export platzierter Pläne" auf D20 verwiesen, Schritt 7 (Referentinnen-Workshop) neu aufgenommen.
- 6. Juli 2026 (o): D21 ergänzt (Editor-UX der Seminareinheiten-Felder, löst den Backlog-Merker auf): Lernziele wandert in die Schnellfassung (Team-Planungs-Szenario), Reihenfolge entlang der Denk-Reihenfolge Titel → Lernziele → Kurzbeschreibung; Feld „Alternative Seminareinheiten" bleibt als Vorbelegung für Plan-Alternativen (Anschluss an D20). Neue Workshop-Frage „Felder-Inventur" in workshop-fragen.md aufgenommen (Überschneidungsgefühl Seminarphase / Kognitive Dimension; brauchen / nice to have / verzichtbar).
- 6. Juli 2026 (p): Wireframe v3 – reiner Gestaltungs-Durchgang, keine neue Entscheidung: Bildsprache auf „Flipchart-Tagesplan" umgestellt (marker-artige Farbakzente, ruhiger als die zuvor rein funktionale Optik von v2), damit das Klickdummy für den Referentinnen-Workshop einladend statt IT-lastig wirkt. Struktur, Datenmodell und alle Mechaniken (D3, D8, D14, D15, D17, D20, D21) unverändert – Datei bleibt „sequenzansicht-wireframe.html", weiterhin ohne echte Funktionalität dahinter.
- 6. Juli 2026 (q): Erste Ergebnisse des Referentinnen-Workshops eingearbeitet. D22 (Regeln 2/4/5/6 des Dramaturgie-Checks im Workshop bestätigt, Schwellenwert final), D23 (neue Kandidaten-Regel 7 „Pausenhinweis"), D24 (Tab-Name bleibt „Import/Export", Vorschlag „Austauschen" verworfen – D16 entsprechend korrigiert), D25 (neue grobe Angabe „Veranstaltungsgröße" am Gesamtplan: Seminar/Tagung, steuert künftig die Dramaturgie-Check-Tipps), D26 (Gruppengröße-Feld an der Seminareinheit auf drei Kategorien vereinfacht, korrigiert D21), D27 (Ein/Aus-Schalter für den Dramaturgie-Check, pro Referentin gespeichert). Noch offen aus dem Workshop: B1, B3, B4, B5 und der Wireframe-Test (Teil C) – siehe workshop-fragen.md.
- 6. Juli 2026 (r): B1 in workshop-fragen.md geschärft (dritte Option „Veröffentlichen" plus Nachfrage zum zweistufigen Prüf-Vorgang ergänzt). D28 ergänzt (Vier-Objekte-Modell: Seminareinheit / Methode / Methodenset / Seminarkonzept – Begriffsklärung nach Praxis-Rückmeldung des Auftraggebers, präzisiert D18 statt es zurückzunehmen) und D29 (neue globale Methoden-Bibliothek: bestehende Methodenset-Infrastruktur aus `local_seminarplaner` wird um „Methode" als eigenen, inhaltsfreien Objekttyp erweitert; Auffindbarkeit über das bestehende freie Tags-Feld mit Facetten statt eines neuen festen „Einsatzzweck"-Feldes – Grundlage: Analyse von 183 echten Methoden aus zwei vom Auftraggeber bereitgestellten Beispiel-Methodensets). Neue offene Frage 9 aufgenommen: globale Bibliothek auch für komplette Seminarkonzepte? workshop-fragen.md um empirische Stütze zu B5 ergänzt (Phase/Kognitive-Dimension-Korrelation aus echten Daten).
- 6. Juli 2026 (s): Vier reale Beispiel-Seminarkonzepte analysiert (Jugend1, FST, KI-Methoden, SEL-Einträge) – bestätigt die D28-Unterscheidung anhand eines echten Paars (FST als Seminarkonzept, KI-Methoden als zugehöriges Methodenset); zeigt außerdem, dass Bausteine im Bestand nur informell über Titel-Konventionen existieren, nicht als eigenes Feld, und dass Seminarphase mehrwertig sowie Zeitbedarf nicht immer numerisch sein kann (Merkposten, noch keine Entscheidung). Frage 9 um diesen Befund ergänzt: D20-Datenmodell würde für eine Seminarkonzept-Bibliothek ausreichen. D30 ergänzt (Sichtbarkeits-Grundsatz, vom Auftraggeber bestätigt): alle Objekte unabhängig vom Typ (D28) sind per Default nur innerhalb des jeweiligen Moodle-Kurses sichtbar, global nur nach explizitem Einreichen mit Konzeptverantwortlichen – gilt für D29 und für eine mögliche künftige Seminarkonzept-Bibliothek gleichermaßen.
- 6. Juli 2026 (t): D31 ergänzt (Klarstellung zu D14/D15/D21): Seminarphase bleibt einwertig – die mehrwertigen Altdaten aus (s) waren eine Unsauberkeit des bestehenden Tools, keine gewünschte Eigenschaft; keine der betroffenen Entscheidungen ändert sich. Zeitbedarf als Auswahlfeld mit Überlaufkategorie („mehr als 180 Minuten") vom Auftraggeber als ungenau bestätigt, aber als offener Backlog-Punkt zurückgestellt, bis das Seminareinheiten-Formular (D21) im Detail besprochen wird.
- 7. Juli 2026 (u): Frage 9 abschließend geklärt. D32 ergänzt (löst Frage 9): Seminarkonzepte und Methodensets nutzen ohne Unterscheidung denselben bestehenden Mechanismus für globale Konzepte (Einreichen → Konzeptverantwortliche → Status-Zyklus → Filter global/lokal im Import/Export-Tab) – der bestehende Review-Workflow war ursprünglich für Seminarkonzepte entwickelt, keine neue Infrastruktur nötig. D33 ergänzt (Erweiterung zu D29): globale Methodensets sollen künftig immer über die Bibliotheksansicht durchsuchbar und direkt für die Planerstellung nutzbar sein, ohne vorherigen Set-Import; eine daraus übernommene Seminareinheit wird sofort als eigene, lokal editierbare Kopie angelegt (wie heute nach Import), keine Live-Verknüpfung zum globalen Original. UX-Konzept für die Einbindung dieser Bibliotheksansicht in den Planbau folgt als eigener Schritt.
- 7. Juli 2026 (v): Neue Wireframe-Datei „sequenzansicht-wireframe-vertraut.html" erstellt – reiner Gestaltungs-Durchgang (analog zu Wireframe v3, Entry p), keine neue Richtungsentscheidung: Chrome (Tab-Leiste, Buttons, Formularfelder, Kartenoptik) an die bestehende Plugin-Oberfläche angelehnt, um die Reaktion „ungewohntes Layout" bei Kolleg*innen zu adressieren. Struktur unverändert (D3, D8, D10, D11, D14, D15, D17, D20, D21, D22–27, D31). D34 ergänzt (Übergangsstrategie): Ein Umschalter zwischen altem Grid und neuer Sequenzansicht als zwei parallele Bearbeitungswege wurde geprüft und verworfen, da es sich um zwei unterschiedliche Herangehensweisen (nicht nur Ansichten) handelt und Baustein-Varianten (D20) nicht bruchlos auf das alte Grid-Slotkey-Muster übertragbar sind. Stattdessen drei Hebel ohne Parallelbetrieb: Grid bleibt reine Überblicksansicht (D11), einmalige Übersetzungs-Anzeige beim ersten Öffnen eines Bestandsplans, gestaffelter visueller Übergang (Chrome-Variante „Vertraut" → später Flipchart-Optik).
- 7. Juli 2026 (w): D35 ergänzt (Konkretisierung zu D34, Übersetzungs-Anzeige): Umfang auf einen Beispieltag mit echten eigenen Daten der Referentin begrenzt (Hinweistext deckt übrige Tage ab), Sichtbarkeit auf „pro Referentin einmal je Plan" festgelegt (nicht global je Plan) – Speicherung je Plan+Nutzerin-Kombination, Anschluss an die bestehende Tabelle für nutzerbezogenen Grid-Zustand. Nächste-Schritte-Punkt 11 entsprechend präzisiert.
- 7. Juli 2026 (x): D36 ergänzt (Korrektur zu D34 Punkt 3): Kein mehrstufiger optischer Übergang (Chrome „Vertraut" → „Weicher" → „Flipchart") – die Optik bleibt dauerhaft bei „Vertraut", Wireframe v3s Flipchart-Optik bleibt reines Diskussionsartefakt für den Workshop-Vergleich, nicht das Zielbild. Der eigentliche „Übergang" ist ausschließlich der Mechanismus-Wechsel Grid-Logik → Sequenzlogik, bereits durch D35 (automatisierte, einmalige Übersetzungs-Anzeige beim ersten Öffnen eines Bestandsplans) abgedeckt. Nächste-Schritte-Punkt 11 damit erledigt.
- 7. Juli 2026 (y): Workshop-Ergebnis zu B1 eingearbeitet. D37 ergänzt (B1 final): Tab heißt „Einreichen" – „Weitergeben" und „Veröffentlichen" verworfen. Workshop zeigte zusätzlich: Auch bei „Einreichen" war nicht von selbst klar, dass danach noch eine Prüfung durch Konzeptverantwortliche folgt. Konsequenz: Der Tab bekommt eine sichtbare Prozess-Erklärung als Flussdiagramm (Einreichen → Prüfung → Sichtbar für andere), unabhängig vom eingereichten Objekt (Seminareinheit/Methodenset/Seminarkonzept, D28/D32). D16-Tabelle und Abschnitt 6 entsprechend aktualisiert.
- 7. Juli 2026 (z): Workshop-Ergebnis zu B3 eingearbeitet. D38 ergänzt (B3 final): Begriff „Methodenset" ersetzt durch „Methoden-Sammlung" – klare Abgrenzung zu „Seminarkonzept" (D28), da „Sammlung" von selbst signalisiert, dass kein Ablauf enthalten ist. Begriff durchgängig in D28–D33, D37, Abschnitt 4/6/7/9 aktualisiert (Änderungshistorie bleibt wie üblich unverändert). workshop-fragen.md restrukturiert: bereits beantwortete Punkte (Teil A, B1, B2) in einen eingeklappten Archiv-Abschnitt am Dokumentende verschoben, oben stehen nur noch B4, B5 und Teil C.
- 7. Juli 2026 (aa): Workshop-Ergebnis zu B4 (Teilaspekt Seminareinheiten-Tab) eingearbeitet. D39 ergänzt: Workshop-Test zeigte reale Erwartungslücke – Referentinnen suchen im Tab „Seminareinheiten" zuerst das Eingabeformular, finden das Durchsuchen nicht sofort; „Bibliothek" als Begriff wurde dagegen klar verstanden. Tab-Name „Seminareinheiten" bleibt (D16/D18 nicht zurückgenommen), bekommt aber zwei benannte Unterbereiche „Anlegen" und „Bibliothek". Konkrete UI-Umsetzung (Unter-Tabs, Nebeneinander, Umschalter) bleibt offen.
- 7. Juli 2026 (ab): Backlog-Idee ergänzt (Anschluss an D17/D39, kein Konzeptbeschluss): ein vierter, jederzeit erreichbarer Einstieg zum Einheiten-Editor („Seminareinheit hinzufügen"-Button unabhängig vom aktuellen Tab/View), vom Auftraggeber als mögliche künftige Ergänzung vorgeschlagen. Konkrete Gestaltung (Position, Geltungsbereich) bleibt Design-Detailarbeit.
- 7. Juli 2026 (ac): Workshop-Ergebnis zu B5 eingearbeitet. D40 ergänzt (B5 final): Kognitive Dimension entfällt zugunsten der Seminarphase (trotz D29-Befund, dass beide Felder in der Mitte der Taxonomie unterschiedliche Information tragen – Doppelpflege wog stärker), Komplexitätsgrad entfällt ersatzlos, Gruppengröße (D26) und Farbcodierung über Seminarphase (D3) bestätigt unverändert, Rest der ~18 Felder bleibt. Zusätzlicher Workshop-Wunsch „Formular insgesamt angenehmer bedienbar machen" als Backlog-Idee aufgenommen. D21-Feldliste entsprechend gekürzt.
- 7. Juli 2026 (ad): D41 ergänzt (direkte Folge von D40): Bloom-Verb-Mapping in der Vorschlagsmechanik (D14) zielt jetzt auf die Seminarphase statt auf die gestrichene Kognitive Dimension, mit ausformulierter Zuordnungstabelle (Erinnern→Orientierung, Verstehen/Analysieren→Analyse, Anwenden→Handlungsteil, Bewerten/Erschaffen→Transfer). Erfahrungserhebung bewusst ausgeklammert (deckt sich mit dem D29-Befund, dass diese Phase sich einer Bloom-Zuordnung entzieht) – dort greift weiterhin nur der Stichwort-Abgleich. D14 und D15 entsprechend angepasst.
- 7. Juli 2026 (ae): `sequenzansicht-wireframe-vertraut.html` um alle sieben Teil-C-Interaktionen ergänzt (Überlauf-Banner C1, Baustein-Varianten als Pillen C2, Einheiten-Variante als ⇄-Chip mit Popover C3, Lücke mit Vorschlagskarten C4, Speichern-Toast C5, Dramaturgie-Blick C6, „＋ Überschrift geben" C7), damit der Workshop-Test darauf statt auf der Flipchart-Fassung durchgeführt werden konnte. Workshop-Ergebnis eingearbeitet: D42 ergänzt – sechs von sieben Interaktionen ohne Änderung bestätigt, C1 korrigiert (Überlauf-Hinweis muss ans Ende des überlaufenden Ankers, nicht an dessen Kopf). Teil C damit abgeschlossen, gesamte Workshop-Fragensammlung durchgearbeitet.
- 7. Juli 2026 (af): Neuer Abschnitt 8 „Entwicklungs- und Rollout-Strategie" ergänzt (Feature-Branch, Staging mit echter Datenkopie, schrittweise Umsetzung entlang der Entscheidungsreihenfolge, Schema-Änderungen über `upgrade.php`, koordinierter Umstieg statt gestaffelter Freischaltung). D43 ergänzt (Präzisierung zu D35/D36): Die Grid→Sequenz-Umrechnung läuft als Upgrade-Schritt beim Plugin-Update, nicht live beim ersten Öffnen durch die Referentin – die Übersetzungs-Anzeige selbst bleibt unverändert, zeigt aber nur noch bereits umgerechnete Daten. Abschnitte 8–9 zu 9–10 verschoben. Zusätzliches Skill `git-branch-guard-seminarplaner` erstellt: verhindert versehentliches Auslösen der bestehenden Deploy-/Release-Skills (Ziel github/main, gitlab „51") während der Umbau-Arbeit auf dem Feature-Branch – in Abschnitt 8 referenziert.
- 7. Juli 2026 (ag): D44 ergänzt: Klärung der Arbeitsteilung zwischen diesem Claude.ai-Projekt (bleibt Ort für neue Konzeptentscheidungen) und Claude Code (Implementierung, mit einer Repo-Kopie des Konzeptdokuments unter `docs/`). Push-Regeln im Skill `git-branch-guard-seminarplaner` präzisiert: Commits/Pushes auf den Feature-Branch nach GitHub sind normaler Alltag, keine Rückfrage nötig; gesperrt bleiben ausschließlich ein Merge auf GitHub `main` und jeder Push nach GitLab (unabhängig vom dortigen Ziel), bis explizit eine stabile, produktionsreife Version erklärt wird. Neues Briefing-Dokument `claude-code-briefing-seminarplaner.md` erstellt (Kurzreferenz D20/D19/D43 u. a. für den Einstieg in Claude-Code-Sessions).
- 9. Juli 2026 (ah): D45 ergänzt: Übertragung der bestehenden Grid-Einrichtungs-Vorlagen (Wochentage/erster Tag/Zeitbereich/Pausenliste) auf die Anker-Logik der Sequenzansicht. Die sechs Vorlagen bekommen feste Vormittag-/Nachmittag-Zeiten (mit optionaler Abweichung am ersten/letzten Tag, z. B. Wochenendseminar Fr nur Nachmittag/So nur Vormittag – konkrete Uhrzeiten noch offen), bleiben aber reine Vorbelegung und frei editierbar. Die alten Setup-Felder „Zeitbereich" und „Pausenzeiten" entfallen zugunsten der Vorlagen-Zeiten; kurze Zwischenpausen laufen künftig über den bestehenden Pausenhinweis (D23). Migrationsregel für Bestandspläne ergänzt (Anschluss an D43): längste konfigurierte Pause bestimmt den Vormittag/Nachmittag-Schnitt, sonst Fallback 12:30. Abschnitt 8 (Rollout-Strategie) angepasst: D45 wird bewusst zu Block 3 gezogen, obwohl inhaltlich näher an Block 1/2, damit Claude Code sie in der laufenden Implementierung mitnimmt. D-Range in Abschnitt 9 auf D1–D45 aktualisiert.
- 9. Juli 2026 (ai): D46 ergänzt: Seminarplan-Auswahl ist ein dauerhaft sichtbarer Umschalter im Planen-Tab (Dropdown oberhalb der Sequenz), kein einmaliges Einstiegs-Gate – durch Screenshot aus der laufenden Entwicklung (Testplaner 5.1.4) bestätigt, bereits so umgesetzt. Löst die Frage, ob der Sequenzer einen an anderer Stelle angelegten Plan voraussetzt. Randnotiz aus demselben Screenshot: ein weiterhin sichtbarer „Bausteine"-Tab ist Entwicklungs-Überbleibsel, keine Revision von D16 (Tab entfällt bleibt gültig) – als Aufräum-Punkt in Abschnitt 7 vermerkt.
- 9. Juli 2026 (aj): D47 ergänzt (Korrektur zu D3): Drag & Drop wurde in der laufenden Entwicklung nicht beibehalten – Reihenfolge-Änderung in der Sequenzansicht erfolgt ausschließlich über ↑/↓-Buttons, bewusste Entscheidung für Barrierefreiheit (ein robuster Weg statt zweier paralleler). Grundidee von D3 (Reihenfolge bestimmt Zeiten, keine Zeitkonflikte) bleibt unverändert. A11y-Backlog-Punkt „Drag & Drop braucht Tastaturalternative" damit hinfällig.
- 9. Juli 2026 (ak): D47 korrigiert – Missverständnis aus dem vorigen Eintrag richtiggestellt: **Beide** Bedienwege sollen nebeneinander funktionieren, nicht nur Buttons statt Drag. ↑/↓-Buttons erfüllen die Tastaturalternative, Drag & Drop bleibt zusätzlich für Maus-/Touch-Nutzerinnen erhalten. Aktueller Stand (nur Buttons funktionieren, Drag & Drop ist derzeit nicht funktionsfähig) als offene Umsetzungslücke im Backlog vermerkt, nicht als Zielzustand. D3-Fußnote und A11y-Backlog-Punkt entsprechend angepasst.
- 9. Juli 2026 (al): D48 ergänzt (Revision von D13): Themenplan-Import läuft nicht mehr über einen PHP-Parser im Plugin, sondern wieder über die externe Seminarschmiede – Gründe: Pflegeaufwand des Plugin-Parsers, die Schmiede kann inzwischen mehr und wird ohnehin für KI-generierte Seminarkonzepte benötigt. Der Medienbruch aus D5 kehrt bewusst zurück (nicht technisch gelöst), als bewusste Abwägung, nicht als Wiederholung des alten Bequemlichkeitsarguments. D13 und D19 als revidiert bzw. hinfällig markiert (D19 bleibt als fachliche Referenz stehen, da bereits in der Schmiede umgesetzt). Abschnitt 4/5 und Backlog-Punkt „Themenplan-Parser" entsprechend angepasst. D-Range in Abschnitt 9 auf D1–D48 aktualisiert.
- 9. Juli 2026 (am): D49 ergänzt (Präzisierung zu D11/D34): Wochen-/Tages-Umschalter im Überblick entfällt ersatzlos (Überblick bleibt reiner Wochen-Gesamtblick, D11); Klick auf eine Seminareinheit im Überblick öffnet direkt den passenden Tag in der Sequenzansicht zum Bearbeiten, ergänzend zum bestehenden allgemeinen „Zur Sequenz wechseln"-Button (D34); Microcopy-Hinweis „Klicke auf eine Seminareinheit, um sie in der Sequenzansicht zu ändern" ergänzt. Anlass war eine Rückmeldung, dass Überblick und Sequenz in der laufenden Entwicklung nicht synchronisiert sind – dazu neuer Backlog-Punkt in Abschnitt 7 (Überblick lädt noch das alte Grid statt der Sequenz-Daten, D20; offene Umsetzungslücke, kein Konzeptthema, analog zu D47 vermerkt). D-Range in Abschnitt 9 auf D1–D49 aktualisiert.

---

## 1. Kontext und Zielgruppe

Der Seminarplaner ist ein Moodle-Aktivitätsplugin für die gewerkschaftliche Bildungsarbeit (IG Metall). Genutzt wird er von **hauptamtlichen Bildungsreferentinnen und ehrenamtlichen Referentinnen** – Pädagoginnen mit reichem Erfahrungsschatz, aber ohne akademische Ausbildung und mit **geringer IT-Kompetenz**. Daraus folgt als Leitprinzip für alle Entscheidungen:

> Metaphern und Begriffe müssen aus der Seminardidaktik kommen, nicht aus der IT. Die Stärke der Zielgruppe ist Pädagogik – das Tool muss diese Stärke ausspielen, nicht IT-Denkweisen (Kalenderraster, Dateisysteme) voraussetzen.

Beobachtetes Kernproblem aus Schulungen: **Abgrenzungsprobleme zwischen „Seminareinheit" und „Baustein"** – nicht nur begrifflich, sondern als Konflikt zweier mentaler Modelle (siehe Entscheidung D1).

Etabliertes Vokabular der Zielgruppe: „Baustein" = thematischer Teil eines Seminars, besteht meist aus **mehreren** Seminareinheiten. Eine ZIM-Zeile (Ziel – Inhalt – Methode) entspricht **einer Seminareinheit**, nicht einem Baustein.

## 2. Ist-Stand des Plugins (Kurzfassung aus dem Code-Review)

- Zwei Plugins: `mod_seminarplaner` (Kursaktivität) + `local_seminarplaner` (globale Methodenset-Verwaltung mit Review-Workflow draft/review/published/archived).
- Sieben Tabs für Verwaltende: Seminarplan (Grid), Roter Faden, Seminareinheiten, Bibliothek, Bausteine, Import/Export, Review. Nur-Leser sehen nur den Roten Faden.
- **Grid**: Kalenderartiges Raster (Tage × Zeit), Drag & Drop mit Pointer/Touch-Support, Resize-Handles, Pausen als Blocker, Autosave (700 ms Debounce + Intervall), Soft-Locks mit `breaklock`-Capability. Zeitkonflikte führen zu „Speichern abgelehnt … Plan wird neu geladen".
- **Baustein im Code**: eigenes Objekt mit Titel, eigener Dauer (Default 90 Min.), eigenen Lernzielen und Themen, Pool zugeordneter Seminareinheiten, Alternativen-Mechanismus. Im Grid zwei Quell-Modi: aus Einzelmethoden oder aus Bausteinen planen.
- **Seminareinheit**: ~18 Felder in drei Abschnitten (Schnellfassung / Ablauf und Rahmen / Materialien und Technik), nur Titel ist Pflicht. Fünf-Phasen-Taxonomie: Orientierung, Erfahrungserhebung, Analyse, Handlungsteil, Transfer (inkl. Alias-Normalisierung für Altdaten).
- **Roter Faden**: veröffentlichbarer Snapshot für Teilnehmende, strukturiert nach Tag und Vormittag (08:00–12:30) / Nachmittag (12:30–18:00).
- **Import/Export**: JSON-Format `seminarplaner-component-export` Version 3 als zentraler Austauschpfad, komponentenbasiert (Methoden / Bausteine / Seminarpläne) mit Vorschau-Auswahl je Eintrag. Außerdem mod_data-kompatible CSV/ZIP-Flows und PDF-Export (ZIM / Seminarverlauf).

## 3. Getroffene Richtungsentscheidungen

### D1 – Baustein wird reines Strukturelement, die Seminareinheit das führende pädagogische Objekt

Der Baustein verliert eigene Lernziele, eigene Themen als Bearbeitungsfelder und die eigene Dauer als festen Wert. Er wird zum „Verzeichnis" für Seminareinheiten: Titel, Unterthemen, Zuordnung – mehr nicht. Pädagogik (Lernziele, Ablauf, Methode) liegt ausschließlich bei den Seminareinheiten. Begründung: Das Tool gab dem etablierten IG-Metall-Begriff „Baustein" bisher eine abweichende Bedeutung (Slot mit eigener Didaktik statt Bündel von Einheiten) – daher die Verwirrung in Schulungen.

Verfeinerung zur Dauer: Eine **„geplante Dauer" bleibt als reiner Platzhalter** erhalten, der nur gilt, solange der Baustein leer ist (Grobplanung: Zeit reservieren, bevor Methoden feststehen). Sobald Einheiten zugeordnet sind, gilt automatisch deren Summe. Visualisierung: leerer Baustein = gestrichelter Rahmen („noch keine Einheiten – 90 Min. reserviert"), gefüllter Baustein = fester Rahmen mit Summendauer.

### D2 – Beide Erstellrichtungen werden unterstützt

Top-down (es gibt einen Themenplan): Bausteine stehen fest, werden zuerst angelegt/importiert und dann mit Einheiten gefüllt. Bottom-up (kein Themenplan): Referentinnen arbeiten aus ihren Einheiten heraus; dafür braucht es die Aktion **„Ausgewählte Einheiten zu Baustein zusammenfassen"**. (Weitergeführt und verallgemeinert durch D10: der Baustein ist eine jederzeit setz- und entfernbare optionale Überschrift.)

### D3 – Sequenzmodell statt Grid als Bearbeitungsfläche (SessionLab-Prinzip)

Die Planung eines Tages erfolgt künftig als **vertikale Sequenz** von Einheiten mit Dauer; Uhrzeiten werden vom Tagesstart aus **berechnet**, nicht manuell platziert. Reihenfolge ändern per Drag → alle Zeiten rücken automatisch nach. *Ergänzt durch D47: Zusätzlich zum Drag stehen ↑/↓-Buttons als gleichwertiger, barrierefreier zweiter Bedienweg zur Verfügung – beide Wege sollen nebeneinander funktionieren.* Konsequenzen:

- Zeitkonflikte sind konstruktiv unmöglich → die Fehlermeldung „Speichern abgelehnt, Plan wird neu geladen" entfällt ersatzlos.
- **Anker** statt freier Platzierung: Tagesstart/-ende und Pausen (existieren bereits in der Grid-Konfiguration) sind Fixpunkte. Überläufe werden als **Zeitbudget** angezeigt („Vormittag: 195 von 240 Min. belegt" / „+20 Min. über der Mittagspause – kürzen oder verschieben"), nie als Abweisung.
- Der Baustein ist in der Sequenz ein **Abschnitt** (Überschrift, gruppiert aufeinanderfolgende Einheiten, Summendauer automatisch) – deckungsgleich mit D1.
- Die fünf Seminarphasen werden als **Farbcodierung** der Einheiten genutzt → der Lernfluss (Orientierung → Transfer) wird visuell ablesbar.
- **Das Grid bleibt als Überblicks-/Leseansicht erhalten** (alle Tage nebeneinander, „Blick aufs Ganze"), ist aber nicht mehr die Bearbeitungsfläche. Bestätigt: fürs Planen eines Tages nicht hilfreich, als Overview wichtig.
- Datenmodell-Hinweis: Entries tragen bereits Tag + Start/Ende; die Sequenz ist daraus ableitbar (Sortierung), Migration überschaubar.

**Präzisierung: Baustein-Fortsetzung über Anker und Tage – kein automatisches Ausdehnen bei Überlauf.** Hier sind zwei Dinge zu trennen:

1. **Der Baustein als thematische Klammer darf Anker- und Tagesgrenzen überspannen.** Ein Baustein kann sich über die Mittagspause oder in den nächsten Tag fortsetzen (z. B. „Mitbestimmung bei KI" vormittags und nach der Pause weiter) – in der Praxis völlig normal. Die Überschrift erscheint dann in beiden Abschnitten, im Folgeabschnitt als „… (Fortsetzung)". Da der Baustein nach D10 nur ein Etikett über aufeinanderfolgenden Einheiten ist, hindert nichts dieses Etikett daran, eine Pause oder einen Tageswechsel zu überspannen.
2. **Das Zeitverhalten dehnt sich dabei nie automatisch aus.** Läuft ein Anker über (z. B. Vormittag +20 Min.), rutschen Einheiten **nicht** stillschweigend über die Mittagspause oder auf den nächsten Tag. Zwei Gründe: Für die Zielgruppe wäre ein Plan, der sich „von selbst" umbaut, beunruhigend – und pädagogisch ist ein Anker-/Tageswechsel nie neutral (der Nachmittag braucht etwas Aktivierendes, der Tag einen Abschluss, der nächste Morgen einen Wiedereinstieg). Ein Automatismus würde genau die Dramaturgie zerstören, die die Didaktischen Empfehlungen (D4) schützen sollen.
3. **Stattdessen: geführte Aktion aus der Zeitbudget-Warnung heraus.** Beispiel: „+20 Min. über der Mittagspause – letzte Einheit(en) auf den Nachmittag verschieben?" Ein Klick, die betroffenen Einheiten wandern in den nächsten Abschnitt, der Baustein läuft als Fortsetzung weiter (Punkt 1). Die Referentin entscheidet, das Tool macht es ihr leicht – dieselbe Logik wie in D9: geführte Aktion statt stiller Automatismus.

### D4 – Lückentext-Prinzip gegen das weiße Blatt

Das leere Blatt darf nie erscheinen. Zwei Einstiege:

1. **Themenplan als Startpunkt** (Hauptweg, wenn vorhanden): Der standardisierte Themenplan wird importiert und erzeugt das Baustein-Gerüst über die Tage (siehe D13 und Abschnitt 4).
2. **Dramaturgie-Vorlage** (wenn kein Themenplan existiert): Ein neuer Tag kommt vorstrukturiert auf Basis der fünf Phasen, als farbige Zonen mit Platzhaltern („Hier fehlt noch ein Einstieg, ca. 30 Min."). Aus dem weißen Blatt wird ein Lückentext.

Zwei Verstärker: **Vorschläge in die Lücke** (Klick auf Platzhalter filtert die Bibliothek automatisch nach Phase und Dauer ≤ Lücke – wählen statt suchen; Mechanik im Detail: D14) und **Didaktische Empfehlungen** als stiller Begleiter (Regeln und Strenge im Detail: D15) – gibt insbesondere Ehrenamtlichen Sicherheit, dass das Konzept „stimmt".

Zielfluss insgesamt: Rahmen (Tage, Zeiten, Gruppe) → Gerüst (Themenplan oder Dramaturgie-Vorlage) → Füllen in der Sequenzansicht mit Vorschlägen und Check → Grid als Überblick → Roter Faden als Veröffentlichung.

### D5 – Seminarschmiede als Themenplan-Konverter *(revidiert durch D13)*

> **Hinweis: Diese Entscheidung wurde am 5. Juli 2026 durch D13 revidiert.** Der Themenplan-Import findet direkt im Plugin statt, nicht mehr über die externe Seminarschmiede. Ursprüngliche Fassung zur Nachvollziehbarkeit:

Der Themenplan-Import sollte als neuer Ausgabemodus der bestehenden Seminarschmiede (FastAPI auf Hetzner, python-docx vorhanden) umgesetzt werden: „Themenplan → Seminarplaner-JSON", Import über den vorhandenen Import/Export-Tab. Bekannte Schwäche war der **Medienbruch** (Datei bei der Schmiede hochladen, JSON herunterladen, in Moodle wieder hochladen). Das Argument „python-docx ist dort vorhanden" war ein Bequemlichkeitsargument – genau dieser Medienbruch führte zur Revision.

**Weiterhin gültig aus D5:** Das Prinzip **deterministisch statt KI**. Da Themenpläne standardisiert sind, wird regelbasiert geparst ((V)/(N)-Präfixe, leere Tag-Zelle = gleicher Tag). Kostenlos, schnell, reproduzierbar. Dieses Prinzip überlebt die Revision und gilt für den Parser im Plugin (D13) unverändert.

### D6 – Kompetenzerwartungen als schreibgeschützte Referenz

Die Kompetenzerwartungen des Themenplans („Die Lernenden können …") liegen dort auf Baustein-Ebene. Sie werden beim Import als **schreibgeschützte Themenplan-Referenz** am Baustein mitgeführt – keine bearbeitbare Pädagogik (das widerspräche D1), sondern sichtbare Vorgabe („Das soll hier rauskommen") beim Füllen. Zusätzlich dienen sie als Suchfutter für die Bibliotheks-Vorschläge (D4).

### D7 – Sprache und Orientierung im UI

- Tabs benennen die **Tätigkeit statt des Objekts**: „Bausteine" → „Grobplanung", ggf. „Seminareinheiten" → „Methoden erstellen". Die bisherige Tab-Reihe stellt Bausteine und Einheiten als Geschwister dar, obwohl Hierarchie besteht.
- **Ein Erklärsatz pro Tab** als Microcopy, z. B.: „Hier planst du den Ablauf grob in Programmpunkten. Die Methoden dazu wählst du später im Seminarplan."
- ~~Der Quell-Umschalter im Planer spricht die Frage der Nutzerin: „Mit fertigen Programmpunkten planen" vs. „Einzelne Methoden platzieren".~~ *(Entfällt durch D8: Der Zwei-Quellen-Umschalter wird abgeschafft.)*
- Erklärmodell für Schulungen (an ZIM anschlussfähig): eine ZIM-Zeile = eine Seminareinheit; der Baustein ist der thematische Teil, der mehrere Einheiten bündelt. Das Verzeichnis-Bild ist als Grobmodell wieder stimmig, sobald D1 umgesetzt ist.

**Ergänzung (5. Juli 2026):** Die **Tabs als Navigationsprinzip bleiben erhalten** – die Zielgruppe hat sich an das Arbeiten mit Tabs gewöhnt, das wird nicht angetastet. Umbenannt wird die Beschriftung: von Objekt-Begriffen hin zu **Tätigkeiten**. Die konkrete Tab-Struktur und die Benennungen sind in **D16** festgelegt.

### D8 – Baustein-Weg ist der einzige strukturgebende Weg; Alternativen auf zwei Ebenen, jederzeit austauschbar

**Auflösung von Frage 6:** Der Zwei-Quellen-Modus entfällt. Es gibt keinen separaten Weg mehr, einzelne Methoden getrennt vom Baustein zu platzieren – Planen läuft ausschließlich über den Baustein als Rahmen (deckungsgleich mit D1). Lose Einheiten ohne Baustein-Zuordnung bleiben höchstens ein Sonderfall, kein gleichwertiger zweiter Weg. *(Präzisiert durch D10: „kein zweiter Quell-Modus" bedeutet nicht „Baustein-Pflicht".)*

**Auflösung von Frage 5:** Der bestehende Alternativen-Mechanismus bleibt nicht nur erhalten, sondern wird auf zwei Ebenen ausgebaut:

- **Baustein-Ebene:** Ein Slot kann mehrere Baustein-Varianten enthalten (z. B. A1/A2), die jeweils ein eigenes Set an Seminareinheiten mitbringen.
- **Seminareinheiten-Ebene:** Auch einzelne Einheiten *innerhalb* eines Bausteins können austauschbare Varianten haben (z. B. Kennenlernen: Bingo vs. Placemat; Feedback: Blitzlicht vs. Zielscheibe; Fallbeispiel Branche X vs. Y).

**Entscheidend:** Diese Alternativen sind nicht auf wiederverwendbare Vorlagen beschränkt. Sie müssen **jederzeit austauschbar** sein – auch im laufenden, individuellen Seminarplan einer Referentin. Sie kann mitten in der Planung mehrere Varianten parat halten und sich erst kurz vor dem Seminar entscheiden, ohne die andere zu verlieren.

**Konsequenz fürs Datenmodell:** Die Alternative ist eine Eigenschaft des laufenden Plans selbst, nicht nur der Vorlage – die Auswahl muss sich pro Plan jederzeit ändern lassen.

### D9 – Migration der alten Baustein-Lernziele: geführte Notiz statt automatischer Zuordnung

**Auflösung von Frage 2:** Die bestehenden Lernziele und Themen eines Bausteins (Bestandsdaten aus der Zeit vor D1) werden **nicht automatisch** einer Einheit zugewiesen. Sie wandern in ein Archivfeld am migrierten Baustein und bleiben dort sichtbar, aber inaktiv.

Zusätzlich erscheint am migrierten Baustein ein einmaliger, geführter Hinweis: „Ehemalige Lernziele dieses Bausteins – einer Einheit zuordnen?" mit einer Aktion, über die die Referentin selbst wählt, in welche zugeordnete Einheit der Inhalt übernommen wird (statt einer automatischen, willkürlichen Zuordnung zur ersten Einheit).

**Begründung:** Vermeidet Datenverlust (anders als stilles Löschen) und vermeidet eine falsche automatische Zuordnung. Folgt dem Lückentext-Prinzip aus D4: eine geführte Aktion statt eines stillen Automatismus oder einer reinen Ablage ohne Weiterverarbeitung.

### D10 – Der Baustein ist eine optionale Überschrift, keine Voraussetzung fürs Platzieren

Eine Sequenz kann auch **vollständig ohne Baustein** geplant werden: eine schlichte, chronologische Folge von Seminareinheiten ohne gruppierende Überschrift darüber. Eine Referentin kann jedem zusammenhängenden Abschnitt jederzeit eine Überschrift geben, die dann wie ein Baustein fungiert – und sie ebenso jederzeit wieder entfernen. Das ist kein struktureller Bruch, sondern ein reversibler Zustand.

**Präzisierung zu D8:** „Baustein-Weg ist der einzige strukturgebende Weg" bezog sich auf die Abschaffung des Zwei-Quellen-Umschalters (kein separates Platzieren neben dem Baustein) – nicht auf einen Zwang, überhaupt einen Baustein anzulegen. Die Sequenz selbst ist die Grundstruktur; der Baustein ist ein optionales Gruppierungs-Etikett darüber.

**Begründung:** Konsequente Weiterführung von D2 (Bottom-up-Weg) und D4 (Lückentext-Prinzip): Zwang zur Struktur widerspricht dem Prinzip, dass sich das Tool der Arbeitsweise der Referentin anpasst. Manche werden nie einen Themenplan haben und reihen chronologisch Einheiten aneinander – ein Pflicht-Baustein wäre unnötige Reibung.

**Abgrenzung zum Alternativen-Mechanismus (D8):** Baustein-Alternativen (A1/A2 mit jeweils eigenem Einheiten-Set) gibt es **nur für benannte Bausteine**. Eine unbenannte Abschnittsfolge hat höchstens Einheiten-Varianten auf Einzelebene (die unabhängig davon jederzeit möglich bleiben), aber keine Abschnitts-Alternative als Ganzes – dafür fehlt ihr die benannte Identität, zwischen der man wählen könnte.

### D11 – Sequenzansicht: Ein Tag mit Pfeilwechsel; Gesamtüberblick bleibt Aufgabe des Grids

**Auflösung von Frage 1 (Layout-Teil):** Die Sequenzansicht zeigt **einen Tag** mit Pfeilwechsel zum vorherigen/nächsten Tag, kein zusätzlicher Scroll-Modus über alle Tage. Der Bedarf „gesamten Plan im Blick haben" wird bereits durch das in D3 festgelegte Grid als Übersichts-/Leseansicht gedeckt – ein zweiter Weg dorthin in der Sequenzansicht selbst wäre redundant und zusätzlicher Lernaufwand für die Zielgruppe. Klare Arbeitsteilung: **Sequenzansicht** = fokussiertes Arbeiten an einem Tag; **Grid** = Überblick über alle Tage, zum Lesen und zur Orientierung.

**Auflösung von Frage 1 (Anker-Teil):** Vormittag und Nachmittag werden als benannte Abschnitte mit Zeitspanne und Zeitbudget-Leiste dargestellt, getrennt durch einen fixen Mittagspausen-Trenner dazwischen (siehe Wireframe „sequenzansicht-wireframe.html").

### D12 – Themenplan-Import platziert Bausteine automatisch auf Tag und Anker – nicht mehr, nicht weniger

**Auflösung von Frage 3:** Der Themenplan-Import erzeugt auch die Platzierung und legt die Bausteine automatisch auf den richtigen **Tag** und **Anker** (Vormittag/Nachmittag), in der Reihenfolge der Themenplan-Zeilen. Begründung: Diese Information liegt beim regelbasierten Parsen ohnehin bereits vor (Tag-Spalte, (V)/(N)-Präfix) – sie nicht zu übersetzen hieße, die Referentin eine bereits bekannte Information manuell nachtragen zu lassen. Bleibt deterministisch (Prinzip aus D5), kein Rateaufwand. *(Ursprünglich als Schmiede-Feature konzipiert; durch D13 findet dies direkt im Plugin-Importer statt.)*

**Bewusste Begrenzung:** Die Platzierung beschränkt sich auf Tag + Anker + Zeilenreihenfolge. Der Import plant **nicht** innerhalb eines Ankers, prüft **keine** Kapazität und verteilt **keine** Zeiten – zum Importzeitpunkt haben Bausteine nur die reservierte Platzhalter-Dauer (D1); ob es ins Zeitbudget passt, entscheidet sich erst beim Füllen durch die Referentin. Alles, was über reines Ablesen der Themenplan-Struktur hinausgeht, wird nicht automatisiert.

### D13 – Themenplan-Import direkt im Plugin statt über die Seminarschmiede *(Revision von D5, ihrerseits revidiert durch D48)*

> **Hinweis: Diese Entscheidung wurde am 9. Juli 2026 durch D48 revidiert.** Der Themenplan-Import läuft nicht mehr über einen PHP-Parser im Plugin, sondern wieder über die externe Seminarschmiede. Ursprüngliche Fassung zur Nachvollziehbarkeit:

Der Themenplan-Import wird **direkt in `mod_seminarplaner`** eingebaut: „Themenplan (.docx) hochladen" als Funktion im Import/Export-Tab (oder als eigener Einstieg im Zielfluss aus D4). Die externe Seminarschmiede wird für diesen Zweck **nicht** gebraucht.

**Begründung:** Das ursprüngliche Argument für die Schmiede („python-docx ist dort vorhanden") war ein Bequemlichkeitsargument, kein prinzipielles. Da das Parsen deterministisch und regelbasiert ist (Prinzip aus D5), kann es genauso in PHP im Plugin stattfinden: Eine .docx ist ein ZIP-Archiv mit XML; Moodle bringt File-API und XML-Verarbeitung mit, und das Plugin bündelt bereits Drittbibliotheken (jspdf, jszip). Der **Medienbruch entfällt vollständig** – drei manuelle Schritte über ein externes Tool waren genau die Art Reibung, die die Zielgruppe mit geringer IT-Kompetenz am härtesten trifft. Die Mini-Anleitung für den Umweg über die Schmiede wird ersatzlos überflüssig.

**Akzeptierter Preis:** Der Parser muss im Plugin gepflegt und getestet werden (Unit-Tests mit echten Themenplänen als Fixtures). Bei künftigen Format-Änderungen des Themenplans ist ein Plugin-Update nötig statt eines Schmiede-Updates.

**Ablauf nach D12 + D13 zusammen:** Referentin lädt Themenplan-.docx direkt im Plugin hoch → deterministischer Parser erzeugt Bausteine (Titel, Unterthemen, Kompetenzerwartungs-Referenz nach D6) → Bausteine werden automatisch auf Tag und Anker platziert (D12) → Referentin füllt in der Sequenzansicht. Kein externes Tool, kein Dateien-Hin-und-Her. *(Die Parsing-Regeln im Detail: D19, seinerseits durch D48 als eigenständige PHP-Spezifikation hinfällig.)*

**Weiterhin gültig aus D13 trotz D48:** Der Zielfluss D12 (automatische Platzierung auf Tag + Anker) bleibt unverändert – nur woher die Bausteine kommen, ändert sich wieder.

### D14 – Vorschlagsmechanik: zweistufig, deterministisch, nie leer

**Auflösung von Frage 7.** Die „Vorschläge in die Lücke" (D4) arbeiten zweistufig:

**Harte Filter (Treffer muss passen):**
- Dauer ≤ Lücke.
- Phase – aber **nur**, wenn die Lücke aus der Dramaturgie-Vorlage stammt und dort eine Phase definiert ist („Hier fehlt ein Einstieg"). Bei einer freien Lücke in einem Baustein gibt es keine Phasenvorgabe.
- **Gruppengröße ist kein Kriterium** – weder hart noch weich. Begründung: Die Gruppen sind in der Praxis fast immer gleich groß (13–20 Personen), das Feld hat keine Unterscheidungskraft. *(Das Feld selbst wurde im Workshop-Nachgang zusätzlich vereinfacht, siehe D26 – bleibt aber weiterhin kein Vorschlagskriterium.)*

**Weiche Sortierung (bestimmt nur die Reihenfolge):**
- **Stichwort-Abgleich:** Wörter aus Baustein-Titel, Unterthemen und Kompetenzerwartungs-Referenz (D6) werden gegen Titel/Beschreibung der Bibliothekseinheiten abgeglichen – mehr Übereinstimmung = weiter oben.
- **Bloom-Verb-Mapping:** Die Kompetenzerwartungen sind nach Bloom formuliert („benennen", „bewerten", „entwickeln" …). Diese Verben werden **deterministisch auf die Seminarphase gemappt** (siehe D41 – Nachfolge des ursprünglichen Mappings auf die inzwischen gestrichene Kognitive Dimension, D40). Einheiten mit passender Phase rutschen nach oben. Regelbasiert im Geist von D5, keine KI.

**Präsentation:** Maximal 3–5 Vorschläge als Karten, jeweils mit einem kurzen „Warum passt das"-Hinweis (z. B. „30 Min · Orientierung · Stichwort ‚Mitbestimmung'"). Nachvollziehbarkeit schafft Vertrauen bei der Zielgruppe; eine unerklärt sortierte Liste wirkt wie Zauberei. Darunter immer der Weg in die volle Bibliothek („Alle passenden anzeigen").

**Null Treffer – nie leer:** Stufenweise lockern und dies transparent kommunizieren: Dauer leicht überziehen lassen („Keine exakten Treffer – diese Einheiten sind etwas länger"), ggf. Phasenfilter lockern. Als letzte Stufe immer: **„Neue Einheit anlegen"**, vorausgefüllt mit Phase und Lückendauer – die Lücke wird zur Schnellanlage (verbindet sich mit dem Backlog-Punkt Formularlast).

**Praxiskontext – zwei Pool-Situationen:** Die Bibliothek einer Aktivität kann sehr unterschiedlich gefüllt sein. Ohne Importe enthält sie oft nur die Seminareinheiten **eines** Seminars (kleiner Pool). Über die **importierten globalen Methoden-Sammlungen** kann sie aber auch sehr groß werden – z. B. viele Warmups, Kennenlern- und Feedback-Methoden gleichzeitig. Das bestehende **Filternetz der Bibliothek trennt die importierten Sammlungen voneinander** und hält sie durchsuchbar; genau dadurch bleiben auch große Pools für die Vorschlagsmechanik nutzbar. Konsequenzen für D14:

- **Der Vorschlagspool umfasst die gesamte Bibliothek** der Aktivität, einschließlich der importierten globalen Sets – nicht nur die selbst angelegten Einheiten.
- **Bei kleinem Pool** dürfen die Filter nicht aggressiv sein (sonst bleibt schnell nichts übrig); der Null-Treffer-Pfad mit Schnellanlage ist hier kein Randfall, sondern ein häufiger, gleichwertiger Weg.
- **Bei großem Pool** leisten die weiche Sortierung (Stichwort-Abgleich, Bloom-Mapping) und die Begrenzung auf 3–5 erklärte Vorschläge die eigentliche Arbeit: Aus vielen formal passenden Treffern (z. B. dutzende Warmups ≤ 30 Min.) die inhaltlich nächstliegenden nach oben holen.

### D15 – Didaktische Empfehlungen: ausschließlich Hinweise, sechs Kandidaten-Regeln, Stille bei fehlenden Daten

**Auflösung von Frage 4** (Grundausrichtung; Schwellenwerte und Feinschliff bleiben dem Workshop mit erfahrenen Referentinnen vorbehalten).

**Grundsatz Strenge: ausschließlich Hinweise.** Keine Warnungen, nichts Blockierendes. Begründung: Die Zielgruppe *sind* die Pädagogik-Expertinnen; ein Tool, das ihnen mit Warnfarben signalisiert, ihr Seminar sei „falsch", kehrt das Kompetenzverhältnis um. Der Check ist der „stille Begleiter" aus D4 – er gibt Sicherheit, er korrigiert nicht. Jede Regel ist eine Erfahrungsheuristik, keine Norm; ein bewusster Regelbruch kann dramaturgisch genau richtig sein.

**Kandidaten-Regeln** (alle mit vorhandenen Daten prüfbar: Phase, Sozialform, Dauer, Anker). **Im Referentinnen-Workshop validiert und um Regel 7 ergänzt – Details siehe D22 und D23:**

1. **Phasenabdeckung:** Alle fünf Phasen kommen im Seminar (nicht: pro Tag) mindestens einmal vor.
2. **Aktivierung nach der Mittagspause:** Die erste Einheit nach dem Mittags-Anker ist keine reine Vortrags-/Input-Einheit. *Im Referentinnen-Workshop bestätigt: bleibt bestehen (D22).*
3. **Transfer am Ende:** Die letzte inhaltliche Einheit des Seminars gehört zur Transfer-Phase.
4. **Tagesabschluss:** Jeder Tag endet mit einer abschließenden Einheit (Blitzlicht, Feedback, Ausblick).
5. **Sozialform-Monotonie:** Nicht länger als ~120 Min. am Stück dieselbe Sozialform. *Schwellenwert im Referentinnen-Workshop bestätigt: final bei 120 Minuten (D22).*
6. **Einstieg am Morgen:** Jeder Tag beginnt mit etwas Orientierendem oder Ankommendem.
7. **Pausenhinweis (neu, D23):** Hinweis auf eine Pause – entweder nach dem Ende einer Seminareinheit oder spätestens nach 1,5 Stunden ohne Pause, je nachdem, was zuerst eintritt. Anders als Regel 2 nicht auf die Mittagspause bezogen, sondern auf Pausenbedarf im gesamten Tagesverlauf.

**Design-Prinzip 1 – Stille bei fehlenden Daten:** Da nur der Titel Pflichtfeld ist, sind Phase oder Sozialform oft nicht gepflegt. Der Check meckert dann nicht („Phase fehlt bei 8 Einheiten!") – das wäre eine Datenpflege-Peitsche. Regeln, deren Datengrundlage fehlt, schweigen einfach; der Check arbeitet mit dem, was da ist.

**Design-Prinzip 2 – positiv formulieren, unaufdringlich platzieren:** Kein rotes Ausrufezeichen an der Einheit, sondern ein eigener Bereich („Didaktische Empfehlungen") mit Formulierungen wie „Nach der Mittagspause könnte etwas Aktivierendes guttun". Erfüllte Regeln werden als Bestätigung angezeigt („✓ Alle fünf Phasen vertreten") – die Sicherheits-Funktion für Ehrenamtliche entsteht mehr durch die Häkchen als durch die Hinweise.

### D16 – Tab-Struktur nach dem Umbau: sechs Tabs entlang des Zielflusses, benannt nach Tätigkeit

**Auflösung von Frage 8.** Tabs bleiben als Navigationsprinzip erhalten (die Zielgruppe ist daran gewöhnt, D7). Drei strukturelle Änderungen:

1. **Der Bausteine-Tab entfällt.** Nach D10 ist der Baustein eine optionale Überschrift *in* der Sequenz, nach D12/D13 erzeugt der Themenplan-Import das Gerüst direkt platziert. Die Grobplanung passiert in der Sequenzansicht selbst – leere Bausteine mit gestricheltem Rahmen und reservierter Dauer (D1) *sind* die Grobplanung. Ein separater Bausteine-Tab würde die alte Verwirrung neu erzeugen: zwei Orte, an denen man mit Bausteinen arbeitet. Bestätigt: Da Bausteine als Strukturelement in der Sequenz weiter nutzbar sind, braucht es den Menüpunkt nicht.
2. **Seminareinheiten + Bibliothek verschmelzen zu einem Tab.** Beide drehen sich um dasselbe Objekt – einer zum Anlegen, einer zum Durchsuchen. Die bisherige Trennung stellt sie als Geschwister dar und zwingt zum Hin- und Herspringen. Künftig ein Ort: durchsuchen (inkl. globaler Sets, Filternetz), anlegen, bearbeiten.
3. **Das Grid bekommt einen eigenen Tab.** Klarer als ein versteckter Umschalter innerhalb der Planungsansicht – die Arbeitsteilung aus D11 (Sequenz = arbeiten, Grid = überblicken) wird über die vertraute Tab-Navigation abgebildet.

**Die sechs Tabs** (Reihenfolge folgt dem Zielfluss aus D4):

| Bisher | Neu |
| --- | --- |
| Seminarplan (Grid, Bearbeitung) | **Planen** (Sequenzansicht; enthält Grobplanung und Themenplan-Import als Einstieg) |
| – | **Überblick** (Grid, nur lesen) |
| Seminareinheiten + Bibliothek | **Bibliothek** (finden und anlegen; Benennung korrigiert durch D18 – ursprünglich „Methoden" – und final durch D50 auf „Bibliothek" festgelegt) |
| Roter Faden | **Roter Faden** (bleibt unverändert – etabliertes didaktisches Vokabular) |
| Import/Export | **Import/Export** (Name bleibt unverändert – Vorschlag „Austauschen" im Workshop verworfen, siehe D24) |
| Review | **Einreichen** (final entschieden im Referentinnen-Workshop, siehe **D37** – „Weitergeben"/„Veröffentlichen" verworfen; zusätzlich Prozess als Flussdiagramm erklärt) |
| Bausteine | *entfällt (siehe Punkt 1)* |

Dazu je Tab ein Erklärsatz als Microcopy (D7).

**Abgrenzung „Import/Export" vs. „Seminareinheiten":** „Import/Export" enthält alles, was die **Grenze des Plugins überquert** – JSON-Import/-Export von Einheiten, Bausteinen und Seminarplänen, Hereinholen globaler Methoden-Sammlungen, PDF-Exporte (ZIM, Konzeptablauf) und den Themenplan-Upload (D13). „Seminareinheiten" (früher Bibliothek + Seminareinheiten-Tab) ist der Ort für alles, was **innerhalb** des Plugins mit Einheiten passiert – durchsuchen (inkl. bereits importierter globaler Sammlungen, getrennt durchs Filternetz), anlegen und bearbeiten (D17-Modal). Faustregel: Kommt etwas rein oder geht raus → Import/Export; Arbeiten mit dem, was da ist → Seminareinheiten.

### D17 – Ein Einheiten-Editor als Modal, drei Einstiege

**Problem:** Die Sequenzansicht zeigt pro Einheit nur Titel, Phase und Dauer – die restlichen ~15 Felder (Ablauf, Inhalte, Materialien …) wären ohne diese Entscheidung nur über einen Tab-Wechsel erreichbar: genau das Hin- und Herspringen, das der Umbau überall sonst abschafft.

**Entscheidung:** Es gibt **einen einzigen Einheiten-Editor**, der als **Modal** (Dialogfenster über der Sequenz) geöffnet wird. Begründung für das Modal statt eines Seitenpanels oder einer eigenen Seite: Moodle arbeitet durchgängig mit Modalen – die Zielgruppe kennt das Muster bereits aus jedem anderen Moodle-Dialog. Zudem erzwingt ein Modal einen klaren Zustand („ich bearbeite jetzt diese eine Einheit"), statt zwei gleichzeitig aktive Bereiche zu schaffen. Akzeptierter Preis: Während der Bearbeitung ist die Sequenz nicht sichtbar; nach dem Schließen rückt sie bei geänderter Dauer sichtbar nach (D3).

**Drei Einstiege, derselbe Editor:**
1. **Aus der Sequenz:** Klick auf eine Einheit öffnet das Modal – ansehen und bearbeiten ohne die Planung zu verlassen.
2. **Aus dem Seminareinheiten-Tab (D18):** Anlegen und Bearbeiten unabhängig vom Plan (Vorrat aufbauen, Bibliothek pflegen).
3. **Aus der D14-Schnellanlage:** „Neue Einheit anlegen" am Platzhalter öffnet das Modal vorausgefüllt mit Phase und Lückendauer.

**Aufbau des Modals:** Die vorhandene Drei-Abschnitts-Struktur des Formulars wird zur Aufklapp-Logik: **Schnellfassung offen** (Titel, Phase, Dauer, Sozialform, Kurzbeschreibung), „Ablauf und Rahmen" und „Materialien und Technik" als zugeklappte Abschnitte darunter. Das entschärft zugleich den Backlog-Punkt Formularlast: Die 18 Felder erschlagen niemanden mehr, weil zwei Drittel zugeklappt sind, bis man sie braucht – und die Schnellfassung *ist* die Schnellanlage.

### D18 – Der Tab heißt „Seminareinheiten", nicht „Methoden"; „Seminareinheit" wird führender UI-Begriff

**Korrektur zu D16:** Der in D16 vorgeschlagene Tab-Name „Methoden" trifft das Objekt nicht. Eine Methode beschreibt nur die **Herangehensweise** an einen Inhalt – die Seminareinheiten im Plugin enthalten aber auch die **ausformulierten Inhalte** selbst, angehängte Dateien und den Ablauf. „Methoden" würde das Objekt kleiner machen, als es ist.

**Entscheidung:** Der Tab heißt **„Seminareinheiten"**. Das folgt derselben Logik wie beim „Roten Faden": Das Tätigkeits-Prinzip (D7/D16) gilt dort, wo der Objektname Verwirrung gestiftet hat (Bausteine) – wo etabliertes Vokabular der Zielgruppe trägt, bleibt es. „Seminareinheit" ist etabliert (eine ZIM-Zeile = eine Seminareinheit).

**Folgeentscheidung für den Backlog-Punkt Begriffs-Inkonsistenz:** „Seminareinheit" wird der **führende Begriff im gesamten UI**. „Methode", „Konzept" und ähnliche Bezeichnungen verschwinden aus der Oberfläche (auch in `local_seminarplaner`); „Methodenset" ist als Name für die globalen Sammlungen zu prüfen (ggf. „Einheiten-Sammlung" o. ä. – Benennung im Referentinnen-Workshop abfragen). *Final entschieden durch D38: Der Name lautet „Methoden-Sammlung".*

*Präzisiert durch D28: „Methode" kommt als eigener, präziser Begriff für einen inhaltsfreien Sonderfall zurück – das ist keine Rücknahme dieser Entscheidung, siehe dort.*

### D19 – Themenplan-Parser: Spezifikation *(Abschluss von Schritt 5; hinfällig durch D48)*

> **Hinweis: Diese Spezifikation ist seit dem 9. Juli 2026 (D48) hinfällig.** Der Parser wird nicht mehr im Plugin gepflegt, sondern lebt (bereits umgesetzt) in der externen Seminarschmiede. Als fachliche Referenz und zur Nachvollziehbarkeit stehen gelassen – **die Regeln unten beschreiben nicht mehr den Ist-Weg.**

Die Parsing-Regeln für den Themenplan-Import (D13), festgelegt vor jeder Code-Zeile. Alle Regeln sind deterministisch (Prinzip aus D5); Referenz-Fixture ist TP_2026_ki.docx.

**Grundsatz Fehlerstrategie – Best-Effort mit Import-Bericht:** Der Parser legt alles an, was er sicher erkennt, und macht Unklares transparent, statt abzuweisen. Konsistent zur Linie des Umbaus (D3, D15): nichts blockieren, die Referentin entscheiden lassen. Nach dem Import erscheint ein **Import-Bericht**: eine kurze Zusammenfassung („5 Seminartage, 9 Bausteine, 1 organisatorischer Block angelegt") plus eine Liste der Hinweise mit Zeilenbezug (z. B. „Zeile 7: kein (V)/(N) erkannt – hinter ‚XY' am Dienstagvormittag eingeordnet, bitte prüfen"). Der Bericht blockiert nichts und verschwindet nach Kenntnisnahme.

**Der eine harte Boden:** Findet der Parser im Dokument keine erkennbare Themenplan-Struktur (siehe Tabellen-Erkennung), wird der Import mit einer freundlichen Meldung abgebrochen („Das sieht nicht nach einem Themenplan aus – erwartet wird eine Tabelle mit Tag/Inhalt/Kompetenzerwartungen") und es wird **nichts** angelegt. Best-Effort gilt innerhalb eines erkennbaren Themenplans, nicht für beliebige Dokumente.

**Die Regeln im Einzelnen:**

1. **Tabellen-Erkennung:** Der Parser sucht die erste Tabelle im Dokument, die eine Kopfzeile „Tag | Inhalt | Kompetenzerwartungen …" bzw. die Markerzeile „Seminarplan:" enthält. Geparst werden nur die Seminarplan-Zeilen ab dieser Stelle. Alles außerhalb der Tabelle (z. B. Fließtext „Stand: Februar 2025" nach der Tabelle) wird ignoriert.
2. **Kopfblock wird ignoriert:** Seminartitel, Seminartyp, Bildungsziel und Inhaltliche Schwerpunkte vor den Seminarplan-Zeilen werden **nicht** importiert. Der Planname kommt aus der Moodle-Aktivität; ein Referenzfeld auf Plan-Ebene wäre Datenmodell- und UI-Aufwand für wenig Nutzen. (Sollte der Workshop zeigen, dass das Bildungsziel beim Füllen vermisst wird, ist eine spätere Ergänzung möglich, ohne die Parser-Grundlogik zu ändern.)
3. **Tag-Zuordnung – Wochentags-Mapping mit Best-Effort-Fallback:** Die Werte der Tag-Spalte werden auf Seminartage gemappt: erster vorkommender Tag = Seminartag 1 usw. Der Wochentagsname bleibt als **Beschriftung** des Seminartags erhalten (im Plan steht „Montag", nicht nur „Tag 2"). Leere Tag-Zelle = gleicher Tag (wie in Abschnitt 4). Nicht erkannte Werte („1. Tag", Tippfehler) eröffnen im Geist von Best-Effort trotzdem einen neuen Seminartag, der Rohwert wird als Beschriftung übernommen, und der Import-Bericht vermerkt es.
4. **Anker-Zuordnung – (V)/(N)-Präfix:** (V) = Vormittag, (N) = Nachmittag (wie D12). Fehlt das Präfix oder ist es unlesbar, schließt die Zeile **an den Vorgänger an** (gleicher Tag, gleicher Anker) – die Zeilenreihenfolge des Themenplans ist selbst eine verlässliche chronologische Information. Berichtshinweis in jedem Fall. Sonderfall: Ist die **erste** Zeile eines Tages ohne Präfix, gibt es keinen Vorgänger am selben Tag – Fallback ist der **Vormittag** (chronologische Lesart: was am Tagesanfang steht, beginnt vormittags), ebenfalls mit Berichtshinweis.
5. **Organisatorische Blöcke – leere Kompetenzerwartungen-Zelle:** Eine Zeile mit leerer Kompetenzerwartungen-Zelle wird als **organisatorischer Block** angelegt (Typ ohne Methodenzwang, siehe Abschnitt 4 – z. B. „Anreise und Begrüßung"). Begründung: Ein Block ohne Kompetenzerwartungen hat per Definition keinen Lernauftrag. Deterministisch, kein Schlüsselwort-Raten; Falsch-Positive sind harmlos, da der Block trotzdem am richtigen Tag/Anker landet und jederzeit gefüllt werden kann.
6. **Inhalt-Zelle auf Absatzebene:** Der Parser liest die Zelle als Folge von Absätzen (`<w:p>`), nicht als Fließtext. Erster Absatz = **Baustein-Titel** (das (V)/(N)-Präfix wird abgeschnitten), Folgeabsätze = **Unterthemen**. Eine Zelle mit nur einem Absatz ergibt einen Titel ohne Unterthemen.
7. **Kompetenzerwartungen-Zelle:** Der Volltext wird als schreibgeschützte Themenplan-Referenz am Baustein übernommen (D6) – als **ein** Textblock, keine Zuordnung einzelner Sätze zu Unterthemen.
8. **Normalisierung:** Whitespace-Trimmen, Vereinheitlichung von Ellipsen-Varianten („…"/„...") und typografischen Anführungszeichen – rein kosmetisch, deterministisch.

**Zusammenspiel:** D19 liefert die Struktur (Bausteine mit Titel, Unterthemen, Referenz, organisatorische Blöcke), D12 die Platzierung (Tag + Anker, nicht mehr), D13 den Ort (PHP-Parser im Plugin, kein externes Tool). Der Import-Bericht ist das einzige neue UI-Element dieser Entscheidung.

### D20 – Datenmodell für Sequenz, Anker-Platzierung und zweistufige Alternativen *(Abschluss von Schritt 6)*

**Problem:** D3 (Sequenz statt Grid), D8 (zwei Alternativ-Ebenen), D10 (Baustein optional) und D12 (automatische Tag/Anker-Platzierung durch den Import) beschreiben das gewünschte Verhalten, aber noch keine gemeinsame Datenstruktur. Zwei Dinge mussten dafür zusammengedacht werden: die Fortsetzung eines Bausteins über eine Pause oder einen Tageswechsel hinweg (Präzisierung zu D3), und zwei unabhängig voneinander schaltbare Alternativ-Ebenen (D8).

**Grundentscheidung: Die Platzierung (Tag, Anker, Reihenfolge) gehört zur einzelnen Seminareinheit, nicht zum Baustein.** Ein Baustein ist weiterhin nur eine optionale Überschrift (D10) – er wird nicht selbst „platziert", sondern taucht dort auf, wo die ihm zugeordneten Einheiten stehen. Das löst die Fortsetzung ohne Sonderfall: Steht dieselbe Baustein-Kennung an zwei nicht unmittelbar benachbarten Stellen der Sequenz, erkennt die Anzeige das automatisch und beschriftet den zweiten Auftritt mit „… (Fortsetzung)" – es gibt keinen zweiten Datensatz, der das eigens speichern müsste.

**Struktur:**

- Ein **Anker** (Vormittag/Nachmittag eines Tages) enthält eine geordnete **Sequenz** von *Platzierungen*. Die Reihenfolge in dieser Liste ersetzt die bisherigen Start/Ende-Felder (D3); Uhrzeiten werden daraus berechnet.
- Eine **Platzierung** ist der atomare Eintrag der Sequenz: ein optionaler Verweis auf einen **Baustein** (leer bei unbenannter Einheit, D10) plus ein Verweis auf eine **Einheiten-Auswahl**.
- Eine **Einheiten-Auswahl** trägt die Alternativen auf Einheiten-Ebene (D8): eine kleine Liste von Kandidatinnen (jeweils nur ein Verweis auf die Seminareinheiten-Bibliothek, keine Kopie der Inhalte) plus Kennzeichnung, welche gerade aktiv ist. Dauer, Phase usw. kommen live aus der referenzierten Seminareinheit.
- Ein **Baustein** trägt Titel, Unterthemen, Themenplan-Referenz (D6) und Archivfeld (D9) wie bisher, zusätzlich aber **Varianten** für die Alternative auf Baustein-Ebene (D8): jede Variante ist ein eigenständiges, benanntes Paket mit eigener Platzierungsliste. Wird eine Variante aktiviert, ersetzt sie den zusammenhängenden Bereich der Sequenz, der bisher zu diesem Baustein gehörte – unabhängig davon, ob die neue Variante mehr, weniger oder andere Einheiten mitbringt. **Bestätigt: Varianten müssen nicht gleich lang sein**, das Zeitbudget des Ankers reagiert einfach neu (D3), es wird nichts automatisch gestreckt oder gestaucht.

**Illustrative Skizze** (Feldnamen vorläufig, angelehnt an die bestehende Version-3-Struktur):

```json
{
  "tage": [
    {
      "tag": 1,
      "bezeichnung": "Montag",
      "anker": {
        "vormittag": { "sequenz": ["p1", "p2", "p3"] },
        "nachmittag": { "sequenz": ["p4"] }
      }
    }
  ],
  "platzierungen": {
    "p1": { "bausteinid": "b1", "einheitenauswahl": "ea1" },
    "p2": { "bausteinid": "b1", "einheitenauswahl": "ea2" },
    "p3": { "bausteinid": null, "einheitenauswahl": "ea3" }
  },
  "einheitenauswahlen": {
    "ea1": { "kandidaten": ["methode-42"], "aktiv": "methode-42" },
    "ea2": { "kandidaten": ["methode-7", "methode-8"], "aktiv": "methode-7" }
  },
  "bausteine": {
    "b1": {
      "titel": "Von den ersten Rechenmaschinen zur heutigen KI",
      "themenplanreferenz": "Die Lernenden können …",
      "varianten": {
        "a1": { "titel": "Grundkurs", "platzierungen": ["p1", "p2"] },
        "a2": { "titel": "Aufbaukurs", "platzierungen": ["p1b", "p2b", "p9b"] }
      },
      "aktivevariante": "a1"
    }
  }
}
```

**Zusammenspiel mit dem bestehenden Code:** Das heutige `slotkey`-Muster (mehrere Baustein-Objekte teilen sich einen Slot, eines ist aktiv) ist bereits eine Vorstufe der Baustein-Varianten und lässt sich darauf abbilden. Neu ist vor allem: Die Platzierung wandert von Start/Ende-Feldern der Grid-Einträge zur Reihenfolge in der Anker-Sequenz, und die Einheiten-Auswahl als eigene Ebene kommt komplett neu hinzu (existiert im Ist-Stand nicht).

**Migrationshinweis:** Bestehende Grid-Einträge (Tag + Start/Ende) lassen sich in die neue Sequenz überführen, indem man sie pro Tag und Anker nach Startzeit sortiert – die Reihenfolge ergibt sich direkt daraus (bereits in D3 als Migrationshinweis vorgemerkt).

**Offen für die Umsetzung** (kein Workshop-Thema, sondern technische Detailarbeit): genaue Tabellen-/Feldnamen, ob Einheiten-Auswahlen mit nur einer Kandidatin als Sonderfall wegoptimiert werden, Exportformat-Erweiterung (siehe Abschnitt 5).

### D21 – Editor-UX der Seminareinheiten-Felder: Reihenfolge nach Denk- und Arbeitslogik *(löst den Backlog-Merker auf)*

Feld-für-Feld-Gestaltung des D17-Modals, ohne die Datenfelder selbst zu ändern (die Felder-Inventur ist eine separate, offene Frage – siehe unten). Leitgedanke war der Merker: Felder erscheinen in der Logik, in der die Planung sie nutzt, und erklären sich durch Platzierung und Microcopy selbst.

**Praxis-Korrektur, die die Reihenfolge bestimmt:** Es gibt drei typische Entstehungswege einer Seminareinheit:
1. **Team-Planungstreffen:** Das Seminarteam geht das Seminar gemeinsam durch; bei Neu-/Umplanung entstehen am Tisch Titel, ggf. Lernziele, eine Kurzbeschreibung und eine Dauer – mehr nicht. Der Ablauf wird später von jemandem allein ausformuliert.
2. **Fertiges Konzept:** Bereits vollständige Einheiten werden nur in eine Reihenfolge gebracht – der Editor wird dabei gar nicht geöffnet.
3. **Einzelplanung Schritt für Schritt:** Eine Person plant durch und schreibt direkt Ablauf und alle weiteren Informationen.

Daraus folgt: **„Lernziele" gehört in die Schnellfassung**, nicht in den zugeklappten Bereich – es ist Teil des Clusters, das im Team-Szenario gemeinsam entsteht. Und die Denk-Reihenfolge ist Titel → Lernziele → Ablauf (vom Ziel zur Umsetzung), nicht umgekehrt.

**Schnellfassung (offen):**
1. Titel *(einziges Pflichtfeld, unverändert)*
2. Lernziele (Ich-kann …) – *neu hier;* bei importierten Bausteinen steht die Themenplan-Referenz (D6) als schreibgeschützte Vorgabe sichtbar daneben
3. Kurzbeschreibung
4. Zeitbedarf (Dauer)
5. Seminarphase
6. Sozialform

Die Positionen 1–4 sind das Team-Szenario-Cluster („kurzer Weg"); 5–6 werden erst beim Einsortieren in die Sequenz wichtig und stehen deshalb hinten, bleiben aber offen sichtbar (steuern Farbcodierung D3 und Vorschläge D14).

**„Ablauf und Rahmen" (zugeklappt):**
1. Ablauf – das Herzstück der Einzelplanung, jetzt erster Punkt des Abschnitts
2. Raumanforderungen
3. Gruppengröße – direkt bei den Raumanforderungen (beides „was muss vorbereitet sein"; als Vorschlagskriterium nach D14 gestrichen, als Durchführungs-Info weiter sinnvoll; Auswahl im Workshop-Nachgang auf drei Kategorien vereinfacht, siehe **D26**)
4. Risiken/Tipps
5. Debrief/Reflexionsfragen
6. Tags/Schlüsselworte – Microcopy: „Hilft beim Wiederfinden und bei Vorschlägen"
7. Autor*in / Kontakt – reines Metadatum, ganz ans Ende

*Kognitive Dimension und Komplexitätsgrad final durch D40 gestrichen (Workshop-Ergebnis B5) – Nummerierung entsprechend angepasst.*

**„Materialien und Technik" (zugeklappt):**
1. Materialien (Datei-Anhänge)
2. Material/Technik (Freitext)
3. Alternative Seminareinheiten – **bleibt, mit neuer Rolle: Vorbelegung.** Nach D20 leben Einheiten-Alternativen im laufenden Plan, nicht in der Vorlage. Das Feld wird deshalb zur Vorschlags-Quelle: Wird die Einheit in eine Sequenz gezogen, sind die hier hinterlegten Einheiten dort bereits als Kandidatinnen der Einheiten-Auswahl vorausgewählt – jederzeit änderbar, aber ein Kopfstart. Microcopy: „Diese Einheiten stehen im Plan automatisch als Alternativen bereit."

**Felder-Inventur final entschieden (Workshop-Ergebnis B5, D40):** Kognitive Dimension entfällt zugunsten der Seminarphase, Komplexitätsgrad entfällt ersatzlos, Gruppengröße bleibt in den D26-Kategorien, alle übrigen Felder bleiben unverändert. Details und Konsequenz für die Vorschlagsmechanik siehe D40/D41.

### D22 – Didaktische Empfehlungen: Regeln 2, 4, 5, 6 im Workshop bestätigt (Ergänzung zu D15)

**Erste Ergebnisse aus dem Referentinnen-Workshop (Teil A, Fragen A1/A3).**

- **Regeln 4 (Tagesabschluss) und 6 (Einstieg am Morgen) bestätigt:** Die Erinnerung, dass es einen Einstieg und einen Feedback-Ausstieg geben sollte, hilft vielen Referentinnen bei der Planung – was in der Praxis daraus gemacht wird, steht auf einem anderen Blatt, ändert aber nichts am Nutzen des Hinweises in der Planungsphase. Beide Regeln bleiben unverändert.
- **Regel 5 (Sozialform-Monotonie) – Schwellenwert final:** Die Arbeitshypothese von ~120 Minuten wurde im Workshop bestätigt. Der Schwellenwert ist damit final, keine offene Frage mehr.
- **Regel 2 (Aktivierung nach der Mittagspause) bleibt bestehen:** Trotz der ursprünglich niedrigen Priorität hat der Workshop die Regel bestätigt, sie wird nicht gestrichen.
- **Klarstellung zur Darstellung der Mittagspause:** Missverständnis im Vorfeld ausgeräumt – die Pause zwischen Vormittag und Nachmittag wird in der Sequenzansicht weiterhin angezeigt (unverändert zu D11), allerdings nicht mehr als eigene Box mit festem Anfang und Ende, sondern als benannter Pausen-Trenner ohne eigene Zeitgrenzen (siehe Wireframe). Das betrifft nur die Darstellung, nicht Regel 2 selbst.

### D23 – Didaktische Empfehlungen: neue Kandidaten-Regel 7 „Pausenhinweis" (Ergänzung zu D15)

**Ergebnis aus dem Referentinnen-Workshop (Teil A, Frage A2).** Zusätzlich zu den sechs ursprünglichen Regeln wünschen sich die Referentinnen einen allgemeinen Hinweis auf Pausen zwischen Seminareinheiten, unabhängig von der festen Mittagspause: Der Hinweis erscheint entweder nach dem Ende einer Seminareinheit oder spätestens nach 1,5 Stunden ohne Pause – je nachdem, was zuerst eintritt. Anders als Regel 2 (die sich ausschließlich auf die Mittagspause bezieht) deckt Regel 7 den gesamten Tagesverlauf ab. Die Didaktischen Empfehlungen haben damit künftig **sieben** Kandidaten-Regeln.

### D24 – Tab bleibt „Import/Export"; Vorschlag „Austauschen" verworfen (Korrektur zu D16)

**Ergebnis aus dem Referentinnen-Workshop (Teil B, Frage B2).** Der in D16 vorgeschlagene neue Name „Austauschen" wurde nicht angenommen: Alle Teilnehmerinnen konnten sich unter dem bestehenden Namen „Import/Export" unmittelbar etwas vorstellen, „Austauschen" brachte keinen Erkenntnisgewinn. Der Tab behält daher seinen bisherigen Namen. Inhaltlich ändert sich nichts – die in D16 festgelegte Abgrenzung (alles, was die Plugin-Grenze überquert) bleibt bestehen, nur unter altem Namen. D16-Tabelle und Abgrenzungs-Absatz sind entsprechend korrigiert.

### D25 – Neue Angabe „Veranstaltungsgröße" am Gesamtplan (Seminar/Tagung), steuert die Tipps der Didaktischen Empfehlungen

**Vorschlag des Auftraggebers im Nachgang des Workshops.** Die Tipps der Didaktischen Empfehlungen sollen sich künftig an der Größenordnung der Veranstaltung orientieren können: Ein Seminar (10–20 TN) braucht andere Hinweise als eine Tagung (z. B. ein Betriebsrät*innen-Tag mit 80–200 TN) – Hinweise, die für eine kleine Gruppe passen, passen nicht automatisch für eine Großveranstaltung.

Dafür bekommt der Gesamtplan eine neue, bewusst grobe Angabe **„Veranstaltungsgröße"** mit zwei Ausprägungen: **Seminar** (10–20 TN) und **Tagung** (80–200 TN). Es geht ausdrücklich nicht um eine exakte Teilnehmendenzahl, sondern um diese grobe Unterscheidung – dieselbe Grundhaltung wie bei der Vereinfachung des Gruppengröße-Felds (D26). Welche konkreten Tipps der Didaktischen Empfehlungen sich je nach Veranstaltungsgröße unterscheiden, ist noch nicht ausgearbeitet und wird nachgezogen, sobald aus dem Workshop weitere Rückmeldungen zu den Regeln vorliegen.

### D26 – Gruppengröße-Feld an der Seminareinheit auf drei Kategorien vereinfacht (Korrektur zu D14/D21)

**Vorschlag des Auftraggebers im Nachgang des Workshops.** Die bisherige feingranulare Gruppengröße-Auswahl an der Seminareinheit (1 / 2-3 / 3-5 / 6-12 / 13-24 / 25+ / beliebig, siehe Bibliotheks-Filter im Code) wird auf drei handlungsbezogene Kategorien reduziert:

- **Gruppenarbeit (2-5)**
- **Planung (10-20)**
- **beliebig**

**Begründung:** Es reicht zu wissen, wofür eine Einheit taugt, nicht die exakte Kopfzahl – dieselbe Überlegung, die in D14 schon dazu führte, Gruppengröße als Vorschlagskriterium zu streichen (die Gruppen sind in der Praxis fast immer gleich groß). Jetzt wird auch die reine Durchführungs-Info (D21, Feldliste Punkt 4) gröber, statt sechs feine Stufen vorzuhalten, die in der Praxis kaum unterschieden werden.

**Mapping der bisherigen Werte:** 1, 2-3, 3-5 und 6-12 → **Gruppenarbeit**; 13-24 → **Planung**; 25+ und beliebig → **beliebig**.

Betrifft die Feldliste aus D21 (Abschnitt „Ablauf und Rahmen", Punkt 4) sowie die entsprechenden Filter-Optionen im Seminareinheiten-Tab.

### D27 – Didaktische Empfehlungen: Ein/Aus-Schalter, pro Referentin gespeichert (Ergänzung zu D15/D22)

**Ergebnis aus dem Referentinnen-Workshop (Teil A, Frage A4 zur Tonlage).** Statt einzelne Formulierungen der Hinweise weiter zu verfeinern, wünschte sich die Runde vor allem eine Möglichkeit, die gesamten Didaktischen Empfehlungen bei Bedarf **auszublenden**. Umgesetzt als Ein/Aus-Schalter:

- Die Einstellung gilt **pro Referentin**, über alle Seminarpläne hinweg – nicht pro einzelnem Plan.
- Sie bleibt gespeichert, bis sie aktiv wieder umgeschaltet wird (kein Zurückspringen auf „an" beim nächsten Plan oder Login).

**Begründung:** Wer den Check grundsätzlich nicht braucht oder er als Bevormundung empfunden wird, kann ihn vollständig abschalten, statt sich an einzelnen Formulierungen zu stören – einfacher und ehrlicher als der Versuch, die Tonlage für alle gleichermaßen richtig zu treffen.

### D28 – Vier-Objekte-Modell: Seminareinheit, Methode, Methoden-Sammlung, Seminarkonzept

**Anlass:** Im Zuge der B3-Diskussion (Begriff „Methodenset") stellte sich heraus, dass der Ist-Stand zwei strukturell unterschiedliche Dinge unter denselben oder überlappenden Namen führt (Code: „globales Konzept" für beide). Das Konzept unterscheidet ab sofort vier Objekte:

| Objekt | Enthält | Status |
| --- | --- | --- |
| **Seminareinheit** | Inhalt, Methode und Ablauf einer einzelnen Einheit | bestehend, führender Begriff (D18) |
| **Methode** *(neu präzisiert)* | nur pädagogische Technik, kein fachlicher Inhalt (z. B. Kennenlernen, Reflexion, Feedback, Einstieg) | strukturell dasselbe Schema wie die Seminareinheit, inhaltlich abgegrenzt |
| **Methoden-Sammlung** | Sammlung mehrerer Methoden/Seminareinheiten zu einem Thema, **ohne Ablauf/Reihenfolge** | bestehend (`local_seminarplaner`, Status draft/review/published/archived) |
| **Seminarkonzept** | Bausteine + Seminareinheiten **mit fertigem Ablauf** – ein kompletter, sequenzierter Seminarplan | bislang nur als Datei-Export (Abschnitt 5, Komponente „Seminarpläne"), keine globale Bibliothek |

**Warum das keine Rücknahme von D18 ist:** D18 hat „Methode" als *allgemeinen* Leitbegriff verworfen, weil die meisten Seminareinheiten mehr sind als reine Technik (Inhalt, Anhänge, Ablauf). Das bleibt richtig. „Methode" wird hier nicht wieder zum Leitbegriff, sondern zum präzisen Namen für den inhaltsfreien Sonderfall – strukturell dasselbe Schema wie eine Seminareinheit (gleiche ~18 Felder, siehe D21), aber ohne fachlichen Inhalt.

**Konsequenz für B3:** Die offene Workshop-Frage „Methodenset" behalten oder umbenennen betrifft künftig nur noch die Methodensammlung **ohne Ablauf** – nicht mehr das komplette Seminarkonzept. Beide brauchen eigene, unterscheidbare Namen. Für die Methoden-Sammlungs-/Methoden-Ebene wird die Auffindbarkeit in D29 konkretisiert; für Seminarkonzepte steht die grundsätzliche Richtung noch offen (siehe Frage 9, Abschnitt 6). *B3 final entschieden durch D38: Der Name lautet „Methoden-Sammlung".*

### D29 – Neue globale Methoden-Bibliothek: Auffindbarkeit über Tags/Facetten statt festes Einsatzzweck-Feld

**Ausgangspunkt:** Der Auftraggeber möchte eine plattformweite Bibliothek wiederkehrender, hilfreicher **Methoden** (D28) initiieren – nutzbar von allen Seminarplaner-Aktivitäten, z. B. für Aktivierung nach der Mittagspause, Tagesabschluss/Feedback oder Seminareinstieg. Architektonisch ist die Grundlage bereits vorhanden: `local_seminarplaner` verwaltet globale Sammlungen schon heute plattformweit, unabhängig von einzelnen Aktivitäten (Review-Workflow, Versionen, Reviewer-Zuweisung). Neu ist die Ausrichtung auf **Methoden** als eigenen, inhaltsfreien Objekttyp und die gezielte Auffindbarkeit.

**Verworfen: festes „Einsatzzweck"-Feld mit fixen Werten.** Ursprünglich vorgeschlagen (Einstieg / Aktivierung nach der Pause / Abschluss / frei). Eine Analyse von 183 echten Methoden aus zwei vom Auftraggeber bereitgestellten Beispiel-Methodensets („Spiele ohne Verlierer", „Thiagi") zeigt: Die Praxis tagged bereits deutlich feiner und organischer, u. a. „Abendgestaltung" (56 von 183 Methoden), „Reflexion & Selbstwahrnehmung" (33), „Themenbearbeitung & Wissenssicherung" (21), „Aufwachspiele" (40), „Kooperation"/„Teamarbeit" sowie eine Aufwands-Achse „ohne Aufwand" vs. „mit Vorbereitung" (91 zu 25 Nennungen). Ein festes Vier-Werte-Feld hätte diese Vielfalt verloren – insbesondere „Abendgestaltung" als große, bislang nicht mitgedachte Kategorie für mehrtägige Präsenzseminare.

**Entscheidung:** Die neue Bibliothek nutzt das **bereits bestehende freie `tags`-Feld** der Seminareinheit/Methode als Grundlage, nicht ein neues festes Feld. Für die Bibliotheksansicht werden daraus **Facetten** gebildet (z. B. Zeitpunkt/Anlass, Format, Aufwand) – als Orientierung, keine abschließende Taxonomie; die endgültigen Facetten werden erst anhand der realen, vom Auftraggeber noch bereitzustellenden Methodenbestände festgelegt (siehe Nächste Schritte, Schritt 9).

**Doppelnutzen:** Dasselbe Tags-Feld, das hier die Facetten-Suche in der Bibliothek speist, dient in D14 bereits dem Stichwort-Abgleich der Vorschlagsmechanik. Eine Pflege der Tags zahlt sich also doppelt aus: beim gezielten Suchen in der Bibliothek und beim automatischen Vorschlag in der Lücke.

**Empirische Randnotiz zu B5 (Felder-Inventur):** Dieselbe Analyse liefert eine Kreuztabelle Seminarphase × Kognitive Dimension über die 183 Methoden: An den Rändern der Taxonomie (Orientierung, Handlungsteil) korrelieren beide Felder stark (jeweils >80 % „Anwenden"), in der Mitte (Transfer, Erfahrungserhebung) tragen sie deutlich unterschiedliche Information. *Ergebnis des Workshops (D40): Trotz dieses Befunds fällt die Kognitive Dimension zugunsten der Seminarphase weg – die Doppelpflege wog in der Praxis stärker als der Informationsverlust in der Mitte der Taxonomie. Die dadurch nötige Anpassung der Vorschlagsmechanik (D14) ist in D41 festgehalten, mit einer bewussten Ausnahme für die Erfahrungserhebungs-Phase, die dem empirischen Befund Rechnung trägt.*

**Offen:** Die endgültige Facetten-Struktur folgt, sobald weitere reale Methodenbestände vorliegen (Nächste Schritte, Schritt 9). Ebenfalls offen: ob auch **Seminarkonzepte** (D28) künftig eine analoge globale, versionierte Bibliothek bekommen sollen, oder ob dafür der bestehende Datei-Export der einzige Weg bleibt (**Frage 9**, Abschnitt 6).

### D30 – Sichtbarkeits-Grundsatz: lokal per Default, global nur nach expliziter Freigabe

**Bestätigung durch den Auftraggeber.** Alle innerhalb eines Seminarplaners (einer Moodle-Kursaktivität) angelegten Objekte – Seminareinheiten, Methoden, Bausteine, ganze Seminarkonzepte (D28) – sind **standardmäßig nur innerhalb dieses Moodle-Kurses sichtbar**, unabhängig vom Objekttyp. Global verfügbar wird etwas ausschließlich durch die explizite, aktive Umwandlung in ein **Globales Konzept**: Einreichen (D16-Tab, siehe auch B1) → Prüfung durch zugewiesene Konzeptverantwortliche → Status `published` in `local_seminarplaner`.

**Konsequenz für D29 (Methoden-Bibliothek) und Frage 9 (mögliche Seminarkonzept-Bibliothek):** Beide Bibliotheken zeigen ausschließlich Inhalte, die diesen Einreichen-Weg bereits durchlaufen haben. Es gibt keinen impliziten oder automatischen Weg, mit dem in einer Aktivität angelegte Inhalte in einer globalen Bibliothek auftauchen – weder für Methoden noch für Seminarkonzepte, weder jetzt noch bei einer künftigen Erweiterung. Der Grundsatz gilt unabhängig vom Objekttyp (D28): Eine Methoden-Sammlung ist nicht „automatisch globaler" als ein Seminarkonzept, beide brauchen denselben expliziten Schritt.

**Begründung:** Entspricht der bestehenden Architektur (`local_seminarplaner` als separate, freiwillig befüllte Schicht) und schützt Referentinnen davor, versehentlich eigene, noch unfertige oder kursspezifische Inhalte plattformweit sichtbar zu machen. Kontrolle über die eigenen Inhalte hat Vorrang vor Auffindbarkeit.

### D31 – Seminarphase bleibt einwertig (Klarstellung zu D14/D15/D21)

**Anlass:** Die Analyse der realen Seminarkonzepte (siehe D28/D29) zeigte Altdaten, bei denen an einer einzelnen Seminareinheit mehrere Seminarphasen gleichzeitig ausgewählt waren (z. B. „Wissen vermitteln" + „Reflexion" + „Transfer"). **Klarstellung des Auftraggebers:** Das ist keine gewünschte Eigenschaft, sondern eine Unsauberkeit des bestehenden Tools, das eine Mehrfachauswahl technisch zuließ, obwohl eine Seminareinheit didaktisch immer zu **genau einer** Phase gehört – Phasen finden nicht gleichzeitig statt.

**Entscheidung:** Die Seminarphase bleibt im Umbau ein **einwertiges Feld** (Single-Select) – das entspricht ohnehin der bisherigen Annahme in D14 (harter Filter „Phase"), D15 (Phasenabdeckungs-Regel, zählt je Einheit eine Phase) und D21 (Feldliste). Keine dieser Entscheidungen muss geändert werden.

**Für die Umsetzung (kein Konzeptthema):** Importierte Altdaten mit mehreren Phasenwerten an einer Einheit brauchen beim Import eine Klärung (z. B. erste Phase übernehmen, Rest als Hinweis im Import-Bericht) – Detail, keine Richtungsentscheidung.

### D32 – Seminarkonzepte nutzen denselben Mechanismus wie Methoden-Sammlungen (löst Frage 9)

**Anlass:** Klärung von Frage 9 (Abschnitt 6) – soll es eine globale Bibliothek auch für komplette Seminarkonzepte geben, und falls ja, mit welchem Verfahren?

**Entscheidung:** Keine Unterscheidung zwischen Methoden-Sammlungen und Seminarkonzepten in der Freigabe-Infrastruktur. Beide durchlaufen exakt denselben, bereits bestehenden Mechanismus:

- Einreichen (D16-Tab „Import/Export", D24) → Prüfung durch zugewiesene Konzeptverantwortliche → Status-Zyklus draft/review/published/archived in `local_seminarplaner`.
- Derselbe Filter global/lokal im Import/Export-Tab (bereits im Code vorhanden) steuert, welche Seminareinheiten je nach Auswahl eines globalen oder lokalen Konzepts gelistet werden – kein neuer Filter nötig.
- Reimport verhält sich wie bisher: Das globale Konzept wird 1:1 in den Seminarplaner gelegt, ohne etwas Bestehendes zu überschreiben; lokale Anpassungen bleiben lokal und fließen nur über einen erneuten, expliziten Einreichen-Vorgang ins globale Original zurück.

**Warum das stimmig ist statt eine Vereinfachung auf Kosten der Genauigkeit:** Der bestehende Review-Workflow (Konzeptverantwortliche, Diff-Ansicht, Status-Zyklus) wurde ursprünglich für Seminarkonzepte entwickelt – im Code sichtbar am Baustein „Globales Konzept zur Review bereitstellen", der Seminareinheiten zu einem kompletten, benannten Konzept bündelt. Methoden-Sammlungen sind historisch der Sonderfall, der dieselbe Infrastruktur mitnutzt. Für den Umbau heißt das: keine getrennten Wege für D28s zwei globalisierbare Objekttypen, sondern ein gemeinsamer, bereits erprobter Weg.

**Konsequenz:** Frage 9 ist damit entschieden – Seminarkonzepte bekommen eine globale Bibliothek, identisch zur bestehenden Infrastruktur für Methoden-Sammlungen. D30 (Sichtbarkeits-Grundsatz: lokal per Default, global nur nach explizitem Einreichen) gilt unverändert für beide Objekttypen.

### D33 – Globale Methoden-Sammlungen immer über die Bibliotheksansicht nutzbar, kein Vor-Import nötig (Erweiterung zu D29)

**Anlass:** Wunsch des Auftraggebers, jenseits des Review-Prozesses zu denken: Referentinnen sollen beim Planbau nicht erst eine ganze Methoden-Sammlung importieren müssen, um daraus wählen zu können.

**Entscheidung (Grundsatz, UX-Ausgestaltung folgt):** Die globale Methoden-Bibliothek (D29) steht beim Planbau **immer** durchsuchbar zur Verfügung – über die Facetten aus D29 – unabhängig davon, ob zuvor eine komplette Methoden-Sammlung in die eigene Aktivität importiert wurde. Eine einzelne globale Methode kann direkt aus der Bibliotheksansicht heraus in den entstehenden Seminarplan übernommen werden, ohne den Umweg über einen vorherigen Sammlungs-Import.

**Was mit der übernommenen Seminareinheit passiert:** Beim Übernehmen entsteht sofort eine **Kopie** – eine eigene, lokal editierbare Seminareinheit, getrennt vom globalen Original, genau wie heute nach einem klassischen Set-Import. Keine Live-Verknüpfung: spätere Änderungen am globalen Original wirken sich nicht rückwirkend auf bereits übernommene Kopien aus. Das entspricht D30 (Kontrolle über eigene, lokale Inhalte hat Vorrang).

**UX-Konzept final entschieden durch D59:** Suchen-und-Ablegen direkt an der D14-Vorschlagsstelle in der Sequenzansicht, zusätzlich bleibt der Bibliothek-Tab (D50/D55) als zweiter, unabhängiger Weg zum freien Stöbern erhalten.

### D34 – Übergangsstrategie: kein Umschalter zwischen zwei Bearbeitungsoberflächen, sondern Vertrautheit über drei Hebel

**Anlass:** Vorschlag des Auftraggebers, alte (Grid) und neue (Sequenzansicht) Oberfläche per Button umschaltbar parallel anzubieten, um Referentinnen die Eingewöhnung zu erleichtern – geprüft anhand des ersten Chrome-Wireframes.

**Warum ein Umschalter verworfen wird:** Grid und Sequenzansicht sind keine zwei Ansichten auf dieselbe Bearbeitungslogik, sondern zwei unterschiedliche Herangehensweisen (freie Zeitplatzierung vs. geordnete Anker-Sequenz mit Baustein-Varianten). Ein Umschalter würde bedeuten, beide Bearbeitungswege dauerhaft parallel funktionsgleich zu halten – insbesondere die neuen Baustein-Varianten (D20, ganzes Paket auf einmal austauschen) lassen sich nicht bruchlos auf das bestehende Grid-„slotkey"-Muster übertragen, das für einzelne Alternativen gedacht ist. Das wäre kein Übergang, sondern zwei zu pflegende Produkte.

**Stattdessen drei Hebel, die Vertrautheit erzeugen, ohne eine zweite Bearbeitungsoberfläche zu bauen:**

1. **Grid bleibt als reine Lese-/Überblicksansicht bestehen** (bereits in D11 so festgelegt) – kein zweiter Bearbeitungsweg, sondern ein vertrauter Blickwinkel auf dieselben Daten. Referentinnen sehen ihren Plan weiter im gewohnten Layout, bearbeiten aber ausschließlich in der Sequenzansicht.
2. **Einmalige, transparente Übersetzungs-Anzeige** beim ersten Öffnen eines bestehenden Plans nach dem Umbau: „So sah dein Tag bisher aus → so sieht er jetzt aus". Nutzt die in D20 bereits belegte verlustfreie Umrechnung Grid↔Sequenz. Kein dauerhaftes Feature, sondern ein einmaliger Vergleichs-Moment, der die Sorge „ist mein Plan noch da?" auffängt.
3. **Gestaffelter visueller Übergang statt gestaffelter Funktions-Umschaltung:** Zunächst die neue Struktur in vertrauter Optik einführen (siehe Chrome-Variante „Vertraut", heutiges Wireframe), erst wenn sich das gesetzt hat, schrittweise Richtung der einladenderen Flipchart-Optik weiterentwickeln. *Korrigiert durch D36: kein optischer Stufenplan – die Optik bleibt dauerhaft bei „Vertraut", der eigentliche Übergang ist der Mechanismus-Wechsel.*

**Konsequenz:** Es bleibt bei einer einzigen Bearbeitungslogik (Sequenzansicht). Vertrautheit entsteht über Sichtbarkeit des Bekannten, einen einmaligen Erklär-Moment und eine gestaffelte Optik – nicht über einen dauerhaft zu pflegenden Parallelbetrieb zweier Bearbeitungswege.

### D35 – Übersetzungs-Anzeige: ein Beispieltag, echte eigene Daten, pro Referentin einmal je Plan (Konkretisierung zu D34)

**Anlass:** Konkretisierung des zweiten Hebels aus D34.

**Umfang:** Die Anzeige zeigt nur **einen Beispieltag** (den ersten Tag des Plans) im direkten Vergleich – links „So war dein Plan bisher" (altes Grid), rechts „So sieht er jetzt aus" (neue Sequenz), mit den **echten eigenen Daten** der Referentin, nicht mit einem generischen Beispiel (Anschluss an D34: das beruhigt konkreter als ein abstraktes Muster). Ergänzender Hinweistext deckt die übrigen Tage ab: „Alle weiteren Tage wurden genauso übertragen." Kein Durchblättern aller Tage – die Anzeige bleibt ein kurzer, einmaliger Moment, kein Werkzeug.

**Sichtbarkeit:** Jede Referentin sieht die Anzeige **einmal pro Plan, beim jeweils eigenen ersten Öffnen** – unabhängig davon, ob eine Kollegin denselben Plan bereits geöffnet und die Anzeige dort schon gesehen hat. Der Status wird also je Kombination aus Plan und Nutzerin gespeichert, nicht global je Plan (mehrere Referentinnen können denselben migrierten Plan bearbeiten und sollen alle einmal die Beruhigung bekommen, nicht nur die erste Person).

**Anschluss an Bestehendes:** Die nutzerbezogene Speicherung passt zur bereits vorhandenen Tabelle für nutzerbezogenen Grid-Zustand (`kgen_grid_user_state`, Grid+Nutzerin) – technische Umsetzung ist Detailarbeit, keine neue Konzeptfrage. *Präzisiert durch D43: Die eigentliche Umrechnung läuft beim Plugin-Upgrade, nicht live beim ersten Öffnen – die Anzeige selbst bleibt unverändert.*

### D36 – Kein optischer Stufenplan: Zielbild bleibt die vertraute Optik, der eigentliche Übergang ist der Mechanismus-Wechsel (Korrektur zu D34 Punkt 3)

**Anlass:** Rückfrage zum „Stufenplan" aus Punkt 11 der Nächsten Schritte. Die Klärung ergab: Der eigentliche Kern ist nicht eine optische Stufenreise über mehrere Zwischen-Chrome-Varianten, sondern die Herleitung des Wechsels von der aktuellen, Grid-basierten Seminarplan-Logik zur neuen, ablaufbasierten Sequenzlogik.

**Korrektur zu D34 Punkt 3:** Es gibt **keinen** mehrstufigen optischen Übergang (Chrome „Vertraut" → „Weicher" → „Flipchart"). Die Optik bleibt dauerhaft an die bestehende Oberfläche angelehnt (Chrome-Variante „Vertraut", siehe `sequenzansicht-wireframe-vertraut.html`). Entwickelt sich die Optik später überhaupt weiter, betrifft das höchstens Farben – **nicht** die Bedienung/Interaktion selbst. Die Flipchart-Tagesplan-Optik aus Wireframe v3 (Changelog-Eintrag p) bleibt ein Diskussionsartefakt für den Workshop-Vergleich, ist aber **nicht** das Zielbild für die tatsächliche Umsetzung.

**Was „Übergang" stattdessen bedeutet:** Der eigentliche Übergang ist ausschließlich der bereits in D35 beschriebene Mechanismus-Wechsel – von der aktuellen Grid-Logik (freie Start-/Endzeiten) zur neuen Sequenzlogik (Anker, Reihenfolge, D20) –, automatisiert und einmalig beim ersten Öffnen eines Bestandsplans nach dem Update, begleitet von der Übersetzungs-Anzeige (D35). Kein zusätzlicher, separater optischer Rollout-Mechanismus nötig. *Präzisiert durch D43: „beim ersten Öffnen" beschreibt hier den Zeitpunkt, zu dem die Referentin die Anzeige sieht – die technische Umrechnung selbst ist zu diesem Zeitpunkt bereits beim Upgrade erledigt.*

**Konsequenz:** Punkt 11 der Nächsten Schritte ist damit erledigt – es gibt keinen offenen Stufenplan mehr zu entwerfen. Verbleibende Arbeit ist rein technisch: die Herleitung/Umsetzung des Mechanismus-Wechsels selbst (Grid-Daten → Sequenz-Daten, D20-Umrechnung), kein weiteres UX-Konzept.

### D37 – B1 final entschieden: Tab heißt „Einreichen"; Prozess wird zusätzlich als Flussdiagramm erklärt

**Anlass:** Workshop-Ergebnis zu B1 (workshop-fragen.md).

**Entscheidung Begriff:** Der Tab heißt **„Einreichen"** – „Weitergeben" und „Veröffentlichen" sind damit verworfen. Die konkrete Handlung *innerhalb* des Tabs (Button) heißt **„Konzept einreichen"** bzw. entsprechend „Seminareinheit einreichen" / „Methoden-Sammlung einreichen" je nach eingereichtem Objekt (D28/D32: Seminarkonzepte und Methoden-Sammlungen laufen über denselben Mechanismus).

**Zusätzliche Erkenntnis aus dem Workshop:** Anders als bei „Veröffentlichen" vermutet, war auch bei „Einreichen" **nicht** von selbst klar, dass danach noch eine Prüfung durch die Konzeptverantwortlichen folgt und der Beitrag nicht sofort sichtbar wird. Der Begriff allein trägt diese Information also nicht – unabhängig davon, welches der drei Wörter gewählt worden wäre.

**Konsequenz:** Der Tab „Einreichen" bekommt eine sichtbare **Prozess-Erklärung als kleines Flussdiagramm** (nicht nur Fließtext), die unabhängig vom eingereichten Objekt (Seminareinheit, Methoden-Sammlung, Seminarkonzept) denselben Ablauf zeigt: **Einreichen → Prüfung durch Konzeptverantwortliche → Sichtbar für andere**. Das macht den zweistufigen Vorgang sichtbar, statt sich auf die Wortwahl zu verlassen – konsistent mit dem Grundsatz aus D4/D15, Unsicherheit durch Transparenz statt durch Begriffswahl aufzufangen.

**Offen (Detailarbeit, kein Konzeptthema):** Konkrete visuelle Gestaltung des Flussdiagramms (Icons, Anordnung, Reaktion auf laufende Einreichungen im jeweiligen Status) – Umsetzungsschritt, keine Richtungsentscheidung mehr.

### D38 – B3 final entschieden: „Methoden-Sammlung" statt „Methodenset"

**Anlass:** Workshop-Ergebnis zu B3 (workshop-fragen.md).

**Entscheidung:** Der bisherige Begriff „Methodenset" wird ersetzt durch **„Methoden-Sammlung"**. Grund aus dem Workshop: Die Referentinnen brauchten eine klare sprachliche Abgrenzung gegenüber „Seminarkonzept" (D28) – zwei Objekte, die sich nur durch das Vorhandensein eines Ablaufs unterscheiden, aber bislang ähnlich benannt waren („Konzept" im alten Code für beide, siehe D28-Anlass). „Methoden-Sammlung" macht durch das Wort „Sammlung" von selbst deutlich, dass hier keine Reihenfolge/kein Ablauf enthalten ist – im Unterschied zum „Konzept", das genau das mitbringt.

**Reichweite:** Der neue Begriff ersetzt „Methodenset" überall in der Oberfläche (Bibliotheksansicht, Einreichen-Tab, Import/Export) und in diesem Dokument an allen Stellen, die sich auf das zu benennende UI-Objekt beziehen (D28–D33, D37). Historische Änderungshistorie-Einträge (Changelog) werden wie üblich nicht rückwirkend umbenannt.

**Konsequenz:** B3 ist damit abschließend beantwortet.

### D39 – Seminareinheiten-Tab bekommt zwei benannte Unterbereiche: „Anlegen" und „Bibliothek" (Ergänzung zu D16/D18)

**Anlass:** Workshop-Ergebnis zu B4 (Tab-Namen insgesamt gegenprüfen). D16 hatte den früheren Bibliothek-Tab und das frühere Eingabeformular „Seminareinheiten" bewusst zu einem Tab verschmolzen (Begründung: beide drehen sich um dasselbe Objekt). Der Workshop-Test zeigte: Referentinnen, die das alte Tool kennen, suchen im Tab „Seminareinheiten" zuerst das Eingabeformular und finden das Durchsuchen/Stöbern dort nicht sofort – die Verschmelzung hat eine reale Erwartungslücke erzeugt, kein nur theoretisches Problem. Gleichzeitig bestätigte der Workshop, dass der Begriff „Bibliothek" für sich genommen klar und eindeutig verstanden wird.

**Entscheidung:** Der Tab-Name bleibt **„Seminareinheiten"** (D16/D18 werden nicht zurückgenommen – die Verschmelzung von Anlegen und Durchsuchen in einen Tab bleibt richtig). Innerhalb des Tabs gibt es aber zwei klar benannte, sichtbar getrennte Bereiche statt einer undifferenzierten Mischung:

- **„Anlegen"** – das Eingabeformular für eine neue Seminareinheit (D17-Modal); entspricht der Erwartung aus dem alten Tool.
- **„Bibliothek"** – das Durchsuchen/Stöbern im Bestand, inklusive importierter globaler Methoden-Sammlungen (D29) und der immer durchsuchbaren globalen Methoden-Bibliothek ohne Vor-Import (D33).

**Begründung:** Löst die Erwartungslücke, ohne die strukturelle Entscheidung aus D16 zurückzunehmen – die Referentin muss nicht zwischen zwei Tabs wechseln (das war ja gerade das Problem am alten Design), findet aber innerhalb des einen Tabs sofort den vertrauten Einstieg wieder. Der gut verstandene Begriff „Bibliothek" bleibt sichtbar erhalten, statt im Tab-Namen zu verschwinden.

**Offen (Detailarbeit):** Ob „Anlegen"/„Bibliothek" als zwei Unter-Tabs, zwei nebeneinanderliegende Bereiche oder ein Umschalter innerhalb der Seite umgesetzt werden – konkrete UI-Gestaltung, keine Richtungsentscheidung mehr.

### D40 – B5 final entschieden: Kognitive Dimension und Komplexitätsgrad entfallen, Rest bleibt

**Anlass:** Workshop-Ergebnis zu B5 (Felder-Inventur der Seminareinheit, workshop-fragen.md).

**Entscheidung:**

1. **Kognitive Dimension entfällt zugunsten der Seminarphase.** Trotz des empirischen Befunds aus D29 (in der Mitte der Taxonomie – Transfer, Erfahrungserhebung – tragen beide Felder unterschiedliche Information) wiegt die in der Praxis empfundene Doppelpflege stärker. Konsequenz für die Vorschlagsmechanik (D14): siehe D41.
2. **Farbcodierung über die Seminarphase** bleibt wie in D3 bereits festgelegt – keine Änderung, nur Bestätigung durch den Auftraggeber.
3. **Gruppengröße** bleibt in den bereits benannten drei Kategorien aus D26 (Gruppenarbeit 2–5 / Planung 10–20 / beliebig) – keine Änderung, nur Bestätigung.
4. **Komplexitätsgrad entfällt ersatzlos.** Kein Ersatzfeld, keine Zusammenlegung mit einem anderen Feld.
5. **Alle übrigen Felder bleiben unverändert** (Reihenfolge und Aufklapp-Logik aus D21 gelten weiter, nur um die zwei gestrichenen Felder verkürzt).

**Zusätzliche Rückmeldung:** Über die reine Felder-Inventur hinaus wurde der Wunsch geäußert, das Formular insgesamt noch angenehmer bedienbar zu machen. Das ist keine konkrete Entscheidung, sondern als Backlog-Idee festgehalten (Abschnitt 7) – Anschluss an den bereits bestehenden Backlog-Punkt „Formularlast".

**Konsequenz:** B5 ist damit abschließend beantwortet. D21s Feldliste ist entsprechend gekürzt.

### D41 – Bloom-Verb-Mapping (D14) zielt künftig auf die Seminarphase statt auf die Kognitive Dimension

**Anlass:** Direkte Folge von D40 – das Bloom-Verb-Mapping in der Vorschlagsmechanik (D14) brauchte durch den Wegfall der Kognitiven Dimension ein neues Ziel für seine Zuordnung.

**Entscheidung:** Bloom-Verben aus den Kompetenzerwartungen werden künftig direkt auf die Seminarphase gemappt:

| Bloom-Verb-Kategorie | → Seminarphase | Begründung |
| --- | --- | --- |
| Erinnern (benennen, definieren) | Orientierung | Grundwissen abrufen passt zum Einstieg/Ankommen im Thema |
| Verstehen (erklären, zusammenfassen, vergleichen) | Analyse | Inhaltliches Durchdringen ist der Kern der Analysephase |
| Analysieren (unterscheiden, klassifizieren, zerlegen) | Analyse | Gleiche Wortfamilie, gleicher inhaltlicher Kern |
| Anwenden (ausführen, umsetzen, durchführen) | Handlungsteil | Deckt sich mit dem empirischen Befund aus D29 (>80 % „Anwenden" im Handlungsteil) |
| Bewerten (beurteilen, kritisch einschätzen) | Transfer | Reflexion/Einordnung passt zum Rückbezug auf die eigene Praxis |
| Erschaffen (entwickeln, gestalten, konzipieren) | Transfer | Eigene Lösungen für die Praxis entwickeln ist Transfer-Arbeit |

**Bewusst ausgeklammert: Erfahrungserhebung.** Kompetenzerwartungen aus dem Themenplan sind Inhalts-/Fachziele und beschreiben so gut wie nie eine Erfahrungserhebung (Kennenlernen, Erwartungsabfrage). Das deckt sich mit dem empirischen Befund aus D29: Gerade bei Erfahrungserhebung liefen Seminarphase und Kognitive Dimension am weitesten auseinander – ein Zeichen, dass sich diese Phase einer Bloom-Zuordnung entzieht. Das Bloom-Verb-Mapping zielt deshalb nur auf die vier anderen Phasen; Erfahrungserhebungs-Einheiten werden weiterhin ausschließlich über den Stichwort-Abgleich gefunden, nicht über dieses Mapping.

**Konsequenz:** D14s weiche Sortierung bleibt zweiteilig (Stichwort-Abgleich + Bloom-Mapping), nur das Ziel des Mappings ändert sich. Kein Informationsverlust für die vier gut abgedeckten Phasen, die Lücke bei Erfahrungserhebung wird bewusst dem Stichwort-Abgleich überlassen statt künstlich eine schlechte Zuordnung zu erzwingen.

### D42 – Teil C (Wireframe-Test) abgeschlossen: alle sieben Beobachtungsaufgaben bestätigt, eine Layout-Korrektur

**Anlass:** Workshop-Ergebnis zu Teil C (workshop-fragen.md), durchgespielt anhand einer um alle C-Interaktionen ergänzten Fassung von `sequenzansicht-wireframe-vertraut.html`.

**Ergebnisse:**

1. **C1 (Verschiebe-Aktion, D3):** Hinweis und angebotene Aktion wurden verstanden. **Korrektur:** Der Überlauf-Hinweis muss dort erscheinen, wo der Überlauf tatsächlich entsteht – also am **Ende** des überlaufenden Ankers, nicht an dessen Kopf. Layout entsprechend angepasst.
2. **C2 (Baustein-Varianten, D8):** Darstellung als Pillen (statt Dropdown) wurde ohne Weiteres gefunden und verstanden – keine Änderung nötig.
3. **C3 (Einheiten-Variante, D8):** Der ⇄-Chip mit Auswahl-Popover wurde als „sehr gute Lösung" bestätigt – keine Änderung nötig.
4. **C4 (Vorschläge in die Lücke, D14):** Die Vorschlagskarten mit „Warum passt das"-Hinweis und der Weg zur Schnellanlage wurden als verständlich bestätigt – keine Änderung nötig.
5. **C5 (Einheiten-Editor, D17):** Sehr gut aufgenommen, inklusive der sichtbaren Rückmeldung nach dem Speichern (Nachrücken) – keine Änderung nötig.
6. **C6 (Didaktische Empfehlungen, D15):** Als nicht aufdringlich empfunden; die Platzierung am Ende der Seite wurde ausdrücklich als „bestens" bestätigt – keine Änderung nötig.
7. **C7 (Unbenannter Abschnitt, D10):** Der Link „＋ Überschrift geben" wurde nach kurzer Orientierung gefunden und als „sehr gut gelöst" bestätigt – keine Änderung nötig.

**Konsequenz:** Teil C ist damit vollständig abgeschlossen. Einzige Korrektur betrifft die Position des Überlauf-Hinweises (C1) – alle übrigen sechs Interaktionsmuster sind ohne Änderung bestätigt. Damit ist die gesamte Workshop-Fragensammlung (Teil A–D) abgearbeitet.

### D43 – Grid→Sequenz-Umrechnung läuft beim Plugin-Upgrade, nicht beim ersten Öffnen (Präzisierung zu D35/D36)

**Anlass:** Überlegung zur Entwicklungs- und Rollout-Strategie – wie die automatische Umrechnung (D20) technisch sauber in den Moodle-Upgrade-Mechanismus eingebettet wird.

**Präzisierung:** D35 und D36 beschrieben die Umrechnung bisher so, als geschähe sie live beim ersten Öffnen eines Bestandsplans durch die Referentin. Sauberer und dem Moodle-Update-Mechanismus entsprechend: Die eigentliche Umrechnung (Grid-Daten → Sequenz-Daten) läuft als **Upgrade-Schritt in `upgrade.php`**, ausgeführt einmalig für alle Bestandspläne, sobald die neue Plugin-Version installiert wird – nicht erst verzögert beim ersten Öffnen durch die einzelne Referentin.

**Was an D35 unverändert bleibt:** Die Übersetzungs-Anzeige selbst (ein Beispieltag, echte eigene Daten, pro Referentin einmal je Plan) bleibt wie in D35 beschrieben – sie ändert sich nur von einem Live-Rechenschritt zu einer reinen **Anzeige bereits umgerechneter Daten**. Die Referentin merkt technisch keinen Unterschied; der Moment der Beruhigung („so war es → so ist es jetzt") bleibt exakt derselbe.

**Konsequenz:** Kein Datenverlust-Risiko durch verzögerte Umrechnung, keine Sonderfälle für „noch nicht umgerechnete" Pläne im laufenden Betrieb. Die Umrechnung ist mit der Installation der neuen Version abgeschlossen, bevor irgendeine Referentin das Tool wieder öffnet.

### D44 – Arbeitsteilung Claude.ai-Projekt / Claude Code; GitHub-Feature-Branch normal, GitLab strikt gesperrt bis Stable

**Anlass:** Klärung, wie die Konzeptarbeit (dieses Projekt) und die eigentliche Implementierung (Claude Code) zusammenspielen, und Präzisierung der Push-Regeln aus dem Branch-Guard-Skill (siehe Abschnitt 8).

**Entscheidung Arbeitsteilung:** Dieses Claude.ai-Projekt bleibt durchgehend der Ort, an dem neue Richtungsentscheidungen entstehen und `seminarplaner-umbau-konzept.md` gepflegt wird – auch während der Code-Erstellungsphase. Zusätzlich wird eine Kopie des Konzeptdokuments ins Code-Repository gelegt (`docs/seminarplaner-umbau-konzept.md` auf dem Feature-Branch), damit Claude Code beim Implementieren direkten Zugriff hat. Nach jeder größeren Konzept-Session hier wird diese Kopie aktualisiert und zusammen mit den dadurch ausgelösten Code-Änderungen committet. Neue Konzeptfragen werden nicht spontan in Claude Code entschieden, sondern zurück in dieses Projekt gegeben.

**Präzisierung der Push-Regeln (Korrektur zum ursprünglichen Skill-Entwurf):** Commits und Pushes auf den Feature-Branch **nach GitHub** sind regulärer Entwicklungs-Alltag und brauchen keine Rückfrage. Gesperrt bleiben ausschließlich zwei Ziele: ein Merge/Push auf **GitHub `main`**, und **jeder** Push nach **GitLab** – GitLab wird während der gesamten Umbau-Arbeit grundsätzlich nicht angefasst, unabhängig vom Ziel-Branch dort. Einzige Ausnahme: eine explizit als stabil und produktionsreif erklärte Version für den bewussten, koordinierten Produktivsystem-Umstieg (D34–D36). Das Skill `git-branch-guard-seminarplaner` (Abschnitt 8) wurde entsprechend präzisiert.

**Konsequenz:** Ein Briefing-Dokument (`claude-code-briefing-seminarplaner.md`) fasst die wichtigsten technischen Eckpunkte (D20-Datenmodell, D19-Parser-Spezifikation, D43-Upgrade-Mechanik, weitere zentrale Mechaniken) für den Einstieg in Claude-Code-Sessions zusammen und verweist auf dieses Konzeptdokument als Referenz, statt es zu ersetzen.

**Offen, noch nicht entschieden – Zeitbedarf als Auswahlfeld ungenau:** Bei derselben Analyse fiel auf, dass „Zeitbedarf" aktuell teils als Auswahlfeld mit einer Überlaufkategorie „mehr als 180 Minuten" geführt wird, statt eine genaue Zahl zuzulassen. Der Auftraggeber hält das für einen Mangel des bestehenden Formulars – ein freier Zahlenwert wäre vermutlich richtiger als ein Auswahlfeld. Das berührt aber das gesamte Seminareinheiten-Formular (D21) und wird dort im Detail besprochen, sobald das ansteht; als Backlog-Punkt festgehalten (Abschnitt 7).

### D45 – Vorlagen der Grid-Einrichtung liefern künftig feste Vormittag-/Nachmittag-Zeiten statt eines freien Zeitbereichs

**Anlass:** Die bestehende „Lage der Tage"-Einrichtung (`grid.php`, Vorlage wählen → Wochentage/erster Tag → Zeitbereich Start/Ende → freie Pausenzeiten-Liste) kannte nur *einen* Zeitrahmen pro Tag. Die Sequenzansicht braucht aber zwei Anker (Vormittag/Nachmittag, D11) mit einem festen Trennpunkt dazwischen (D3: „Tagesstart/-ende und Pausen … sind Fixpunkte") – diese Übersetzung war bisher nicht ausgearbeitet.

**Entscheidung:**

1. **Die sechs bestehenden Vorlagen** (Standard-Woche, Seminarwoche, Wochenendseminar, Halbe Woche ×2, Kompakttag) behalten ihre heutige Aufgabe – Wochentage + erster Seminartag – und bekommen zusätzlich **feste Vormittag-/Nachmittag-Zeitspannen** als Teil der Vorlage:

   | Vorlage | Vormittag | Nachmittag | Besonderheit |
   |---|---|---|---|
   | Standard-Woche (Mo–Fr) | 08:30–12:30 | 13:15–17:30 | einheitlich alle Tage |
   | Seminarwoche (So–Fr) | 08:30–12:30 | 13:15–17:30 | einheitlich alle Tage |
   | Wochenendseminar (Fr–So) | 08:30–12:30 | 13:15–17:30 | **Freitag:** nur Nachmittag (Anreise) · **Sonntag:** nur Vormittag (Abreise) – konkrete Uhrzeiten noch offen, siehe unten |
   | Halbe Woche (Mo–Mi / Mi–Fr) | 08:30–12:30 | 13:15–17:30 | einheitlich alle Tage |
   | Kompakttag | 08:30–12:30 | 13:15–17:30 | ein Tag, trotzdem in zwei Anker geteilt (Sequenzansicht kennt nur Vormittag/Nachmittag) |
   | Individuelle Konfiguration | frei wählbar | frei wählbar | ersetzt die bisherigen Felder „Zeitbereich" und „Pausenzeiten"-Liste durch direkte Vormittag-/Nachmittag-Eingabe |

2. **Vorlage bleibt Vorbelegung, keine Festlegung.** Nach dem Anwenden landen die Zeiten in normalen, editierbaren Feldern – dieselbe Logik wie schon bei „Alternative Seminareinheiten" (D21) und beim Zeitbudget generell (D3: geführte Aktion statt stiller Automatismus). Eine Vorlage ist ein Vorschlag zum Loslegen, keine Sperre.

3. **Die bisherigen Setup-Felder „Zeitbereich" (ein Start/Ende fürs ganze Grid) und „Pausenzeiten" (freie Pausenliste) entfallen** und werden durch die Vorlagen-Zeiten ersetzt. Kurze Zwischenpausen (Kaffeepause etc.) werden nicht mehr im Voraus verplant, sondern laufen über den bereits bestehenden allgemeinen Pausenhinweis in der Sequenzansicht (D23) – der wacht ohnehin schon darüber, ob nach 1,5 Std. ohne Pause ein Hinweis erscheint.

4. **Migrationsregel für Bestandspläne (Anschluss an D43):** Für bereits existierende Grids mit Start/Ende + eigener Pausenliste braucht die automatische Grid→Sequenz-Umrechnung eine Regel für den Vormittag/Nachmittag-Schnitt. Im Best-Effort-Geist von D5/D19: Die **längste konfigurierte Pause** eines Grids gilt als Mittagspause und liefert den Schnittpunkt; gibt es keine Pause, Fallback auf 12:30.

**Offen – konkrete Uhrzeiten Wochenendseminar:** Die genauen An-/Abreisezeiten für Freitag und Sonntag beim Wochenendseminar sind praxisabhängig und noch nicht festgelegt; als offener Punkt vorgemerkt, berührt aber nicht die Struktur dieser Entscheidung (Vorbelegung, jederzeit änderbar).

**Einordnung in die Rollout-Strategie:** Obwohl D45 inhaltlich näher am Datenmodell (D20/D43) liegt, wird die Umsetzung bewusst in **Block 3** (Vorschlagsmechanik/Didaktische Empfehlungen, siehe Abschnitt 8) mit erledigt, da die Sequenzansicht-Grundlagen (Block 2) bereits abgeschlossen sind und Claude Code die Anker-Zeiten für die laufende Implementierung braucht, statt auf einen späteren, thematisch passenderen Block zu warten.

### D46 – Seminarplan-Auswahl ist ein dauerhaft sichtbarer Umschalter im Planen-Tab, kein einmaliges Gate

**Anlass:** Klärung, ob die Sequenzansicht einen vorab an anderer Stelle angelegten Seminarplan voraussetzt. Nach D16 liegt die Sequenzansicht im selben Tab wie die frühere Seminarplan-Erstellung („Planen", vormals „Seminarplan"/`grid.php`) – offen war, ob die Plan-Auswahl ein einmaliges Einstiegs-Gate ist (verschwindet nach der Wahl) oder ein dauerhaft sichtbarer Umschalter bleibt.

**Entscheidung:** Ein dauerhaft sichtbares Auswahlfeld „Seminarplan" (Dropdown) steht direkt oberhalb der Sequenz – keine Notwendigkeit, den Tab zu verlassen oder eine erneute Einstiegsmaske zu durchlaufen, um zwischen Seminarplänen zu wechseln. Bereits so in der laufenden Entwicklung umgesetzt (durch Screenshot aus Testplaner 5.1.4 bestätigt).

**Konsequenz:** Löst die ursprüngliche Sorge vollständig auf – der Sequenzer setzt keinen an anderer Stelle vorbereiteten Plan voraus, sondern trägt die Plan-Zuweisung direkt sichtbar in sich.

**Randnotiz (kein Konzeptthema, siehe Backlog):** Der Screenshot zeigt zusätzlich einen weiterhin sichtbaren „Bausteine"-Tab – das ist ein Entwicklungs-Überbleibsel und keine Revision von D16 (Bausteine-Tab entfällt bleibt gültig). Als Aufräum-Punkt im Backlog vermerkt.

### D47 – Reihenfolge-Änderung über beide Wege: ↑/↓-Buttons UND Drag & Drop (Präzisierung zu D3)

**Anlass:** Rückfrage, ob Drag & Drop als Bedienkonzept beibehalten wurde. Erste Rückmeldung aus der laufenden Entwicklung („Drag & Drop funktioniert nicht mehr") wurde zunächst als bewusste Entscheidung gegen Drag & Drop verstanden – das war ein Missverständnis. Richtig ist: **Beide Bedienwege sollen nebeneinander funktionieren.**

**Entscheidung:** Die Reihenfolge in der Sequenzansicht lässt sich sowohl über **↑/↓-Buttons** an jeder Einheit/jedem Baustein als auch per **Drag & Drop** (Maus/Touch, wie in D3 angelegt) ändern. Die Buttons sind die barrierefreie, tastaturbedienbare Variante (deckt den ursprünglichen A11y-Backlog-Punkt „Drag & Drop braucht Tastaturalternative" ab), Drag & Drop bleibt zusätzlich für Maus-/Touch-Nutzerinnen erhalten, die diesen Weg gewohnt sind oder bevorzugen. Kein Entweder-oder.

**Korrektur zu D3:** D3s Formulierung „Reihenfolge ändern per Drag" bleibt inhaltlich gültig, wird aber um die gleichwertige Button-Bedienung ergänzt – beide Wege führen zum selben Ergebnis (Reihenfolge bestimmt Zeiten, Zeitkonflikte weiterhin konstruktiv unmöglich).

**Aktueller Umsetzungsstand (kein Konzeptthema, siehe Backlog):** In der laufenden Entwicklung (Testplaner 5.1.4) funktionieren aktuell nur die Buttons, Drag & Drop ist derzeit nicht funktionsfähig. Das ist eine offene Umsetzungslücke, kein Zielzustand – als Backlog-Punkt vermerkt.

**Konsequenz:** Der A11y-Backlog-Punkt zur Tastaturalternative ist durch die Buttons erfüllt; zusätzlich offen bleibt, Drag & Drop wieder herzustellen, damit beide Wege wie vorgesehen nebeneinander funktionieren.

### D48 – Themenplan-Import zurück in die Seminarschmiede *(Revision von D13; D19 damit hinfällig)*

**Entscheidung:** Der Themenplan-Import läuft nicht mehr über einen im Plugin gepflegten PHP-Parser (D13), sondern wieder über die externe Seminarschmiede – die die vollständige Konvertierung Themenplan → Seminarplaner-Format bereits übernimmt.

**Begründung:**

1. **Pflegeaufwand.** Ein Parser im Plugin bedeutet: jede künftige Format-Änderung des Themenplans zieht ein Plugin-Update nach sich (genau der „akzeptierte Preis" aus D13). Das entfällt, wenn die Schmiede die Konvertierung trägt.
2. **Die Seminarschmiede kann inzwischen mehr** als zum Zeitpunkt von D5/D13 – sie ist kein reines Einzweck-Tool für den Themenplan-Import mehr.
3. **Die Schmiede wird ohnehin gebraucht:** für KI-generierte Seminarkonzepte, ein neuer Anwendungsfall außerhalb des Themenplan-Imports. Damit lohnt sich die zentrale Pflege dort strukturell, unabhängig vom Parser.

**Bewusst in Kauf genommener Preis – der Medienbruch aus D5 kehrt zurück.** Das war 2026 in D13 das entscheidende Gegenargument (drei manuelle Schritte über ein externes Tool, genau die Reibung, die eine Zielgruppe mit geringer IT-Kompetenz am härtesten trifft) und ist **nicht** technisch gelöst (keine direkte Anbindung/API). Diesmal überwiegen Pflegeaufwand und Doppelnutzung der Schmiede diesen Nachteil – eine bewusste Abwägung, keine Wiederholung des alten Arguments „Bequemlichkeit". Für die Zielgruppe bleibt der Umweg über ein externes Tool eine reale Hürde; falls sich das im Praxisbetrieb als zu große Reibung erweist, ist das ein Kandidat für eine erneute Revision (Backlog-Hinweis in Abschnitt 7).

**Konsequenz für D19:** Die Parser-Spezifikation (Tabellen-Erkennung, Wochentags-Mapping, (V)/(N)-Anker-Fallbacks, organisatorische Blöcke über leere Kompetenzerwartungen-Zelle, Best-Effort mit Import-Bericht) wird **nicht mehr als PHP-Spezifikation benötigt** – sie ist in der Seminarschmiede bereits umgesetzt. D19 bleibt im Dokument als fachliche Referenz stehen (falls die Schmiede-Logik je dokumentiert/geprüft werden muss), ist aber kein Arbeitsauftrag für die Plugin-Implementierung mehr.

**Konsequenz für Abschnitt 5 (Import-Zielformat):** Der Import läuft weiterhin über das bestehende `seminarplaner-component-export`-JSON-Format – die Schmiede liefert dieses Format, der Import/Export-Tab im Plugin nimmt es entgegen wie jeden anderen Import auch. Kein neuer Weg, sondern der alte Weg aus D5, nur mit dem seither unveränderten Zielformat.

### D49 – Überblick: Klick-Navigation zur Sequenz statt Wochen-/Tagesansicht (Präzisierung zu D11/D34)

**Anlass:** Rückmeldung, dass der Überblick in der laufenden Entwicklung noch nicht mit der Sequenzansicht synchronisiert ist (siehe Backlog, Abschnitt 7) – daraus abgeleitet zwei konzeptionelle Präzisierungen, wie der Überblick künftig mit der Sequenz zusammenspielen soll.

**Entscheidung:**

1. **Der Wochen-/Tages-Umschalter im Überblick entfällt ersatzlos.** Der Überblick zeigt ausschließlich den Wochen-Gesamtblick – das entspricht bereits dem in D11 festgelegten Zweck („Grid = Überblick über alle Tage"). Eine zusätzliche Tagesansicht dort würde die Sequenzansicht-Funktion verdoppeln, ohne einen eigenen Zweck zu erfüllen.
2. **Klick auf eine Seminareinheit im Überblick öffnet direkt den entsprechenden Tag in der Sequenzansicht zum Bearbeiten.** Das ergänzt den bisher nur allgemein am Kopf stehenden „Zur Sequenz wechseln"-Button (D34) um eine kontextbezogene Navigation: Referentin sieht einen Baustein im Wochenblick, klickt drauf, landet zum Bearbeiten genau an dieser Stelle in der Sequenz. Der allgemeine „Zur Sequenz wechseln"-Button bleibt zusätzlich bestehen, für den Fall, dass die Referentin ohne Bezug zu einer bestimmten Einheit wechseln möchte.
3. **Microcopy-Hinweis:** „Klicke auf eine Seminareinheit, um sie in der Sequenzansicht zu ändern" ergänzt den bestehenden Hinweistext im Überblick.

**Konsequenz:** `grid-ueberblick-wireframe-vertraut.html` braucht eine entsprechende Anpassung (Woche/Tag-Buttons entfernen, Events klickbar machen) – Design-Detailarbeit, keine neue Richtungsfrage. Die Klick-Navigation setzt voraus, dass der Überblick aus denselben Daten wie die Sequenzansicht liest (siehe offene Umsetzungslücke in Abschnitt 7); ohne diese Synchronisation lässt sich die Navigation nicht sauber verdrahten.

### D50 – Tab wird zu „Bibliothek"; „Anlegen" entfällt als eigener Bereich; zusätzlicher Einstiegspunkt in der Sequenz (Revision von D39)

**Anlass:** Ein aktueller Screenshot aus der laufenden Entwicklung (Testplaner) zeigte, dass die D39-Lösung („Anlegen" und „Bibliothek" als zwei Unterbereiche im Tab „Seminareinheiten") in der Umsetzung zu viel Redundanz erzeugt: Der „Anlegen"-Bereich ist im Kern nur das D17-Modal-Formular, groß und vorangestellt, bevor man überhaupt zur eigentlichen Sammlung kommt. Das bringt dieselbe Art von Umweg zurück, die D16/D39 eigentlich beseitigen sollten.

**Entscheidung:**

1. **Der Tab/Menüpunkt heißt künftig „Bibliothek"** statt „Seminareinheiten". Das revidiert die Tab-*Beschriftung* aus D16/D18/D39 – der in D18 festgelegte Grundsatz, dass „Seminareinheit" der führende *Objekt*-Begriff im gesamten UI bleibt, ist davon nicht betroffen, nur der Name dieses einen Tabs ändert sich.
2. **Der Tab enthält nur noch einen Bereich:** die durchsuchbare Sammlung aller Seminareinheiten mit den bestehenden Filtern/Facetten (D29, D33). Die separate Unteransicht „Anlegen" aus D39 entfällt als eigener sichtbarer Bereich.
3. **„Neue Seminareinheit anlegen" wird zum Button innerhalb der Bibliothek**, der den bestehenden D17-Modal-Editor öffnet – kein eigenes Unterformular mehr. Das ist weiterhin der zweite der drei D17-Einstiege, nur ohne eigenen Tab-Bereich drumherum.
4. **Zusätzlicher, gleichwertiger Einstiegspunkt in der Sequenzansicht:** ein „Neue Seminareinheit anlegen"-Button direkt an der Stelle, an der man bereits eine neue Einheit oder Pause einfügen kann – nicht als schwebender Button auf jeder Seite. Öffnet ebenfalls den D17-Modal, aber ohne Vorbelegung (im Unterschied zum D14-Lücken-Einstieg, der Phase/Dauer aus dem Platzhalter vorausfüllt und als dritter, kontextspezifischer Einstieg zusätzlich bestehen bleibt).

**Begründung:** Löst die in D39 nur teilweise behobene Redundanz vollständig auf, ohne den in D39 bestätigten Kern zu verlieren – der gut verstandene Begriff „Bibliothek" (D39-Workshop-Befund) bleibt sichtbar, jetzt sogar als Tab-Name selbst statt nur als Unterbereich. Gleichzeitig beantwortet Punkt 4 den bislang offenen Backlog-Punkt „vierter, jederzeit erreichbarer Einstieg zum Einheiten-Editor" (Ergänzung zu D17/D39): Die Position war dort offen (schwebend vs. feste Stelle, überall vs. nur Sequenz) – jetzt entschieden auf die Sequenzansicht, direkt neben den bestehenden „Hinzufügen"-Kontrollen.

**Konsequenz:** D39 wird durch D50 abgelöst (Änderungshistorie bleibt wie üblich unverändert). D16-Tabelle (Tab-Name „Seminareinheiten" → „Bibliothek") und der Backlog-Punkt „vierter Einstieg" (Abschnitt 7) sind entsprechend angepasst; Letzterer ist damit final beantwortet und kein offener Punkt mehr.

### D51 – Einreichen-Seite: Weggabelung vor den Formularen, Zusammenführung der beiden „bestehende Sammlung"-Blöcke

**Anlass:** Screenshot-Analyse der laufenden Entwicklung (`review.php`, Tab „Einreichen"). Der obere Seitenbereich (4-Schritte-Erklärung „Einreichen → Prüfung → Freigabe → Für alle da" plus Statusliste „Wo stehen deine Einreichungen?") funktioniert gut und bleibt unverändert. Der untere Formularbereich zeigt jedoch drei Blöcke untereinander, die als durchgehende Liste wirken, obwohl es sich um zwei getrennte Wege handelt:

1. „Geänderte oder neue Seminareinheit bereitstellen" (Sammlung wählen + Update-Hinweis) und der direkt folgende, fast wortgleich betitelte Block „Geänderte oder neue Seminareinheit**en** bereitstellen" (Kandidaten auswählen + einreichen) gehören inhaltlich zusammen, sind aber technisch in zwei Boxen mit uneinheitlicher Formulierung (Singular/Plural, fehlende Nummerierung im zweiten Block) gesplittet.
2. „Neue Methoden-Sammlung einreichen" ist ein eigenständiger, alternativer Vorgang (etwas Neues bündeln statt Bestehendes ergänzen).

Ohne erkennbare Weggabelung entsteht der Eindruck, man müsse alle Blöcke der Reihe nach abarbeiten, statt sich für einen der beiden Wege zu entscheiden.

**Entscheidung:**

1. **Weggabelung vor den Formularen:** Ein neuer, kurzer Auswahlschritt mit der Frage „Was möchtest du einreichen?" und *(ergänzt bei der Umsetzung am 13. Juli 2026, siehe Änderungshistorie bd)* **drei** Optionen – *„Eine bestehende Methoden-Sammlung ergänzen oder aktualisieren"*, *„Eine neue Methoden-Sammlung zusammenstellen"* und *„Ein Seminarkonzept einreichen"*. Die dritte Option kam hinzu, weil seit der Formulierung dieser Entscheidung der D32-Block „Seminarkonzept einreichen" auf derselben Seite entstanden ist; ihn außerhalb der Weggabelung dauerhaft sichtbar zu lassen, hätte genau die „muss ich alle Blöcke abarbeiten?"-Verwirrung wiederhergestellt, die D51 beseitigt. Erst nach Auswahl erscheint der passende Bereich; die jeweils anderen bleiben verborgen statt dauerhaft sichtbar.
2. **Zusammenführung der beiden „bestehende Sammlung"-Blöcke** zu einem einzigen, durchgängig formulierten Ablauf (Sammlung wählen → Kandidaten prüfen → einreichen) statt zwei optisch getrennter Kästen mit uneinheitlicher Überschrift.
3. **Info-Bereich oben (4-Schritte-Erklärung, Statusliste) bleibt unverändert** – er löst bereits ein anderes Verständnisproblem gut und ist von dieser Entscheidung nicht betroffen.

**Begründung:** Löst die Verwechslungsgefahr an der Wurzel (fehlende Weggabelung, redundante Blocktitel), ohne die bereits gut funktionierenden Teile der Seite anzufassen. Folgt demselben Prinzip wie D11/D49 (Anker als benannte Abschnitte statt Sammelansicht): erst die Orientierung/Entscheidung, dann die dafür relevanten Felder.

**Konsequenz:** Neuer Backlog-Punkt (Abschnitt 7) für die Umsetzung durch Claude Code: `review.php` entsprechend umbauen (Weggabelung + Blockzusammenführung), Formulierungen vereinheitlichen (Singular/Plural, „Methoden-Sammlung" statt „Konzept"/„Methodenset" gemäß D38, falls dort noch nicht durchgängig). Kein neues Wireframe zwingend nötig, kann aber bei Bedarf im „Vertraut"-Stil ergänzt werden.

### D52 – PDF-Export: eigenständige Materialliste + dauerhaftes Logo im Seitenkopf

**Anlass:** Priorisierter Punkt „Materialcheck" aus der Lücken-Analyse (12. Juli 2026, Perspektive Bildungsreferentin/ehrenamtlicher Referent), konkretisiert durch den Auftraggeber; Logo-Wunsch als eng verwandte Ergänzung zum bestehenden PDF-Export mit aufgenommen.

**Entscheidung:**

1. **Neue, eigenständige Materialliste als separates PDF** (dritte Export-Option neben ZIM-PDF und Konzeptsammlung-PDF, siehe Abschnitt 2/Ist-Stand): listet alle benötigten Materialien ohne Doppelungen, den einzelnen Seminartagen zugeordnet, im Layout einer Abgabeliste (zum Abhaken/Bereitstellen).
2. **Logo im PDF-Seitenkopf**, wahlweise oben rechts oder oben links positionierbar. Das Logo wird **einmalig pro Aktivität hochgeladen und gespeichert** – gilt danach automatisch für alle künftigen PDF-Exporte dieser Aktivität, kein erneuter Upload pro Export nötig.

**Konsequenz:** Backlog-Punkt für Claude Code: dritter Export-Button „Materialliste-PDF erstellen" neben den bestehenden (`kg-pdf-zim`, `kg-pdf-flow`) im Import/Export-Tab; Logo-Upload und Positions-Auswahl (rechts/links) als neues, dauerhaft gespeichertes Aktivitäts-Setting, das beim PDF-Export automatisch gezogen wird.

### D53 – Didaktische Empfehlungen: neue Regel „Zeitrahmen-Hinweis" (Ergänzung zu D15/D22/D23)

**Anlass:** Priorisierter Punkt „Gesamtzeit-Check" aus der Lücken-Analyse (12. Juli 2026). Die Didaktischen Empfehlungen geben bisher Hinweise pro Tag/Anker, aber keinen Abgleich der Gesamtsumme aller geplanten Bausteine gegen den verfügbaren Zeitrahmen.

**Entscheidung:**

1. **Der Zeitrahmen ergibt sich automatisch** aus den gewählten Seminartagen und den zugehörigen Vormittag-/Nachmittag-Anker-Zeiten (D45) – kein zusätzliches Eingabefeld für „offiziell gebuchte Stunden".
2. **Neue Regel in den Didaktischen Empfehlungen** (achte Regel, nach D23s Pausenhinweis): Wenn die Summe der geplanten Bausteine den verfügbaren Zeitrahmen über- oder deutlich unterschreitet, erscheint ein Hinweis in den bestehenden Dramaturgie-Empfehlungen.
3. **Gleicher Ton wie die übrigen Regeln** (D15): reiner Hinweis, keine Warnung/Blockade, positive Formulierung, stille Behandlung bei fehlenden Daten – keine Sonderbehandlung gegenüber den anderen sieben Regeln.

**Konsequenz:** Backlog-Punkt für Claude Code: neue Regel in der Logik der Didaktischen Empfehlungen ergänzen, Formulierung im etablierten Hinweis-Ton (Beispiel folgt bei Bedarf als eigener Konzeptions-Schritt, analog zu D22/D23).

**Umsetzungsstand (13. Juli 2026, Version 2026071504):** Umgesetzt als achte Regel in `sequenz.js` (`dramaFindings`, nach dem Pausenhinweis). Kapazität = Summe der Anker-Fenster über alle Tage (`dayFrame`/`anchorBudget`, D45-Flags automatisch berücksichtigt), verplant = Summe aller Platzierungen (`usedMinutes`, Einheiten + Pausen). Drei Fälle: überfüllt (verplant > Rahmen + 10 Min.) / deutlich zu leer (Rest > 60 Min. und verplant < 75 % des Rahmens) / passt. Still bei fehlender Anker-Zeit oder leerem Plan. Browser-verifiziert.

### D54 – Kein Auto-Update-Schalter mehr; Hinweis in der Bibliotheks-Kartenansicht; lokale Änderung hat immer Vorrang

**Anlass:** Priorisierter Punkt „Sichtbarkeit bei Auto-Update", zusammen mit dem im Backlog zurückgestellten „Konfliktfall beim Auto-Update" geklärt – beide lösen sich mit derselben Entscheidung.

**Entscheidung:**

1. **Die Checkbox „Auto-Update für dieses Konzept aktivieren" entfällt ersatzlos** aus dem Import/Export-Tab – niemand versteht, was Aktivieren/Deaktivieren tatsächlich bewirkt.
2. **Statt eines Ein/Aus-Schalters: automatischer Hinweis in der Karten-Ansicht der Bibliothek.** Sobald eine Seminareinheit innerhalb einer übernommenen globalen Methoden-Sammlung/eines Seminarkonzepts von der Konzeptverantwortlichen aktualisiert wurde, erscheint der Hinweis direkt an der betroffenen Karte – dort, wo ohnehin gearbeitet wird, kein separater Sammel-Ort.
3. **Konfliktfall eindeutig zugunsten der Nutzerin gelöst:** Wurde die lokale Kopie selbst verändert, hat diese Änderung immer Vorrang. Eine globale Aktualisierung wird nie automatisch übernommen und überschreibt nie etwas still. Es gibt maximal den einen Hinweis „aktualisierte Version verfügbar" – keine Rückfrage-Dialoge, keine erzwungene Übernahme.
4. Der bestehende Button „Ausstehende Updates übernehmen" bleibt als einziger, bewusster Weg, eine Aktualisierung tatsächlich zu holen – nur eben nie automatisch ausgelöst.

**Begründung:** Konkretisiert D30 (Kontrolle über eigene, lokale Inhalte hat Vorrang) für genau diesen Fall, statt es offenzulassen.

**Konsequenz:** Backlog-Punkt „Konfliktfall beim Auto-Update" ist damit final beantwortet und entfällt aus der offenen Liste. Technischer Umbau des `methodset_sync_service` (Checkbox raus, Hinweis-Logik an der Kartenansicht rein) als neuer Backlog-Punkt für Claude Code.

### D55 – Bibliothek: drei Tabs statt durchgehender Liste (Ergänzung zu D50)

**Anlass:** Rückmeldung, dass in der Bibliothek aktuell unter Umständen mehrere Sammlungen unkomfortabel untereinanderstehen.

**Entscheidung:** Innerhalb des Bibliothek-Tabs (D50) gibt es künftig drei klar getrennte Unterbereiche als Tabs:

1. **„Methodensammlungen"** – globale Methoden-Sammlungen (D29/D33), immer durchsuchbar ohne Vor-Import. Methoden (D28, der inhaltsfreie Sonderfall) gehen hier mit auf, kein eigener Tab dafür.
2. **„Globale Seminarkonzepte"** – nur die Seminarkonzepte, die aktiv über „Globale Konzepte importieren" (D32) geholt wurden. Kein automatisches „immer da" wie bei den Methodensammlungen.
3. **„Lokale Seminareinheiten"** – alle eigenständigen lokalen Kopien in der Aktivität: selbst angelegt, über die Seminarschmiede importiert (D48) oder als Kopie aus einer Methodensammlung übernommen (D33). Maßgeblich ist „eigenständige lokale Kopie", nicht „nie importiert".

**Konsequenz:** Präzisiert D50 (der Bibliothek-Tab bleibt als Ganzes bestehen, bekommt aber diese drei internen Unterbereiche statt einer durchgehenden Liste). Backlog-Punkt für Claude Code: Bibliotheksansicht entsprechend umbauen, bestehendes Filternetz (D29) bleibt innerhalb des Tabs „Methodensammlungen" erhalten.

### D56 – Vorschlagsmechanik durchsucht auch globale Methodensammlungen (Erweiterung zu D14)

**Anlass:** Direkte Folge von D55/D33 – wenn Methodensammlungen ohnehin immer durchsuchbar sind, sollte die automatische Vorschlagsmechanik beim Auffüllen einer Lücke das mitnutzen.

**Entscheidung:** D14 (Vorschlagsmechanik) durchsucht künftig nicht nur die lokal vorhandenen Seminareinheiten, sondern auch die global durchsuchbaren Methodensammlungen (D29). Globale Seminarkonzepte bleiben außen vor – die brauchen weiterhin den expliziten Import (D32). Wird ein Vorschlag aus einer Methodensammlung übernommen, entsteht sofort eine lokale Kopie (gleiches Prinzip wie D33).

**Konsequenz:** Backlog-Punkt für Claude Code: Suchraum der Vorschlagsmechanik erweitern.

### D57 – local_seminarplaner: explizites Typ-Feld für Seminarkonzept vs. Methodensammlung (Ergänzung zu D28/D32)

**Anlass:** D55 führt in der Bibliothek getrennte Tabs für „Methodensammlungen" und „Globale Seminarkonzepte" ein. Der Ist-Stand von `local_seminarplaner` unterscheidet beide Objekttypen aber nicht strukturell, nur informell über Titel-Konventionen (vgl. D28-Anlass, FST/KI-Methoden-Beispiel) – das reicht nicht mehr, um ein importiertes globales Konzept zuverlässig dem richtigen Bibliothek-Tab zuzuordnen.

**Entscheidung:** `local_seminarplaner` bekommt ein explizites Typ-Feld je globalem Konzept (Methodensammlung oder Seminarkonzept). Der Typ wird beim Einreichen (D48/D51) festgelegt und bestimmt beim Import (D32), ob das Konzept im Tab „Methodensammlungen" (immer durchsuchbar, D33) oder „Globale Seminarkonzepte" (nur nach explizitem Import, D55) erscheint.

**Begründung:** D32 bleibt unverändert – beide Objekttypen durchlaufen weiterhin denselben Workflow-Mechanismus (Status-Zyklus, Reviewer, Diff-Ansicht). Neu ist nur das strukturelle Unterscheidungsmerkmal, das D55 jetzt braucht, weil die Bibliothek beide Typen erstmals unterschiedlich behandelt.

**Konsequenz:** Backlog-Punkt für Claude Code: neues Typ-Feld in der `local_seminarplaner`-Datenbank, Migration der Bestandsdaten (bisherige Unterscheidung nur über Titel), Typ-Auswahl im Einreichen-Formular (D51) ergänzen, Import-Auswahlliste (`kg-global-set-select`) entsprechend nach Typ filtern/gruppieren.

**Umsetzungsstand (Abgleich mit Claude Code, 12. Juli 2026):** Bereits vollständig umgesetzt, sogar schon **vor** dieser Entscheidung – am 10. Juli wurde im Rahmen von „D32 Seminarkonzept-Einreichen" die Spalte `concepttype` (Werte `sammlung`/`seminarkonzept`) in `local_seminarplaner` ergänzt (Commits 9f67f79 mod / 689303d local, Upgrade-Schritt 2026071001), inklusive Typ-Auswahl im Einreichen-Formular und typbewusster Verarbeitung beim Import. D57 bestätigt damit nachträglich eine bereits gebaute Lösung, statt eine neue anzustoßen.

### D58 – Konzeptverantwortliche: opt-in-basierte Übersichtsliste als Vertrauenssignal

**Anlass:** Vierter priorisierter Punkt aus der Lücken-Analyse (12. Juli 2026). Referentinnen sehen bisher nur eine anonyme Zahl („Konzeptverantwortliche: 1"), ohne zu wissen, wer dahintersteht.

**Entscheidung:**

1. **Allgemeine Liste statt Kennzeichnung am einzelnen Konzept:** Eine Übersicht „Das sind unsere Konzeptverantwortlichen" zeigt alle Personen, die sich dafür sichtbar gemacht haben – nicht objektbezogen an jeder einzelnen Sammlung/jedem Konzept.
2. **Opt-in pro Person, nicht pro Konzept:** Eine Konzeptverantwortliche entscheidet einmal für sich, ob sie in dieser Liste erscheint – gilt dann einheitlich für alle von ihr betreuten Konzepte, keine Einzelfall-Entscheidung pro Sammlung.
3. **Reines Vertrauens-/Orientierungssignal**, kein Kontaktweg: Die Liste zeigt nur, dass echte Personen hinter den Konzepten stehen – sie ersetzt keinen Rückmeldeweg (der bereits als eigener, noch offener Backlog-Punkt „Rückkanal nach der Durchführung" vorgemerkt ist).

**Konsequenz:** Backlog-Punkt für Claude Code: neue Übersichtsliste (Platzierung naheliegend im Einreichen-Tab, in der Nähe der bestehenden Prozess-Erklärung aus D37), Opt-in-Einstellung pro Nutzerin mit Konzeptverantwortlichen-Rolle.

### D59 – UX-Konzept „Bibliothek beim Planbau": Suchen-und-Ablegen direkt an der Lücke, zusätzlich zum bestehenden Bibliothek-Tab (löst D33-UX, letzte offene Frage aus Abschnitt 8)

**Anlass:** Letzte offene Gestaltungsfrage aus den „Nächsten Schritten" (Punkt 10) – wie die immer durchsuchbare globale Bibliothek (D33) konkret in den Sequenz-Workflow eingebunden wird.

**Entscheidung:**

1. **Suchen-und-Ablegen direkt an der Lücke:** An der Stelle, an der die Vorschlagsmechanik (D14) bereits automatische Vorschläge einblendet, gibt es zusätzlich ein Suchfeld für die manuelle Suche in der kompletten Bibliothek (D55: Methodensammlungen + lokale Seminareinheiten). Eine übernommene Methode wird sofort als lokale Kopie angelegt (wie D33).
2. **Der Bibliothek-Tab (D50/D55) bleibt zusätzlich vollständig erhalten** – kein Ersatz, sondern zwei parallele Wege zum selben Bestand: gezieltes Suchen an der konkreten Lücke während des Planbaus, und freies Stöbern/Vorbereiten unabhängig von einer aktuellen Lücke über den Tab.

**Begründung:** Führt kein neues Bedienkonzept ein, sondern erweitert die bereits verstandene Vorschlags-Stelle (D14) um eine manuelle Variante – konsistent mit dem Grundsatz, auf vertrauten Mustern aufzubauen statt Bildschirmfläche dauerhaft zu teilen (Andock-Panel) oder einen zusätzlichen Fokuswechsel zu erzwingen (separates Fenster), wo es nicht nötig ist.

**Konsequenz:** Punkt 10 der „Nächsten Schritte" (Abschnitt 8) ist damit final entschieden. Backlog-Punkt „UX-Konzept Bibliothek ohne Vor-Import (D33, offen)" entfällt, ersetzt durch einen Umsetzungs-Backlog-Punkt für Claude Code: Suchfeld an der D14-Vorschlagsstelle in der Sequenzansicht ergänzen.

### D60 – Begriff „Dramaturgie-Check"/„Dramaturgie-Blick" wird zu „Didaktische Empfehlungen" (Revision der Benennung in D15/D22/D23/D27/D53)

**Anlass:** Beim Abgleich mit dem Arbeitsstand aus Claude Code zeigte sich, dass die Weboberfläche den Bereich bereits auf Nutzerwunsch von „Dramaturgie-Blick" in **„Didaktische Empfehlungen"** umbenannt hat (Commit 12d9b6c, 10. Juli). Diese Umbenennung war noch nicht ins Konzeptdokument zurückgeflossen.

**Entscheidung:** Der Begriff **„Didaktische Empfehlungen"** wird rückwirkend als einheitliche Bezeichnung für den in D15 eingeführten Mechanismus übernommen – ersetzt „Dramaturgie-Check" (fachlicher Name des Mechanismus) und „Dramaturgie-Blick" (bisheriger UI-Bereichsname) einheitlich. Die fachliche Grundidee aus D15 (nur Hinweise, keine Warnungen, Stille bei fehlenden Daten, positive Formulierung) bleibt vollständig unverändert – es ändert sich ausschließlich der Name.

**Nicht betroffen:** Der Begriff „Dramaturgie" für die pädagogische Grundidee des Seminaraufbaus bleibt in Fließtext-Erwähnungen unverändert (z. B. „die Dramaturgie eines Seminartags") – ebenso „Dramaturgie-Vorlage" (D3/D4, die phasenbasierte Vorstrukturierung eines neuen Tags), ein eigenständiger, klar unterschiedener Begriff, der nicht Gegenstand dieser Umbenennung ist.

**Konsequenz:** Alle Erwähnungen von „Dramaturgie-Check"/„Dramaturgie-Blick" als Mechanismus-/Bereichsname in D15, D22, D23, D25, D27, D53 sowie in Abschnitt 1, 6, 8 und 10 werden auf „Didaktische Empfehlungen" umgestellt (Änderungshistorie bleibt wie üblich unverändert, D38-Präzedenzfall). Die D-Nummern selbst behalten ihre ursprünglichen Titel-Anker nicht wortgleich, sondern in der neuen Benennung – die inhaltliche Entscheidung bleibt jeweils dieselbe.

**Umsetzungsstand: bereits vollständig erledigt, kein Arbeitsauftrag für Claude Code.** Anders als bei den übrigen D5x-Entscheidungen ist hier nichts mehr zu bauen – die Umbenennung ist im Code längst umgesetzt (Commit 12d9b6c, 10. Juli: Toolbar-Label, Panel-Überschrift in `sequenz.js`; die interne User-Preference `mod_seminarplaner_dramaturgie` bleibt bewusst unverändert, das betrifft nur den sichtbaren Text). D60 zieht ausschließlich das Konzeptdokument nach, damit Begriff und Code wieder übereinstimmen. Kein Backlog-Punkt nötig.

### D61 – Neues „Seminarziele"-Feld am Gesamtplan + manuelle Verknüpfung mit Seminareinheiten (neue Regel „Zielabdeckung" in den Didaktischen Empfehlungen)

**Anlass:** Wunsch, die Gesamtziele des Seminars mit den Teilzielen (Lernziele, D21) der einzelnen Seminareinheiten abzugleichen, um zu prüfen, ob alle Ziele abgedeckt sind – analog zum Zeitrahmen-Check (D53), aber mit Freitext statt Zahlen.

**Entscheidung:**

1. **Neues Feld „Seminarziele" am Gesamtplan:** eine Liste einzelner, kurzer Zielformulierungen (Freitext, ähnlich den „Ich-kann …"-Lernzielen der Seminareinheiten), von der Referentin selbst eingetragen. Unabhängig vom Themenplan-Import – D19 (Bildungsziel-Kopfblock wird nicht importiert) bleibt unverändert, dies ist ein separates, manuell gepflegtes Feld.
2. **Manuelle Verknüpfung statt automatischem Abgleich:** Da Lernziele Freitext sind, lässt sich eine Abdeckung nicht zuverlässig automatisch erkennen. Die Referentin verknüpft deshalb jedes Seminarziel händisch mit den Seminareinheiten, die es adressieren (Checkliste je Ziel).
3. **Neue, neunte Regel in den Didaktischen Empfehlungen** (D15/D22/D23/D53): „Zielabdeckung" – meldet als Hinweis, wenn ein Seminarziel noch mit keiner Seminareinheit verknüpft ist. Gleicher Ton wie die übrigen Regeln: reiner Hinweis, keine Warnung, Stille bei fehlenden Daten (kein Hinweis, solange noch keine Seminarziele eingetragen sind).

**Konsequenz:** Backlog-Punkt für Claude Code: neues Feld/Liste „Seminarziele" am Gesamtplan (Datenmodell-Ergänzung), Verknüpfungs-UI (Checkliste je Ziel gegen die Liste der Seminareinheiten), neue Regel in der Logik der Didaktischen Empfehlungen.

**Umsetzungsstand (13. Juli 2026, Version 2026071508):** Umgesetzt. Aufklappbarer „Seminarziele"-Bereich oben in der Sequenz (`#sq-goals`); je Ziel Freitext + Verknüpfungs-Checkliste der platzierten Einheiten. Speicherung als `seminarziele`-Liste im `statejson` des Plans (kein DB-Schema-Eingriff nötig – kein install.xml/upgrade). Neunte Regel „Zielabdeckung" in den Didaktischen Empfehlungen (💡 bei unverknüpftem Ziel; ✓ wenn alle verknüpft; still ohne Ziele). Browser-verifiziert (inkl. Persistenz).

### D62 – Lernziel-Editor: Bloom-Stufe + Verb wählen, Inhalt frei ergänzen (inspiriert von „The Differentiator"; Ergänzung zu D21/D41/D61)

**Anlass:** Wunsch nach einem geführten Editor für Lernziele, angeregt durch `moodle-local_differentiator` (Bösch, basierend auf „The Differentiator" von Ian Byrd) – ein Werkzeug, das Lernziele aus Bloom-Stufe, Verb und Inhalt zusammensetzt statt sie als leeres Textfeld zu verlangen.

**Entscheidung:**

1. **Gilt gleichermaßen** für die Lernziele der Seminareinheit (D21) und die neuen Seminarziele des Gesamtplans (D61) – ein einziger Editor, zwei Einsatzorte (Prinzip wie D17).
2. **Geführter Aufbau statt leerem Feld:** Referentin wählt zuerst eine Bloom-Stufe (pädagogisch verständlich beschriftet, nicht als Fachbegriff „Kognitive Dimension"), dann ein passendes Verb aus einer kurzen Liste dazu, ergänzt den Inhalt frei. Daraus setzt sich automatisch der Satz „Die Teilnehmenden können [Verb] [Inhalt]" zusammen.
3. **Doppelnutzung der bestehenden D41-Tabelle:** Das gewählte Bloom-Verb schlägt automatisch die passende Seminarphase vor (als Vorbelegung, nicht zwingend) – dieselbe Zuordnung, die D41 schon für die Vorschlagsmechanik nutzt, keine zweite Pflege.
4. **Nichts wird zusätzlich gespeichert:** Die Bloom-Stufe ist ein Werkzeug beim Formulieren, kein neues Datenfeld – kein Widerspruch zu D40 (Kognitive Dimension bleibt gestrichen als eigenes Feld).
5. **Bestandsdaten bleiben unangetastet:** Bereits vorhandene Freitext-Lernziele migrieren nicht automatisch in die neue Struktur, der Editor greift nur bei künftiger Neu-/Bearbeitung.

**Konsequenz:** Backlog-Punkt für Claude Code: Editor-Komponente (Bloom-Stufe-Auswahl → Verb-Liste → Freitext-Ergänzung → Satz-Zusammenbau), Wiederverwendung der D41-Tabelle für die Phasen-Vorbelegung, Einbindung an beiden Stellen (D21-Modal, D61-Seminarziele-Feld).

**Umsetzungsstand (13. Juli 2026, Version 2026071508):** Umgesetzt als modaler Baukasten (Phase → Verb → Inhalt → Live-Satz-Vorschau → Übernehmen). **Präzisierung zu Punkt 2 (Nutzer-Entscheidung 13. Juli):** Statt der klassischen sechs Bloom-Stufen dienen die **fünf Seminarphasen** als Stufen (Orientierung, Erfahrungserhebung, Analyse, Handlungsteil, Transfer) – eine Taxonomie, konsistent mit dem Rest des Plugins, die Phase ist zugleich die Vorbelegung (Punkt 3). **Präzisierung zum Satz:** grammatisch korrekt „Die Teilnehmenden können [Inhalt] [Verb]" (deutscher Infinitiv am Satzende), nicht die im ursprünglichen Wortlaut notierte englische Reihenfolge „[Verb] [Inhalt]". Einbindung an beiden Stellen: Button „✎ Lernziel formulieren" am Lernziele-Feld des Einheiten-Modals (fügt den Satz an, belegt die Seminarphase vor) und Button „✎ Formulieren" an den Seminarzielen (legt daraus ein Ziel an). Browser-verifiziert an beiden Stellen.

### D63 – Geplante Baustein-Einheiten direkt platzierbar und nicht doppelt als Vorschlag (Ergänzung zu D14/D6)

**Anlass:** Nutzer-Befund an reservierten Bausteinen (13. Juli 2026): Die laut Themenplan zum Baustein gehörenden Einheiten („geplant, noch nicht platziert") waren reine Info-Zeilen ohne Platzier-Möglichkeit; sie verschwanden zudem komplett, sobald man eine einzelne Einheit platzierte; und sie tauchten nicht in den generischen Bibliotheks-Vorschlägen auf (die matchen per Stichwort/Bloom-Phase, nicht die Baustein-eigenen Einheiten). Ergebnis: Man musste eine Einheit, die dem Baustein ohnehin zugeordnet ist, umständlich in der Bibliothek suchen.

**Entscheidung:**

1. **Jede geplante, noch nicht platzierte Baustein-Einheit ist direkt platzierbar** (Button „＋ Platzieren"), ohne Umweg über die Bibliothekssuche. Das Platzieren verkleinert die Reservierung um die Dauer der Einheit – dieselbe Mechanik wie das Übernehmen eines Vorschlags (D14) bzw. das Anlegen einer lokalen Kopie (D33).
2. **Die Liste bleibt nach dem Platzieren sichtbar** und zeigt die jeweils noch offenen Einheiten – solange die Reservierung nicht aufgebraucht ist. (Vorher fiel die ganze Liste beim ersten Platzieren weg.)
3. **Reihenfolge:** Baustein-eigene geplante Einheiten zuerst, generische Bibliotheks-Vorschläge darunter. Bewusst **kein** Sammel-„Alle platzieren"-Button – die Referentin platziert einzeln und behält die Kontrolle (Prinzip wie D30).
4. **Keine Doppelanzeige:** Die Baustein-eigenen geplanten Einheiten werden aus den generischen Bibliotheks-Vorschlägen ausgeschlossen, damit dieselbe Einheit nicht gleichzeitig oben (als „＋ Platzieren") und unten (als Vorschlag) erscheint.

**Begründung:** Konkretisiert D14 (Vorschlagsmechanik) und D6 (Baustein-Stammdaten aus dem Themenplan) für den häufigsten Fall: Der Themenplan sagt bereits, welche Einheiten in den Baustein gehören – die sollen ohne Suche platzierbar sein und beim schrittweisen Befüllen sichtbar bleiben.

**Konsequenz:** Umgesetzt (Versionen 2026071505/2026071506, Commit 391ed6b, auf Staging browser-verifiziert). Kein Datenmodell-Eingriff (nutzt die vorhandene Reservierungs-/Platzierungs-Mechanik).

## 4. Themenplan-Format und Mapping (verifiziert am Original TP_2026_ki.docx)

Standardisiertes Word-Dokument, eine Tabelle. Kopf: Seminartitel, Seminartyp, Bildungsziel, Inhaltliche Schwerpunkte. Danach Seminarplan-Zeilen: Tag | Inhalt | Kompetenzerwartungen.

| Themenplan | → Seminarplaner |
| --- | --- |
| Tag-Spalte (leer = gleicher Tag) | Seminartag |
| Präfix (V) / (N) | Vormittag / Nachmittag (deckt sich mit Roter-Faden-Struktur 08:00–12:30 / 12:30–18:00) |
| Erste Zeile der Inhalt-Zelle | Baustein-Titel |
| Folgezeilen der Inhalt-Zelle | Unterthemen des Bausteins |
| Kompetenzerwartungen | schreibgeschützte Referenz am Baustein (D6) |

Besonderheit: rein **organisatorische Blöcke** existieren (z. B. Sonntag „(N) Anreise und Begrüßung") → brauchen einen eigenen Typ ohne Methodenzwang. Erkennungsmerkmal beim Import: leere Kompetenzerwartungen-Zelle (D19, Regel 5).

Ergänzung durch D12/D13: Tag-Spalte und (V)/(N)-Präfix werden beim Import nicht nur als Text mitgeführt, sondern in eine tatsächliche Platzierung (Tag + Anker) übersetzt. **Die vollständigen Parsing-Regeln inkl. Fehlerstrategie und Randfällen: D19** *(fachliche Referenz, seit D48 keine PHP-Spezifikation mehr – die Umsetzung liegt in der Seminarschmiede).*

## 5. Import-Zielformat (aus dem Plugin-Code, `importexport.js`)

*Gilt unverändert auch nach D48: Die Seminarschmiede liefert dieses Format, der Import läuft über den bestehenden Import/Export-Tab.*

```json
{
  "format": "seminarplaner-component-export",
  "version": 3,
  "exportedat": "2026-07-04T12:00:00Z",
  "components": { "methods": false, "bausteine": true, "seminarplaene": false },
  "bausteine": [
    {
      "id": "eindeutige-id",
      "title": "Von den ersten Rechenmaschinen zur heutigen KI",
      "topics": "Grundzüge der Computergeschichte …",
      "objectives": "Die Lernenden können …",
      "methods": []
    }
  ],
  "planningstate": { "units": [] }
}
```

Hinweise aus dem Code: `normalizeImportedPlanningUnits` übernimmt nur `id`, `title`, `topics`, `objectives`, `methods` – eine Dauer wird beim Import derzeit **nicht** übernommen (Default greift später). `planningstate.units` wird als Fallback-Quelle für Bausteine akzeptiert.

## 6. Offene Fragen

Alle neun Fragen sind entschieden, und der Referentinnen-Workshop ist inzwischen vollständig ausgewertet (D22–D27, D37–D42) – siehe workshop-fragen.md für die vollständige Ergebnis-Übersicht. Es gibt aktuell keine offenen konzeptionellen Fragen mehr in diesem Abschnitt; verbleibende Punkte sind Umsetzungs-/Design-Detailarbeit und stehen im Backlog (Abschnitt 7).

Aufgelöste Fragen:

- ~~9. Globale Bibliothek auch für Seminarkonzepte?~~ → **D32** (kein separates Verfahren – Seminarkonzepte nutzen denselben Einreichen-/Review-/Filter-Mechanismus wie Methoden-Sammlungen; ergänzt um **D33**: globale Methoden-Sammlungen sollen künftig ohne Vor-Import immer über die Bibliotheksansicht nutzbar sein, UX-Ausgestaltung folgt)

- ~~1. Sequenz-UI (Layout und Anker)~~ → **D11** (ein Tag mit Pfeilwechsel; Grid bleibt Overview; Anker als benannte Abschnitte mit Zeitbudget-Leiste und Pausen-Trenner)
- ~~4. Didaktische Empfehlungen~~ → **D15** (nur Hinweise, Stille bei fehlenden Daten, positive Formulierung), im Referentinnen-Workshop validiert und ergänzt: **D22** (Regeln 2/4/5/6 final), **D23** (neue Regel 7 „Pausenhinweis")
- ~~2. Migration der Bestandsdaten~~ → **D9** (Archivfeld mit geführtem Zuordnungs-Hinweis)
- ~~3. Automatische Tages-Platzierung~~ → **D12** (Tag + Anker automatisch, nicht mehr; im Plugin gemäß D13)
- ~~5. Alternativen-Mechanismus~~ → **D8** (zwei Ebenen, jederzeit austauschbar), abgegrenzt durch **D10** (nur für benannte Bausteine)
- ~~6. Zwei-Quellen-Modus~~ → **D8** (entfällt), präzisiert durch **D10** (Baustein ist optional, kein Zwang)
- ~~7. Vorschlagsmechanik~~ → **D14** (zweistufig hart/weich, Bloom-Verb-Mapping, max. 3–5 erklärte Vorschläge, Null-Treffer-Pfad mit Schnellanlage; Gruppengröße gestrichen)
- ~~8. Tab-Struktur und -Benennung~~ → **D16** (sechs Tabs entlang des Zielflusses; Bausteine-Tab entfällt, Methoden-Tab vereint Anlegen und Bibliothek, Grid als „Überblick"), Tab-Name „Einreichen" final entschieden durch **D37**

## 7. Backlog (nicht vergessen, unabhängig vom Umbau)

- **Kein Undo** im Planer – im Sequenzmodell neu bewerten, mindestens „letzte Aktion rückgängig".
- **A11y**: Statuszeile `#kg-status` ohne `aria-live` (Screenreader bekommen Meldungen nicht mit); Tastaturalternative zu Drag & Drop ist mit den ↑/↓-Buttons erfüllt (**D47**). ~~Offen: Drag & Drop selbst ist im aktuellen Entwicklungsstand nicht funktionsfähig~~ ✓ Seit Commit `4a179a8` behoben – beide Bedienwege (Buttons und Drag & Drop) funktionieren wie in D47 vorgesehen nebeneinander. Weiterhin offen bleibt nur die fehlende `aria-live`-Anbindung der Statuszeile.
- **Formularlast Seminareinheit**: ~18 Felder, jetzt 16 nach D40; entschärft durch **D17** (Modal mit offener Schnellfassung, restliche Abschnitte zugeklappt); zusätzlicher Wunsch aus dem Workshop-Nachgang zu B5: Formular insgesamt noch angenehmer bedienbar machen – Idee, noch nicht konkretisiert, bei Umsetzung mitdenken.
- **Editor-UX der Seminareinheiten-Felder (D17-Feinschliff, Merker):** ✓ aufgelöst durch **D21** (Feldreihenfolge nach Denk- und Arbeitslogik, Lernziele in der Schnellfassung, „Alternative Seminareinheiten" als Vorbelegung). ✓ **Felder-Inventur** final entschieden durch **D40** (Kognitive Dimension und Komplexitätsgrad entfallen, Rest bleibt) – Konsequenz für die Vorschlagsmechanik in **D41** (Bloom-Verb-Mapping zielt jetzt auf Seminarphase).
- **Grid-Einstieg**: zuletzt geöffneter Plan sollte direkt laden (entfällt ggf. mit Sequenz-UI, sonst umsetzen).
- **Begriffs-Inkonsistenz** in Strings: entschieden durch **D18** – „Seminareinheit" bleibt führender Begriff für das allgemeine, inhaltstragende Objekt. Präzisiert durch **D28**: „Methode" ist kein Rückfall in die alte Verwirrung, sondern der eigene Name für den inhaltsfreien Sonderfall (Kennenlernen, Reflexion, Feedback …), der in der neuen Methoden-Bibliothek (**D29**) lebt. Benennung der Methodensammlung ohne Ablauf final entschieden durch **D38**: „Methoden-Sammlung"; „Seminarkonzept" (komplette Pläne mit Ablauf, D28) ist als Begriff bereits stimmig und unstrittig.
- **Themenplan-Parser** (D13/D19, hinfällig durch **D48**): Läuft wieder über die externe Seminarschmiede, kein PHP-Parser im Plugin mehr. Verbleibt zu klären: konkreter Übergabe-/Aufruf-Weg zur Schmiede aus dem Import/Export-Tab (D48 legt nur fest, dass das bestehende Zielformat aus Abschnitt 5 geliefert wird, nicht die genaue Bedienführung). Beobachtungspunkt: Falls der wiederkehrende Medienbruch (D48) in der Praxis zu große Reibung erzeugt, ist eine erneute Revision zu prüfen.
- **Export platzierter Pläne**: Import/Export-Format ggf. um Tag/Anker-Platzierung erweitern (siehe **D20** und Hinweis in Abschnitt 5).
- **Facetten-Taxonomie der Methoden-Bibliothek (D29):** Vorschlag (Zeitpunkt/Anlass, Format, Aufwand) beruht bislang auf zwei Beispiel-Methodensets (183 Methoden); weitere reale Bestände vom Auftraggeber ausstehen, um die Taxonomie zu verfestigen oder zu korrigieren.
- **Zeitbedarf als Feldtyp (D31, offen):** Aktuell teils Auswahlfeld mit Überlaufkategorie („mehr als 180 Minuten"), vom Auftraggeber als ungenau eingeschätzt. Ob ein freier Zahlenwert die bessere Lösung ist, wird im Rahmen der Gesamt-Überarbeitung des Seminareinheiten-Formulars (D21) besprochen, sobald das ansteht – noch keine Entscheidung.
- ~~**UX-Konzept „Bibliothek ohne Vor-Import" (D33, offen).**~~ ✓ Final entschieden durch **D59**: Suchen-und-Ablegen direkt an der D14-Vorschlagsstelle in der Sequenzansicht, zusätzlich bleibt der Bibliothek-Tab (D50/D55) als zweiter, unabhängiger Weg erhalten. Umsetzung für Claude Code: Suchfeld an der D14-Vorschlagsstelle ergänzen.
- ~~**Vierter, jederzeit erreichbarer Einstieg zum Einheiten-Editor.**~~ ✓ Final entschieden durch **D50**: „Neue Seminareinheit anlegen"-Button in der Sequenzansicht, direkt an der Stelle, an der bereits eine neue Einheit oder Pause eingefügt werden kann.
- ~~**Aufräum-Punkt „Bausteine"-Tab entfernen (D16, D46).**~~ ✓ Erledigt (Commit 4b2f8ff): Tab ist entfernt, `planningmode.php` nur noch per direkter URL erreichbar. Neu hinzugekommen: `planningmode.php` und `methods.js` sind seither komplett ungenutzt (methods.php ist nur noch Redirect auf die Bibliothek). **Erledigt (13. Juli, Version 2026071509):** `planningmode.php` ist jetzt ebenfalls ein Redirect (auf die Sequenz); Migration alt→neu bleibt unberührt (verifiziert). Optional verbleibend: die toten AMD-Dateien `methods.js`/`planningmode.js` (+ Builds) löschen.
- **Touch-Alternative für Drag & Drop (Anschluss an D47):** HTML5-Drag-and-Drop (D47) funktioniert nicht auf Touch-Geräten. Die ↑/↓-Buttons decken die Tastaturalternative bereits ab: Touch-Nutzerinnen können den Plan darüber vollständig bedienen. Falls Touch-Drag als eigener Bedienweg (nicht nur als Ersatz) gewünscht ist, bräuchte es eine Pointer-Events-Emulation – noch nicht entschieden, ob nötig.
- ~~**Überblick/Sequenz-Synchronisation (offene Umsetzungslücke, Voraussetzung für D49).**~~ ✓ Erledigt: Der Überblick leitet sich jetzt aus den Sequenz-Daten (D20) ab, beide Ansichten sind synchron – D49 (Klick-Navigation Überblick → Sequenz) ist damit vollständig einsatzbereit.
- ~~**Rich-Text-Editor fehlt im Sequenz-Modal (offene Umsetzungslücke, Anschluss an D17).**~~ ✓ Erledigt: Das aus der Sequenzansicht geöffnete Einheiten-Editor-Modal nutzt jetzt denselben Moodle-Editor (Tiny) wie `library.php`/`methodlibrary.php` – der D17-Grundsatz „ein einziger Editor, drei Einstiege" ist damit an allen drei Einstiegen erfüllt.
- ~~**Einreichen-Seite umbauen (Anschluss an D51).**~~ ✓ Erledigt (13. Juli 2026, Commit e284017): `review.php` hat jetzt die Weggabelung „Was möchtest du einreichen?" (drei Optionen, siehe Historie bd) vor den Formularen, die beiden „bestehende Sammlung"-Blöcke sind zu einem durchgängigen Ablauf verschmolzen, Formulierungen auf „Methoden-Sammlung" (D38) vereinheitlicht; Info-Bereich oben unverändert. Auf Staging browser-verifiziert.
- **PDF-Export erweitern (Anschluss an D52):** Dritter Export-Button „Materialliste-PDF erstellen" neben `kg-pdf-zim`/`kg-pdf-flow`; Materialien werden über alle Seminareinheiten hinweg dedupliziert und den Seminartagen zugeordnet, Layout als Abgabeliste. Zusätzlich neues, dauerhaft pro Aktivität gespeichertes Logo-Setting (Upload + Position rechts/links), das automatisch in den Seitenkopf aller PDF-Exporte (ZIM, Konzeptsammlung, Materialliste) einfließt.
- **Didaktische Empfehlungen um Zeitrahmen-Hinweis erweitern (Anschluss an D53):** Achte Regel ergänzen, die die Summe aller geplanten Bausteine gegen den aus Seminartagen + Anker-Zeiten (D45) automatisch ermittelten Zeitrahmen abgleicht. Gleicher Hinweis-Ton wie D15/D22/D23, keine Sonderbehandlung. Konkrete Formulierung des Hinweistexts steht noch aus.

**Offene konzeptionelle Fragen aus der Lücken-Analyse (12. Juli 2026, Perspektive Bildungsreferentin bei Neuerstellung / ehrenamtlicher Referent bei Durchführung):** Noch nicht ausreichend durchdacht für eine Entscheidung, deshalb hier gesammelt statt vorschnell entschieden.

- **Entwurfsstatus für neue Seminarkonzepte:** Bei der kompletten Neuerstellung eines Seminarkonzepts fehlt ein Zwischenstand „noch nicht fertig" vs. „einsatzbereit" – aktuell wirkt jeder Stand sofort nutzbar. Berührt das Sichtbarkeitsmodell (D30) und das Vier-Objekte-Modell (D28); zu klären, ob ein eigener Status nötig ist oder ob die bestehende lokale Sichtbarkeit (D30) bereits ausreicht und nur deutlicher kommuniziert werden muss.
- **„Als Vorlage nehmen" für ganze Seminarkonzepte:** D45 kennt Vorlagen bisher nur für Anker-Zeiten. Wer ein bestehendes Seminarkonzept als Ausgangspunkt für ein neues nehmen will, statt bei null anzufangen – unklar, ob/wie sich das von der bestehenden Kopie-Logik beim Übernehmen einzelner Methoden (D33) unterscheiden soll.
- **Durchführungsmodus:** Während der laufenden Durchführung fehlt eine einfache, ggf. offline-taugliche Live-Ansicht („was kommt jetzt/als Nächstes"). Sessionplan.de hat dafür bereits einen „Live-Modus" (aktueller Block, Restzeit, nächster Punkt) als möglichen Referenzpunkt. Konkretisierung (12. Juli 2026): Eine eigene Sequenzansicht für Referentinnen während der Durchführung, die zum nächsten Seminarschritt zeigt, welche Materialien benötigt werden, ggf. eine dort hochgeladene PowerPoint zum Download anbietet und das zugehörige Skript aus dem Ablauf-Feld anzeigt. Größeres Feature, eigener Konzeptions-Schritt nötig, sobald angegangen.
- **Live-Abweichungen vom Plan während der Durchführung:** Hängt am Durchführungsmodus – ob/wie Anpassungen während des laufenden Seminars (Zeit läuft aus dem Ruder, Baustein entfällt) erfasst werden, ohne dass es sich wie „Konzept bearbeiten" anfühlt.
- **Rückkanal nach der Durchführung:** Referentinnen, die ein fremdes Konzept nur durchführen, haben oft Erfahrungswerte, die unterhalb der Schwelle einer vollständigen Einreichung (D48/D51) liegen. Zu klären, ob/wie ein leichterer Feedback-Weg zur Konzeptverantwortlichen aussehen könnte – hängt mit der Transparenz-Frage (Konzeptverantwortliche sichtbar machen, separat als schneller Punkt vorgesehen) zusammen.
- ~~**Konfliktfall beim Auto-Update.**~~ ✓ Final entschieden durch **D54**: Auto-Update-Checkbox entfällt, stattdessen Hinweis in der Bibliotheks-Kartenansicht; lokale Änderung hat immer Vorrang, kein stilles Überschreiben. Umsetzung für Claude Code: `methodset_sync_service` entsprechend umbauen (Checkbox raus, Hinweis-Logik an der Kartenansicht rein).
- **Bibliothek auf drei Tabs umbauen (Anschluss an D55):** „Methodensammlungen" (bestehendes Filternetz aus D29 bleibt hier), „Globale Seminarkonzepte", „Lokale Seminareinheiten" – statt einer durchgehenden Liste.
- **Vorschlagsmechanik-Suchraum erweitern (Anschluss an D56):** D14 soll künftig auch die globalen Methodensammlungen durchsuchen, nicht nur lokal Vorhandenes; Übernahme eines Vorschlags erzeugt sofort eine lokale Kopie (wie D33).
- ~~**Typ-Feld in local_seminarplaner ergänzen (Anschluss an D57).**~~ ✓ Bereits umgesetzt (Commits 9f67f79 mod / 689303d local, 10. Juli 2026) – Spalte `concepttype` (`sammlung`/`seminarkonzept`), Typ-Auswahl im Einreichen-Formular, typbewusste Verarbeitung beim Import. War bereits vor der D57-Entscheidung gebaut worden.
- ~~**Übersichtsliste Konzeptverantwortliche (Anschluss an D58).**~~ ✓ Erledigt (13. Juli 2026, Commit e284017): Bereich „Das sind unsere Konzeptverantwortlichen" im Einreichen-Tab (nur Name, kein Kontaktweg), Opt-in-User-Preference `mod_seminarplaner_konzeptverantwortliche_public` (Default aus), Opt-in-Schalter nur für Nutzer:innen mit `local/seminarplaner:reviewset`-Capability. Neuer Webservice `list_public_reviewers`. Auf Staging browser-verifiziert.
- **Offene Schnittstelle als OER-Prinzip:** Wunsch, den Seminarplaner nicht zum Datensilo werden zu lassen – Daten sollen möglichst leicht kontrolliert entnommen/eingespeist werden können, über die bestehenden plugin-eigenen Formate (Abschnitt 5, JSON/CSV/ZIP) hinaus. Grundsätzliche Richtungsfrage, noch nicht ausgearbeitet.
- **Anbindung an Sessionplan.de:** Konkreter Anwendungsfall für die offene Schnittstelle. Sessionplan.de hat keine dokumentierte öffentliche API; eine Beispiel-Exportdatei liegt vor und muss noch analysiert werden, um die Machbarkeit einzuschätzen.
- **Eigener Seitenkopf mit Logo in der Weboberfläche (neue offene Konzeptfrage, gemeldet von Claude Code):** Während der Umsetzung des Corporate-Design-Handoffs bewusst zurückgestellt: ein eigener „Seminarplaner"-Seitenkopf mit Logo oben rechts, statt sich auf den umgebenden Moodle-Rahmen zu verlassen. Zu unterscheiden vom Logo im PDF-Export (**D52**, dort bereits entschieden) – hier geht es um die laufende Weboberfläche selbst. Noch nicht konzipiert, keine Entscheidung.
- **Seminarziele-Feld + Zielabdeckung umsetzen (Anschluss an D61):** Neues Feld/Liste „Seminarziele" am Gesamtplan, Verknüpfungs-UI (Checkliste je Ziel gegen die Seminareinheiten), neue neunte Regel in der Logik der Didaktischen Empfehlungen.
- **Lernziel-Editor umsetzen (Anschluss an D62):** Editor-Komponente (Bloom-Stufe → Verb → Freitext-Inhalt → Satz-Zusammenbau), Wiederverwendung der D41-Tabelle für die Phasen-Vorbelegung, Einbindung im D21-Modal und im neuen D61-Seminarziele-Feld.

## 8. Entwicklungs- und Rollout-Strategie

**Ausgangslage:** Git-Repository und eine separate Test-/Staging-Instanz sind bereits vorhanden; die Entwicklung erfolgt durch eine einzelne Person (den Auftraggeber selbst).

**Grundsatz: dasselbe Plugin bekommt eine neue Version, kein zweites Plugin entsteht.** `mod_seminarplaner` und `local_seminarplaner` behalten ihre Namen; der Umbau ist eine Versionsfolge desselben Codes, kein Nebeneinander von altem und neuem Plugin.

1. **Langlebiger Feature-Branch** (z. B. `umbau-sequenzansicht`) vom aktuellen produktiven Stand abgezweigt; der Stand davor bekommt einen Git-Tag als Rücksprungpunkt.
2. **Staging bekommt eine echte Kopie der Produktionsdaten** (DB-Dump), damit die Grid→Sequenz-Umrechnung (D20/D43) und die Übersetzungs-Anzeige (D35) an echten, teils „unsauberen" Bestandsplänen getestet werden – nicht nur an synthetischen Testdaten.
3. **Schrittweise Umsetzung entlang der Entscheidungsreihenfolge:** zuerst Datenmodell und Migrations-Logik (D20/D43), dann die Sequenzansicht selbst (D3/D10/D11) – **Block 2, abgeschlossen** –, dann Vorschlagsmechanik und Didaktische Empfehlungen (D14/D15/D22/D23/D40/D41) plus D45 (Vorlagen-Anker-Zeiten der Grid-Einrichtung) – **Block 3, abgeschlossen** –, zuletzt Bibliothek und Einreichen-Workflow (D28–D33, D37–D39, D50–D59) – **Block 4, in Arbeit** (Etappe 1 abgeschlossen: globale Bibliothek D29/D33 mit Facetten-Suche, D38-Begriff, D37-Statusliste, D32-Seminarkonzept-Einreichen inkl. D57-Typ-Feld; verbleibend: D59-Suchen-und-Ablegen an der Vorschlagsstelle, D55-Bibliothek-Tabs, D58-Übersichtsliste Konzeptverantwortliche, D56-erweiterte Vorschlagsmechanik, D51/D52/D53/D54-Einreichen-Seite/PDF-Export/Didaktische-Empfehlungen-Erweiterung). Nach jedem Block: Test auf Staging, bevor der nächste Block beginnt.
4. **Schema-Änderungen laufen über Moodles `upgrade.php`-Mechanismus**, nicht als manuelle Datenbank-Eingriffe – nummerierte, nachvollziehbare Upgrade-Schritte, die beim Versionswechsel automatisch nachgezogen werden. Die Grid→Sequenz-Umrechnung (D43) ist einer dieser Schritte.
5. **Produktion bleibt vom Umbau unberührt, bis ein zusammenhängender Meilenstein auf Staging überzeugt** – im Zweifel dort auch nochmal mit ein bis zwei Referentinnen getestet, ähnlich wie beim Wireframe-Workshop. Das Tool bleibt während der gesamten Umbauphase produktiv nutzbar, weil ausschließlich auf Branch und Staging gearbeitet wird. Der Umstieg auf Produktion erfolgt als ein einziger, koordinierter Update-Moment (passend zu D34–D36) – alle Referentinnen wechseln gemeinsam von Grid auf Sequenzansicht, keine gestaffelte Teil-Freischaltung.
6. **Zusätzliche Absicherung gegen versehentliches Deployment:** Ein eigenes Skill (`git-branch-guard-seminarplaner`) verhindert, dass die beiden bestehenden Deploy-/Release-Skills (`deploy-local-seminarplaner`, `seminarplaner-release` – Ziel: GitHub `main` und GitLab) während der Umbau-Arbeit versehentlich mitlaufen. Commits/Pushes auf den Feature-Branch nach GitHub sind normaler Alltag; ein Merge auf GitHub `main` oder **jeder** Push nach GitLab ist dagegen gesperrt, bis explizit eine stabile, produktionsreife Version für den Produktivsystem-Umstieg erklärt wird (D44). Branch-Name im Skill als Platzhalter (`umbau-sequenzansicht`) zu prüfen und ggf. anzupassen.
7. **Übergabe an Claude Code:** Ein Briefing-Dokument (`claude-code-briefing-seminarplaner.md`) fasst die wichtigsten technischen Eckpunkte für den Einstieg in Claude-Code-Sessions zusammen (D20, D19, D43, weitere Kernmechaniken) und verweist auf eine im Repository mitgeführte Kopie dieses Konzeptdokuments (`docs/seminarplaner-umbau-konzept.md`). Dieses Claude.ai-Projekt bleibt durchgehend der Ort für neue Richtungsentscheidungen (D44).

## 9. Vorschlag für die Projekt-Anweisungen (Claude-Projekt)

> Wir entwickeln das Moodle-Plugin „Seminarplaner" (mod_seminarplaner + local_seminarplaner) für die IG-Metall-Bildungsarbeit konzeptionell weiter. Zielgruppe sind hauptamtliche und ehrenamtliche Referentinnen: erfahrene Pädagoginnen ohne akademische Ausbildung und mit geringer IT-Kompetenz – alle Vorschläge müssen didaktische statt IT-Metaphern nutzen. Grundlage aller Arbeit ist das Dokument „seminarplaner-umbau-konzept.md" im Projektwissen; getroffene Entscheidungen (D1–D63) gelten, bis sie ausdrücklich revidiert werden. Aktuelle Phase: Konzeption und Richtungsklärung – keinen Code generieren, außer es wird ausdrücklich verlangt. Bei neuen Entscheidungen das Konzeptdokument fortschreiben. Antworten auf Deutsch.

Empfohlenes Projektwissen: dieses Dokument, die Plugin-Code-Referenz, ein Beispiel-Themenplan (TP_2026_ki.docx), das Wireframe der Sequenzansicht, die Workshop-Fragensammlung (workshop-fragen.md).

## 10. Nächste Schritte

1. ~~Claude-Projekt anlegen, Anweisungen und Projektwissen einpflegen.~~ ✓ erledigt
2. ~~Offene Fragen 1 und 6 klären.~~ ✓ erledigt (D8, D10, D11) – ebenso Fragen 2, 3, 5 (D9, D12, D13)
3. ~~**Frage 4 klären:** Regeln der Didaktischen Empfehlungen formulieren.~~ ✓ Grundausrichtung erledigt (**D15**) – verbleibt: **Workshop mit erfahrenen Referentinnen**; alle Workshop-Fragen sind gesammelt im Begleitdokument **„workshop-fragen.md"** (D15-Regeln inkl. Schwellenwerte und Regel 2, Begriffe „Einreichen" und „Methoden-Sammlung" inzwischen final entschieden, Wireframe-Test mit UX-Prüffragen).
3a. ~~**Frage 7 klären:** Vorschlagsmechanik aus D4 konkret ausarbeiten.~~ ✓ erledigt (**D14**) – bei der Klärung von Frage 4 (Didaktische Empfehlungen) berücksichtigen, dass beide auf dieselben Daten zugreifen (Phasen, kognitive Dimension, Dauer).
3b. ~~**Frage 8 klären:** Tab-Struktur und -Benennungen nach dem Umbau durchdenken.~~ ✓ erledigt (**D16**) – verbleibt nur die finale Wahl „Einreichen" vs. „Weitergeben", ggf. im Workshop abfragen.
4. ~~**Wireframe verfeinern.**~~ ✓ abgeschlossen: v2 zeigt alle Entscheidungen (Alternativen D8, unbenannte Abschnitte D10, Fortsetzung + Verschiebe-Aktion D3, Tab-Leiste D16/D18, Vorschläge D14, Didaktische Empfehlungen D15, Einheiten-Editor-Modal D17 mit drei Einstiegen). Das Wireframe ist das abgestimmte UI-Konzept und Testinstrument für den Referentinnen-Workshop.
5. ~~**Themenplan-Parser (D13) spezifizieren.**~~ ✓ erledigt (**D19**): Parsing-Regeln als Spezifikation ausformuliert – Best-Effort mit Import-Bericht, organisatorische Blöcke über leere Kompetenzerwartungen-Zelle, Wochentags-Mapping, Anker-Fallbacks, Kopfblock ignoriert, ein harter Boden bei fehlender Struktur. Keine neuen Workshop-Fragen daraus.
6. ~~**Datenmodell-Konzept für Sequenz, Anker-Platzierung und Alternativen** (D3, D8, D12).~~ ✓ erledigt (**D20**): Platzierung liegt an der einzelnen Seminareinheit statt am Baustein (löst Fortsetzung ohne Sonderfall); Baustein-Varianten (D8) tauschen als unterschiedlich lange Pakete auf einmal; Einheiten-Auswahl als eigene, neue Ebene für Einheiten-Alternativen.
7. ~~**Referentinnen-Workshop terminieren und durchführen.**~~ ✓ durchgeführt – erste Ergebnisse ausgewertet und eingearbeitet (**D22–D27**): Regeln der Didaktischen Empfehlungen inkl. Schwellenwert final, neue Regel 7, Ein/Aus-Schalter, Tab-Name „Import/Export" bestätigt, Veranstaltungsgröße und vereinfachte Gruppengröße neu aufgenommen.
8. ~~**Verbleibende Workshop-Ergebnisse auswerten.**~~ ✓ Vollständig abgeschlossen: B1 (**D37**), B3 (**D38**), B4 (**D39**), B5 (**D40**/**D41**), Teil C (**D42**). Die gesamte Workshop-Fragensammlung (workshop-fragen.md) ist damit durchgearbeitet.
9. ~~**Methoden-Bibliothek (D29) konzipieren – Frage 9 klären.**~~ ✓ Frage 9 entschieden (**D32**: Seminarkonzepte nutzen denselben Mechanismus wie Methoden-Sammlungen, kein separates Verfahren). Verbleibt: weitere reale Methodenbestände vom Auftraggeber sichten, Facetten (Zeitpunkt/Anlass, Format, Aufwand) daran verfeinern oder korrigieren, danach UI-Konzept für die Bibliotheksansicht (Filternetz, Kartenansicht) ausarbeiten.
10. ~~**UX-Konzept „Bibliothek ohne Vor-Import" (D33) ausarbeiten.**~~ ✓ Final entschieden durch **D59**: Suchen-und-Ablegen direkt an der D14-Vorschlagsstelle, Bibliothek-Tab (D50/D55) bleibt zusätzlich erhalten.
11. ~~**Übergangsstrategie (D34) fertig ausarbeiten.**~~ ✓ Abgeschlossen. Übersetzungs-Anzeige konkretisiert (**D35**: ein Beispieltag mit echten eigenen Daten, pro Referentin einmal je Plan). Der ursprünglich geplante optische Stufenplan entfällt (**D36**: kein Wechsel Richtung Flipchart-Optik – Zielbild bleibt dauerhaft die Chrome-Variante „Vertraut"; der eigentliche Übergang ist der Mechanismus-Wechsel Grid-Logik → Sequenzlogik, bereits durch D35 abgedeckt). Verbleibt als rein technische Aufgabe: die Umsetzung der Grid→Sequenz-Umrechnung selbst (D20).
