# Seminarplaner Codequalitäts-Audit und Refactoring-Plan

Die Codebelege sind auf den ursprünglichen Prüfcommit festgelegt. Diese Tabelle beschreibt den Umsetzungsstand auf dem Audit-Branch.

| Paket | Stand und nächste Abnahme |
| --- | --- |
| CQ-001 | `e73931d` vereinheitlicht die Zuordnungsprüfung in den betroffenen Plan-APIs. Die Moodle-Rollen- und Kontextmatrix bleibt offen. |
| CQ-002 | `ced9f43` trennt Schnappschuss und Entwurf. `3d4d46b` entfernt Referenten aus gespeicherten Sequenz-Platzierungen. `d3045d2` deckt auch fehlende Restore-Zuordnungen und unlesbare Inhalte ab. Eine vollständige Feldliste setzt fachliche Vorgaben und Altformat-Fixtures voraus. |
| CQ-003 | `36ec54a` nutzt dieselbe Bereinigung für die Plugin-Tabellen in beiden kontextweiten Löschpfaden. Benutzerbezogene Anonymisierung und die Löschung von Kopien bleiben getrennte Verträge. |
| CQ-004 | `e41651d` prüft Größenlimits vor dem Draft-Ersatz. Für einen fehlertoleranten Austausch bleibt der in SEC-003 beschriebene Test auf dem konkreten Moodle-Dateispeicher erforderlich. |
| CQ-005 | `5f0b607` macht das Laden von Altständen schreibfrei. `3664431` liest für wiederholte Versionsabfragen nur ID und Hash des jüngsten Altstands. Beim Öffnen und beim ersten Speichern unter der Plansperre wird der vollständige Zustand geladen. Die Nutzung alter Weiterleitungen bleibt zu prüfen. |
| CQ-006 | Zeitregeln erst nach einem Vergleich mit gemeinsamen Referenzdaten zusammenführen. Die Testmatrix soll ältere Tagespläne, abweichende Pausen und Varianten in Web, App und PDF abdecken. |
| CQ-007 | `b6af912` korrigiert die Versionsangaben in der README. Die Installationsgrenze im Code bleibt erhalten. Der tatsächlich unterstützte Mindeststand muss mit dem Begleitplugin getestet werden. |

Auf einem lokalen Moodle-Teststand mit dem Begleitplugin die vollständige Suite mit `vendor/bin/phpunit --testsuite mod_seminarplaner_testsuite` ausführen. Für die Änderungspakete zuerst [Grid](../../tests/grid_service_test.php), [Anhänge](../../tests/sync_attachments_test.php), [Privacy](../../tests/privacy_provider_test.php) und [Präsenz](../../tests/presence_test.php) prüfen. Die Task-Registrierung zusätzlich beim Plugin-Upgrade verifizieren.

## 1. Zusammenfassung

Das größte Refactoring-Potenzial liegt an drei Grenzen, an denen ähnliche Abläufe inzwischen unterschiedliche Regeln haben. Die API löst Kontext und Planobjekt getrennt auf. Entwurf und veröffentlichter Zustand verwenden überlappende Datenmodelle. Aktivitätslöschung und Privacy-Provider pflegen eigene Tabellenlisten. Die ersten Arbeitspakete sichern diese Verträge. Danach lassen sich Legacy-Migration, Dateiersatz und die mehrfach implementierten Darstellungsregeln gezielt entflechten.

Prüfstand ist ausschließlich der Moodle-Seminarplaner am Commit `d93a60bd289aac160e7372636e19a628503397a9`, Release 1.1.0, Build 2026111302. Die [Prüfgrundlage und Betriebsgrenzen](SECURITY-DATA-PRIVACY-AUDIT-Seminarplaner-20261119.md#2-prüfstand-und-umfang) gelten auch für diesen Bericht.

## 2. Prüfergebnisse und Testabdeckung

| Prüfschritt | Ergebnis |
| --- | --- |
| Statisches Review | Einstiegspunkte, ausgewählte API- und Servicepfade, Schema, Backup, Privacy, Altformatmigration, Konsumenten des Planzustands sowie eingecheckte Tests gesichtet. |
| PHP-Syntaxprüfung | 74 PHP-Dateien bestanden unter PHP 8.4.24 CLI in einem isolierten lokalen Container. Der produktive PHP-Stand 8.3.36 ist damit noch nicht geprüft. |
| AMD-Syntaxprüfung | 34 JavaScript-Dateien in `amd/src` und `amd/build` bestanden `node --check` mit Node 24.22.3. Reproduzierbarkeit der Builds wurde damit noch nicht geprüft. |
| Vorhandene isolierbare Tests | Vier Testmethoden aus `import_export_validator_test.php` liefen mit einem lokalen Assertion-Adapter ohne Moodle und bestanden. Sie prüfen Pflichtfeld, Altformat-Mapping sowie Warnung und Fehler beim Export. |
| Moodle-Integration | 135 `test_`-Methoden in 23 PHP-Testdateien und eine Behat-Featuredatei erfasst. Die reguläre Moodle-Suite wurde ohne passenden lokalen Stack nicht gestartet. Vorhandene Tests für Privacy, Backup/Restore, App, Merge und Anhänge bilden die Basis für die Nachprüfung. |
| Qualitätsschranke | Im Checkout keine eingecheckte CI-Workflow-Definition gefunden. Extern konfigurierte CI bleibt offen. |

## 3. Refactoring-Arbeitspakete

### CQ-001 Planobjekte kontextgebunden auflösen

**Beobachtung.** Die zentrale API-Klasse enthält knapp 4.950 Zeilen. Die Plan-Aktivitäts-Bindung wird beim Publizieren angewendet, im allgemeinen Zustandszugriff fehlt sie. Die Auflösung des Modulkontexts kommt vor der Verarbeitung, bindet aber das fachliche Planobjekt noch nicht.

**Evidenz.** [SEC-001](SECURITY-DATA-PRIVACY-AUDIT-Seminarplaner-20261119.md#sec-001-fehlende-objektbindung-bei-planzugriffen) · [API-Kontext](https://github.com/gibro/seminarplaner_mod/blob/d93a60bd289aac160e7372636e19a628503397a9/classes/external/api.php#L72) · [Publikationsprüfung](https://github.com/gibro/seminarplaner_mod/blob/d93a60bd289aac160e7372636e19a628503397a9/classes/local/service/grid_service.php#L945)

**Maßnahme.** Einen klar abgegrenzten Auflösungsschritt für Kontext und zugehörigen Plan einführen. Zuerst Lesen und Speichern umstellen. Danach weitere API-Aufrufer mit Planbezug inventarisieren und bei gleicher Semantik übernehmen. Gültige API-Signaturen, Rollen, Versionshash und Merge-Verhalten erhalten.

**Abnahme.** Moodle-Regressionstests belegen fachlich korrekte Ergebnisse im erlaubten Kontext und Verweigerung außerhalb davon. Bestehende Merge-Tests bleiben grün. Das Arbeitspaket deckt die Objektbindung ab und kann unabhängig von den Anzeigeumbauten geprüft werden.

### CQ-002 Veröffentlichung als eigenen Datenvertrag abbilden

**Beobachtung.** Der Veröffentlichungs-Service verarbeitet generisches Zustands-JSON. `get_roterfaden_state()` ergänzt für Altstände bei Bedarf aktuelle Planungsdaten. AJAX und App wenden Sichtbarkeit an unterschiedlichen Stellen an.

**Evidenz.** [SEC-002](SECURITY-DATA-PRIVACY-AUDIT-Seminarplaner-20261119.md#sec-002-freigabe-schützt-den-gespeicherten-schnappschuss-nicht-durchgängig) · [Snapshot-Service](https://github.com/gibro/seminarplaner_mod/blob/d93a60bd289aac160e7372636e19a628503397a9/classes/local/service/grid_service.php#L945) · [App-Ausgabe](https://github.com/gibro/seminarplaner_mod/blob/d93a60bd289aac160e7372636e19a628503397a9/classes/output/mobile.php#L81)

**Maßnahme.** Den Zustand für Teilnehmende aus einem definierten Satz veröffentlichbarer Felder bilden. Sichtbarkeit an der serverseitigen Grenze für Web und App anwenden. Alt-Snapshots durch denselben Vertrag lesen. Veröffentlichte Zeitpläne, Handouts und fachlich benötigte Altdaten erhalten.

**Abnahme.** Fixtures für aktuelle und ältere Schnappschüsse zeigen dieselben vorgesehenen Felder in Web und App. Nach Aufheben der Freigabe liefert der Server keine Inhalte. Vorhandene Publikations-, Referenten- und App-Tests um die öffentlichen Antwortdaten ergänzen.

### CQ-003 Löschverträge anhand des Datenschemas zentralisieren

**Beobachtung.** Aktivitätslöschung und Privacy-Provider kennen unterschiedliche Ausschnitte des Schemas. Auskunft, Kontextsuche und Löschung pflegen ihre Datenquellen getrennt.

**Evidenz.** [DS-001](SECURITY-DATA-PRIVACY-AUDIT-Seminarplaner-20261119.md#ds-001-unvollständige-bereinigung-beim-löschen-einer-aktivität) · [DS-002](SECURITY-DATA-PRIVACY-AUDIT-Seminarplaner-20261119.md#ds-002-sperrdaten-fehlen-bei-der-ermittlung-von-anfragekontexten) · [Schema](https://github.com/gibro/seminarplaner_mod/blob/d93a60bd289aac160e7372636e19a628503397a9/db/install.xml)

**Maßnahme.** Für jede Datenquelle festlegen, ob Aktivitätslöschung, betroffenenbezogene Löschung oder Anonymisierung greift. Gemeinsame Löschschritte wiederverwenden, wo die Verträge identisch sind. Personenbezogene Zuordnungen und gemeinsam erarbeitete Inhalte weiterhin unterschiedlich behandeln.

**Abnahme.** Synthetische Fixtures decken jede betroffene Tabelle ab. Kontextsuche findet auch eine ausschließlich über einen Sperrdatensatz erfasste Person. Wiederholte Bereinigung hinterlässt denselben Zustand. Datensätze anderer Personen und Aktivitäten bleiben im vorgesehenen Umfang erhalten.

### CQ-004 Anhangsänderungen explizit und fehlertolerant verarbeiten

**Beobachtung.** Karten-Speicherung unterstützt verschiedene Anhangsformate und Fallbacks. Der Draft-Ersatz kann nach einem Kopierfehler teilweise erfolgreich weiterlaufen. Historisch erforderte das Speichern einer anderen Einheit bereits eine Korrektur zum Erhalt vorhandener Anhänge.

**Evidenz.** [SEC-003](SECURITY-DATA-PRIVACY-AUDIT-Seminarplaner-20261119.md#sec-003-teilfehler-beim-ersetzen-von-anhängen) · [SEC-004](SECURITY-DATA-PRIVACY-AUDIT-Seminarplaner-20261119.md#sec-004-dateibudgets-greifen-je-nach-aufrufweg-unterschiedlich) · [Bestehende Anhangstests](https://github.com/gibro/seminarplaner_mod/blob/d93a60bd289aac160e7372636e19a628503397a9/tests/sync_attachments_test.php#L323)

**Maßnahme.** An der Servicegrenze zwischen Beibehalten, gezieltem Löschen und Ersetzen unterscheiden. Neuen Bestand vor dem Umschalten validieren. Fehlschläge an den Aufrufer melden und gemeinsame Dateibudgets umsetzen. Fehlende Felder, leere Altwerte und explizite Löschsignale nach dem heutigen Vertrag behandeln.

**Abnahme.** Die Tests für fehlende Felder und leere Listen bleiben grün. Ein Dateiübernahmefehler erhält den alten Bestand und ist für den Aufrufer erkennbar. Reimport und Wiederholung erzeugen keine doppelten Dateien.

### CQ-005 Legacy-Migration aus lesenden Aufrufen lösen

**Beobachtung.** Das Upgrade konvertiert alte Planstände. Der reguläre Getter überführt fehlende gemeinsame Zustände zusätzlich beim Lesen aus Altdaten in die Datenbank. Die alten Seiten `planningmode.php` und `methods.php` sind weiterhin Kompatibilitätseinstiege.

**Evidenz.** [Versionierte Migration](https://github.com/gibro/seminarplaner_mod/blob/d93a60bd289aac160e7372636e19a628503397a9/db/upgrade.php#L140) · [Getter mit Schreibpfad](https://github.com/gibro/seminarplaner_mod/blob/d93a60bd289aac160e7372636e19a628503397a9/classes/local/service/grid_service.php#L699) · [Planungsmodus-Weiterleitung](https://github.com/gibro/seminarplaner_mod/blob/d93a60bd289aac160e7372636e19a628503397a9/planningmode.php) · [Methoden-Weiterleitung](https://github.com/gibro/seminarplaner_mod/blob/d93a60bd289aac160e7372636e19a628503397a9/methods.php)

**Maßnahme.** Zuerst Bestands- und Import-Fixtures für alle weiterhin unterstützten Formate erfassen. Dauerhafte Konvertierung an Upgrade, Import oder einen ausdrücklichen einmaligen Migrationsvorgang binden. Bestehende Links auf erforderliche Weiterleitungen und aktuelle Aufrufer prüfen. Aufbauend auf CQ-001 den getterseitigen Schreibpfad entfernen, sobald alle relevanten Datenwege abgedeckt sind.

**Abnahme.** Altplan, Neuplan und Altimport bleiben lesbar und behalten Referenzen, Zeiten und Anhänge. Wiederholte Migration ist stabil. Ein reiner Lesevorgang verändert keine Persistenz. Bei Deaktivierung eines Altpfads sind Datenformat und verbleibende Aufrufer dokumentiert.

### CQ-006 Zeitregeln über verschiedene Ausgaben absichern

**Beobachtung.** Die Logik für Tagesanker und abweichende Pausen existiert in PHP und in mehreren AMD-Modulen. Das Umsetzungsprotokoll dokumentiert teilweise kopierte Regeln als Folge der Web-, App- und PDF-Umbauten.

**Evidenz.** [PHP-Modell](https://github.com/gibro/seminarplaner_mod/blob/d93a60bd289aac160e7372636e19a628503397a9/classes/local/sequence/roterfaden_model.php#L178) · [AMD-Modell](https://github.com/gibro/seminarplaner_mod/blob/d93a60bd289aac160e7372636e19a628503397a9/amd/src/roterfadenmodel.js#L104) · [Sequenz](https://github.com/gibro/seminarplaner_mod/blob/d93a60bd289aac160e7372636e19a628503397a9/amd/src/sequenz.js#L93) · [Umbauprotokoll](https://github.com/gibro/seminarplaner_mod/blob/d93a60bd289aac160e7372636e19a628503397a9/docs/umsetzungsprotokoll.md)

**Maßnahme.** Gemeinsame Beispieldaten für aktive und ältere Zeitmodelle anlegen. Zuerst den fachlichen Gleichlauf absichern. Danach redundante Regeln innerhalb derselben Laufzeit zusammenführen und eine reproduzierbare Erstellung der AMD-Builds einrichten.

**Abnahme.** Web, App und PDF stimmen für die gemeinsamen fachlichen Angaben überein, einschließlich Tagesgrenzen, Pausen und Varianten. Formatierung und bewusst unterschiedliche Darstellungsdetails bleiben erhalten. Der Build-Abgleich lässt sich lokal wiederholen.

### CQ-007 Mindestversion und Testmatrix synchronisieren

**Beobachtung.** Die Moduldeklaration setzt `requires = 2024042200` und bezeichnet diese Version im Kommentar als Moodle 4.5. Laut Versionsabgleich im Auditplan gehört der Wert zu Moodle 4.4. Das Begleitplugin ist eine Pflichtabhängigkeit.

**Evidenz.** [Modulversion](https://github.com/gibro/seminarplaner_mod/blob/d93a60bd289aac160e7372636e19a628503397a9/version.php) · [Versionsabgleich](SEMINARPLANER-AUDITPLAN.md#seminarplaner-und-erste-prüfbare-ausgangspunkte)

**Maßnahme.** Unterstützte Mindestversion bewusst festlegen und Deklaration, README, Begleitplugin-Kompatibilität und Testmatrix daran ausrichten. Den produktionsnahen Stand Moodle 5.2.5 und PHP 8.3 zusätzlich testen.

**Abnahme.** Installation und Upgrade sind auf dem vereinbarten Mindeststand und der Zielumgebung belegt. Dokumentation und `requires` nennen denselben Mindeststand. Testbefehle und bekannte Einschränkungen stehen im Repository.

## 4. Reihenfolge und Nachprüfung

| Reihenfolge | Paket | Grund |
| --- | --- | --- |
| 1 | CQ-001 und CQ-002 | Beheben belegte Fehler an Berechtigungs- und Freigabegrenzen. Beide Pakete lassen sich separat reviewen. |
| 2 | CQ-003 und CQ-004 | Sichern Löschung und Dateibestand bei Fehlern und Wiederholung. |
| 3 | CQ-005 und CQ-006 | Vereinfachen Altpfade und doppelte Regeln auf Basis der zuvor abgesicherten Verträge. |
| Parallel zur Vorbereitung | CQ-007 | Liefert die Testumgebung und die Kompatibilitätsbasis für den Nachweis der anderen Pakete. |

Jeder spätere PR nennt das Paket, sämtliche berührten Security- oder Datenschutz-IDs und die lokal überprüften Abnahmekriterien. Die Änderungen werden anschließend anhand des Diffs und der Regressionstests nachgeprüft.
