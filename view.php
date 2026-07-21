<?php
// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <https://www.gnu.org/licenses/>.

/**
 * Displays a single instance.
 *
 * @package    mod_seminarplaner
 * @copyright  2026 Guido Brombach <gibro@posteo.de>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

require_once(__DIR__ . '/bootstrap.php');

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

if (
    has_capability('mod/seminarplaner:managemethods', $context)
    || has_capability('mod/seminarplaner:managegrids', $context)
) {
    // D50: Der Anlegen-Bereich ist entfallen – Einstieg ist die Bibliothek.
    redirect(new moodle_url('/mod/seminarplaner/methodlibrary.php', ['id' => $cm->id]));
}

// D69: Wer den Plan nur durchfuehrt, landet im Souffleur — der Rote Faden ist
// die Teilnehmenden-Sicht und bleibt Einstieg fuer alle uebrigen.
if (
    !has_capability('mod/seminarplaner:viewroterfaden', $context)
    && has_capability('mod/seminarplaner:viewlive', $context)
) {
    redirect(new moodle_url('/mod/seminarplaner/live.php', ['id' => $cm->id]));
}

require_capability('mod/seminarplaner:viewroterfaden', $context);
redirect(new moodle_url('/mod/seminarplaner/roterfaden.php', ['id' => $cm->id]));
