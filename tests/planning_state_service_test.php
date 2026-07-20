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
 * Unit tests for planning state service.
 *
 * @package    mod_seminarplaner
 * @copyright  2026 Guido Brombach <gibro@posteo.de>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

use mod_seminarplaner\local\service\planning_state_service;

/**
 * DB-backed tests for planning state service.
 */
final class planning_state_service_test extends advanced_testcase {
    public function test_save_state_removes_non_reciprocal_slotkeys(): void {
        $this->resetAfterTest(true);

        $service = new planning_state_service();
        $hash = $service->save_state(2101, [
            'units' => [
                [
                    'id' => 'u1',
                    'title' => 'Baustein A',
                    'duration' => 60,
                    'slotkey' => 'alt-a',
                    'active' => true,
                    'methods' => [],
                ],
                [
                    'id' => 'u2',
                    'title' => 'Baustein B',
                    'duration' => 60,
                    'slotkey' => '',
                    'active' => true,
                    'methods' => [],
                ],
            ],
            'slotorder' => [],
        ], 15);

        $this->assertNotEmpty($hash);
        $loaded = $service->get_state(2101);
        $units = (array)($loaded['state']['units'] ?? []);
        $this->assertCount(2, $units);
        $this->assertSame('', (string)($units[0]['slotkey'] ?? ''));
        $this->assertSame('', (string)($units[1]['slotkey'] ?? ''));
    }

    public function test_save_state_keeps_reciprocal_alternative_groups(): void {
        $this->resetAfterTest(true);

        $service = new planning_state_service();
        $hash = $service->save_state(2102, [
            'units' => [
                [
                    'id' => 'u1',
                    'title' => 'Baustein A',
                    'duration' => 60,
                    'slotkey' => 'alt-a',
                    'active' => true,
                    'methods' => [],
                ],
                [
                    'id' => 'u2',
                    'title' => 'Baustein B',
                    'duration' => 60,
                    'slotkey' => 'alt-a',
                    'active' => false,
                    'methods' => [],
                ],
            ],
            'slotorder' => [],
        ], 16);

        $this->assertNotEmpty($hash);
        $loaded = $service->get_state(2102);
        $units = (array)($loaded['state']['units'] ?? []);
        $this->assertCount(2, $units);
        $this->assertSame('alt-a', (string)($units[0]['slotkey'] ?? ''));
        $this->assertSame('alt-a', (string)($units[1]['slotkey'] ?? ''));
    }
}
