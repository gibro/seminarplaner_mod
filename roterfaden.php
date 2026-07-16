<?php
// This file is part of Moodle - http://moodle.org/

require_once(__DIR__ . '/bootstrap.php');
require_once(__DIR__ . '/locallib.php');

$id = required_param('id', PARAM_INT);
$activity = seminarplaner_require_activity_context($id, 'mod/seminarplaner:viewroterfaden');
$cm = $activity['cm'];
$course = $activity['course'];
$seminarplaner = $activity['seminarplaner'];
$context = $activity['context'];

// Kein AMD-Modul an prepare_page uebergeben: die Seite startet roterfaden
// gleich selbst, weil sie das Logo mitgeben muss. Beides zusammen wuerde das
// Modul zweimal instanziieren – und weil jede Instanz ihren eigenen
// Klick-Listener anhaengt, klappte ein Klick auf „Themen" den Block zu und
// sofort wieder auf. Gleiche Bauart wie importexport.php.
seminarplaner_prepare_page('/mod/seminarplaner/roterfaden.php', $cm, $course, $seminarplaner, null);
$pdflogo = seminarplaner_get_pdf_logo($context, $seminarplaner);
$PAGE->requires->js_call_amd('mod_seminarplaner/roterfaden', 'init', [(int)$cm->id, $pdflogo]);

echo $OUTPUT->header();

echo $OUTPUT->heading(format_string($seminarplaner->name));
echo seminarplaner_render_tabs((int)$cm->id, 'roterfaden', $context);

// D64: Das Handout entsteht hier im Browser (jsPDF) — Teilnehmende erzeugen es
// selbst, ohne den Import/Export-Tab, den sie nicht sehen dürfen.
$vendorbase = $CFG->wwwroot . '/mod/seminarplaner/thirdparty';
echo '<script>window.__kg_prev_define = window.define; try { window.define = undefined; } catch (e) {}</script>';
echo '<script src="' . s($vendorbase . '/jspdf/jspdf.umd.min.js') . '"></script>';
echo '<script>try { if (window.__kg_prev_define !== undefined) { window.define = window.__kg_prev_define; } else { delete window.define; } } catch (e) {} delete window.__kg_prev_define;</script>';

echo html_writer::start_div('kg-shell kg-rf-shell');

// Kopfzeile mit rotem Balken — dasselbe Muster wie in den übrigen Tabs.
echo html_writer::start_div('sq-pagehead');
echo html_writer::tag('h3', get_string('roterfadenmenu', 'mod_seminarplaner'));
echo html_writer::div(
    'Der Ablauf des Seminars als durchgehende Linie — Tag für Tag, von der Orientierung bis zum Transfer.',
    'sq-pagehead__sub'
);
echo html_writer::end_div();

// Werkzeugleiste: Ansichtsdichte links, Handout-Ausgabe rechts.
echo html_writer::start_div('rf-toolbar');
echo html_writer::start_div('rf-toolbar__group');
echo html_writer::tag('label', get_string('roterfaden_theme_label', 'mod_seminarplaner'), [
    'for' => 'kg-roterfaden-theme',
    'class' => 'rf-toolbar__label',
]);
echo html_writer::start_tag('select', ['id' => 'kg-roterfaden-theme', 'class' => 'kg-input rf-select']);
echo html_writer::tag('option', get_string('roterfaden_theme_modern', 'mod_seminarplaner'), ['value' => 'modern']);
echo html_writer::tag('option', get_string('roterfaden_theme_kompakt', 'mod_seminarplaner'), ['value' => 'kompakt']);
echo html_writer::end_tag('select');
echo html_writer::end_div();
// D64: Handout-PDF für Teilnehmende. Der Button steht allen offen, die den Roten
// Faden sehen dürfen (also auch Teilnehmenden) — erzeugt wird das PDF im Browser
// aus dem veröffentlichten Snapshot, denselben Generator nutzt der Import/Export-Tab.
// Bis ein Ablauf geladen ist, blendet das AMD-Modul den Button aus.
// Dokument-Glyphe als Inline-SVG (html_writer kann kein SVG), dekorativ.
$icdoc = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
    . 'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'
    . '<path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5"/>'
    . '<path d="M9 13h6M9 17h4"/></svg>';
echo html_writer::tag(
    'button',
    $icdoc . '<span>Handout-PDF für Teilnehmende</span>',
    [
        'type' => 'button',
        'id' => 'kg-roterfaden-handout',
        'class' => 'kg-btn kg-btn--outline-red rf-handout kg-hidden',
    ]
);
echo html_writer::end_div();

echo html_writer::tag('div', '', ['id' => 'kg-roterfaden-status', 'class' => 'kg-status', 'role' => 'status', 'aria-live' => 'polite']);
echo html_writer::tag('div', '', [
    'id' => 'kg-roterfaden-empty',
    'class' => 'sp-filter-status kg-hidden',
    'data-empty-message' => get_string('roterfaden_empty', 'mod_seminarplaner'),
]);
echo html_writer::tag('div', '', ['id' => 'kg-roterfaden-list', 'class' => 'kg-roterfaden-list']);
echo html_writer::end_div();

echo $OUTPUT->footer();
