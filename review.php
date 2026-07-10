<?php
// This file is part of Moodle - http://moodle.org/

require_once(__DIR__ . '/bootstrap.php');
require_once(__DIR__ . '/locallib.php');

$id = required_param('id', PARAM_INT);
$activity = seminarplaner_require_activity_context($id, 'mod/seminarplaner:view');
$cm = $activity['cm'];
$course = $activity['course'];
$seminarplaner = $activity['seminarplaner'];

seminarplaner_prepare_page('/mod/seminarplaner/review.php', $cm, $course, $seminarplaner, 'review');

echo $OUTPUT->header();

echo $OUTPUT->heading(format_string($seminarplaner->name));
echo seminarplaner_render_tabs((int)$cm->id, 'review');

echo html_writer::start_div('kg-shell');
echo html_writer::tag('h3', get_string('einreichenmenu', 'mod_seminarplaner'));

// D37: Flussdiagramm-Erklaerung des Pruefprozesses.
$flowsteps = [
    ['titel' => 'Einreichen', 'text' => 'Du gibst deinen Beitrag bei den Konzeptverantwortlichen ab.'],
    ['titel' => 'Prüfung', 'text' => 'Sie schauen fachlich darüber – bei Fragen melden sie sich bei dir.'],
    ['titel' => 'Freigabe', 'text' => 'Passt alles, geben sie deinen Beitrag frei.'],
    ['titel' => 'Für alle da', 'text' => 'Dein Beitrag erscheint in der globalen Bibliothek.'],
];
echo html_writer::start_div('kg-flow', ['aria-label' => 'So läuft der Prüfprozess']);
foreach ($flowsteps as $index => $step) {
    if ($index > 0) {
        echo html_writer::tag('span', '→', ['class' => 'kg-flow__arrow', 'aria-hidden' => 'true']);
    }
    echo html_writer::div(
        html_writer::tag('span', (string)($index + 1), ['class' => 'kg-flow__num'])
        . html_writer::tag('strong', s($step['titel']))
        . html_writer::tag('span', s($step['text']), ['class' => 'kg-flow__text']),
        'kg-flow__step'
    );
}
echo html_writer::end_div();

// D37: laufende Einreichungen samt Status sichtbar machen - die Liste
// zeigt je Methoden-Sammlung, wo sie im Flussdiagramm oben steht.
echo html_writer::start_div('kg-ie-block');
echo html_writer::tag('h4', 'Wo stehen deine Einreichungen?');
echo html_writer::tag('div', '', ['id' => 'kg-review-status-list', 'class' => 'kg-review-status-list']);
echo html_writer::end_div();

echo html_writer::start_div('kg-ie-block');
echo html_writer::tag('h4', '1. Geänderte oder neue Seminareinheit bereitstellen');
echo html_writer::tag('label', 'Bestehende Methoden-Sammlung auswählen', ['for' => 'kg-review-existing-set-select', 'class' => 'kg-label']);
echo html_writer::start_tag('select', ['id' => 'kg-review-existing-set-select', 'class' => 'kg-input']);
echo html_writer::tag('option', 'Bitte wählen', ['value' => '0']);
echo html_writer::end_tag('select');
echo html_writer::tag('label', 'Update-Hinweis für Konzeptverantwortliche', ['for' => 'kg-review-existing-changelog', 'class' => 'kg-label']);
echo html_writer::tag('textarea', '', ['id' => 'kg-review-existing-changelog', 'class' => 'kg-input', 'rows' => 3]);
echo html_writer::tag('div', '', ['id' => 'kg-review-existing-status', 'class' => 'kg-status']);
echo html_writer::end_div();

echo html_writer::start_div('kg-ie-block');
echo html_writer::tag('h4', 'Geänderte oder neue Seminareinheiten bereitstellen');
echo html_writer::tag('p', 'Nach Auswahl einer Methoden-Sammlung erscheinen hier neue/geänderte Seminareinheiten für die bestehende Sammlung.');
echo html_writer::start_div('kg-row');
echo html_writer::tag('button', 'Alle auswählen', ['type' => 'button', 'id' => 'kg-review-existing-select-all', 'class' => 'kg-btn']);
echo html_writer::tag('button', 'Keine auswählen', ['type' => 'button', 'id' => 'kg-review-existing-select-none', 'class' => 'kg-btn']);
echo html_writer::tag('button', 'Änderungen neu prüfen', ['type' => 'button', 'id' => 'kg-review-existing-refresh', 'class' => 'kg-btn']);
echo html_writer::end_div();
echo html_writer::tag('div', '', ['id' => 'kg-review-existing-candidates', 'class' => 'kg-ie-preview']);
echo html_writer::start_div('kg-row kg-pdf-actions');
echo html_writer::tag('button', 'Ausgewählte Seminareinheiten einreichen', [
    'type' => 'button',
    'id' => 'kg-review-existing-submit',
    'class' => 'kg-btn kg-btn-primary',
]);
echo html_writer::end_div();
echo html_writer::end_div();

echo html_writer::start_div('kg-ie-block');
echo html_writer::tag('h4', '2. Neue Methoden-Sammlung einreichen');
echo html_writer::tag('p', 'Wähle aus allen vorhandenen Seminareinheiten aus und bündele sie zu einer neuen Methoden-Sammlung – einer Sammlung ohne Ablauf/Reihenfolge.');
echo html_writer::start_div('kg-two');
echo html_writer::start_div();
echo html_writer::tag('label', 'Name', ['for' => 'kg-review-new-displayname', 'class' => 'kg-label']);
echo html_writer::empty_tag('input', ['type' => 'text', 'id' => 'kg-review-new-displayname', 'class' => 'kg-input']);
echo html_writer::tag('small', 'Name = sichtbarer Anzeigename.');
echo html_writer::end_div();
echo html_writer::start_div();
echo html_writer::tag('label', 'Kurzbezeichnung', ['for' => 'kg-review-new-shortname', 'class' => 'kg-label']);
echo html_writer::empty_tag('input', ['type' => 'text', 'id' => 'kg-review-new-shortname', 'class' => 'kg-input']);
echo html_writer::tag('small', 'Kurzbezeichnung = technischer, eindeutiger Schlüssel ohne Leerzeichen; Name = sichtbarer Anzeigename.');
echo html_writer::end_div();
echo html_writer::end_div();
echo html_writer::tag('label', 'Beschreibung', ['for' => 'kg-review-new-description', 'class' => 'kg-label']);
echo html_writer::tag('textarea', '', ['id' => 'kg-review-new-description', 'class' => 'kg-input', 'rows' => 3]);
echo html_writer::tag('label', 'Update-Hinweis für Konzeptverantwortliche', ['for' => 'kg-review-new-changelog', 'class' => 'kg-label']);
echo html_writer::tag('textarea', '', ['id' => 'kg-review-new-changelog', 'class' => 'kg-input', 'rows' => 3]);
echo html_writer::start_div('kg-row');
echo html_writer::tag('button', 'Alle auswählen', ['type' => 'button', 'id' => 'kg-review-new-select-all', 'class' => 'kg-btn']);
echo html_writer::tag('button', 'Keine auswählen', ['type' => 'button', 'id' => 'kg-review-new-select-none', 'class' => 'kg-btn']);
echo html_writer::end_div();
echo html_writer::tag('div', '', ['id' => 'kg-review-new-methods', 'class' => 'kg-ie-preview']);
echo html_writer::start_div('kg-row kg-pdf-actions');
echo html_writer::tag('button', 'Methoden-Sammlung einreichen', [
    'type' => 'button',
    'id' => 'kg-review-new-submit',
    'class' => 'kg-btn kg-btn-primary',
]);
echo html_writer::end_div();
echo html_writer::tag('div', '', ['id' => 'kg-review-new-status', 'class' => 'kg-status']);
echo html_writer::end_div();

echo html_writer::end_div();

echo $OUTPUT->footer();
