# Seminarplaner Plugins (Moodle)

Dieses Repository enthält zwei zusammenarbeitende Moodle-Plugins:

- `mod_seminarplaner` (Aktivitätsmodul für Kurskontext)
- `local_seminarplaner` (globale Methodenset-Verwaltung, Review-Workflow)

Stand laut Codebasis:

<!-- README_SYNC:START -->
- `mod_seminarplaner`: `0.6.6-beta` (`2026030512`)
- `local_seminarplaner`: `0.2.2-beta` (`2026022305`)
- Mindestversion Moodle: `4.5` (`$plugin->requires = 2024042200`)
- Letzte Synchronisierung: `2026-03-05 17:04:22 CET`
<!-- README_SYNC:END -->

## Funktionen

### 1) `mod_seminarplaner` (Kursaktivität)

UI-Bereiche:

- Grid
- Methodenbibliothek
- Methodenkarten
- Review
- Import/Export

Kernfunktionen:

- Anlegen und Verwalten von Methodenkarten in einer Aktivität
- Grid-Planung (Seminarplaner) mit nutzerspezifischem Zustand
- Roter-Faden-Ansicht für Teilnehmende (Common Thread) mit veröffentlichbarem Snapshot aus dem Seminarplan
- Roter-Faden-Struktur nach Tag -> Vormittag (08:00-12:30) / Nachmittag (12:30-18:00) inkl. Boxen mit Header- und Contentbereich
- Timeline-Darstellung: Wochentage auf der Pfeilachse, Tages-Contentboxen alternierend oberhalb/unterhalb der Achse
- Tages-Boxen zeigen Vormittag/Nachmittag nebeneinander; Themen sind je Eintrag ein-/ausklappbar (standardmäßig eingeklappt)
- Zeilenbasiertes Timeline-Raster (oben/mitte/unten) mit gerichteter Verbindungsline je Tag (nur nach oben oder unten)
- Tagesboxen werden symmetrisch um den Marker verbreitert und nutzen den Zwischenraum bis zur Nachbarbox; Außenabstand > Innenabstand (Vor/Nachmittag)
- Tagesboxen sind marker-zentriert absolut positioniert (keine Spaltenbindung), damit sie horizontal über Rastergrenzen hinweg laufen können
- Zwei Timeline-Achsenstile verfügbar (`clean`, `modern`), umschaltbar per UI-Dropdown oder über `window.KG_ROTERFADEN_AXIS_THEME`
- Theme-Wirkung umfasst Achse, Karten, Entry-Header/Content, Marker-Dot und Verbindungsline (`clean` kontraststark, `modern` spielerisch)
- Farben und visuelle Akzente orientieren sich am IG-Metall-Designsystem (Palette + Sunrise/Dreiecks-Element) und werden in den Roter-Faden-Themes konsistent verwendet
- Responsive Umschaltung für Mobilgeräte: vertikale Timeline mit Tagesmarkern und gestapelten Karten (Desktop bleibt horizontale Achse)
- Import globaler Methodensets aus dem `local`-Plugin
- Review-Einreichung von neuen/geänderten Methoden aus der Aktivität
- Import/Export von Methoden (JSON, CSV/ZIP kompatible Flows)
- PDF-Export-Flows (ZIM / Seminarverlauf)
- Soft-Lock-Mechanismus für Grid-Bearbeitung
- Datei-Uploads für Methodenmaterialien

Wichtige Webservice-Funktionen (AJAX):

- Methoden: `get_method_cards`, `save_method_cards`
- Globale Sets: `list_global_methodsets`, `import_global_methodset`
- Review: `list_review_targets`, `list_reviewer_candidates`, `get_review_method_candidates`, `submit_methodset_for_review`, `create_methodset_for_review`
- Grids: `create_grid`, `list_grids`, `get_user_state`, `save_user_state`
- Validierung: `validate_import_payload`, `validate_export_payload`
- Locks: `acquire_lock`, `refresh_lock`, `release_lock`, `lock_status`

### 2) `local_seminarplaner` (globale Governance)

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

Wichtige Webservice-Funktionen (AJAX):

- `create_draft_methodset`
- `transition_methodset`
- `list_methodsets`

## Aktuelle Änderungen (März 2026)

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
- Optional Standard-Methodenset-ID konfigurieren

## Rolle `Reviewer` in Moodle anlegen

Damit Nutzende in `local/seminarplaner/reviewrequests.php` als Konzeptverantwortliche auswählbar sind, muss die Capability `local/seminarplaner:reviewset` in einem passenden Kontext vergeben sein.

1. `Website-Administration -> Nutzer/innen -> Rechte ändern -> Rollen verwalten`
2. `Neue Rolle hinzufügen` (oder bestehende Rolle duplizieren), Name z. B. `Reviewer`
3. In den Rollenrechten mindestens folgende Capability auf `Erlauben` setzen:
   - `local/seminarplaner:reviewset`
4. Optional zusätzlich setzen (falls Reviewer auch Statuswechsel/Einreichungen ausführen sollen):
   - `local/seminarplaner:submitforreview`
5. Rolle zuweisen:
   - global: `Website-Administration -> Nutzer/innen -> Rechte ändern -> Systemrollen zuweisen`
   - oder auf Kategorieebene: `Kurskategorie -> Rollen zuweisen`
6. Prüfen:
   - Seite `local/seminarplaner/reviewrequests.php` neu laden
   - bei einem Methodenset unter „Konzeptverantwortliche“ sollte die Person nun auswählbar sein

## Wichtige Hinweise

- Beide Plugins sind als **Paar** gedacht. Viele Flows (globale Sets, Review) setzen `local_seminarplaner` voraus.
- Releasestand ist `alpha` (beide Plugins). Vor Produktion Staging/Tests durchführen.
- Import von ZIP benötigt `ZipArchive` in PHP.
- Export-/PDF-UI-Flows nutzen lokal eingebundene Third-Party-Bibliotheken (kein CDN erforderlich).
- Große Importdateien sind limitiert (z. B. Uploadgröße/CSV-Reihen/ZIP-Einträge), um Performance und Sicherheit zu schützen.
- Nach Updates: Cache leeren (`Website-Administration -> Entwicklung -> Caches leeren`) falls UI/JS nicht aktuell erscheint.
- Bei paralleler Bearbeitung mit 2 oder mehr Lehrenden: immer zuerst den Button `Seminarplan laden` klicken, bevor weitergearbeitet oder gespeichert wird. So wird der aktuelle Stand geladen und unbeabsichtigtes Überschreiben/Nicht-Übernehmen von Änderungen vermieden.

## Refactoring-Stand in diesem Repository

Durchgeführte Strukturverbesserungen:

- Gemeinsame Helper in `mod/seminarplaner/locallib.php`:
  - Seiten-Bootstrap (Context/Capability/Page Setup)
  - Tab-Rendering
  - Wiederverwendbarer Multi-Select-Dropdown-Renderer
- Seiten `grid.php`, `methods.php`, `methodlibrary.php`, `review.php`, `importexport.php` auf zentrale Helper umgestellt
- Umfangreiche Utility-Funktionen aus `local/seminarplaner/manage.php` nach `local/seminarplaner/locallib.php` ausgelagert

Ergebnis:

- deutlich weniger Duplikatcode
- klarere Verantwortlichkeiten
- einfachere Wartung für weitere Ausbauschritte
