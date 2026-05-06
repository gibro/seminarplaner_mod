<?php
// This file is part of Moodle - http://moodle.org/

require_once(__DIR__ . '/bootstrap.php');
require_once($CFG->libdir . '/editorlib.php');
require_once(__DIR__ . '/locallib.php');

$id = required_param('id', PARAM_INT);
$activity = seminarplaner_require_activity_context($id, 'mod/seminarplaner:view');
$cm = $activity['cm'];
$course = $activity['course'];
$seminarplaner = $activity['seminarplaner'];

seminarplaner_prepare_page('/mod/seminarplaner/planningmode.php', $cm, $course, $seminarplaner, 'planningmode');

echo $OUTPUT->header();

echo $OUTPUT->heading(format_string($seminarplaner->name));
echo seminarplaner_render_tabs((int)$cm->id, 'planningmode');

echo html_writer::start_div('kg-shell');
echo html_writer::tag('div', '', ['id' => 'kg-pm-status', 'class' => 'kg-status']);
echo html_writer::tag('h3', 'Bausteine');

echo html_writer::start_div('kg-ie-block kg-library-step');
echo html_writer::tag('h4', '1. Bausteine grob planen');
echo html_writer::start_div('kg-two');

echo html_writer::start_div('kg-ie-block');
echo html_writer::tag('label', 'Titel', ['for' => 'kg-pm-unit-title', 'class' => 'kg-label']);
echo html_writer::empty_tag('input', ['type' => 'text', 'id' => 'kg-pm-unit-title', 'class' => 'kg-input']);
echo html_writer::tag('label', 'Dauer (Min.)', ['for' => 'kg-pm-unit-duration', 'class' => 'kg-label']);
echo html_writer::empty_tag('input', ['type' => 'number', 'id' => 'kg-pm-unit-duration', 'class' => 'kg-input', 'value' => '90', 'min' => '5', 'step' => '5']);
echo html_writer::tag('label', 'Baustein-Alternative überschreiben', ['for' => 'kg-pm-unit-altunits', 'class' => 'kg-label']);
echo html_writer::start_div('kg-tag-dropdown', [
    'id' => 'kg-pm-unit-alt-dropdown',
    'data-pm-unit-alt-dropdown' => '1',
]);
echo html_writer::tag('button', 'Bausteine wählen', [
    'type' => 'button',
    'class' => 'kg-input kg-tag-dropdown-toggle',
    'id' => 'kg-pm-unit-alt-toggle',
    'data-pm-unit-alt-toggle' => '1',
]);
echo html_writer::start_div('kg-tag-dropdown-panel kg-hidden', [
    'id' => 'kg-pm-unit-alt-panel',
    'data-pm-unit-alt-panel' => '1',
]);
echo html_writer::start_div('', ['id' => 'kg-pm-unit-alt-options']);
echo html_writer::end_div();
echo html_writer::end_div();
echo html_writer::end_div();
echo html_writer::empty_tag('input', [
    'type' => 'hidden',
    'id' => 'kg-pm-unit-altunits',
    'value' => '',
]);
echo html_writer::tag('label', 'Lernziele', ['for' => 'kg-pm-unit-objectives', 'class' => 'kg-label']);
echo html_writer::tag('textarea', '', [
    'id' => 'kg-pm-unit-objectives',
    'name' => 'kg_pm_unit_objectives',
    'class' => 'kg-input kg-richtext-edit',
    'rows' => '4',
    'placeholder' => 'Lernziele als Richtext eingeben',
]);
echo html_writer::tag('label', 'Themen', ['for' => 'kg-pm-unit-topics', 'class' => 'kg-label']);
echo html_writer::tag('textarea', '', [
    'id' => 'kg-pm-unit-topics',
    'name' => 'kg_pm_unit_topics',
    'class' => 'kg-input kg-richtext-edit',
    'rows' => '4',
    'placeholder' => 'Themen als Richtext eingeben',
]);
echo html_writer::tag('button', 'Baustein hinzufügen', ['type' => 'button', 'id' => 'kg-pm-add-unit', 'class' => 'kg-btn kg-btn-primary']);
echo html_writer::tag('button', 'Bearbeitung abbrechen', ['type' => 'button', 'id' => 'kg-pm-cancel-edit', 'class' => 'kg-btn kg-hidden']);
echo html_writer::end_div();

echo html_writer::start_div('kg-ie-block');
echo html_writer::tag('h5', 'Bausteine');
echo html_writer::tag('div', '', ['id' => 'kg-pm-unit-list', 'class' => 'kg-unit-list']);
echo html_writer::end_div();

echo html_writer::end_div();
echo html_writer::end_div();

echo html_writer::start_div('kg-ie-block kg-library-step', ['id' => 'kg-pm-step-2']);
echo html_writer::tag('h4', '2. Feinplanung');
echo html_writer::tag('p',
    'Hinweis: Die geplante Dauer aus Schritt 1 darf in Schritt 2 überschritten werden. Bei Überschreitung erscheint ein Warnhinweis; gespeichert wird die in Schritt 2 tatsächlich entstandene Dauer.',
    ['class' => 'sp-filter-status']);
echo html_writer::start_div('kg-row');
echo html_writer::tag('button', 'Baustein speichern', ['type' => 'button', 'id' => 'kg-pm-save', 'class' => 'kg-btn kg-btn-primary']);
echo html_writer::tag('button', 'Didaktik prüfen', ['type' => 'button', 'id' => 'kg-pm-check', 'class' => 'kg-btn']);
echo html_writer::end_div();
echo html_writer::tag('div', '', ['id' => 'kg-pm-accordion', 'class' => 'kg-plan-accordion']);
echo html_writer::end_div();

echo html_writer::start_div('kg-ie-block kg-library-step');
echo html_writer::tag('h4', '3. Empfehlungen');
echo html_writer::tag('div', '', ['id' => 'kg-pm-didactic', 'class' => 'kg-didactic-output']);
echo html_writer::end_div();

echo html_writer::end_div();

// Enable preferred Moodle editor (Tiny in Moodle 5.x by default) on rich text fields.
$editor = editors_get_preferred_editor(FORMAT_HTML);
$editoroptions = [
    'context' => $activity['context'],
    'maxfiles' => 0,
    'maxbytes' => 0,
    'trusttext' => false,
    'subdirs' => 0,
];
foreach ([
    'kg-pm-unit-objectives',
    'kg-pm-unit-topics',
] as $editorid) {
    $editor->use_editor($editorid, $editoroptions, null);
}

echo $OUTPUT->footer();
