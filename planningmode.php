<?php
// This file is part of Moodle - http://moodle.org/

require_once(__DIR__ . '/../../config.php');
require_once($CFG->libdir . '/editorlib.php');
require_once(__DIR__ . '/locallib.php');

$id = required_param('id', PARAM_INT);
$activity = konzeptgenerator_require_activity_context($id, 'mod/konzeptgenerator:managegrids');
$cm = $activity['cm'];
$course = $activity['course'];
$konzeptgenerator = $activity['konzeptgenerator'];

konzeptgenerator_prepare_page('/mod/konzeptgenerator/planningmode.php', $cm, $course, $konzeptgenerator, 'planningmode');

echo $OUTPUT->header();

echo $OUTPUT->heading(format_string($konzeptgenerator->name));
echo konzeptgenerator_render_tabs((int)$cm->id, 'planningmode');

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
echo html_writer::tag('label', 'Alternativgruppe (optional)', ['for' => 'kg-pm-unit-slotkey', 'class' => 'kg-label']);
echo html_writer::empty_tag('input', ['type' => 'text', 'id' => 'kg-pm-unit-slotkey', 'class' => 'kg-input', 'placeholder' => 'z. B. A']);
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

echo html_writer::start_div('kg-ie-block kg-library-step');
echo html_writer::tag('h4', '2. Feinplanung');
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
