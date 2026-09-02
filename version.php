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
 * Version details.
 *
 * @package    mod_seminarplaner
 * @copyright  2026 Guido Brombach <gibro@posteo.de>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

$plugin->component = 'mod_seminarplaner';
$plugin->version = 2026090201;
$plugin->requires = 2024042200; // Moodle 4.5 minimum.
$plugin->maturity = MATURITY_STABLE;
$plugin->release = '1.1.0';

// Die Methodensets und Konzepte liegen in Tabellen des Local-Plugins;
// ohne dieses Plugin ist die Aktivitaet nicht lauffaehig.
$plugin->dependencies = [
    'local_seminarplaner' => 2026072000,
];
