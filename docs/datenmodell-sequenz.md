# Datenmodell Sequenz (D20) – technische Festlegung

Stand: 8. Juli 2026. Setzt die Richtungsentscheidung **D20** aus
`seminarplaner-umbau-konzept.md` um (dort: Abschnitt „Getroffene
Richtungsentscheidungen"). Dieses Dokument hält die in D20 bewusst offen
gelassene *technische Detailarbeit* fest (genaue Feldnamen, Speicherort,
Migrationsregeln). Neue Richtungsfragen gehören weiterhin ins
Claude.ai-Projekt, nicht hierher.

## Speicherort

Die Sequenzstruktur lebt **im bestehenden Plan-JSON** von
`kgen_grid_user_state.statejson` (Shared-State, `userid = 0`) unter dem
neuen Top-Level-Schlüssel **`sequenz`**. Keine neuen Tabellen:

- Das passt zur bestehenden Architektur (ein JSON-Dokument je Plan,
  Optimistic-Locking über `versionhash`, Backup/Restore unverändert).
- Der alte `plan`-Abschnitt (Grid mit `startMin`/`endMin`) bleibt
  **unangetastet** erhalten: Das Grid bleibt reine Lese-/Überblicksansicht
  (D34) und liefert die Daten für die einmalige Übersetzungs-Anzeige (D35).

Implementierung: `classes/local/sequence/sequence_state.php` (Schema,
Validierung) und `classes/local/sequence/grid_to_sequence_converter.php`
(Migration). Der Upgrade-Schritt in `db/upgrade.php` ergänzt `sequenz`
einmalig für alle Bestandspläne (D43 – beim Plugin-Upgrade, nicht live
beim ersten Öffnen).

## Struktur (`version: 1`)

```json
{
  "sequenz": {
    "version": 1,
    "tage": [
      {
        "tag": 1,
        "bezeichnung": "Montag",
        "anker": {
          "vormittag":  { "sequenz": ["p1", "p2"] },
          "nachmittag": { "sequenz": ["p3"] }
        }
      }
    ],
    "platzierungen": {
      "p1": {
        "typ": "einheit",
        "bausteinid": "b17",
        "einheitenauswahl": "ea1",
        "titel": "Kennenlernrunde",
        "dauer": 45,
        "quelle": { "uids": ["…"], "flowid": "…", "startMin": 510, "endMin": 555 }
      },
      "p2": { "typ": "pause", "titel": "Kaffeepause", "dauer": 15, "quelle": { } }
    },
    "einheitenauswahlen": {
      "ea1": { "kandidaten": ["entry-42"], "aktiv": "entry-42" }
    },
    "bausteine": {
      "b17": {
        "titel": "Von den ersten Rechenmaschinen zur heutigen KI",
        "unterthemen": "",
        "themenplanreferenz": "",
        "archiv": null,
        "varianten": {},
        "aktivevariante": null,
        "quelle": { "unitid": "17", "slotkey": "" }
      }
    }
  }
}
```

### Festgelegte Details

| Punkt | Festlegung |
|---|---|
| Reihenfolge | Die Position in `anker.*.sequenz` ersetzt Start/Ende; Uhrzeiten werden zur Laufzeit aus Tagesstart + Dauern berechnet. |
| `dauer` | Minuten, ganzzahlig, an der Platzierung. Nach der Migration Snapshot der Grid-Zeitspanne; im laufenden Betrieb wird sie beim Wechsel der aktiven Kandidatin aus der referenzierten Seminareinheit übernommen (D20: „Dauer, Phase usw. kommen live aus der Einheit"). |
| Platzierungstypen | `einheit` (verweist auf Einheiten-Auswahl, optional Baustein) und `pause` (Pausen *innerhalb* eines Ankers). Die Mittagspause ist **keine** Platzierung, sondern der feste Trenner zwischen den Ankern (D11). |
| Einheiten-Auswahl | Auch bei nur einer Kandidatin eine echte Auswahl (kein wegoptimierter Sonderfall) – hält den Code einheitlich; die in D20 offene Frage ist damit entschieden: **nicht** wegoptimieren. Leere Kandidatenliste = noch ungefüllte Platzierung (z. B. Baustein-Platzhalter aus Import/Migration), `aktiv: null`. |
| Kandidaten-Referenzen | String-Verweise auf die Seminareinheiten-Bibliothek (heute: `entryId` der Methodenkarte), keine Kopien. Migrations-Fallback ohne Referenz: `legacy:<uid>`. |
| Baustein-Fortsetzung | Kein eigenes Feld. Dieselbe `bausteinid` an nicht benachbarten Sequenz-Stellen wird von der Anzeige als „… (Fortsetzung)" erkannt (D20). |
| Varianten | `bausteine.*.varianten` = benannte Pakete mit eigener Platzierungsliste; `aktivevariante` schaltet um. Nach der Migration leer – das alte `slotkey`-Muster wird als `quelle.slotkey` mitgeführt und erst beim Umbau der Planungsansicht auf Varianten abgebildet. |
| `quelle` | Reines Migrations-/Übersetzungs-Metadatum (D35): ursprüngliche `uid(s)`, `flowid`, Zeitspanne bzw. `unitid`/`slotkey`. Wird von der neuen Bearbeitung nicht gepflegt und kann nach Abschluss der Übergangsphase entfallen. |

## Migrationsregeln (Grid → Sequenz, deterministisch)

1. **Tage:** Reihenfolge aus `config.days`; verwaiste Tage aus `plan.days`
   werden hinten angefügt (Wochentags-, dann Alphabet-Reihenfolge).
2. **Anker-Grenze (D45):** Start der **längsten** konfigurierten Pause des
   Grids (`config.breaks`; bei gleicher Länge gewinnt die näher an 12:30).
   Fallback ohne Konfiguration: 12:30 (Roter-Faden-Konvention
   08:00–12:30 / 12:30–18:00). `startMin < Grenze` → Vormittag, sonst
   Nachmittag.
3. **Sortierung:** je Tag/Anker nach `startMin`, dann `endMin`, dann `uid`
   (stabil, verlustfrei im Sinne von D20/D3).
4. **Mittagspausen-Einträge** (`kind: "break"` mit Überlappung des
   konfigurierten Mittagsfensters) werden nicht migriert – sie werden zum
   festen Anker-Trenner. Alle anderen Pausen → `typ: "pause"`.
5. **Flow-Segmente** (`flowid`): direkt aufeinanderfolgende Segmente
   derselben Einheit im selben Anker verschmelzen zu einer Platzierung
   (Dauern summiert). Segmente in verschiedenen Ankern/Tagen bleiben
   getrennte Platzierungen → Fortsetzung über den Trenner hinweg.
6. **`kind: "unit"`** (Baustein-Block im Grid) → Platzierung mit
   `bausteinid` und **leerer** Einheiten-Auswahl (ungefüllter Platzhalter,
   Dauer bleibt reserviert, D1). Baustein-Stammdaten (Unterthemen,
   Themenplan-Referenz) werden in einem späteren Schritt aus dem
   Planning-State (`kgen_planning_state`) angereichert.
7. **`kind: "method"`** → Platzierung mit Einheiten-Auswahl (eine
   Kandidatin, aktiv); `parentunit` → `bausteinid` (Baustein-Stub wird bei
   Bedarf angelegt).

## Anker-Zeiten der Einrichtung (D45, `config.ankerzeiten`)

Die Grid-Einrichtungs-Vorlagen liefern seit D45 feste Vormittag-/
Nachmittag-Zeitspannen statt eines freien Zeitbereichs plus Pausenliste.
Sie liegen als reine **Vorbelegung** (frei editierbar) in der Config:

```json
"ankerzeiten": {
  "vormittag":  {"start": "08:30", "end": "12:30"},
  "nachmittag": {"start": "13:15", "end": "17:30"},
  "ersterTagNurNachmittag": false,
  "letzterTagNurVormittag": false
}
```

- Die beiden Flags bilden das Wochenendseminar ab (Fr nur Nachmittag =
  Anreise, So nur Vormittag = Abreise); der betroffene Anker entfällt in
  der Sequenzansicht (Budget 0, Kennzeichnung „entfällt").
- Die alten Felder `config.timeRange` und `config.breaks` werden beim
  Speichern der Einrichtung **abgeleitet** (timeRange = Vormittag-Start bis
  Nachmittag-Ende; eine „all"-Pause im Mittagsfenster), damit die
  Überblicks-Ansicht (D34) und Alt-Clients unverändert rendern.
- **Bestandspläne ohne `ankerzeiten`:** Ableitung zur Laufzeit nach der
  D45-Migrationsregel – längste konfigurierte Pause = Mittagsschnitt,
  Fallback 12:30. Es findet kein Daten-Upgrade statt; erst ein erneutes
  „Übernehmen" der Einrichtung schreibt `ankerzeiten` in die Config.

## Bewusst offen (spätere Schritte)

- Anreicherung der Baustein-Stammdaten aus `kgen_planning_state`
  (Unterthemen, Themenplan-Referenz, Archivfeld D9) und Abbildung des
  `slotkey`-Musters auf Baustein-Varianten.
- Erweiterung des Export-Formats (`seminarplaner-component-export` v3) um
  Tag/Anker-Platzierung – Backlog „Export platzierter Pläne" (Abschnitt 5/7
  des Konzepts).
- „Gesehen"-Status der Übersetzungs-Anzeige (D35) je Plan+Nutzerin an
  `kgen_grid_user_state` – Teil des D35-Schritts, nicht des Datenmodells.
