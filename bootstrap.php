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
 * Shared bootstrap and access checks.
 *
 * @package    mod_seminarplaner
 * @copyright  2026 Guido Brombach <gibro@posteo.de>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

/**
 * Symlink-safe Moodle bootstrap for the Seminarplaner activity.
 *
 * __DIR__ points to the real plugin source when the plugin is installed via a
 * symlink, so walking up to ../../config.php would leave the Moodle dirroot.
 */
if (!isset($CFG)) {
    global $CFG;

    $configfile = '';
    if (!empty($_SERVER['DOCUMENT_ROOT'])) {
        $configfile = rtrim($_SERVER['DOCUMENT_ROOT'], DIRECTORY_SEPARATOR) . '/config.php';
    }

    if (!$configfile || !is_readable($configfile)) {
        $scriptfile = $_SERVER['SCRIPT_FILENAME'] ?? '';
        if ($scriptfile) {
            $configfile = dirname($scriptfile, 2) . '/config.php';
        }
    }

    require_once($configfile);
}
