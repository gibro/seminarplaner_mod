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
 * Moodle App support.
 *
 * @package    mod_seminarplaner
 * @copyright  2026 Guido Brombach <gibro@posteo.de>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

// Die Aktivitaet in der Moodle App ist der Rote Faden: die Teilnehmenden-Sicht.
// Geplant wird weiterhin im Browser — Bibliothek, Sequenz und Import/Export
// waeren auf dem Telefon nicht zu bedienen. Wer bearbeiten will, oeffnet die
// Aktivitaet ueber "Im Browser oeffnen" (displayopeninbrowser).
$addons = [
    'mod_seminarplaner' => [
        'handlers' => [
            'roterfaden' => [
                'displaydata' => [
                    'icon' => $CFG->wwwroot . '/mod/seminarplaner/pix/monologo.svg',
                    'class' => '',
                ],
                'delegate' => 'CoreCourseModuleDelegate',
                'method' => 'mobile_course_view',
                // Der veroeffentlichte Ablauf ist der Grund, warum die App
                // ueberhaupt gebraucht wird: im Seminarraum, oft ohne Netz.
                // Deshalb laesst sich die Ansicht herunterladen.
                'offlinefunctions' => [
                    'mobile_course_view' => [],
                ],
                'displayrefresh' => true,
                'displayopeninbrowser' => true,
                'displaydescription' => true,
                'ptrenabled' => true,
                'styles' => [
                    'url' => $CFG->wwwroot . '/mod/seminarplaner/mobileapp/styles.css',
                    'version' => 1,
                ],
            ],
        ],
        'lang' => [
            ['pluginname', 'seminarplaner'],
            ['roterfadenmenu', 'seminarplaner'],
        ],
    ],
];
