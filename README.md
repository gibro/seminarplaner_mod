# mod_seminarplaner – Seminarplaner für Moodle

Kursaktivität, mit der Referent*innen ein Seminar planen, durchführen und an Teilnehmende weitergeben: von der Seminareinheiten-Bibliothek über den Ablaufplan je Tag bis zum „Roten Faden“ für die Teilnehmenden und den PDF-Unterlagen.

Das Plugin arbeitet im Paar mit [`local_seminarplaner`](https://github.com/gibro/seminarplaner_local), das die globale Bibliothek (Methodensammlungen und Seminarkonzepte) und den Prüf-Workflow bereitstellt. `local_seminarplaner` ist eine **Pflicht-Abhängigkeit** und muss zuerst installiert sein.

| | |
| --- | --- |
| Version | `1.1.0` (`2026101907`), Reife `STABLE` |
| Moodle | ab 4.5 (`$plugin->requires = 2024042200`) |
| Abhängigkeit | `local_seminarplaner` ab `2026072000` |
| Datenbanken | MySQL/MariaDB und PostgreSQL |
| Lizenz | GNU GPL v3 oder später (siehe `LICENSE`) |

## Funktionen

### Ansichten (Tabs)

Welche Tabs eine Aktivität zeigt, hängt von der Einstellung **„Wozu brauchst du den Seminarplaner?“** in den Aktivitätseinstellungen und von den Rechten der Person ab:

| Tab | Was man dort tut | Sichtbar bei Nutzungszweck |
| --- | --- | --- |
| **Überblick** | Alle Seminartage nebeneinander als Wochenansicht (nur lesen); Plan wählen, löschen, veröffentlichen; Überblick als PDF (A4 quer) | immer |
| **Sequenz** | Der eigentliche Planungsort: je Tag ein Vormittag und ein Nachmittag mit einer geordneten Abfolge von Seminareinheiten und Bausteinen. Uhrzeiten ergeben sich aus der Reihenfolge | immer |
| **Bibliothek** | Seminareinheiten der Aktivität anlegen, suchen, filtern und stapelweise bearbeiten | immer |
| **Live** | Ablauf-Souffleur während der Durchführung: was läuft jetzt, was kommt als Nächstes | „durchführen“ |
| **Roter Faden** | Veröffentlichte Fassung des Plans für Teilnehmende, inkl. Handout-PDF | „durchführen“ |
| **Import/Export** | Seminarplaner-JSON, globale Konzepte übernehmen, PDF-Exporte | immer |
| **Einreichen** | Seminareinheiten, Methodensammlungen oder Seminarkonzepte zur Prüfung in die globale Bibliothek einreichen | „verwalten“ |

Teilnehmende ohne Bearbeitungsrechte sehen nur den Roten Faden (und, mit `viewlive`, die Live-Ansicht).

### Planen in der Sequenz

- Mehrere Pläne pro Aktivität, Plan innerhalb der Aktivität kopieren
- Einheiten per Ziehen umsortieren (auch per Touch), duplizieren, erneut einplanen
- **Bausteine** fassen Einheiten unter einer Überschrift zusammen; ein Baustein kann über die Mittagspause fortgesetzt werden
- **Alternativen** auf Einheiten- und auf Baustein-Ebene, umschaltbar ohne Neuplanung
- Geführte Überlauf-Aktion: Was nicht mehr in den Vormittag passt, wird verschoben oder geteilt – nie stillschweigend ausgedehnt
- „Einheit hinzufügen“ mit Vorschlägen passend zur Lücke, Quellen-Tabs (eigene Bibliothek / globale Methodensammlung) und Schnellanlage
- Seminarziele mit Verknüpfung zu den platzierten Einheiten
- Didaktische Empfehlungen (Dramaturgie-Check) als reine Hinweise, pro Person abschaltbar
- Lernziel-Editor „Der Differenzierer“
- Referent*innen einer platzierten Einheit zuordnen
- **Gleichzeitiges Arbeiten** mehrerer Personen im selben Plan: Änderungen werden pro Platzierung zusammengeführt statt überschrieben und erscheinen bei den anderen nach wenigen Sekunden

### Exporte

Alle PDFs werden im Browser erzeugt (jsPDF, lokal eingebunden – kein CDN):

- **ZIM-Plan** mit frei wählbarer und je Aktivität gespeicherter Spaltenreihenfolge
- **Konzeptsammlung**, **Materialliste** (je Tag, dedupliziert, zum Abhaken), **Handout** für Teilnehmende, **Überblick**
- Hoch- oder Querformat wählbar, optional mit Logo und Seminarzielen auf dem Deckblatt
- Seminarplaner-JSON bzw. ZIP (mit Anhängen) zum Austausch zwischen Aktivitäten

### Moodle App

Der Rote Faden ist in der offiziellen Moodle App verfügbar (inkl. Offline-Download). Voraussetzung ist, dass auf der Site der Webservice für Mobilgeräte (`enablemobilewebservice`) aktiv ist.

## Installation

1. Zuerst `local_seminarplaner` nach `moodle/local/seminarplaner` legen, dann dieses Plugin nach `moodle/mod/seminarplaner`.
   (Bei Moodle-Installationen mit `public/`-Verzeichnis entsprechend unter `public/local/…` und `public/mod/…`.)
2. Upgrade ausführen: `Website-Administration -> Mitteilungen` oder per CLI:

   ```bash
   php admin/cli/upgrade.php
   ```

3. Nach jedem Update die Caches leeren (`Website-Administration -> Entwicklung -> Caches leeren`), sonst lädt der Browser veraltetes JavaScript.
4. Im Kurs die Aktivität **Seminarplaner** hinzufügen und den Nutzungszweck wählen.

Für den Import von ZIP-Dateien muss PHP `ZipArchive` bereitstellen. Uploadgröße, CSV-Zeilen und ZIP-Einträge sind aus Performance- und Sicherheitsgründen begrenzt.

Bestandsdaten aus Versionen vor 1.0 (freies Zeitraster) werden beim Upgrade automatisch in die Sequenz-Struktur übernommen; beim ersten Öffnen eines umgestellten Plans zeigt eine einmalige Gegenüberstellung „So war es / So ist es jetzt“.

## Rechte

| Capability | Wofür | Standardrollen |
| --- | --- | --- |
| `mod/seminarplaner:addinstance` | Aktivität im Kurs anlegen | Trainer/in, Manager |
| `mod/seminarplaner:view` | Aktivität öffnen | Teilnehmer/in, Trainer/in (beide), Manager |
| `mod/seminarplaner:viewroterfaden` | Roten Faden sehen und Handout erzeugen | Teilnehmer/in, Trainer/in (beide), Manager |
| `mod/seminarplaner:viewlive` | Live-Ansicht während der Durchführung | Trainer/in (beide), Manager |
| `mod/seminarplaner:managemethods` | Seminareinheiten anlegen und bearbeiten, globale Konzepte importieren | Trainer/in (beide), Manager |
| `mod/seminarplaner:managegrids` | Pläne bearbeiten und veröffentlichen | Trainer/in (beide), Manager |
| `mod/seminarplaner:overrideglobalset` | Globale Konzepte lokal anpassen | Trainer/in (beide), Manager |
| `mod/seminarplaner:importfrommoddata` | Import aus dem Datenbank-Format | Trainer/in (beide), Manager |
| `mod/seminarplaner:exporttomoddata` | Export in das Datenbank-Format | Trainer/in (beide), Manager |
| `mod/seminarplaner:breaklock` | Bearbeitungssperre eines Plans aufheben | Manager |

### Globale Konzepte für Trainer/innen sichtbar machen

Damit Referent*innen unter **Import/Export** die veröffentlichten globalen Konzepte sehen, braucht es zwei Rechte:

- `mod/seminarplaner:view` (Kurs- oder Aktivitätsebene)
- `local/seminarplaner:viewglobalsets` (beliebige Ebene ab der Aktivität aufwärts)

Beide stecken bereits in der Standardrolle `Trainer/in`. Eine Einschreibung als Trainer/in im Kurs genügt, weil sich die Rechte nach unten vererben. Das bloße Ansehen braucht kein `managemethods`; das **Übernehmen** eines globalen Konzepts in die Aktivität dagegen schon.

Die Einrichtung von Konzeptverantwortlichen (Prüfer*innen) ist in der README von [`local_seminarplaner`](https://github.com/gibro/seminarplaner_local) beschrieben.

## Entwicklung

- Tests: `vendor/bin/phpunit --testsuite mod_seminarplaner_testsuite`
- JavaScript liegt als AMD-Module in `amd/src`, gebaut nach `amd/build`.
- Fremdbibliotheken (jsPDF, jsPDF-AutoTable, JSZip) liegen unter `thirdparty/`, Lizenzhinweise in `thirdparty/NOTICE.txt`.
- Was wann gebaut wurde: [`docs/umsetzungsprotokoll.md`](docs/umsetzungsprotokoll.md). Das Datenmodell der Sequenz: [`docs/datenmodell-sequenz.md`](docs/datenmodell-sequenz.md).
