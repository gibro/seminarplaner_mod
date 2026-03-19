<?php
// This file is part of Moodle - http://moodle.org/

require_once(__DIR__ . '/../../config.php');
require_once(__DIR__ . '/locallib.php');

$id = required_param('id', PARAM_INT);
$activity = seminarplaner_require_activity_context($id, 'mod/seminarplaner:view');
$cm = $activity['cm'];
$course = $activity['course'];
$seminarplaner = $activity['seminarplaner'];

seminarplaner_prepare_page('/mod/seminarplaner/importexport.php', $cm, $course, $seminarplaner, null);
$PAGE->requires->js_call_amd('mod_seminarplaner/importexport', 'init', [(int)$cm->id]);

echo $OUTPUT->header();

echo $OUTPUT->heading(format_string($seminarplaner->name));
echo seminarplaner_render_tabs((int)$cm->id, 'importexport');

$vendorbase = $CFG->wwwroot . '/mod/seminarplaner/thirdparty';
echo '<script>window.__kg_prev_define = window.define; try { window.define = undefined; } catch (e) {}</script>';
echo '<script src="' . s($vendorbase . '/jszip/jszip.min.js') . '"></script>';
echo '<script src="' . s($vendorbase . '/jspdf/jspdf.umd.min.js') . '"></script>';
echo '<script src="' . s($vendorbase . '/jspdf-autotable/jspdf.plugin.autotable.min.js') . '"></script>';
echo '<script>try { if (window.__kg_prev_define !== undefined) { window.define = window.__kg_prev_define; } else { delete window.define; } } catch (e) {} delete window.__kg_prev_define;</script>';

echo html_writer::start_div('kg-shell');
echo html_writer::tag('h3', 'Import / Export');

echo html_writer::start_div('kg-ie-layout');

echo html_writer::start_div('kg-ie-block');
echo html_writer::tag('h4', 'Import (Assistent)');
echo html_writer::start_div('kg-ie-steps');
echo html_writer::tag('span', '1) Datei wählen', ['class' => 'kg-step kg-step-active', 'id' => 'kg-step-1']);
echo html_writer::tag('span', '2) Vorschau & Import', ['class' => 'kg-step', 'id' => 'kg-step-2']);
echo html_writer::end_div();

echo html_writer::start_div('', ['id' => 'kg-ie-panel-1']);
echo html_writer::tag('p', 'Unterstützte Formate: mod_data CSV-Export, ZIP mit CSV, JSON-Export.');
echo html_writer::tag('p', 'Wähle per Mehrfachauswahl, welche Inhalte importiert werden sollen: Seminareinheiten, Bausteine und/oder Seminarpläne.');
echo html_writer::empty_tag('input', [
    'type' => 'file',
    'id' => 'kg-ie-file',
    'class' => 'kg-input',
    'accept' => '.json,.csv,.zip,application/json,text/csv,application/zip',
]);
echo html_writer::tag('button', 'Datei analysieren', ['type' => 'button', 'id' => 'kg-ie-parse', 'class' => 'kg-btn kg-btn-primary']);
echo html_writer::end_div();

echo html_writer::start_div('kg-hidden', ['id' => 'kg-ie-panel-2']);
echo html_writer::tag('p', 'Vorschau der gefundenen Inhalte. Bei doppelten Titeln von Seminareinheiten kann pro Eintrag entschieden werden: Ersetzen, als Duplikat hinzufügen oder nicht hinzufügen.');
echo html_writer::start_div('kg-row');
echo html_writer::tag('button', 'Alle auswählen', ['type' => 'button', 'id' => 'kg-ie-select-all', 'class' => 'kg-btn']);
echo html_writer::tag('button', 'Keine auswählen', ['type' => 'button', 'id' => 'kg-ie-select-none', 'class' => 'kg-btn']);
echo html_writer::end_div();
echo html_writer::tag('div', '', ['id' => 'kg-ie-preview', 'class' => 'kg-ie-preview']);
echo html_writer::start_div('kg-row kg-ie-actions');
echo html_writer::tag('button', 'Importieren', ['type' => 'button', 'id' => 'kg-ie-import-now', 'class' => 'kg-btn kg-btn-primary']);
echo html_writer::end_div();
echo html_writer::tag('div', '', ['id' => 'kg-ie-import-status', 'class' => 'kg-status']);
echo html_writer::end_div();

echo html_writer::end_div();

echo html_writer::start_div('kg-ie-block');
echo html_writer::tag('h4', 'Globale Konzepte (local Plugin)');
echo html_writer::tag('p', 'Importiere veröffentlichte globale Konzepte aus dem lokalen Seminarplaner-Plugin.');
echo html_writer::start_div('kg-row');
echo html_writer::start_tag('select', ['id' => 'kg-global-set-select', 'class' => 'kg-input']);
echo html_writer::tag('option', 'Bitte wählen', ['value' => '']);
echo html_writer::end_tag('select');
echo html_writer::tag('button', 'Globales Konzept importieren', ['type' => 'button', 'id' => 'kg-global-set-import', 'class' => 'kg-btn kg-btn-primary']);
echo html_writer::end_div();
echo html_writer::start_div('kg-row');
echo '<label class="kg-label" style="display:flex;align-items:center;gap:8px;margin:0">'
    . '<input type="checkbox" id="kg-global-set-autosync">'
    . '<span>Auto-Update für dieses Konzept aktivieren</span>'
    . '</label>';
echo html_writer::tag('button', 'Ausstehende Updates übernehmen', ['type' => 'button', 'id' => 'kg-global-set-apply', 'class' => 'kg-btn']);
echo html_writer::end_div();
echo html_writer::tag('div', '', ['id' => 'kg-global-set-syncinfo', 'class' => 'kg-status']);
echo html_writer::tag('div', '', ['id' => 'kg-global-set-status', 'class' => 'kg-status']);
echo html_writer::end_div();

echo html_writer::start_div('kg-ie-block');
echo html_writer::tag('h4', 'Export für Seminarplaner');
echo html_writer::tag('p', 'Für den Austausch zwischen zwei Seminarplanern (Seminareinheiten, Bausteine und Seminarpläne).');
echo '<div class="kg-row" style="margin-top:8px;gap:14px;flex-wrap:wrap">'
    . '<label class="kg-label" style="display:flex;align-items:center;gap:6px;margin:0"><input type="checkbox" id="kg-ie-export-methods" checked><span>Seminareinheiten</span></label>'
    . '<label class="kg-label" style="display:flex;align-items:center;gap:6px;margin:0"><input type="checkbox" id="kg-ie-export-units" checked><span>Bausteine</span></label>'
    . '<label class="kg-label" style="display:flex;align-items:center;gap:6px;margin:0"><input type="checkbox" id="kg-ie-export-grids"><span>Seminarpläne</span></label>'
    . '</div>';
echo html_writer::start_div('kg-row');
echo html_writer::tag('button', 'Seminarplaner-JSON exportieren', ['type' => 'button', 'id' => 'kg-ie-export-json-full', 'class' => 'kg-btn kg-btn-primary']);
echo html_writer::end_div();
echo html_writer::end_div();

echo html_writer::start_div('kg-ie-block');
echo html_writer::tag('h4', 'PDF-Erstellung');
echo html_writer::tag('p', 'Metadaten nur für PDF-Export. Seminarpläne bleiben separat persistent gespeichert.');
echo html_writer::tag('label', 'Seminarplan wählen', ['for' => 'kg-pdf-grid', 'class' => 'kg-label']);
echo html_writer::start_tag('select', ['id' => 'kg-pdf-grid', 'class' => 'kg-input']);
echo html_writer::tag('option', 'Bitte wählen', ['value' => '']);
echo html_writer::end_tag('select');
echo html_writer::start_div('kg-two');
echo html_writer::start_div();
echo html_writer::tag('label', 'Seminartitel', ['for' => 'kg-pdf-title', 'class' => 'kg-label']);
echo html_writer::empty_tag('input', ['type' => 'text', 'id' => 'kg-pdf-title', 'class' => 'kg-input']);
echo html_writer::end_div();
echo html_writer::start_div();
echo html_writer::tag('label', 'Datum', ['for' => 'kg-pdf-date', 'class' => 'kg-label']);
echo html_writer::empty_tag('input', ['type' => 'text', 'id' => 'kg-pdf-date', 'class' => 'kg-input']);
echo html_writer::end_div();
echo html_writer::end_div();
echo html_writer::start_div('kg-two kg-pdf-meta-row');
echo html_writer::start_div();
echo html_writer::tag('label', 'Seminarnummer', ['for' => 'kg-pdf-number', 'class' => 'kg-label']);
echo html_writer::empty_tag('input', ['type' => 'text', 'id' => 'kg-pdf-number', 'class' => 'kg-input']);
echo html_writer::end_div();
echo html_writer::start_div();
echo html_writer::tag('label', 'Kontakt', ['for' => 'kg-pdf-contact', 'class' => 'kg-label']);
echo html_writer::empty_tag('input', ['type' => 'text', 'id' => 'kg-pdf-contact', 'class' => 'kg-input']);
echo html_writer::end_div();
echo html_writer::end_div();
echo html_writer::start_div('field-card');
echo html_writer::tag('label', 'Spalten für PDF-Export', ['class' => 'kg-label']);
echo '<div class="kg-tag-dropdown" id="kg-pdf-columns-dropdown">';
echo '<button type="button" class="kg-input kg-tag-dropdown-toggle" id="kg-pdf-columns-toggle">Spalten wählen</button>';
echo '<div class="kg-tag-dropdown-panel kg-hidden" id="kg-pdf-columns-panel">';
echo '<label class="kg-tag-option"><input type="checkbox" id="kg-pdf-columns-all" checked><span>Alle</span></label>';
echo '<div id="kg-pdf-columns-options">';
foreach ([
    'uhrzeit' => 'Uhrzeit',
    'titel' => 'Titel',
    'seminarphase' => 'Seminarphase',
    'kognitive' => 'Kognitive Dimension',
    'kurzbeschreibung' => 'Kurzbeschreibung',
    'debrief' => 'Debrief-/Reflexionsfragen',
    'ablauf' => 'Ablauf',
    'lernziele' => 'Lernziele',
    'risiken' => 'Risiken/Tipps',
    'materialtechnik' => 'Material/Technik',
    'sonstiges' => 'Sonstiges',
] as $key => $label) {
    echo '<label class="kg-tag-option"><input type="checkbox" value="' . s($key) . '"><span>' . s($label) . '</span></label>';
}
echo '</div></div></div>';
echo html_writer::end_div();
echo html_writer::start_div('kg-row kg-pdf-actions');
echo html_writer::tag('button', 'ZIM-PDF erstellen', ['type' => 'button', 'id' => 'kg-pdf-zim', 'class' => 'kg-btn kg-btn-primary']);
echo html_writer::tag('button', 'Konzeptsammlung-PDF erstellen', ['type' => 'button', 'id' => 'kg-pdf-flow', 'class' => 'kg-btn']);
echo html_writer::end_div();
echo html_writer::end_div();

echo html_writer::end_div();

echo html_writer::tag('div', '', ['id' => 'kg-ie-status', 'class' => 'kg-status']);

echo html_writer::end_div();

echo $OUTPUT->footer();
