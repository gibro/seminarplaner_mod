# Seminarplaner Security und Datenschutz Audit

Die Codebelege in diesem Bericht beziehen sich auf den ursprünglichen Prüfcommit. Der folgende Umsetzungsstand dokumentiert die Vorschläge auf dem Audit-Branch.

## Umsetzungsstand auf dem Audit-Branch

| Befund | Änderung oder offene Entscheidung | Nachprüfung |
| --- | --- | --- |
| SEC-001 | `e73931d` bindet die Plan-ID an den bereits autorisierten Modulkontext. | Erlaubte Nutzung und Verweigerung für zwei getrennte Aktivitäten auf Moodle 5.2.5 prüfen. |
| SEC-002 | `ced9f43` entfernt den Entwurfs-Fallback. `3d4d46b` filtert Referenten in gespeicherten Sequenz-Platzierungen. `d3045d2` behandelt auch eine beim Restore fehlende Planzuordnung und unlesbare Schnappschüsse als unveröffentlicht. | Gültige Veröffentlichungen und Widerruf in Web, App und Handout prüfen. Die vollständige Feldfreigabe braucht abgestimmte Altformat-Beispiele und eine Definition der für Teilnehmende bestimmten Felder. |
| SEC-003 | Der Ersetzungsvorgang bei Fehlern im File API bleibt offen. Konkreter Vorschlag für den nächsten PR: validierte Ersatzdateien zuerst in einem temporären Bereich vorbereiten, danach den aktiven Bestand unter Erhalt der Dateiverweise umschalten und Speicherfehler an den Aufrufer melden. | Auf dem tatsächlich eingesetzten Dateispeicher Fehler beim Vorbereiten und beim Umschalten simulieren. Bisherige Dateien und Links bleiben nutzbar, bis der Ersatz vollständig vorliegt. |
| SEC-004 | `e41651d` übernimmt die vorhandene 10-MiB-Einzelgrenze für neue eingebettete und Draft-Anhänge. Zu große Draft-Anhänge werden vor dem Leeren des Dateibereichs erkannt. | Neue Dateien knapp unter und über der Grenze sowie unverändert übernommene Altdateien prüfen. Gesamtbudgets und betriebliche Uploadgrenzen separat bestätigen. |
| DS-001 | `36ec54a` führt die Bereinigung der Aktivitäts- und Privacy-Datensätze zusammen. Die Änderung betrifft die SQL-Tabellen. | Löschung einer synthetisch befüllten Aktivität und Erhalt einer zweiten Aktivität prüfen. Dateispeicher, Konfigurationsreste, globale Kopien und Backups gesondert nachverfolgen. |
| DS-002 | `36ec54a` berücksichtigt Sperrdaten bei der personenzentrierten Kontextermittlung. | Den Regressionstest für eine Person mit ausschließlich einem Sperrdatensatz ausführen. |
| DS-003 | `b6af912` registriert die Präsenzbereinigung als Moodle-Task und nutzt die vorhandene 120-Sekunden-Schwelle. | Upgrade auf Build `2026111900`, Task-Registrierung und Löschung ohne neue Pings prüfen. Die effektive Verzögerung hängt vom Moodle-Cron ab. |

**Gegenprüfung auf Code-Stand `3664431`.** 76 PHP-Dateien bestanden die Syntaxprüfung mit PHP 8.4.24, 34 AMD-Quellen und Builds die Syntaxprüfung mit Node 24.22.3. Vier vorhandene Import-/Export-Validatortests bestanden mit lokalem Assertion-Adapter. Sieben isolierte Aufrufe des echten Freigabeservices mit einem Repository-Testdouble bestätigten das Ergebnis für fehlende Restore-Zuordnung, fehlenden Plan, fremde Aktivität, archivierten Plan, Widerruf, unlesbaren Inhalt und gültige Freigabe. Der eingecheckte [Moodle-Regressionstest](../../tests/grid_service_test.php) prüft die Wiederherstellungsfälle auf Ebene der gespeicherten Daten. Der vollständige Restore, die Rollenmatrix, PHPUnit und Behat stehen auf dem Moodle-Testsystem aus.

**Offen beim Dateiersatz (SEC-003/004).** Der Draft-Pfad prüft die Einzelgrößen vor dem Leeren des Bereichs. Eingebettete Anhänge werden nacheinander geprüft und geschrieben. Wird erst ein späterer Anhang wegen seiner Größe abgelehnt, können frühere Einträge desselben Aufrufs bereits geändert sein. Für die Abnahme zwei Einträge verwenden und den Bestand nach Ablehnung des zweiten vergleichen. [Dateiservice im Audit-Branch](../../classes/local/service/method_card_service.php)

## 1. Management-Zusammenfassung

Beim Lesen und Speichern gemeinsamer Seminarpläne fehlt im geprüften API-Pfad die Bindung des Plans an die autorisierte Aktivität. Das ist der wichtigste Befund, da die Zugriffskontrolle für eine Aktivität auch die Daten anderer Aktivitäten schützen muss. Der API-Endpunkt für den Roten Faden liefert außerdem den gespeicherten Inhalt auch bei aufgehobener Freigabe. Bei der Löschung einer Aktivität bleiben im Plugin mehrere Tabellen unberücksichtigt. Diese drei Punkte sollten vor größeren Refactorings behoben werden.

Die Feststellungen beruhen auf lokalem Code-Review. Alle 74 PHP-Dateien und 34 AMD-Quell- und Build-Dateien bestanden die jeweilige Syntaxprüfung. Vier vorhandene, isolierbare Validator-Tests bestanden mit einem lokalen Assertion-Adapter. Rollenverhalten, Datenschutzprozesse, Backup und App wurden statisch gesichtet. Ihre Nachprüfung in Moodle steht aus.

## 2. Prüfstand und Umfang

| Merkmal | Angabe |
| --- | --- |
| Quellstand | `seminarplaner_mod`, `codex/security-privacy-audit`, `d93a60bd289aac160e7372636e19a628503397a9`, Release 1.1.0 / Build 2026111302 |
| Installationsangaben | Die Plugin-Übersicht nennt Seminarplaner 1.1.0 (Build 2026111302). Die Serverinformationen nennen PHP 8.3.36 mit FPM. Der lokale Screenshot zeigt Moodle 5.2.5 (Build 20261112) als ausgewählte Version der Umgebungsprüfung. Die tatsächlich installierte Moodle-Core-Version ist separat zu bestätigen. |
| Begleitplugin | `local_seminarplaner` ab Build 2026111100 erforderlich. Installierter Build und Quellstand des Begleitplugins wurden im lokalen Prüfbestand nicht verifiziert. |
| Lokale Werkzeuge | Statisches Codex-Code-Review, Git und Dateisuche, PHP 8.4.24 CLI in lokal vorhandenem Container ohne Netzwerk und mit schreibgeschütztem Mount, Node 24.22.3. Keine gehostete Codex-Security-Prüfung oder PR-Review ausgelöst. |
| Lokale Tests | `php -l`, `node --check` und die vier Tests aus `import_export_validator_test.php` mit Assertion-Adapter. Moodle-PHPUnit und Behat benötigen eine lokale Moodle-Installation mit Datenbank und Begleitplugin. Im verfügbaren Bestand wurde kein solcher Prüfstand gefunden. |
| Maßstab | Lokale Audit-Vorgabe sowie der im Prüfplan dokumentierte Abgleich mit OWASP ASVS 5 und den Moodle-Zugriffs- und Privacy-APIs. |

Evidenzverweise zeigen auf den geprüften lokalen Checkout. **Im Code bestätigt** bezeichnet die im Quelltext belegte Abweichung. Die tatsächliche Auswirkung unter den produktiven Rollen, Einstellungen und Datenbeständen ist eine eigene Prüffrage. Alle Arbeiten fanden lokal statt.

## 3. Bedrohungsmodell und Abdeckung

Entscheidend sind die Grenzen zwischen Kursen und Aktivitäten, zwischen Entwurf und Veröffentlichung sowie zwischen lokaler Planung und globaler Bibliothek. Relevante Personen sind Teilnehmende, Trainer mit und ohne Bearbeitungsrechte, Reviewer und Administration. Zu schützen sind Planzustände, Methodenmaterialien, Referenten-Zuordnungen, Entwürfe und personenbezogene Betriebsdaten.

| Funktion | Geprüfte Grenze | Evidenz und Restfrage |
| --- | --- | --- |
| Web und AJAX | Anmeldung, Modulkontext, Rollen sowie Plan- und Aktivitätszuordnung | Registrierung der 46 Dienste inventarisiert. Kritische Lese-, Schreib- und Publikationspfade statisch verfolgt. Zwei-Aktivitäten-Rollenmatrix bleibt ausstehend. |
| Roter Faden und Live | Veröffentlichung und getrennte Rollen für Teilnahme und Durchführung | Web-API, Service und App-Ausgabe gesichtet. Die App rendert Tage erst nach Capability- und Publikationsprüfung. Browser- und Offline-Nachweise stehen aus. |
| Dateien und Austausch | Aktivitätskontext, Zugriff auf Methodenmaterialien, Dateibudgets, Importfehler | Direkter Upload, Dateiabruf, Draft-Ersatz und ausgewählte Importpfade gesichtet. Vier Validator-Tests bestanden. ZIP- und globaler Austausch wurden stichprobenweise geprüft. |
| Globale Bibliothek | Kategorie-, System- und Aktivitätskontext, Entwurf und Veröffentlichung | Anbindung im Modul gesichtet. Berechtigungen, Datenverbleib und Versionen im Begleitplugin bleiben offen. |
| Privacy, Backup und App | Auskunft, Löschung, Datenminimierung, Wiederherstellung und Offline-Kopien | Schema, Modullöschung, Privacy-Provider, Backup-Quellen und App-Registrierung statisch verglichen. Laufzeit und Betreiberkonfiguration bleiben offen. |

Positiv belegt sind die Moodle-Kontextauflösung mit Anmeldung, der Kursmodulbezug beim Dateiabruf, die Prüfung der Plan-Aktivitätszuordnung beim Veröffentlichen und die eigene Capability für die Live-Ansicht. Der Direktupload prüft Anmeldung, Capability und Sitzungsschlüssel. [API-Kontext](https://github.com/gibro/seminarplaner_mod/blob/d93a60bd289aac160e7372636e19a628503397a9/classes/external/api.php#L72) · [Dateiabruf](https://github.com/gibro/seminarplaner_mod/blob/d93a60bd289aac160e7372636e19a628503397a9/lib.php#L247) · [Publikation](https://github.com/gibro/seminarplaner_mod/blob/d93a60bd289aac160e7372636e19a628503397a9/classes/local/service/grid_service.php#L945) · [Rollen](https://github.com/gibro/seminarplaner_mod/blob/d93a60bd289aac160e7372636e19a628503397a9/db/access.php#L58) · [Upload](https://github.com/gibro/seminarplaner_mod/blob/d93a60bd289aac160e7372636e19a628503397a9/upload_attachment.php#L45)

## 4. Befunde

| ID | Befund | Schwere | Evidenzstatus |
| --- | --- | --- | --- |
| SEC-001 | Planzugriff bindet das Objekt nicht an die autorisierte Aktivität | Hoch | Im Code bestätigt |
| SEC-002 | API liefert Schnappschussinhalt unabhängig von der Sichtbarkeit | Hoch | Im Code bestätigt |
| SEC-003 | Fehler beim Kopieren von Anhängen können zu unbemerktem Datenverlust führen | Mittel | Im Code bestätigt |
| SEC-004 | Unterschiedliche Ressourcenbudgets für Dateiübernahmen | Mittel | Abweichung im Code bestätigt, Laufzeiteffekt offen |
| DS-001 | Modul- und Datenschutzlöschung decken unterschiedliche Daten ab | Mittel | Im Code bestätigt |
| DS-002 | Datenschutz-Kontextsuche berücksichtigt Sperren nicht | Niedrig | Im Code bestätigt |
| DS-003 | Präsenzbereinigung hängt von Folgeaktivität ab | Niedrig | Im Code bestätigt |

### SEC-001 Fehlende Objektbindung bei Planzugriffen

**Beobachtung.** `get_user_state()` und `save_user_state()` prüfen `managegrids` im aufgelösten Modulkontext. Der anschließende Servicezugriff arbeitet ausschließlich mit der Plan-ID. Die gekapselte Schreibsperre serialisiert den Zugriff auf den Plan, prüft aber dessen Zugehörigkeit zur autorisierten Aktivität nicht. Damit fehlt eine objektbezogene Zugriffskontrolle für vertrauliche Plansicht und Änderung.

**Evidenz.** [Lese-API](https://github.com/gibro/seminarplaner_mod/blob/d93a60bd289aac160e7372636e19a628503397a9/classes/external/api.php#L3863) · [Schreib-API](https://github.com/gibro/seminarplaner_mod/blob/d93a60bd289aac160e7372636e19a628503397a9/classes/external/api.php#L4016) · [Service und Sperre](https://github.com/gibro/seminarplaner_mod/blob/d93a60bd289aac160e7372636e19a628503397a9/classes/local/service/grid_service.php#L344) · [Repository-Zugriff nach Plan-ID](https://github.com/gibro/seminarplaner_mod/blob/d93a60bd289aac160e7372636e19a628503397a9/classes/local/repository/grid_repository.php#L166)

**Maßnahme.** Plan und Kontext vor jeder Verarbeitung zusammen auflösen. Dieselbe Bindung für alle API-Pfade mit Planbezug verwenden und direkte Aufrufer des Services mitprüfen.

**Abnahme.** Zwei Testaktivitäten mit unterschiedlichen Rollen. Erlaubte Operationen im eigenen Kontext bleiben möglich. Außerhalb des berechtigten Kontexts werden Lese- und Schreiboperationen verweigert. Betroffene Zustände und Versionswerte bleiben unverändert.

### SEC-002 Freigabe schützt den gespeicherten Schnappschuss nicht durchgängig

**Beobachtung.** Die lesende API ist für die Capability `viewroterfaden` verfügbar, die standardmäßig auch Teilnehmende erhalten. Der Service berechnet die Sichtbarkeit und gibt zugleich den dekodierten Zustand zurück. Die API serialisiert diesen state auch bei fehlender Sichtbarkeit. Zusätzlich kann der Service bei älteren Snapshots den aktuellen Planungszustand ergänzen. Die App prüft Sichtbarkeit vor dem Rendern der Tage.

**Evidenz.** [Teilnehmenden-Capability](https://github.com/gibro/seminarplaner_mod/blob/d93a60bd289aac160e7372636e19a628503397a9/db/access.php#L48) · [API-Ausgabe](https://github.com/gibro/seminarplaner_mod/blob/d93a60bd289aac160e7372636e19a628503397a9/classes/external/api.php#L3596) · [Fallback und Sichtbarkeit](https://github.com/gibro/seminarplaner_mod/blob/d93a60bd289aac160e7372636e19a628503397a9/classes/local/service/grid_service.php#L1016) · [App-Renderpfad](https://github.com/gibro/seminarplaner_mod/blob/d93a60bd289aac160e7372636e19a628503397a9/classes/output/mobile.php#L81)

**Maßnahme.** Den Teilnehmenden-Zustand serverseitig auf eine definierte öffentliche Projektion beschränken. Bei aufgehobener Freigabe Inhalt und Plan-ID aus der öffentlichen Antwort entfernen. Altformate vor der Ausgabe mit der gleichen Freigabe- und Feldlogik behandeln.

**Abnahme.** Freigegebene Ansichten funktionieren in Web und App. Ohne Freigabe enthält die Serverantwort keine Planinhalte. Die Projektion verwendet bei Altdaten ausschließlich Felder, die für Teilnehmende bestimmt sind.

### SEC-003 Teilfehler beim Ersetzen von Anhängen

**Beobachtung.** Der Draft-Pfad leert den bestehenden Dateibereich vor dem Kopieren. Fehler beim Kopieren und beim zweiten Versuch können übersprungen werden. Der normale Karten-Speicherweg meldet nach Rückkehr aus dem Service Erfolg. Unter Dateispeicherfehlern kann damit der bisherige Bestand ganz oder teilweise verloren gehen.

**Evidenz.** [Draft-Ersatz](https://github.com/gibro/seminarplaner_mod/blob/d93a60bd289aac160e7372636e19a628503397a9/classes/local/service/method_card_service.php#L1025) · [Erfolgsmeldung](https://github.com/gibro/seminarplaner_mod/blob/d93a60bd289aac160e7372636e19a628503397a9/classes/external/api.php#L887)

**Maßnahme.** Neuen Anhangsbestand vollständig vorbereiten und validieren, bevor der alte Bestand ersetzt wird. Teilerfolg und Wiederholung ausdrücklich im Service-Ergebnis abbilden.

**Abnahme.** Ein simulierter Kopierfehler lässt den bisherigen Bestand nutzbar und liefert einen eindeutigen Fehler. Erfolgreiche Ersetzung sowie bewusstes Entfernen funktionieren weiterhin.

### SEC-004 Dateibudgets greifen je nach Aufrufweg unterschiedlich

**Beobachtung.** Direktuploads haben ein Limit von 10 MiB. Der Methoden-API-Aufruf begrenzt JSON auf 25 MiB. Der Methodenservice begrenzt die Anzahl der Dateien und deaktiviert mit `MAX_ATTACHMENT_BYTES = 0` seinen eigenen Dateigrößencheck für Draft- und eingebettete Dateien. Die wirksamen Moodle-, PHP- und Proxy-Grenzen wurden nicht verifiziert.

**Evidenz.** [Upload-Limit](https://github.com/gibro/seminarplaner_mod/blob/d93a60bd289aac160e7372636e19a628503397a9/upload_attachment.php#L28) · [API-Limit](https://github.com/gibro/seminarplaner_mod/blob/d93a60bd289aac160e7372636e19a628503397a9/classes/external/api.php#L875) · [Service-Limit](https://github.com/gibro/seminarplaner_mod/blob/d93a60bd289aac160e7372636e19a628503397a9/classes/local/service/method_card_service.php#L39) · [Draft-Prüfung](https://github.com/gibro/seminarplaner_mod/blob/d93a60bd289aac160e7372636e19a628503397a9/classes/local/service/method_card_service.php#L1036)

**Maßnahme und Abnahme.** Einheitliche Einzel- und Gesamtbudgets je berechtigtem Vorgang definieren. Direktupload, Draft und eingebettete Dateien mit normalen Grenzwert-Fixtures prüfen. Vor Überschreiten der Vorgaben bleibt der alte Dateibestand erhalten.

### DS-001 Unvollständige Bereinigung beim Löschen einer Aktivität

**Beobachtung.** `seminarplaner_delete_instance()` löscht einige Modultabellen und Favoriten. Präsenzdaten, gemeinsamer Planungszustand, Publikations-Snapshots und Datei-Mappings fehlen in diesem Callback. Der Privacy-Provider führt diese Tabellen bei der kontextweiten Löschung ausdrücklich. Damit unterscheiden sich zwei Löschwege für dieselbe Aktivität. Die Moodle-Core-Bereinigung von Dateien ist separat zu verifizieren.

**Evidenz.** [Aktivitätslöschung](https://github.com/gibro/seminarplaner_mod/blob/d93a60bd289aac160e7372636e19a628503397a9/lib.php#L130) · [Kontextweite Privacy-Löschung](https://github.com/gibro/seminarplaner_mod/blob/d93a60bd289aac160e7372636e19a628503397a9/classes/privacy/provider.php#L530) · [Datenschema](https://github.com/gibro/seminarplaner_mod/blob/d93a60bd289aac160e7372636e19a628503397a9/db/install.xml)

**Maßnahme und Abnahme.** Beide Löschverträge pro Datenart festlegen und die Bereinigung aufeinander abstimmen. Nach Löschung einer synthetisch befüllten Aktivität verbleiben in keiner vorgesehenen Plugintabelle abhängige Zeilen. Eine zweite Aktivität bleibt unverändert. Backups werden gemäß eigenem Aufbewahrungsprozess beurteilt.

### DS-002 Sperrdaten fehlen bei der Ermittlung von Anfragekontexten

**Beobachtung.** `get_users_in_context()` berücksichtigt Sperren. `get_contexts_for_userid()` durchsucht Benutzerzustand und Präsenz, berücksichtigt die Sperrtabelle aber nicht. Haben andere Quellen keinen passenden Treffer, kann ein Modulkontext für eine Person mit Sperrdaten fehlen.

**Evidenz.** [Personenzentrierte Suche](https://github.com/gibro/seminarplaner_mod/blob/d93a60bd289aac160e7372636e19a628503397a9/classes/privacy/provider.php#L161) · [Kontextzentrierte Suche](https://github.com/gibro/seminarplaner_mod/blob/d93a60bd289aac160e7372636e19a628503397a9/classes/privacy/provider.php#L225) · [Export von Sperren](https://github.com/gibro/seminarplaner_mod/blob/d93a60bd289aac160e7372636e19a628503397a9/classes/privacy/provider.php#L376)

**Maßnahme und Abnahme.** Kontextermittlung und Export/Löschung nach denselben Datenquellen ausrichten. Ein minimaler Testfall mit Sperrdaten als einziger Quelle findet den richtigen Kontext und verarbeitet die Daten entsprechend.

### DS-003 Sichtbarkeit und Aufbewahrung der Präsenzdaten sind verschieden

**Beobachtung.** Die Präsenzansicht filtert nach 20 Sekunden. Das tatsächliche Löschen älterer Datensätze geschieht bei einem späteren Ping. Das Modul plant hierfür keinen periodischen Job. Ohne Folgeaktivität bleibt die Zeitangabe von 120 Sekunden deshalb eine Prüfschwelle für den nächsten Löschlauf. DS-001 betrifft zusätzlich den Abbau beim Löschen der Aktivität.

**Evidenz.** [Präsenzservice](https://github.com/gibro/seminarplaner_mod/blob/d93a60bd289aac160e7372636e19a628503397a9/classes/local/service/presence_service.php#L37) · [Task-Registrierung](https://github.com/gibro/seminarplaner_mod/blob/d93a60bd289aac160e7372636e19a628503397a9/db/tasks.php)

**Maßnahme und Abnahme.** Aufbewahrungsvorgabe und automatischen Löschmechanismus aufeinander abstimmen. Ein zeitgesteuerter Test weist die Bereinigung auch ohne anschließende Nutzung nach, sofern diese Frist betrieblich vorgesehen ist.

## 5. Datenschutz-Datenflüsse und offene Betriebsnachweise

| Daten und Zweck | Verwendung und Kopien | Offene Prüfung |
| --- | --- | --- |
| Planinhalt, Referenten und Autorschaft | Geteilter Grid-Zustand, Zuordnung im JSON, Autor-IDs und gegebenenfalls Kopien durch Backup/Restore | Vollständigkeit der Auskunft und Anonymisierung über Altformate und kopierte JSON-Inhalte. Der Service entfernt Referenten aus dem neuen Teilnehmenden-Snapshot für den vorgesehenen Sequenzpfad. |
| Freigegebener Roter Faden | Publikations-Snapshot, Web, App und Handout. Offline-Unterstützung ist registriert. | Verhalten nach Widerruf, Gerätecache und Exportkopien sowie tatsächlicher Empfängerkreis. |
| Präsenz, Sperren und Favoriten | Bearbeitungskoordination und persönliche Einstellungen | Effektive Fristen, Gerätekontext und nachweisbare Bereinigung gemäß DS-001 bis DS-003. |
| Dateien, Importprotokolle und globale Bibliothek | Lokale Dateien und Zuordnungen, Protokolle mit Akteur-ID, Kopien in globalen Methoden und Paketen | Zweck und Empfängerkreis, Fristen, Export- und Löschzuständigkeit über beide Plugins. |
| Kursbackup | Backup-Quellen enthalten Plan-JSON, Autor-IDs und Methoden-Dateizuordnungen. | Varianten mit und ohne Nutzerdaten anhand synthetischer Daten testen. Backup-Zugriff, Rotation und Wiederherstellungsprozess durch den Betreiber belegen. |

[Referenten beim Publizieren](https://github.com/gibro/seminarplaner_mod/blob/d93a60bd289aac160e7372636e19a628503397a9/classes/local/service/grid_service.php#L971) · [Privacy-Provider](https://github.com/gibro/seminarplaner_mod/blob/d93a60bd289aac160e7372636e19a628503397a9/classes/privacy/provider.php) · [Backup-Quellen](https://github.com/gibro/seminarplaner_mod/blob/d93a60bd289aac160e7372636e19a628503397a9/backup/moodle2/backup_seminarplaner_stepslib.php#L229) · [Offline-Registrierung](https://github.com/gibro/seminarplaner_mod/blob/d93a60bd289aac160e7372636e19a628503397a9/db/mobile.php#L44)

Für die Compliance-Bewertung stehen Zweck und Rechtsgrundlage, dokumentierte Aufbewahrungsfristen, Zuständigkeiten beim Begleitplugin und die Information der Betroffenen zur Bestätigung durch den Betreiber aus. Der statische Befund belegt die jeweiligen technischen Pfade.

## 6. Nachprüfung und Prioritäten

Die Befund-IDs dieses Berichts bilden die Ausgangsbasis für die Nachprüfung des Seminarplaners.

| Priorität | Befunde | Zuständigkeit und Nachprüfung |
| --- | --- | --- |
| P0 | SEC-001, SEC-002 | Plugin-Entwicklung. Objektbindung und öffentliche Projektion korrigieren. Positive und negative Rollenfälle auf Moodle 5.2.5 protokollieren. |
| P1 | DS-001, SEC-003, SEC-004 | Plugin-Entwicklung. Löschung und Dateischreibvorgänge einschließlich Fehlerpfaden mit synthetischen Daten verifizieren. |
| P2 | DS-002, DS-003, Betriebsnachweise | Plugin-Entwicklung und Moodle-Betrieb. Datenschutz-Kontexte, Aufbewahrung, Backup und Offline-Daten belegen. |

Die offline gesichtete Versionsliste enthält jsPDF 2.5.1, JSZip 3.10.1 und jsPDF-AutoTable 3.5.31. Die im [Auditplan](SEMINARPLANER-AUDITPLAN.md) dokumentierte jsPDF-Advisory ist wegen der Logo-Verarbeitung relevant für die Nachprüfung. Ein aktueller Advisory-Abgleich aller eingebetteten Komponenten und die Untersuchung der Reichweite bleiben als Prüfgrenze erfasst. [Vendor-Inventar](https://github.com/gibro/seminarplaner_mod/blob/d93a60bd289aac160e7372636e19a628503397a9/thirdparty/NOTICE.txt)
