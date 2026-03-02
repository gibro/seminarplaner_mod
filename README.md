# Konzeptgenerator Plugins (Moodle)

Dieses Repository enthält zwei zusammenarbeitende Moodle-Plugins:

- `mod_konzeptgenerator` (Aktivitätsmodul für Kurskontext)
- `local_konzeptgenerator` (globale Methodenset-Verwaltung, Review-Workflow)

Stand laut Codebasis:

- `mod_konzeptgenerator`: `0.6.6-alpha` (`2026022337`)
- `local_konzeptgenerator`: `0.2.2-alpha` (`2026022304`)
- Mindestversion Moodle: `4.5` (`$plugin->requires = 2024042200`)

## Funktionen

### 1) `mod_konzeptgenerator` (Kursaktivität)

UI-Bereiche:

- Grid
- Methodenbibliothek
- Methodenkarten
- Review
- Import/Export

Kernfunktionen:

- Anlegen und Verwalten von Methodenkarten in einer Aktivität
- Grid-Planung (Seminarplaner) mit nutzerspezifischem Zustand
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

### 2) `local_konzeptgenerator` (globale Governance)

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

## Rechte/Capabilities

### `mod_konzeptgenerator`

- `mod/konzeptgenerator:view`
- `mod/konzeptgenerator:managemethods`
- `mod/konzeptgenerator:managegrids`
- `mod/konzeptgenerator:overrideglobalset`
- `mod/konzeptgenerator:importfrommoddata`
- `mod/konzeptgenerator:exporttomoddata`
- `mod/konzeptgenerator:breaklock`

### `local_konzeptgenerator`

- `local/konzeptgenerator:viewglobalsets`
- `local/konzeptgenerator:createdraftset`
- `local/konzeptgenerator:editdraftset`
- `local/konzeptgenerator:submitforreview`
- `local/konzeptgenerator:reviewset`
- `local/konzeptgenerator:publishset`
- `local/konzeptgenerator:archiveglobalset`
- `local/konzeptgenerator:manageareascopes`
- `local/konzeptgenerator:importglobalset`
- `local/konzeptgenerator:exportglobalset`

## Installation

### 1) Dateien ablegen

In deiner Moodle-Installation:

- `mod/konzeptgenerator` nach: `moodle/mod/konzeptgenerator`
- `local/konzeptgenerator` nach: `moodle/local/konzeptgenerator`

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
- Aktivität `Konzeptgenerator` hinzufügen
- Optional Standard-Methodenset-ID konfigurieren

## Wichtige Hinweise

- Beide Plugins sind als **Paar** gedacht. Viele Flows (globale Sets, Review) setzen `local_konzeptgenerator` voraus.
- Releasestand ist `alpha` (beide Plugins). Vor Produktion Staging/Tests durchführen.
- Import von ZIP benötigt `ZipArchive` in PHP.
- Einige Export-/PDF-UI-Flows laden JS-Bibliotheken per CDN. In restriktiven Netzwerken kann das blockiert sein.
- Große Importdateien sind limitiert (z. B. Uploadgröße/CSV-Reihen/ZIP-Einträge), um Performance und Sicherheit zu schützen.
- Nach Updates: Cache leeren (`Website-Administration -> Entwicklung -> Caches leeren`) falls UI/JS nicht aktuell erscheint.

## Refactoring-Stand in diesem Repository

Durchgeführte Strukturverbesserungen:

- Gemeinsame Helper in `mod/konzeptgenerator/locallib.php`:
  - Seiten-Bootstrap (Context/Capability/Page Setup)
  - Tab-Rendering
  - Wiederverwendbarer Multi-Select-Dropdown-Renderer
- Seiten `grid.php`, `methods.php`, `methodlibrary.php`, `review.php`, `importexport.php` auf zentrale Helper umgestellt
- Umfangreiche Utility-Funktionen aus `local/konzeptgenerator/manage.php` nach `local/konzeptgenerator/locallib.php` ausgelagert

Ergebnis:

- deutlich weniger Duplikatcode
- klarere Verantwortlichkeiten
- einfachere Wartung für weitere Ausbauschritte
