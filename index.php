<?php
// This file is part of Moodle - http://moodle.org/

require_once(__DIR__ . '/../../config.php');

$id = required_param('id', PARAM_INT);
$course = $DB->get_record('course', ['id' => $id], '*', MUST_EXIST);

require_course_login($course);
$context = context_course::instance($course->id);

$PAGE->set_url('/mod/konzeptgenerator/index.php', ['id' => $id]);
$PAGE->set_title(get_string('modulenameplural', 'mod_konzeptgenerator'));
$PAGE->set_heading(format_string($course->fullname));

$instances = get_all_instances_in_course('konzeptgenerator', $course);

echo $OUTPUT->header();
echo $OUTPUT->heading(get_string('modulenameplural', 'mod_konzeptgenerator'));

if (!$instances) {
    notice(get_string('thereareno', 'moodle', get_string('modulenameplural', 'mod_konzeptgenerator')),
        new moodle_url('/course/view.php', ['id' => $course->id]));
}

$table = new html_table();
$table->head = [get_string('name')];

foreach ($instances as $instance) {
    $cmcontext = context_module::instance($instance->coursemodule);
    if (!has_capability('mod/konzeptgenerator:view', $cmcontext)) {
        continue;
    }

    $url = new moodle_url('/mod/konzeptgenerator/view.php', ['id' => $instance->coursemodule]);
    $table->data[] = [html_writer::link($url, format_string($instance->name))];
}

echo html_writer::table($table);
echo $OUTPUT->footer();
