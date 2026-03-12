<?php
// This file is part of Moodle - http://moodle.org/

require_once(__DIR__ . '/../../config.php');
require_once(__DIR__ . '/locallib.php');

$id = required_param('id', PARAM_INT);
$activity = seminarplaner_require_activity_context($id, 'mod/seminarplaner:viewroterfaden');
$cm = $activity['cm'];
$course = $activity['course'];
$seminarplaner = $activity['seminarplaner'];
$context = $activity['context'];

seminarplaner_prepare_page('/mod/seminarplaner/roterfaden.php', $cm, $course, $seminarplaner, 'roterfaden');

echo $OUTPUT->header();

echo $OUTPUT->heading(format_string($seminarplaner->name));
echo seminarplaner_render_tabs((int)$cm->id, 'roterfaden', $context);

echo html_writer::start_div('kg-shell');
echo html_writer::tag('div', '', ['id' => 'kg-roterfaden-status', 'class' => 'kg-status']);
echo html_writer::start_div('kg-ie-block');
echo html_writer::tag('h3', get_string('roterfadenmenu', 'mod_seminarplaner'));
echo html_writer::start_div('kg-row');
echo html_writer::tag('label', get_string('roterfaden_theme_label', 'mod_seminarplaner'), [
    'for' => 'kg-roterfaden-theme',
    'class' => 'kg-label',
]);
echo html_writer::start_tag('select', ['id' => 'kg-roterfaden-theme', 'class' => 'kg-input kg-grid-select']);
echo html_writer::tag('option', get_string('roterfaden_theme_modern', 'mod_seminarplaner'), ['value' => 'modern']);
echo html_writer::tag('option', get_string('roterfaden_theme_clean', 'mod_seminarplaner'), ['value' => 'clean']);
echo html_writer::end_tag('select');
echo html_writer::end_div();
echo html_writer::tag('div', '', [
    'id' => 'kg-roterfaden-empty',
    'class' => 'sp-filter-status kg-hidden',
    'data-empty-message' => get_string('roterfaden_empty', 'mod_seminarplaner'),
]);
echo html_writer::tag('div', '', ['id' => 'kg-roterfaden-list', 'class' => 'kg-roterfaden-list']);
echo html_writer::end_div();
echo html_writer::end_div();

echo $OUTPUT->footer();
