<?php
// This file is part of Moodle - http://moodle.org/

require_once(__DIR__ . '/../../config.php');

$id = optional_param('id', 0, PARAM_INT);
$n = optional_param('n', 0, PARAM_INT);

if ($id) {
    $cm = get_coursemodule_from_id('seminarplaner', $id, 0, false, MUST_EXIST);
    $course = $DB->get_record('course', ['id' => $cm->course], '*', MUST_EXIST);
} else if ($n) {
    $record = $DB->get_record('seminarplaner', ['id' => $n], 'id', MUST_EXIST);
    $cm = get_coursemodule_from_instance('seminarplaner', $record->id, 0, false, MUST_EXIST);
    $course = $DB->get_record('course', ['id' => $cm->course], '*', MUST_EXIST);
} else {
    throw new moodle_exception('missingparameter');
}

require_login($course, true, $cm);
$context = context_module::instance($cm->id);

if (has_capability('mod/seminarplaner:managemethods', $context)
    || has_capability('mod/seminarplaner:managegrids', $context)) {
    redirect(new moodle_url('/mod/seminarplaner/methods.php', ['id' => $cm->id]));
}

require_capability('mod/seminarplaner:viewroterfaden', $context);
redirect(new moodle_url('/mod/seminarplaner/roterfaden.php', ['id' => $cm->id]));
