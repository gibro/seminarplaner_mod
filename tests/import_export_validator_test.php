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
 * Unit tests for import export validator.
 *
 * @package    mod_seminarplaner
 * @copyright  2026 Guido Brombach <gibro@posteo.de>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

use mod_seminarplaner\local\service\import_export_validator;

/**
 * Tests for import/export validator.
 */
final class import_export_validator_test extends advanced_testcase {
    public function test_validate_legacy_row_requires_title(): void {
        $validator = new import_export_validator();
        $result = $validator->validate_legacy_row(['Kurzbeschreibung' => 'X'], false);

        $this->assertNotEmpty($result['errors']);
        $this->assertStringContainsString('Titel', $result['errors'][0]);
    }

    public function test_validate_legacy_row_maps_known_fields(): void {
        $validator = new import_export_validator();
        $row = [
            'Titel' => 'Methode 1',
            'Kurzbeschreibung' => 'Kurz',
            'Zeitbedarf' => '30',
        ];

        $result = $validator->validate_legacy_row($row, true);
        $this->assertEmpty($result['errors']);
        $this->assertSame('Methode 1', $result['mapped']['title']);
        $this->assertSame('Kurz', $result['mapped']['kurzbeschreibung']);
        $this->assertSame('30', $result['mapped']['zeitbedarf']);
    }

    public function test_validate_export_row_warns_when_title_missing_non_strict(): void {
        $validator = new import_export_validator();
        $result = $validator->validate_export_row(['kurzbeschreibung' => 'X'], false);

        $this->assertEmpty($result['errors']);
        $this->assertNotEmpty($result['warnings']);
    }

    public function test_validate_export_row_errors_when_title_missing_strict(): void {
        $validator = new import_export_validator();
        $result = $validator->validate_export_row(['kurzbeschreibung' => 'X'], true);

        $this->assertNotEmpty($result['errors']);
    }
}
