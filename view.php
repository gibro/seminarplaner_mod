<?php
// This file is part of Moodle - http://moodle.org/

require_once(__DIR__ . '/../../config.php');

$id = optional_param('id', 0, PARAM_INT);
$n = optional_param('n', 0, PARAM_INT);

if ($id) {
    $cm = get_coursemodule_from_id('konzeptgenerator', $id, 0, false, MUST_EXIST);
    redirect(new moodle_url('/mod/konzeptgenerator/methods.php', ['id' => $cm->id]));
} else if ($n) {
    $record = $DB->get_record('konzeptgenerator', ['id' => $n], 'id', MUST_EXIST);
    $cm = get_coursemodule_from_instance('konzeptgenerator', $record->id, 0, false, MUST_EXIST);
    redirect(new moodle_url('/mod/konzeptgenerator/methods.php', ['id' => $cm->id]));
} else {
    throw new moodle_exception('missingparameter');
}
