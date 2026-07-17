# Seminarplaner Plugins (Moodle)

Dieses Repository enthält zwei zusammenarbeitende Moodle-Plugins:

- `mod_seminarplaner` (Aktivitätsmodul für Kurskontext)
- `local_seminarplaner` (globale Methodenset-Verwaltung, Review-Workflow)

Plugin Status:

<!-- README_SYNC:START -->
- `mod_seminarplaner`: `0.6.8-beta` (`2026070102`)
- `local_seminarplaner`: `0.2.3-beta` (`2026070600`)
- Mindestversion Moodle: `4.5` (`$plugin->requires = 2024042200`)
- Letzte Synchronisierung: `2026-07-06`
<!-- README_SYNC:END -->

## Funktionen

### 1) `mod_seminarplaner` (Kursaktivität)

UI-Bereiche:

- Seminarplan
- Roter Faden
- Methodenbibliothek
- Seminareinheiten
- Review
- Import/Export

Kernfunktionen:

- Anlegen und Verwalten von Seminareinheiten in einer Aktivität
- Seminarplaner mit der Möglichkeit verschiedene Pläne in einem Seminarplaner abzuspeichern
- Roter-Faden-Ansicht für Teilnehmende mit veröffentlichbarem Snapshot aus dem Seminarplan
- Roter-Faden-Struktur nach Tag und der Differenzierung in Vormittag (08:00-12:30) und Nachmittag (12:30-18:00) in Boxen mit Header- und Contentbereich
- Responsive Umschaltung für Mobilgeräte
- Import globaler Methodensets aus dem Moodle-Datenbank-Plugin (https://github.com/gibro/Konzeptgenerator_git)
- Review-Einreichung von neuen/geänderten Methoden aus der Aktivität
- Import/Export von Methoden (JSON, CSV/ZIP kompatible Flows)
- PDF-Export-Flows (ZIM / Seminarverlauf)
- Datei-Uploads für Methodenmaterialien

### 2) `local_seminarplaner` (globale Verwaltung von Seminareinheiten)

Kernfunktionen:

- Verwaltung globaler Methodensets
- Workflow-Status:
  - `draft`
  - `review`
  - `published`
  - `archived`
- Reviewer-Zuweisung pro Methodenset
- Differenzansicht (Review-Diff) zwischen Versionen
- Speichern von Review-Entscheidungen (accepted/rejected/pending)
- Import von mod_data-kompatiblen CSV/ZIP in neue oder bestehende Sets
- Export globaler Sets als mod_data-kompatible CSV/ZIP
- Benachrichtigungslogik im Review-Prozess

## Aktuelle Änderungen (Juli 2026)

- Bugfix Review-Einreichung (`mod/classes/external/api.php`): Material-Anhänge von Seminareinheiten gehen beim Einreichen zur Review nicht mehr verloren. Die Dateien werden jetzt beim Einreichen (in ein bestehendes wie in ein neues Konzept) in den globalen Dateibereich von `local_seminarplaner` kopiert und mit der Konzept-Version verknüpft – auch für unverändert übernommene Seminareinheiten des bestehenden Konzepts. Damit bleiben Anhänge nach Annahme/Veröffentlichung erhalten.
- `local/reviewrequests.php`: Review-Diff-Modal überarbeitet – die Diff-Liste liegt in einem gerahmten, eigenen Scrollbereich; „Alle Änderungen annehmen“, „Entscheidungen speichern“ und „Schließen“ sind von Beginn an ohne Scrollen sichtbar.
- `local/lib.php` (neu): Link „Reviewanfragen für globale Konzepte“ auf der eigenen Profilseite unter `Profil -> Berichte` für alle Nutzer mit Review-/Verwaltungsrechten. Reviewer erreichen die Review-Seite damit auch ohne Benachrichtigungsmail.
- `mod/methodlibrary.php`: Stapel-Bearbeitung für mehrere Seminareinheiten gleichzeitig – Auswahlmodus mit Checkboxen auf den Karten, schwebende Toolbar mit „Alle auswählen“/„Auswahl aufheben“/„Bearbeiten“, und ein Bulk-Formular zum Hinzufügen/Entfernen/Ersetzen von Tags, kognitiven Dimensionen und allen weiteren Nicht-Freitextfeldern.

### Ältere Änderungen (März 2026)

- `mod/importexport.php`: komponentenbasierter Import/Export mit Mehrfachauswahl pro Dateiinhalt (Methoden, Bausteine, Seminarpläne) inkl. Vorschau-Auswahl je Eintrag.
- `mod/importexport.php`: Review/Local-Exportbox entfernt; Seminarplaner-JSON ist der zentrale Austauschpfad.
- `mod/methods.php`: Alternativmethoden als reine Mehrfachauswahl (ohne Suche) plus dynamischer Hinweistext bei fehlenden Optionen.
- `mod/methodlibrary.php`: Edit-Formular zeigt gespeicherte kognitive Dimensionen wieder korrekt in der Mehrfachauswahl; TinyMCE-Felder auf 10 sichtbare Zeilen erhöht.
- `mod/planningmode.php`: Feld „Alternativgruppe“ ersetzt durch „Baustein-Alternative überschreiben“ mit Mehrfach-Dropdown auf vorhandene Bausteine.
- `local/manage.php` und `local/reviewrequests.php`: Layout/Buttons/Tabellenreihenfolge vereinheitlicht und an das Plugin-Design angepasst.

## Rechte/Capabilities

### `mod_seminarplaner`

- `mod/seminarplaner:view`
- `mod/seminarplaner:managemethods`
- `mod/seminarplaner:managegrids`
- `mod/seminarplaner:overrideglobalset`
- `mod/seminarplaner:importfrommoddata`
- `mod/seminarplaner:exporttomoddata`
- `mod/seminarplaner:breaklock`

### `local_seminarplaner`

- `local/seminarplaner:viewglobalsets`
- `local/seminarplaner:createdraftset`
- `local/seminarplaner:editdraftset`
- `local/seminarplaner:submitforreview`
- `local/seminarplaner:reviewset`
- `local/seminarplaner:publishset`
- `local/seminarplaner:archiveglobalset`
- `local/seminarplaner:manageareascopes`
- `local/seminarplaner:importglobalset`
- `local/seminarplaner:exportglobalset`

## Installation

### 1) Dateien ablegen

In deiner Moodle-Installation:

- `mod/seminarplaner` nach: `moodle/mod/seminarplaner`
- `local/seminarplaner` nach: `moodle/local/seminarplaner`

### 2) Upgrade ausführen

- Als Admin anmelden
- `Website-Administration -> Mitteilungen` öffnen
- Upgrade/DB-Migration vollständig durchlaufen lassen

Alternativ CLI:

```bash
php admin/cli/upgrade.php
```

### 3) Berechtigungen prüfen

- Rollen/Capabilities für Lehrende, Reviewer, Manager prüfen
- Für Review/Publishing sicherstellen, dass die passenden `local/*` Capabilities auf System-/Kategoriekontext vergeben sind

### 4) Aktivität im Kurs anlegen

- Kurs öffnen
- Aktivität `Seminarplaner` hinzufügen

## Konzeptverantwortliche (Reviewer) in Moodle einrichten

Konzeptverantwortliche prüfen eingereichte Konzepte auf `local/seminarplaner/reviewrequests.php`. Damit eine Person dort als Konzeptverantwortliche*r auswählbar ist und arbeiten kann, braucht sie eine Rolle mit den passenden Berechtigungen.

### Was macht welche Berechtigung?

| Berechtigung | Einfach erklärt | Kontext |
| --- | --- | --- |
| `local/seminarplaner:viewglobalsets` | Globale Konzepte ansehen (Katalog und Übersichten). Grundlage für fast alle weiteren Funktionen. | System oder Kursbereich |
| `local/seminarplaner:createdraftset` | Neues globales Konzept als Entwurf anlegen. | System oder Kursbereich |
| `local/seminarplaner:editdraftset` | Entwürfe bearbeiten und Konzeptverantwortliche zuordnen. | System oder Kursbereich |
| `local/seminarplaner:submitforreview` | Entwurf zur Review einreichen (Status `draft` -> `review`). Einreich-Recht, kein Reviewer-Recht. | System oder Kursbereich |
| `local/seminarplaner:reviewset` | Das eigentliche Reviewer-Recht: zugewiesene Reviews unter „Meine Reviews“ sehen, Review-Diff öffnen, Änderungen annehmen/ablehnen und ein Konzept zur Überarbeitung zurück auf `draft` setzen. Nur wer dieses Recht hat, ist am Konzept als Konzeptverantwortliche*r auswählbar. | System oder Kursbereich |
| `local/seminarplaner:publishset` | Konzept nach der Review veröffentlichen (Status `review` -> `published`). Erst mit diesem Recht erscheint der Button „Veröffentlichen“. **Wird immer auf Systemebene geprüft.** | Nur System |
| `local/seminarplaner:archiveglobalset` | Veröffentlichte Konzepte archivieren bzw. archivierte zurückholen. | Nur System |
| `local/seminarplaner:manageareascopes` | Geltungsbereiche (Scopes) für Konzepte verwalten. | Nur System |
| `local/seminarplaner:importglobalset` | Konzepte aus Dateien importieren (ZIP/CSV/JSON). | System oder Kursbereich |
| `local/seminarplaner:exportglobalset` | Konzepte exportieren. | System oder Kursbereich |

Standardrollen nach der Installation: Trainer/innen erhalten automatisch nur `viewglobalsets`; die Rolle `Manager` erhält alle Rechte **außer** `publishset` und `archiveglobalset`. Diese beiden hat **keine einzige Standardrolle** – ohne manuelle Vergabe kann also niemand außer Admins veröffentlichen oder archivieren.

### Schritt für Schritt: Reviewer-Rolle anlegen

1. `Website-Administration -> Nutzer/innen -> Rechte ändern -> Rollen verwalten`
2. `Neue Rolle hinzufügen` (oder bestehende Rolle duplizieren), Name z. B. `Reviewer` oder `Konzeptverantwortliche`
3. Als Kontexttypen für die Zuweisung `System` und `Kursbereich` erlauben
4. Folgende Berechtigungen auf `Erlauben` setzen:
   - `local/seminarplaner:reviewset` (Pflicht – das eigentliche Review-Recht)
   - `local/seminarplaner:viewglobalsets` (empfohlen – Konzepte ansehen)
   - `local/seminarplaner:publishset` (nur wenn Reviewer nach angenommener Review selbst veröffentlichen sollen)
5. Rolle zuweisen:
   - global: `Website-Administration -> Nutzer/innen -> Rechte ändern -> Globale Rollen zuweisen`
   - oder auf Kursbereichsebene: `Kursbereich -> Rollen zuweisen`
   - **Achtung:** Soll die Person veröffentlichen können, muss die Rolle **global (Systemebene)** zugewiesen werden. `publishset` wird im Systemkontext geprüft – eine Zuweisung nur im Kursbereich reicht dafür nicht aus.
6. Person am Konzept zuordnen: auf `reviewrequests.php` beim Methodenset unter „Konzeptverantwortliche“ auswählen
7. Prüfen:
   - Bei Einreichungen erhält die Person eine Benachrichtigungsmail mit Link zur Review-Seite
   - Dauerhaft erreichbar ist die Seite über das eigene Profil: `Profilbild -> Profil -> Berichte -> Reviewanfragen für globale Konzepte`
   - Bei einem Set im Status `review` sieht die Person „Review-Diff anzeigen“ und „Zurück zu Entwurf“; mit `publishset` zusätzlich „Veröffentlichen“

### Typische Symptome bei fehlenden Rechten

- Person ist nicht als Konzeptverantwortliche auswählbar -> `reviewset` fehlt im Scope (Kursbereich/System) des Konzepts.
- „Meine Reviews“ ist leer, obwohl eingereicht wurde -> Person ist dem Konzept nicht als Konzeptverantwortliche zugeordnet.
- Nach angenommener Review fehlt der Button „Veröffentlichen“ -> `publishset` fehlt in der Rolle, oder die Rolle ist nur im Kursbereich statt global zugewiesen.
- Kein Eintrag im Profil unter „Berichte“ -> keine Review-/Verwaltungsrechte in einem Scope mit vorhandenen Konzepten, oder nach dem Plugin-Update wurden die Caches nicht geleert.

## Globale Methodensets für `Trainer/in` sichtbar machen

Damit Trainer/innen (Referent/innen) in der Kursaktivität unter `Import / Export` die veröffentlichten globalen Methodensets sehen, sind **zwei** Capabilities nötig — und zwar in **unterschiedlichen Kontexten**:

| Capability | Zweck | Wo zuweisen |
| --- | --- | --- |
| `mod/seminarplaner:view` | Aktivität (und globale Sets) ansehen | Kurs oder Aktivität (vererbt sich nach unten) |
| `local/seminarplaner:viewglobalsets` | globale Methodensets auflisten | beliebige Ebene **ab Modul aufwärts** (System, Kategorie, Kurs oder Aktivität) |

Beide Rechte sind in der Standardrolle `Trainer/in` bereits enthalten. In der Praxis genügt es daher, die Rolle `Trainer/in` so zuzuweisen, dass beide Rechte greifen:

1. `Website-Administration -> Nutzer/innen -> Rechte ändern -> Rollen verwalten -> Trainer/in`
   - sicherstellen, dass `mod/seminarplaner:view` und `local/seminarplaner:viewglobalsets` auf `Erlauben` stehen.
2. Rolle der Person zuweisen — am einfachsten **auf Kursebene** (`Kurs -> Teilnehmer/innen -> Nutzer/in einschreiben` als `Trainer/in`).
   - Da die Prüfung im Aktivitätskontext erfolgt, wirkt eine Kurszuweisung für **beide** Rechte (Abwärtsvererbung). Eine separate Zuweisung auf Kategorie- oder Systemebene ist nicht nötig.
3. Prüfen:
   - Aktivität `Seminarplaner` im Kurs öffnen -> Tab `Import / Export`
   - im Block „Globale Konzepte“ sollte die Auswahlliste die veröffentlichten Sets anzeigen.

Hinweise:

- Reines **Auflisten/Ansehen** der globalen Sets benötigt **kein** `managemethods`. Das **Importieren** eines globalen Sets in die Aktivität (`Globales Konzept importieren`) ist dagegen ein Schreibvorgang und erfordert weiterhin `mod/seminarplaner:managemethods`.
- Der Tab `Import / Export` erscheint nur für Rollen mit Verwaltungsrechten (`managemethods`/`managegrids`/`importfrommoddata`/`exporttomoddata`). Die Standardrolle `Trainer/in` besitzt diese, daher ist der Tab dort sichtbar.

## Wichtige Hinweise

- Beide Plugins sind als **Paar** gedacht. Viele Flows (globale Sets, Review) setzen `local_seminarplaner` voraus.
- Import von ZIP benötigt `ZipArchive` in PHP.
- Große Importdateien sind limitiert (z. B. Uploadgröße/CSV-Reihen/ZIP-Einträge), um Performance und Sicherheit zu schützen.
- Bei paralleler Bearbeitung mit 2 oder mehr Lehrenden: immer zuerst den Button `Seminarplan laden` klicken, bevor weitergearbeitet oder gespeichert wird. So wird der aktuelle Stand geladen und unbeabsichtigtes Überschreiben/Nicht-Übernehmen von Änderungen vermieden.
