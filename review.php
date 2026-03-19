<?php
// This file is part of Moodle - http://moodle.org/

require_once(__DIR__ . '/../../config.php');
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
echo html_writer::tag('h3', 'Review');

echo html_writer::start_div('kg-ie-block');
echo html_writer::tag('h4', '1. Geänderte oder neue Seminareinheit bereitstellen');
echo html_writer::tag('label', 'Bestehendes Konzept auswählen', ['for' => 'kg-review-existing-set-select', 'class' => 'kg-label']);
echo html_writer::start_tag('select', ['id' => 'kg-review-existing-set-select', 'class' => 'kg-input']);
echo html_writer::tag('option', 'Bitte wählen', ['value' => '0']);
echo html_writer::end_tag('select');
echo html_writer::tag('label', 'Update-Hinweis für Konzeptverantwortliche', ['for' => 'kg-review-existing-changelog', 'class' => 'kg-label']);
echo html_writer::tag('textarea', '', ['id' => 'kg-review-existing-changelog', 'class' => 'kg-input', 'rows' => 3]);
echo html_writer::tag('div', '', ['id' => 'kg-review-existing-status', 'class' => 'kg-status']);
echo html_writer::end_div();

echo html_writer::start_div('kg-ie-block');
echo html_writer::tag('h4', 'Geänderte oder neue Seminareinheiten bereitstellen');
echo html_writer::tag('p', 'Nach Auswahl eines Konzepts erscheinen hier neue/geänderte Lernkarten für das bestehende Konzept.');
echo html_writer::start_div('kg-row');
echo html_writer::tag('button', 'Alle auswählen', ['type' => 'button', 'id' => 'kg-review-existing-select-all', 'class' => 'kg-btn']);
echo html_writer::tag('button', 'Keine auswählen', ['type' => 'button', 'id' => 'kg-review-existing-select-none', 'class' => 'kg-btn']);
echo html_writer::tag('button', 'Änderungen neu prüfen', ['type' => 'button', 'id' => 'kg-review-existing-refresh', 'class' => 'kg-btn']);
echo html_writer::end_div();
echo html_writer::tag('div', '', ['id' => 'kg-review-existing-candidates', 'class' => 'kg-ie-preview']);
echo html_writer::start_div('kg-row kg-pdf-actions');
echo html_writer::tag('button', 'Ausgewählte zur Review einreichen', [
    'type' => 'button',
    'id' => 'kg-review-existing-submit',
    'class' => 'kg-btn kg-btn-primary',
]);
echo html_writer::end_div();
echo html_writer::end_div();

echo html_writer::start_div('kg-ie-block');
echo html_writer::tag('h4', '2. Globales Konzept zur Review bereitstellen');
echo html_writer::tag('p', 'Wähle aus allen vorhandenen Seminareinheiten aus und bündele sie zu einem neuen globalen Konzept.');
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
echo html_writer::tag('button', 'Neues Konzept zur Review einreichen', [
    'type' => 'button',
    'id' => 'kg-review-new-submit',
    'class' => 'kg-btn kg-btn-primary',
]);
echo html_writer::end_div();
echo html_writer::tag('div', '', ['id' => 'kg-review-new-status', 'class' => 'kg-status']);
echo html_writer::end_div();

echo html_writer::end_div();

echo $OUTPUT->footer();
