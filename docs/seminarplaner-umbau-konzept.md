# Seminarplaner-Umbau – Konzept- und Entscheidungsdokument

Stand: 9. Juli 2026 · Grundlage: Code-Review `mod_seminarplaner` 0.6.6-beta / `local_seminarplaner` 0.2.2-beta, Analyse eines Original-Themenplans (TP_2026_ki.docx), Vergleich mit SessionLab, Analyse von zwei realen Beispiel-Methodensets (183 Methoden) und vier realen Beispiel-Seminarkonzepten.

Zweck: Dieses Dokument hält den Stand der konzeptionellen Überlegungen zum Umbau des Moodle-Plugins Seminarplaner fest. Es dient als Projektwissen für die Weiterarbeit in einem Claude-Projekt und trennt bewusst zwischen **getroffenen Richtungsentscheidungen**, **offenen Fragen** und **Backlog**. Es soll fortgeschrieben werden, wenn neue Entscheidungen fallen.

Änderungshistorie:
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
2. **Das Zeitverhalten dehnt sich dabei nie automatisch aus.** Läuft ein Anker über (z. B. Vormittag +20 Min.), rutschen Einheiten **nicht** stillschweigend über die Mittagspause oder auf den nächsten Tag. Zwei Gründe: Für die Zielgruppe wäre ein Plan, der sich „von selbst" umbaut, beunruhigend – und pädagogisch ist ein Anker-/Tageswechsel nie neutral (der Nachmittag braucht etwas Aktivierendes, der Tag einen Abschluss, der nächste Morgen einen Wiedereinstieg). Ein Automatismus würde genau die Dramaturgie zerstören, die der Dramaturgie-Check (D4) schützen soll.
3. **Stattdessen: geführte Aktion aus der Zeitbudget-Warnung heraus.** Beispiel: „+20 Min. über der Mittagspause – letzte Einheit(en) auf den Nachmittag verschieben?" Ein Klick, die betroffenen Einheiten wandern in den nächsten Abschnitt, der Baustein läuft als Fortsetzung weiter (Punkt 1). Die Referentin entscheidet, das Tool macht es ihr leicht – dieselbe Logik wie in D9: geführte Aktion statt stiller Automatismus.

### D4 – Lückentext-Prinzip gegen das weiße Blatt

Das leere Blatt darf nie erscheinen. Zwei Einstiege:

1. **Themenplan als Startpunkt** (Hauptweg, wenn vorhanden): Der standardisierte Themenplan wird importiert und erzeugt das Baustein-Gerüst über die Tage (siehe D13 und Abschnitt 4).
2. **Dramaturgie-Vorlage** (wenn kein Themenplan existiert): Ein neuer Tag kommt vorstrukturiert auf Basis der fünf Phasen, als farbige Zonen mit Platzhaltern („Hier fehlt noch ein Einstieg, ca. 30 Min."). Aus dem weißen Blatt wird ein Lückentext.

Zwei Verstärker: **Vorschläge in die Lücke** (Klick auf Platzhalter filtert die Bibliothek automatisch nach Phase und Dauer ≤ Lücke – wählen statt suchen; Mechanik im Detail: D14) und ein **Dramaturgie-Check** als stiller Begleiter (Regeln und Strenge im Detail: D15) – gibt insbesondere Ehrenamtlichen Sicherheit, dass das Konzept „stimmt".

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

### D15 – Dramaturgie-Check: ausschließlich Hinweise, sechs Kandidaten-Regeln, Stille bei fehlenden Daten

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

**Design-Prinzip 2 – positiv formulieren, unaufdringlich platzieren:** Kein rotes Ausrufezeichen an der Einheit, sondern ein eigener Bereich („Dramaturgie-Blick") mit Formulierungen wie „Nach der Mittagspause könnte etwas Aktivierendes guttun". Erfüllte Regeln werden als Bestätigung angezeigt („✓ Alle fünf Phasen vertreten") – die Sicherheits-Funktion für Ehrenamtliche entsteht mehr durch die Häkchen als durch die Hinweise.

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
| Seminareinheiten + Bibliothek | **Seminareinheiten** (finden und anlegen; Benennung korrigiert durch D18 – ursprünglich „Methoden") |
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

### D22 – Dramaturgie-Check: Regeln 2, 4, 5, 6 im Workshop bestätigt (Ergänzung zu D15)

**Erste Ergebnisse aus dem Referentinnen-Workshop (Teil A, Fragen A1/A3).**

- **Regeln 4 (Tagesabschluss) und 6 (Einstieg am Morgen) bestätigt:** Die Erinnerung, dass es einen Einstieg und einen Feedback-Ausstieg geben sollte, hilft vielen Referentinnen bei der Planung – was in der Praxis daraus gemacht wird, steht auf einem anderen Blatt, ändert aber nichts am Nutzen des Hinweises in der Planungsphase. Beide Regeln bleiben unverändert.
- **Regel 5 (Sozialform-Monotonie) – Schwellenwert final:** Die Arbeitshypothese von ~120 Minuten wurde im Workshop bestätigt. Der Schwellenwert ist damit final, keine offene Frage mehr.
- **Regel 2 (Aktivierung nach der Mittagspause) bleibt bestehen:** Trotz der ursprünglich niedrigen Priorität hat der Workshop die Regel bestätigt, sie wird nicht gestrichen.
- **Klarstellung zur Darstellung der Mittagspause:** Missverständnis im Vorfeld ausgeräumt – die Pause zwischen Vormittag und Nachmittag wird in der Sequenzansicht weiterhin angezeigt (unverändert zu D11), allerdings nicht mehr als eigene Box mit festem Anfang und Ende, sondern als benannter Pausen-Trenner ohne eigene Zeitgrenzen (siehe Wireframe). Das betrifft nur die Darstellung, nicht Regel 2 selbst.

### D23 – Dramaturgie-Check: neue Kandidaten-Regel 7 „Pausenhinweis" (Ergänzung zu D15)

**Ergebnis aus dem Referentinnen-Workshop (Teil A, Frage A2).** Zusätzlich zu den sechs ursprünglichen Regeln wünschen sich die Referentinnen einen allgemeinen Hinweis auf Pausen zwischen Seminareinheiten, unabhängig von der festen Mittagspause: Der Hinweis erscheint entweder nach dem Ende einer Seminareinheit oder spätestens nach 1,5 Stunden ohne Pause – je nachdem, was zuerst eintritt. Anders als Regel 2 (die sich ausschließlich auf die Mittagspause bezieht) deckt Regel 7 den gesamten Tagesverlauf ab. Der Dramaturgie-Check hat damit künftig **sieben** Kandidaten-Regeln.

### D24 – Tab bleibt „Import/Export"; Vorschlag „Austauschen" verworfen (Korrektur zu D16)

**Ergebnis aus dem Referentinnen-Workshop (Teil B, Frage B2).** Der in D16 vorgeschlagene neue Name „Austauschen" wurde nicht angenommen: Alle Teilnehmerinnen konnten sich unter dem bestehenden Namen „Import/Export" unmittelbar etwas vorstellen, „Austauschen" brachte keinen Erkenntnisgewinn. Der Tab behält daher seinen bisherigen Namen. Inhaltlich ändert sich nichts – die in D16 festgelegte Abgrenzung (alles, was die Plugin-Grenze überquert) bleibt bestehen, nur unter altem Namen. D16-Tabelle und Abgrenzungs-Absatz sind entsprechend korrigiert.

### D25 – Neue Angabe „Veranstaltungsgröße" am Gesamtplan (Seminar/Tagung), steuert Dramaturgie-Check-Tipps

**Vorschlag des Auftraggebers im Nachgang des Workshops.** Die Tipps des Dramaturgie-Checks sollen sich künftig an der Größenordnung der Veranstaltung orientieren können: Ein Seminar (10–20 TN) braucht andere Hinweise als eine Tagung (z. B. ein Betriebsrät*innen-Tag mit 80–200 TN) – Hinweise, die für eine kleine Gruppe passen, passen nicht automatisch für eine Großveranstaltung.

Dafür bekommt der Gesamtplan eine neue, bewusst grobe Angabe **„Veranstaltungsgröße"** mit zwei Ausprägungen: **Seminar** (10–20 TN) und **Tagung** (80–200 TN). Es geht ausdrücklich nicht um eine exakte Teilnehmendenzahl, sondern um diese grobe Unterscheidung – dieselbe Grundhaltung wie bei der Vereinfachung des Gruppengröße-Felds (D26). Welche konkreten Dramaturgie-Check-Tipps sich je nach Veranstaltungsgröße unterscheiden, ist noch nicht ausgearbeitet und wird nachgezogen, sobald aus dem Workshop weitere Rückmeldungen zu den Regeln vorliegen.

### D26 – Gruppengröße-Feld an der Seminareinheit auf drei Kategorien vereinfacht (Korrektur zu D14/D21)

**Vorschlag des Auftraggebers im Nachgang des Workshops.** Die bisherige feingranulare Gruppengröße-Auswahl an der Seminareinheit (1 / 2-3 / 3-5 / 6-12 / 13-24 / 25+ / beliebig, siehe Bibliotheks-Filter im Code) wird auf drei handlungsbezogene Kategorien reduziert:

- **Gruppenarbeit (2-5)**
- **Planung (10-20)**
- **beliebig**

**Begründung:** Es reicht zu wissen, wofür eine Einheit taugt, nicht die exakte Kopfzahl – dieselbe Überlegung, die in D14 schon dazu führte, Gruppengröße als Vorschlagskriterium zu streichen (die Gruppen sind in der Praxis fast immer gleich groß). Jetzt wird auch die reine Durchführungs-Info (D21, Feldliste Punkt 4) gröber, statt sechs feine Stufen vorzuhalten, die in der Praxis kaum unterschieden werden.

**Mapping der bisherigen Werte:** 1, 2-3, 3-5 und 6-12 → **Gruppenarbeit**; 13-24 → **Planung**; 25+ und beliebig → **beliebig**.

Betrifft die Feldliste aus D21 (Abschnitt „Ablauf und Rahmen", Punkt 4) sowie die entsprechenden Filter-Optionen im Seminareinheiten-Tab.

### D27 – Dramaturgie-Check: Ein/Aus-Schalter, pro Referentin gespeichert (Ergänzung zu D15/D22)

**Ergebnis aus dem Referentinnen-Workshop (Teil A, Frage A4 zur Tonlage).** Statt einzelne Formulierungen der Hinweise weiter zu verfeinern, wünschte sich die Runde vor allem eine Möglichkeit, den gesamten Dramaturgie-Check bei Bedarf **auszublenden**. Umgesetzt als Ein/Aus-Schalter:

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

**Offen – UX-Konzept folgt als eigener Schritt:** Wie diese immer verfügbare Bibliotheksansicht konkret in den Workflow der Sequenzansicht/Planerstellung eingebunden wird (z. B. dauerhaftes Andock-Panel neben der Sequenz, Suchen-und-Ablegen direkt in den Plan, oder ein separat aufrufbares Bibliotheksfenster) – wird als eigener Konzeptions-Schritt aufgenommen (siehe Nächste Schritte).

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
6. **C6 (Dramaturgie-Blick, D15):** Als nicht aufdringlich empfunden; die Platzierung am Ende der Seite wurde ausdrücklich als „bestens" bestätigt – keine Änderung nötig.
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

**Einordnung in die Rollout-Strategie:** Obwohl D45 inhaltlich näher am Datenmodell (D20/D43) liegt, wird die Umsetzung bewusst in **Block 3** (Vorschlagsmechanik/Dramaturgie-Check, siehe Abschnitt 8) mit erledigt, da die Sequenzansicht-Grundlagen (Block 2) bereits abgeschlossen sind und Claude Code die Anker-Zeiten für die laufende Implementierung braucht, statt auf einen späteren, thematisch passenderen Block zu warten.

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
- ~~4. Dramaturgie-Check~~ → **D15** (nur Hinweise, Stille bei fehlenden Daten, positive Formulierung), im Referentinnen-Workshop validiert und ergänzt: **D22** (Regeln 2/4/5/6 final), **D23** (neue Regel 7 „Pausenhinweis")
- ~~2. Migration der Bestandsdaten~~ → **D9** (Archivfeld mit geführtem Zuordnungs-Hinweis)
- ~~3. Automatische Tages-Platzierung~~ → **D12** (Tag + Anker automatisch, nicht mehr; im Plugin gemäß D13)
- ~~5. Alternativen-Mechanismus~~ → **D8** (zwei Ebenen, jederzeit austauschbar), abgegrenzt durch **D10** (nur für benannte Bausteine)
- ~~6. Zwei-Quellen-Modus~~ → **D8** (entfällt), präzisiert durch **D10** (Baustein ist optional, kein Zwang)
- ~~7. Vorschlagsmechanik~~ → **D14** (zweistufig hart/weich, Bloom-Verb-Mapping, max. 3–5 erklärte Vorschläge, Null-Treffer-Pfad mit Schnellanlage; Gruppengröße gestrichen)
- ~~8. Tab-Struktur und -Benennung~~ → **D16** (sechs Tabs entlang des Zielflusses; Bausteine-Tab entfällt, Methoden-Tab vereint Anlegen und Bibliothek, Grid als „Überblick"), Tab-Name „Einreichen" final entschieden durch **D37**

## 7. Backlog (nicht vergessen, unabhängig vom Umbau)

- **Kein Undo** im Planer – im Sequenzmodell neu bewerten, mindestens „letzte Aktion rückgängig".
- **A11y**: Statuszeile `#kg-status` ohne `aria-live` (Screenreader bekommen Meldungen nicht mit); Tastaturalternative zu Drag & Drop ist mit den ↑/↓-Buttons erfüllt (**D47**). Offen: Drag & Drop selbst ist im aktuellen Entwicklungsstand nicht funktionsfähig und muss wiederhergestellt werden, damit beide Bedienwege wie in D47 vorgesehen nebeneinander funktionieren.
- **Formularlast Seminareinheit**: ~18 Felder, jetzt 16 nach D40; entschärft durch **D17** (Modal mit offener Schnellfassung, restliche Abschnitte zugeklappt); zusätzlicher Wunsch aus dem Workshop-Nachgang zu B5: Formular insgesamt noch angenehmer bedienbar machen – Idee, noch nicht konkretisiert, bei Umsetzung mitdenken.
- **Editor-UX der Seminareinheiten-Felder (D17-Feinschliff, Merker):** ✓ aufgelöst durch **D21** (Feldreihenfolge nach Denk- und Arbeitslogik, Lernziele in der Schnellfassung, „Alternative Seminareinheiten" als Vorbelegung). ✓ **Felder-Inventur** final entschieden durch **D40** (Kognitive Dimension und Komplexitätsgrad entfallen, Rest bleibt) – Konsequenz für die Vorschlagsmechanik in **D41** (Bloom-Verb-Mapping zielt jetzt auf Seminarphase).
- **Grid-Einstieg**: zuletzt geöffneter Plan sollte direkt laden (entfällt ggf. mit Sequenz-UI, sonst umsetzen).
- **Begriffs-Inkonsistenz** in Strings: entschieden durch **D18** – „Seminareinheit" bleibt führender Begriff für das allgemeine, inhaltstragende Objekt. Präzisiert durch **D28**: „Methode" ist kein Rückfall in die alte Verwirrung, sondern der eigene Name für den inhaltsfreien Sonderfall (Kennenlernen, Reflexion, Feedback …), der in der neuen Methoden-Bibliothek (**D29**) lebt. Benennung der Methodensammlung ohne Ablauf final entschieden durch **D38**: „Methoden-Sammlung"; „Seminarkonzept" (komplette Pläne mit Ablauf, D28) ist als Begriff bereits stimmig und unstrittig.
- **Themenplan-Parser** (D13/D19, hinfällig durch **D48**): Läuft wieder über die externe Seminarschmiede, kein PHP-Parser im Plugin mehr. Verbleibt zu klären: konkreter Übergabe-/Aufruf-Weg zur Schmiede aus dem Import/Export-Tab (D48 legt nur fest, dass das bestehende Zielformat aus Abschnitt 5 geliefert wird, nicht die genaue Bedienführung). Beobachtungspunkt: Falls der wiederkehrende Medienbruch (D48) in der Praxis zu große Reibung erzeugt, ist eine erneute Revision zu prüfen.
- **Export platzierter Pläne**: Import/Export-Format ggf. um Tag/Anker-Platzierung erweitern (siehe **D20** und Hinweis in Abschnitt 5).
- **Facetten-Taxonomie der Methoden-Bibliothek (D29):** Vorschlag (Zeitpunkt/Anlass, Format, Aufwand) beruht bislang auf zwei Beispiel-Methodensets (183 Methoden); weitere reale Bestände vom Auftraggeber ausstehen, um die Taxonomie zu verfestigen oder zu korrigieren.
- **Zeitbedarf als Feldtyp (D31, offen):** Aktuell teils Auswahlfeld mit Überlaufkategorie („mehr als 180 Minuten"), vom Auftraggeber als ungenau eingeschätzt. Ob ein freier Zahlenwert die bessere Lösung ist, wird im Rahmen der Gesamt-Überarbeitung des Seminareinheiten-Formulars (D21) besprochen, sobald das ansteht – noch keine Entscheidung.
- **UX-Konzept „Bibliothek ohne Vor-Import" (D33, offen):** Grundsatzentscheidung liegt vor (globale Methoden-Sammlungen immer durchsuchbar, direkte Übernahme einzelner Methoden als Kopie ohne vorherigen Sammlungs-Import). Noch offen: konkrete Einbindung in den Planbau-Workflow (Andock-Panel, Suchen-und-Ablegen, separates Bibliotheksfenster o. Ä.) – eigener Konzeptions-Schritt.
- **Vierter, jederzeit erreichbarer Einstieg zum Einheiten-Editor (Idee, Ergänzung zu D17/D39):** „Seminareinheit hinzufügen" als Button, der unabhängig vom aktuellen Tab/View erreichbar ist – nicht nur aus dem „Anlegen"-Bereich des Seminareinheiten-Tabs (D39). Noch offen: schwebender Button oder feste Position, auf jeder Seite oder nur in der Sequenzansicht – Design-Detailarbeit, keine Richtungsentscheidung.
- **Aufräum-Punkt „Bausteine"-Tab entfernen (D16, D46):** Im aktuellen Entwicklungsstand (Testplaner 5.1.4) ist der eigenständige Bausteine-Tab noch sichtbar – laut D16 soll er entfallen, da Bausteine nur noch als optionale Überschrift in der Sequenz existieren (D10). Kein Konzeptthema, reine Umsetzungs-Nacharbeit.
- **Überblick/Sequenz-Synchronisation (offene Umsetzungslücke, Voraussetzung für D49):** Im aktuellen Entwicklungsstand lädt der Überblick noch das alte Grid statt aus den Sequenz-Daten (D20) abzuleiten – beide Ansichten sind dadurch nicht synchron. Konzeptionell ist die Sequenz seit D20 die maßgebliche Datenstruktur; der Überblick soll rein lesend darauf aufsetzen (D11), nicht auf einer eigenen, parallel gepflegten Datenquelle. Kein neuer Konzeptbeschluss, sondern technischer Nachholbedarf für Claude Code – analog zu D47 (Drag & Drop) als offene Lücke vermerkt, nicht als Zielzustand.

## 8. Entwicklungs- und Rollout-Strategie

**Ausgangslage:** Git-Repository und eine separate Test-/Staging-Instanz sind bereits vorhanden; die Entwicklung erfolgt durch eine einzelne Person (den Auftraggeber selbst).

**Grundsatz: dasselbe Plugin bekommt eine neue Version, kein zweites Plugin entsteht.** `mod_seminarplaner` und `local_seminarplaner` behalten ihre Namen; der Umbau ist eine Versionsfolge desselben Codes, kein Nebeneinander von altem und neuem Plugin.

1. **Langlebiger Feature-Branch** (z. B. `umbau-sequenzansicht`) vom aktuellen produktiven Stand abgezweigt; der Stand davor bekommt einen Git-Tag als Rücksprungpunkt.
2. **Staging bekommt eine echte Kopie der Produktionsdaten** (DB-Dump), damit die Grid→Sequenz-Umrechnung (D20/D43) und die Übersetzungs-Anzeige (D35) an echten, teils „unsauberen" Bestandsplänen getestet werden – nicht nur an synthetischen Testdaten.
3. **Schrittweise Umsetzung entlang der Entscheidungsreihenfolge:** zuerst Datenmodell und Migrations-Logik (D20/D43), dann die Sequenzansicht selbst (D3/D10/D11) – **Block 2, abgeschlossen** –, dann Vorschlagsmechanik und Dramaturgie-Check (D14/D15/D22/D23/D40/D41) **plus D45** (Vorlagen-Anker-Zeiten der Grid-Einrichtung; thematisch näher an Block 1/2, aber bewusst zu Block 3 gezogen, damit Claude Code sie in der laufenden Implementierung mitnimmt) – **Block 3, aktuell**, zuletzt Bibliothek und Einreichen-Workflow (D28–D33, D37–D39). Nach jedem Block: Test auf Staging, bevor der nächste Block beginnt.
4. **Schema-Änderungen laufen über Moodles `upgrade.php`-Mechanismus**, nicht als manuelle Datenbank-Eingriffe – nummerierte, nachvollziehbare Upgrade-Schritte, die beim Versionswechsel automatisch nachgezogen werden. Die Grid→Sequenz-Umrechnung (D43) ist einer dieser Schritte.
5. **Produktion bleibt vom Umbau unberührt, bis ein zusammenhängender Meilenstein auf Staging überzeugt** – im Zweifel dort auch nochmal mit ein bis zwei Referentinnen getestet, ähnlich wie beim Wireframe-Workshop. Das Tool bleibt während der gesamten Umbauphase produktiv nutzbar, weil ausschließlich auf Branch und Staging gearbeitet wird. Der Umstieg auf Produktion erfolgt als ein einziger, koordinierter Update-Moment (passend zu D34–D36) – alle Referentinnen wechseln gemeinsam von Grid auf Sequenzansicht, keine gestaffelte Teil-Freischaltung.
6. **Zusätzliche Absicherung gegen versehentliches Deployment:** Ein eigenes Skill (`git-branch-guard-seminarplaner`) verhindert, dass die beiden bestehenden Deploy-/Release-Skills (`deploy-local-seminarplaner`, `seminarplaner-release` – Ziel: GitHub `main` und GitLab) während der Umbau-Arbeit versehentlich mitlaufen. Commits/Pushes auf den Feature-Branch nach GitHub sind normaler Alltag; ein Merge auf GitHub `main` oder **jeder** Push nach GitLab ist dagegen gesperrt, bis explizit eine stabile, produktionsreife Version für den Produktivsystem-Umstieg erklärt wird (D44). Branch-Name im Skill als Platzhalter (`umbau-sequenzansicht`) zu prüfen und ggf. anzupassen.
7. **Übergabe an Claude Code:** Ein Briefing-Dokument (`claude-code-briefing-seminarplaner.md`) fasst die wichtigsten technischen Eckpunkte für den Einstieg in Claude-Code-Sessions zusammen (D20, D19, D43, weitere Kernmechaniken) und verweist auf eine im Repository mitgeführte Kopie dieses Konzeptdokuments (`docs/seminarplaner-umbau-konzept.md`). Dieses Claude.ai-Projekt bleibt durchgehend der Ort für neue Richtungsentscheidungen (D44).

## 9. Vorschlag für die Projekt-Anweisungen (Claude-Projekt)

> Wir entwickeln das Moodle-Plugin „Seminarplaner" (mod_seminarplaner + local_seminarplaner) für die IG-Metall-Bildungsarbeit konzeptionell weiter. Zielgruppe sind hauptamtliche und ehrenamtliche Referentinnen: erfahrene Pädagoginnen ohne akademische Ausbildung und mit geringer IT-Kompetenz – alle Vorschläge müssen didaktische statt IT-Metaphern nutzen. Grundlage aller Arbeit ist das Dokument „seminarplaner-umbau-konzept.md" im Projektwissen; getroffene Entscheidungen (D1–D49) gelten, bis sie ausdrücklich revidiert werden. Aktuelle Phase: Konzeption und Richtungsklärung – keinen Code generieren, außer es wird ausdrücklich verlangt. Bei neuen Entscheidungen das Konzeptdokument fortschreiben. Antworten auf Deutsch.

Empfohlenes Projektwissen: dieses Dokument, die Plugin-Code-Referenz, ein Beispiel-Themenplan (TP_2026_ki.docx), das Wireframe der Sequenzansicht, die Workshop-Fragensammlung (workshop-fragen.md).

## 10. Nächste Schritte

1. ~~Claude-Projekt anlegen, Anweisungen und Projektwissen einpflegen.~~ ✓ erledigt
2. ~~Offene Fragen 1 und 6 klären.~~ ✓ erledigt (D8, D10, D11) – ebenso Fragen 2, 3, 5 (D9, D12, D13)
3. ~~**Frage 4 klären:** Dramaturgie-Check-Regeln formulieren.~~ ✓ Grundausrichtung erledigt (**D15**) – verbleibt: **Workshop mit erfahrenen Referentinnen**; alle Workshop-Fragen sind gesammelt im Begleitdokument **„workshop-fragen.md"** (D15-Regeln inkl. Schwellenwerte und Regel 2, Begriffe „Einreichen" und „Methoden-Sammlung" inzwischen final entschieden, Wireframe-Test mit UX-Prüffragen).
3a. ~~**Frage 7 klären:** Vorschlagsmechanik aus D4 konkret ausarbeiten.~~ ✓ erledigt (**D14**) – bei der Klärung von Frage 4 (Dramaturgie-Check) berücksichtigen, dass beide auf dieselben Daten zugreifen (Phasen, kognitive Dimension, Dauer).
3b. ~~**Frage 8 klären:** Tab-Struktur und -Benennungen nach dem Umbau durchdenken.~~ ✓ erledigt (**D16**) – verbleibt nur die finale Wahl „Einreichen" vs. „Weitergeben", ggf. im Workshop abfragen.
4. ~~**Wireframe verfeinern.**~~ ✓ abgeschlossen: v2 zeigt alle Entscheidungen (Alternativen D8, unbenannte Abschnitte D10, Fortsetzung + Verschiebe-Aktion D3, Tab-Leiste D16/D18, Vorschläge D14, Dramaturgie-Blick D15, Einheiten-Editor-Modal D17 mit drei Einstiegen). Das Wireframe ist das abgestimmte UI-Konzept und Testinstrument für den Referentinnen-Workshop.
5. ~~**Themenplan-Parser (D13) spezifizieren.**~~ ✓ erledigt (**D19**): Parsing-Regeln als Spezifikation ausformuliert – Best-Effort mit Import-Bericht, organisatorische Blöcke über leere Kompetenzerwartungen-Zelle, Wochentags-Mapping, Anker-Fallbacks, Kopfblock ignoriert, ein harter Boden bei fehlender Struktur. Keine neuen Workshop-Fragen daraus.
6. ~~**Datenmodell-Konzept für Sequenz, Anker-Platzierung und Alternativen** (D3, D8, D12).~~ ✓ erledigt (**D20**): Platzierung liegt an der einzelnen Seminareinheit statt am Baustein (löst Fortsetzung ohne Sonderfall); Baustein-Varianten (D8) tauschen als unterschiedlich lange Pakete auf einmal; Einheiten-Auswahl als eigene, neue Ebene für Einheiten-Alternativen.
7. ~~**Referentinnen-Workshop terminieren und durchführen.**~~ ✓ durchgeführt – erste Ergebnisse ausgewertet und eingearbeitet (**D22–D27**): Dramaturgie-Check-Regeln inkl. Schwellenwert final, neue Regel 7, Ein/Aus-Schalter, Tab-Name „Import/Export" bestätigt, Veranstaltungsgröße und vereinfachte Gruppengröße neu aufgenommen.
8. ~~**Verbleibende Workshop-Ergebnisse auswerten.**~~ ✓ Vollständig abgeschlossen: B1 (**D37**), B3 (**D38**), B4 (**D39**), B5 (**D40**/**D41**), Teil C (**D42**). Die gesamte Workshop-Fragensammlung (workshop-fragen.md) ist damit durchgearbeitet.
9. ~~**Methoden-Bibliothek (D29) konzipieren – Frage 9 klären.**~~ ✓ Frage 9 entschieden (**D32**: Seminarkonzepte nutzen denselben Mechanismus wie Methoden-Sammlungen, kein separates Verfahren). Verbleibt: weitere reale Methodenbestände vom Auftraggeber sichten, Facetten (Zeitpunkt/Anlass, Format, Aufwand) daran verfeinern oder korrigieren, danach UI-Konzept für die Bibliotheksansicht (Filternetz, Kartenansicht) ausarbeiten.
10. **UX-Konzept „Bibliothek ohne Vor-Import" (D33) ausarbeiten.** Grundsatz steht: globale Methoden-Sammlungen sind beim Planbau immer durchsuchbar, einzelne Methoden werden bei Übernahme sofort als lokale Kopie angelegt. Noch zu konzipieren: wie diese Bibliotheksansicht konkret in den Workflow der Sequenzansicht eingebunden wird (Andock-Panel, Suchen-und-Ablegen, separates Fenster).
11. ~~**Übergangsstrategie (D34) fertig ausarbeiten.**~~ ✓ Abgeschlossen. Übersetzungs-Anzeige konkretisiert (**D35**: ein Beispieltag mit echten eigenen Daten, pro Referentin einmal je Plan). Der ursprünglich geplante optische Stufenplan entfällt (**D36**: kein Wechsel Richtung Flipchart-Optik – Zielbild bleibt dauerhaft die Chrome-Variante „Vertraut"; der eigentliche Übergang ist der Mechanismus-Wechsel Grid-Logik → Sequenzlogik, bereits durch D35 abgedeckt). Verbleibt als rein technische Aufgabe: die Umsetzung der Grid→Sequenz-Umrechnung selbst (D20).
