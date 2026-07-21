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
 * Live-Ansicht (Durchfuehrungsmodus / Souffleur, D69/D70/D72).
 *
 * Rein lesend: die Seite schreibt nichts in den Plan zurueck. Wer waehrend der
 * Durchfuehrung abweichen will, kopiert den Plan vorab (D67/D71) und bearbeitet
 * die Kopie mit dem Sequenz-Editor.
 *
 * @package    mod_seminarplaner
 * @copyright  2026 Guido Brombach <gibro@posteo.de>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

require_once(__DIR__ . '/bootstrap.php');
require_once(__DIR__ . '/locallib.php');

$id = required_param('id', PARAM_INT);
$activity = seminarplaner_require_activity_context($id, 'mod/seminarplaner:viewlive');
$cm = $activity['cm'];
$course = $activity['course'];
$seminarplaner = $activity['seminarplaner'];
$context = $activity['context'];

seminarplaner_prepare_page('/mod/seminarplaner/live.php', $cm, $course, $seminarplaner, 'live');

echo $OUTPUT->header();

echo $OUTPUT->heading(format_string($seminarplaner->name));
echo seminarplaner_render_tabs((int)$cm->id, 'live', $context);

echo html_writer::start_div('kg-shell live-shell', ['id' => 'live-shell']);

echo html_writer::tag('div', '', [
    'id' => 'live-status',
    'class' => 'kg-status',
    'role' => 'status',
    'aria-live' => 'polite',
]);

// ---------------------------------------------------------------------------
// Startbildschirm (D72): kein Zeitautomatismus — die Referentin startet selbst.
// ---------------------------------------------------------------------------
echo html_writer::start_div('live-start', ['id' => 'live-start']);

echo html_writer::start_div('sq-pagehead');
echo html_writer::tag('h3', get_string('livemenu', 'mod_seminarplaner'));
echo html_writer::div(get_string('live_intro', 'mod_seminarplaner'), 'sq-pagehead__sub');
echo html_writer::end_div();

echo html_writer::start_div('live-start__form');

echo html_writer::start_div('live-field');
echo html_writer::tag('label', get_string('live_planlabel', 'mod_seminarplaner'), [
    'for' => 'live-grid-select',
    'class' => 'kg-label',
]);
echo html_writer::tag('select', '', ['id' => 'live-grid-select', 'class' => 'kg-input']);
echo html_writer::end_div();

echo html_writer::start_div('live-field');
echo html_writer::tag('label', get_string('live_startatlabel', 'mod_seminarplaner'), [
    'for' => 'live-start-select',
    'class' => 'kg-label',
]);
echo html_writer::tag('select', '', ['id' => 'live-start-select', 'class' => 'kg-input']);
echo html_writer::end_div();

echo html_writer::end_div();

echo html_writer::tag('div', '', ['id' => 'live-start-preview', 'class' => 'live-start__preview']);

echo html_writer::tag('button', get_string('live_startbutton', 'mod_seminarplaner'), [
    'type' => 'button',
    'id' => 'live-start-button',
    'class' => 'kg-btn kg-btn-primary live-start__go',
]);

echo html_writer::tag('div', get_string('live_empty', 'mod_seminarplaner'), [
    'id' => 'live-empty',
    'class' => 'sp-filter-status kg-hidden',
]);

echo html_writer::end_div();

// ---------------------------------------------------------------------------
// Buehne: erst nach dem Start sichtbar, danach ausschliesslich manuell bedient.
// ---------------------------------------------------------------------------
echo html_writer::start_div('live-stage kg-hidden', ['id' => 'live-stage']);

echo html_writer::start_div('live-bar');
echo html_writer::tag('div', '', ['id' => 'live-where', 'class' => 'live-bar__where']);
echo html_writer::start_div('live-bar__tools');
echo html_writer::tag('span', '', ['id' => 'live-clock', 'class' => 'live-bar__clock live-time']);
echo html_writer::tag(
    'label',
    html_writer::empty_tag('input', ['type' => 'checkbox', 'id' => 'live-clock-toggle', 'checked' => 'checked'])
    . html_writer::tag('span', get_string('live_showclock', 'mod_seminarplaner')),
    ['class' => 'live-bar__switch', 'for' => 'live-clock-toggle']
);
echo html_writer::tag('button', get_string('live_fullscreen', 'mod_seminarplaner'), [
    'type' => 'button', 'id' => 'live-fullscreen', 'class' => 'kg-btn',
]);
echo html_writer::tag('button', get_string('live_quit', 'mod_seminarplaner'), [
    'type' => 'button', 'id' => 'live-quit', 'class' => 'kg-btn',
]);
echo html_writer::end_div();
echo html_writer::end_div();

echo html_writer::start_div('live-grid');
echo html_writer::tag('section', '', [
    'id' => 'live-now',
    'class' => 'live-now',
    'aria-live' => 'polite',
    'aria-label' => get_string('live_now', 'mod_seminarplaner'),
]);
echo html_writer::tag('aside', '', [
    'id' => 'live-next',
    'class' => 'live-next',
    'aria-label' => get_string('live_next', 'mod_seminarplaner'),
]);
echo html_writer::end_div();

// D72: Vor/Zurueck wie der Foliensprung im Moderationsmodus — kein Fortschritt
// aus geplanten Dauern oder echter Uhrzeit.
echo html_writer::start_div('live-nav');
echo html_writer::tag('button', '◀ ' . get_string('live_prev', 'mod_seminarplaner'), [
    'type' => 'button', 'id' => 'live-prev', 'class' => 'kg-btn live-nav__btn',
]);
echo html_writer::tag('div', '', ['id' => 'live-count', 'class' => 'live-nav__count']);
echo html_writer::tag('button', get_string('live_next', 'mod_seminarplaner') . ' ▶', [
    'type' => 'button', 'id' => 'live-next-button', 'class' => 'kg-btn kg-btn-primary live-nav__btn',
]);
echo html_writer::end_div();

echo html_writer::div(get_string('live_keyhint', 'mod_seminarplaner'), 'live-keyhint');

echo html_writer::end_div();

echo html_writer::end_div();

echo $OUTPUT->footer();
