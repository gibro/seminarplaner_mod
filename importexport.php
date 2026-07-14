<?php
// This file is part of Moodle - http://moodle.org/

require_once(__DIR__ . '/bootstrap.php');
require_once(__DIR__ . '/locallib.php');

$id = required_param('id', PARAM_INT);
$activity = seminarplaner_require_activity_context($id, 'mod/seminarplaner:view');
$cm = $activity['cm'];
$course = $activity['course'];
$seminarplaner = $activity['seminarplaner'];
$context = $activity['context'];

seminarplaner_prepare_page('/mod/seminarplaner/importexport.php', $cm, $course, $seminarplaner, null);
$pdflogo = seminarplaner_get_pdf_logo($context, $seminarplaner);
$pdfcolumns = seminarplaner_get_pdf_columns((int)$cm->id);
$PAGE->requires->js_call_amd('mod_seminarplaner/importexport', 'init', [(int)$cm->id, $pdflogo, $pdfcolumns]);

echo $OUTPUT->header();

echo $OUTPUT->heading(format_string($seminarplaner->name));
echo seminarplaner_render_tabs((int)$cm->id, 'importexport');

$vendorbase = $CFG->wwwroot . '/mod/seminarplaner/thirdparty';
echo '<script>window.__kg_prev_define = window.define; try { window.define = undefined; } catch (e) {}</script>';
echo '<script src="' . s($vendorbase . '/jszip/jszip.min.js') . '"></script>';
echo '<script src="' . s($vendorbase . '/jspdf/jspdf.umd.min.js') . '"></script>';
echo '<script src="' . s($vendorbase . '/jspdf-autotable/jspdf.plugin.autotable.min.js') . '"></script>';
echo '<script>try { if (window.__kg_prev_define !== undefined) { window.define = window.__kg_prev_define; } else { delete window.define; } } catch (e) {} delete window.__kg_prev_define;</script>';

// ---------------------------------------------------------------------------
// Inline-SVG-Icons (Handoff: Meta-Line, stroke-width 2 / 2.2). Rein dekorativ,
// daher aria-hidden. Ausgabe als rohes HTML, da html_writer kein SVG kann.
// ---------------------------------------------------------------------------
$icon = function(string $paths, float $size = 16, float $stroke = 2.0, string $extra = ''): string {
    return '<svg width="' . $size . '" height="' . $size . '" viewBox="0 0 24 24" fill="none" '
        . 'stroke="currentColor" stroke-width="' . $stroke . '" aria-hidden="true" focusable="false"'
        . ($extra !== '' ? ' ' . $extra : '') . '>' . $paths . '</svg>';
};
$icImportTray = $icon('<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>', 18, 2.2);
$icExportUp   = $icon('<path d="M12 21V9M7 14l5-5 5 5M4 3h16"/>', 18, 2.2);
$icFile       = $icon('<path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5"/>');
$icLayers     = $icon('<path d="M4 7l8-4 8 4-8 4-8-4z"/><path d="M4 12l8 4 8-4M4 17l8 4 8-4"/>');
$icExchange   = $icon('<path d="M4 8h13l-3-3M20 16H7l3 3"/>');
$icPdf        = $icon('<path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>');
$icInfo       = $icon('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>', 16, 2);
$icExternal   = $icon('<path d="M7 17L17 7M9 7h8v8"/>', 12, 2.4);
$icDownload   = $icon('<path d="M12 3v12M8 11l4 4 4-4M5 21h14"/>', 14, 2.2);
$icCheck      = $icon('<path d="M20 6L9 17l-5-5"/>', 10, 3.6, 'stroke="#fff"');

// Scope-Chip (wiederverwendbares Toggle statt nackter Checkbox). Enthaelt eine
// echte Checkbox mit der bestehenden ID, damit das AMD-Modul unveraendert den
// Zustand liest; die Optik uebernimmt CSS ueber :has(input:checked).
$scopechip = function(string $inputid, string $label, bool $checked) use ($icCheck): string {
    return '<label class="kg-scope-chip">'
        . '<input type="checkbox" id="' . s($inputid) . '"' . ($checked ? ' checked' : '') . '>'
        . '<span class="kg-scope-chip__box">' . $icCheck . '</span>'
        . '<span class="kg-scope-chip__label">' . s($label) . '</span>'
        . '</label>';
};

echo html_writer::start_div('kg-shell kg-ie-shell');

echo html_writer::start_div('sq-pagehead');
echo html_writer::tag('h3', 'Import &amp; Export');
echo html_writer::div(
    'Seminareinheiten, Bausteine und ganze Seminarpläne ein- und auslesen sowie Dokumente erzeugen.',
    'sq-pagehead__sub'
);
echo html_writer::end_div();

echo html_writer::start_div('kg-ie-layout');

// =====================================================================
// ZONE: IMPORTIEREN
// =====================================================================
echo '<div class="kg-ie-zone">';
echo '<div class="kg-ie-zonehead">'
    . '<span class="kg-ie-zonehead__badge">' . $icImportTray . '</span>'
    . '<div><div class="kg-ie-zonehead__title">Importieren</div>'
    . '<div class="kg-ie-zonehead__sub">Inhalte in deinen Bestand holen</div></div>'
    . '</div>';

// --- Karte 1: Datei importieren (Rot) -------------------------------
echo '<div class="kg-ie-card kg-ie-card--red">';
echo '<div class="kg-ie-card__head">'
    . '<span class="kg-ie-card__badge">' . $icFile . '</span>'
    . '<div class="kg-ie-card__headtext"><h4 class="kg-ie-card__title">Datei importieren</h4>'
    . '<div class="kg-ie-card__sub">CSV, ZIP oder JSON aus Moodle oder einem anderen Planer einlesen.</div></div>'
    . '</div>';

// Wizard-Schrittleiste (JS toggelt .kg-step-active + Panels).
echo '<div class="kg-ie-steps">';
echo '<span class="kg-step kg-step-active" id="kg-step-1"><span class="kg-step__num">1</span>Datei wählen</span>';
echo '<span class="kg-step" id="kg-step-2"><span class="kg-step__num">2</span>Vorschau &amp; Import</span>';
echo '</div>';

// Panel 1 – Datei wählen.
echo '<div id="kg-ie-panel-1">';
// D48: Themenpläne werden nicht im Plugin geparst, sondern in der externen
// Seminarschmiede in eine Import-Datei umgewandelt. Bewusst neutraler Info-
// Kasten (kein Fehler-/Warnton).
echo '<div class="kg-ie-hint">';
echo '<span class="kg-ie-hint__icon">' . $icInfo . '</span>';
echo '<div class="kg-ie-hint__body">'
    . '<p class="kg-ie-hint__text">Du startest mit einem <strong>Themenplan</strong> (Word-Datei)? '
    . 'Die <strong>Seminarschmiede</strong> wandelt ihn in eine Import-Datei für den Seminarplaner um. '
    . 'Lade den Themenplan dort hoch und importiere die erzeugte Datei anschließend hier.</p>';
echo html_writer::link('https://igmetall-seminarschmiede.de',
    'Zur Seminarschmiede ' . $icExternal, [
        'class' => 'kg-btn kg-ie-hint__btn',
        'target' => '_blank',
        'rel' => 'noopener',
    ]);
echo '</div></div>';

// Was soll importiert werden? – In diesem Plugin wird der Umfang pro Eintrag in
// der Vorschau (Schritt 2) entschieden; hier nur der erläuternde Einzeiler.
echo '<p class="kg-ie-note">Wähle in der Vorschau per Mehrfachauswahl, welche Inhalte importiert '
    . 'werden: Seminareinheiten, Bausteine und/oder Seminarpläne.</p>';

// Datei-Auswahl (Label-Button + verstecktes File-Input + Dateiname).
echo '<div class="kg-ie-filepick">'
    . '<label class="kg-btn kg-ie-filepick__btn">Datei auswählen'
    . '<input type="file" id="kg-ie-file" class="kg-ie-filepick__input" '
    . 'accept=".json,.csv,.zip,application/json,text/csv,application/zip"></label>'
    . '<span class="kg-ie-filepick__name" id="kg-ie-filename">Keine Datei ausgewählt</span>'
    . '</div>';

echo html_writer::tag('button', 'Datei analysieren', [
    'type' => 'button', 'id' => 'kg-ie-parse', 'class' => 'kg-btn kg-btn-primary kg-ie-fullbtn',
]);
echo '<div class="kg-ie-footnote">Unterstützte Formate: mod_data CSV-Export, ZIP mit CSV, JSON-Export.</div>';
echo '</div>'; // #kg-ie-panel-1

// Panel 2 – Vorschau & Import.
echo '<div class="kg-hidden" id="kg-ie-panel-2">';
echo '<p class="kg-ie-note">Vorschau der gefundenen Inhalte. Bei doppelten Titeln von Seminareinheiten '
    . 'kann pro Eintrag entschieden werden: Ersetzen, als Duplikat hinzufügen oder nicht hinzufügen.</p>';
echo '<div class="kg-row kg-ie-previewtools">';
echo html_writer::tag('button', 'Alle auswählen', ['type' => 'button', 'id' => 'kg-ie-select-all', 'class' => 'kg-btn']);
echo html_writer::tag('button', 'Keine auswählen', ['type' => 'button', 'id' => 'kg-ie-select-none', 'class' => 'kg-btn']);
echo '</div>';
echo html_writer::tag('div', '', ['id' => 'kg-ie-preview', 'class' => 'kg-ie-preview']);
echo html_writer::tag('button', 'Importieren', [
    'type' => 'button', 'id' => 'kg-ie-import-now', 'class' => 'kg-btn kg-btn-primary kg-ie-fullbtn',
]);
echo html_writer::tag('div', '', [
    'id' => 'kg-ie-import-status', 'class' => 'kg-status', 'role' => 'status', 'aria-live' => 'polite',
]);
echo '</div>'; // #kg-ie-panel-2

echo '</div>'; // kg-ie-card (Datei importieren)

// --- Karte 2: Globale Seminarkonzepte (Blau) ------------------------
echo '<div class="kg-ie-card kg-ie-card--blue">';
echo '<div class="kg-ie-card__head">'
    . '<span class="kg-ie-card__badge">' . $icLayers . '</span>'
    . '<div class="kg-ie-card__headtext"><h4 class="kg-ie-card__title">Globale Seminarkonzepte</h4>'
    . '<div class="kg-ie-card__sub">Ein veröffentlichtes globales Seminarkonzept als eigenen '
    . 'Seminarplan übernehmen. Globale Methoden-Sammlungen musst du nicht importieren – ihre '
    . 'Methoden sind jederzeit durchsuchbar im Tab „Methodensammlungen“.</div></div>'
    . '</div>';
echo html_writer::start_tag('select', ['id' => 'kg-global-set-select', 'class' => 'kg-input']);
echo html_writer::tag('option', 'Bitte wählen …', ['value' => '']);
echo html_writer::end_tag('select');
echo '<div class="kg-ie-btnstack">';
echo html_writer::tag('button', 'Seminarkonzept importieren', [
    'type' => 'button', 'id' => 'kg-global-set-import', 'class' => 'kg-btn kg-btn-primary kg-ie-fullbtn',
]);
// D54: Aktualisierungen einer übernommenen Sammlung werden nie automatisch
// übernommen; das bewusste Übernehmen bleibt hier als Sekundäraktion.
echo html_writer::tag('button', 'Ausstehende Updates übernehmen', [
    'type' => 'button', 'id' => 'kg-global-set-apply', 'class' => 'kg-btn kg-ie-fullbtn',
]);
echo '</div>';
echo html_writer::tag('div', '', [
    'id' => 'kg-global-set-syncinfo', 'class' => 'kg-status', 'role' => 'status', 'aria-live' => 'polite',
]);
echo html_writer::tag('div', '', [
    'id' => 'kg-global-set-status', 'class' => 'kg-status', 'role' => 'status', 'aria-live' => 'polite',
]);
echo '</div>'; // kg-ie-card (Globale Seminarkonzepte)

echo '</div>'; // kg-ie-zone (Import)

// =====================================================================
// ZONE: EXPORTIEREN & AUSGEBEN
// =====================================================================
echo '<div class="kg-ie-zone">';
echo '<div class="kg-ie-zonehead">'
    . '<span class="kg-ie-zonehead__badge">' . $icExportUp . '</span>'
    . '<div><div class="kg-ie-zonehead__title">Exportieren &amp; ausgeben</div>'
    . '<div class="kg-ie-zonehead__sub">Inhalte weitergeben oder als Dokument erzeugen</div></div>'
    . '</div>';

// --- Karte 3: Austausch mit anderem Planer (Grün) -------------------
echo '<div class="kg-ie-card kg-ie-card--green">';
echo '<div class="kg-ie-card__head">'
    . '<span class="kg-ie-card__badge">' . $icExchange . '</span>'
    . '<div class="kg-ie-card__headtext"><h4 class="kg-ie-card__title">Austausch mit anderem Planer</h4>'
    . '<div class="kg-ie-card__sub">JSON-Datei für den Umzug zwischen zwei Seminarplanern '
    . '(Seminareinheiten, Bausteine und Seminarpläne).</div></div>'
    . '</div>';
echo '<div class="kg-ie-fieldlabel">Was soll exportiert werden?</div>';
echo '<div class="kg-scope-chips">';
echo $scopechip('kg-ie-export-methods', 'Seminareinheiten', true);
echo $scopechip('kg-ie-export-units', 'Bausteine', true);
echo $scopechip('kg-ie-export-grids', 'Seminarpläne', false);
echo '</div>';
echo '<button type="button" id="kg-ie-export-json-full" class="kg-btn kg-btn-primary kg-ie-fullbtn kg-ie-btn--green">'
    . '<span class="kg-btn-content">' . $icDownload . 'Seminarplaner-JSON exportieren</span></button>';
echo '</div>'; // kg-ie-card (Austausch)

// --- Karte 4: PDF erstellen (Tiefrot) -------------------------------
echo '<div class="kg-ie-card kg-ie-card--darkred">';
echo '<div class="kg-ie-card__head">'
    . '<span class="kg-ie-card__badge">' . $icPdf . '</span>'
    . '<div class="kg-ie-card__headtext"><h4 class="kg-ie-card__title">PDF erstellen</h4>'
    . '<div class="kg-ie-card__sub">Druckfertige Dokumente. Diese Angaben gelten nur für den '
    . 'PDF-Export; Seminarpläne bleiben separat persistent gespeichert.</div></div>'
    . '</div>';
echo '<label class="kg-ie-fieldlabel" for="kg-pdf-grid">Seminarplan wählen</label>';
echo html_writer::start_tag('select', ['id' => 'kg-pdf-grid', 'class' => 'kg-input']);
echo html_writer::tag('option', 'Bitte wählen', ['value' => '']);
echo html_writer::end_tag('select');

echo '<div class="kg-ie-metagrid">';
foreach ([
    'kg-pdf-title' => 'Seminartitel',
    'kg-pdf-date' => 'Datum',
    'kg-pdf-number' => 'Seminarnummer',
    'kg-pdf-contact' => 'Kontakt',
] as $fid => $flabel) {
    echo '<div class="kg-ie-metafield">'
        . '<label class="kg-ie-fieldlabel" for="' . s($fid) . '">' . s($flabel) . '</label>'
        . '<input type="text" id="' . s($fid) . '" class="kg-input">'
        . '</div>';
}
echo '</div>';

echo '<div class="field-card kg-ie-columns">';
echo '<label class="kg-ie-fieldlabel">Spalten für PDF-Export</label>';
echo '<div class="kg-tag-dropdown" id="kg-pdf-columns-dropdown">';
echo '<button type="button" class="kg-input kg-tag-dropdown-toggle" id="kg-pdf-columns-toggle">Spalten wählen</button>';
echo '<div class="kg-tag-dropdown-panel kg-hidden" id="kg-pdf-columns-panel">';
echo '<label class="kg-tag-option"><input type="checkbox" id="kg-pdf-columns-all" checked><span>Alle</span></label>';
// D63: Reihenfolge der gewählten Spalten ist per ◄/► editierbar (horizontal, da im
// PDF nebeneinander) und wird pro Aktivität dauerhaft gespeichert.
echo '<p class="kg-pdf-columns-hint sp-filter-status">Reihenfolge mit ◄ ► ändern – so stehen die Spalten im PDF.</p>';
echo '<div id="kg-pdf-columns-options">';
foreach ([
    'uhrzeit' => 'Uhrzeit',
    'titel' => 'Titel',
    'seminarphase' => 'Seminarphase',
    'kurzbeschreibung' => 'Kurzbeschreibung',
    'debrief' => 'Debrief-/Reflexionsfragen',
    'ablauf' => 'Ablauf',
    'lernziele' => 'Lernziele',
    'risiken' => 'Risiken/Tipps',
    'materialtechnik' => 'Material/Technik',
    'sonstiges' => 'Sonstiges',
] as $key => $label) {
    echo '<div class="kg-tag-option kg-pdf-col-row" data-col="' . s($key) . '">'
        . '<label class="kg-pdf-col-check"><input type="checkbox" value="' . s($key) . '"><span>' . s($label) . '</span></label>'
        . '<span class="kg-pdf-col-move">'
        . '<button type="button" class="kg-pdf-col-btn" data-move="left" title="Spalte nach links" aria-label="Spalte nach links">◄</button>'
        . '<button type="button" class="kg-pdf-col-btn" data-move="right" title="Spalte nach rechts" aria-label="Spalte nach rechts">►</button>'
        . '</span>'
        . '</div>';
}
echo '</div></div></div>';
echo '</div>'; // .field-card

echo '<div class="kg-ie-pdfactions">';
echo html_writer::tag('button', 'ZIM-PDF erstellen', [
    'type' => 'button', 'id' => 'kg-pdf-zim', 'class' => 'kg-btn kg-btn-primary',
]);
echo html_writer::tag('button', 'Konzeptsammlung-PDF erstellen', [
    'type' => 'button', 'id' => 'kg-pdf-flow', 'class' => 'kg-btn kg-btn-primary',
]);
// D52: dritte PDF-Variante (Materialliste).
echo html_writer::tag('button', 'Materialliste-PDF erstellen', [
    'type' => 'button', 'id' => 'kg-pdf-materials', 'class' => 'kg-btn kg-btn-primary',
]);
// D64: Handout für Teilnehmende (PDF-Export des veröffentlichten Roten Fadens).
echo html_writer::tag('button', 'Handout-PDF für Teilnehmende', [
    'type' => 'button', 'id' => 'kg-pdf-handout', 'class' => 'kg-btn kg-btn-primary',
]);
echo '</div>';
echo '</div>'; // kg-ie-card (PDF)

echo '</div>'; // kg-ie-zone (Export)

echo html_writer::end_div(); // kg-ie-layout

echo html_writer::tag('div', '', [
    'id' => 'kg-ie-status', 'class' => 'kg-status', 'role' => 'status', 'aria-live' => 'polite',
]);

echo html_writer::end_div(); // kg-shell

echo $OUTPUT->footer();
