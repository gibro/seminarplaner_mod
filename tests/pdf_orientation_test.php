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
 * Unit tests for the ZIM-PDF page orientation setting.
 *
 * @package    mod_seminarplaner
 * @copyright  2026 Guido Brombach <gibro@posteo.de>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

global $CFG;
require_once($CFG->dirroot . '/mod/seminarplaner/locallib.php');

/**
 * Hoch- oder Querformat für das ZIM-Papier (12. Oktober 2026).
 *
 * Die Wahl liegt mit der Spaltenwahl (D63) in pdfcolumns_cmid_<cmid>.
 * Querformat bleibt der Standard - auch für Einstellungen von vorher.
 */
final class pdf_orientation_test extends advanced_testcase {

    /**
     * Gespeichertes Hochformat kommt zurück.
     */
    public function test_portrait_is_kept(): void {
        $this->resetAfterTest();
        set_config('pdfcolumns_cmid_7', json_encode([
            'all' => true, 'order' => [], 'selected' => [], 'orientation' => 'portrait',
        ]), 'mod_seminarplaner');
        $this->assertSame('portrait', seminarplaner_get_pdf_columns(7)['orientation']);
    }

    /**
     * Einstellungen von vorher (ohne Angabe) und Unsinn ergeben Querformat.
     */
    public function test_default_and_invalid_are_landscape(): void {
        $this->resetAfterTest();
        set_config('pdfcolumns_cmid_8', json_encode(['all' => true, 'order' => []]), 'mod_seminarplaner');
        $this->assertSame('landscape', seminarplaner_get_pdf_columns(8)['orientation']);
        set_config('pdfcolumns_cmid_9', json_encode(['all' => true, 'orientation' => 'quer']), 'mod_seminarplaner');
        $this->assertSame('landscape', seminarplaner_get_pdf_columns(9)['orientation']);
        $this->assertSame('landscape', seminarplaner_pdf_orientation(null));
    }
}
