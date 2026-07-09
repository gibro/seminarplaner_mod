<?php
// This file is part of Moodle - http://moodle.org/

require_once(__DIR__ . '/bootstrap.php');
require_once(__DIR__ . '/locallib.php');

$id = required_param('id', PARAM_INT);
$activity = seminarplaner_require_activity_context($id, 'mod/seminarplaner:managegrids');
$cm = $activity['cm'];
$course = $activity['course'];
$seminarplaner = $activity['seminarplaner'];

seminarplaner_prepare_page('/mod/seminarplaner/sequenz.php', $cm, $course, $seminarplaner, 'sequenz');

echo $OUTPUT->header();

echo $OUTPUT->heading(format_string($seminarplaner->name));
echo seminarplaner_render_tabs((int)$cm->id, 'sequenz');

echo html_writer::start_div('kg-shell sq-shell');
echo html_writer::tag('div', '', ['id' => 'sq-status', 'class' => 'kg-status', 'aria-live' => 'polite']);

echo html_writer::div(
    get_string('sequenz_previewnote', 'mod_seminarplaner'),
    'sq-note', ['id' => 'sq-preview-note']
);

// Plan selection.
echo html_writer::start_div('sq-planbar');
echo html_writer::tag('label', get_string('sequenz_planlabel', 'mod_seminarplaner'),
    ['for' => 'sq-grid-select', 'class' => 'kg-label sq-planbar__label']);
echo html_writer::tag('select', '', ['id' => 'sq-grid-select', 'class' => 'kg-input sq-planbar__select']);
echo html_writer::end_div();

// Toolbar with day navigation.
echo html_writer::start_div('sq-toolbar');
echo html_writer::start_div('sq-toolbar__nav');
echo html_writer::tag('button', '‹', [
    'type' => 'button', 'id' => 'sq-prev-day', 'class' => 'kg-btn',
    'title' => get_string('sequenz_prevday', 'mod_seminarplaner'),
    'aria-label' => get_string('sequenz_prevday', 'mod_seminarplaner'),
]);
echo html_writer::tag('div', '', ['id' => 'sq-day-label', 'class' => 'sq-daylabel']);
echo html_writer::tag('button', '›', [
    'type' => 'button', 'id' => 'sq-next-day', 'class' => 'kg-btn',
    'title' => get_string('sequenz_nextday', 'mod_seminarplaner'),
    'aria-label' => get_string('sequenz_nextday', 'mod_seminarplaner'),
]);
echo html_writer::end_div();
echo html_writer::end_div();

// Anchors are rendered by the AMD module.
echo html_writer::tag('div', '', ['id' => 'sq-day']);

// Phase legend.
$phases = [
    'orientierung' => 'Orientierung',
    'erfahrung' => 'Erfahrungserhebung',
    'analyse' => 'Analyse',
    'handlung' => 'Handlungsteil',
    'transfer' => 'Transfer',
];
echo html_writer::start_div('sq-legend');
foreach ($phases as $key => $label) {
    echo html_writer::tag('span',
        html_writer::tag('i', '', ['class' => 'sq-legend__dot sq-phase-bg--' . $key]) . s($label));
}
echo html_writer::end_div();

echo html_writer::end_div();

echo $OUTPUT->footer();
