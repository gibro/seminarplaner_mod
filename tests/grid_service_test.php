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
 * Unit tests for grid service.
 *
 * @package    mod_seminarplaner
 * @copyright  2026 Guido Brombach <gibro@posteo.de>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

use mod_seminarplaner\local\service\grid_service;

/**
 * DB-backed tests for grid service.
 */
final class grid_service_test extends advanced_testcase {
    public function test_create_and_list_grid(): void {
        $this->resetAfterTest(true);

        $service = new grid_service();
        $gridid = $service->create_grid(1001, 'Grid A', 2, 'Desc');

        $this->assertGreaterThan(0, $gridid);
        $grids = $service->list_grids(1001);
        $this->assertCount(1, $grids);
        $this->assertSame('Grid A', $grids[$gridid]->name);
    }

    public function test_save_and_load_user_state(): void {
        $this->resetAfterTest(true);

        $service = new grid_service();
        $gridid = $service->create_grid(1002, 'Grid B', 3);

        $hash = $service->save_user_state($gridid, 3, ['x' => 1]);
        $this->assertNotEmpty($hash);

        $state = $service->get_user_state($gridid, 3);
        // Die gespeicherten Nutzerdaten kommen unveraendert zurueck.
        $this->assertSame(1, $state['state']['x']);
        // D43: der Lesepfad ergaenzt einen fehlenden Sequenz-Abschnitt (Self-Heal
        // fuer Zustaende aus Alt-Importen, die die Sequenzansicht sonst leer
        // liessen). Der Zustand traegt deshalb zusaetzlich 'sequenz' - frueher
        // erwartete dieser Test exakt ['x' => 1] und schlug seitdem fehl.
        $this->assertArrayHasKey('sequenz', $state['state']);
        $this->assertNotEmpty($state['versionhash']);
    }

    public function test_save_state_merges_stale_non_overlapping_changes(): void {
        $this->resetAfterTest(true);

        $service = new grid_service();
        $gridid = $service->create_grid(1003, 'Grid C', 4);
        $firststate = [
            'plan' => [
                'days' => [
                    'Montag' => [
                        ['uid' => 'a', 'startMin' => 540, 'endMin' => 600],
                    ],
                ],
            ],
        ];
        $firsthash = $service->save_user_state($gridid, 4, $firststate);

        $secondstate = [
            'plan' => [
                'days' => [
                    'Dienstag' => [
                        ['uid' => 'b', 'startMin' => 600, 'endMin' => 660],
                    ],
                ],
            ],
        ];
        $secondhash = $service->save_user_state($gridid, 4, $secondstate, $firsthash . 'mismatch');

        $this->assertNotSame($firsthash, $secondhash);
        $state = $service->get_user_state($gridid, 4);
        $this->assertCount(1, $state['state']['plan']['days']['Montag']);
        $this->assertCount(1, $state['state']['plan']['days']['Dienstag']);
    }

    public function test_delete_grid_removes_it_from_active_list(): void {
        $this->resetAfterTest(true);

        $service = new grid_service();
        $keepid = $service->create_grid(1004, 'Keep', 8);
        $dropid = $service->create_grid(1004, 'Drop', 8);
        $this->assertCount(2, $service->list_grids(1004));

        $deleted = $service->delete_grid(1004, $dropid, 8);
        $this->assertTrue($deleted);

        $grids = $service->list_grids(1004);
        $this->assertCount(1, $grids);
        $this->assertArrayHasKey($keepid, $grids);
        $this->assertArrayNotHasKey($dropid, $grids);
    }

    /**
     * Beim Veröffentlichen projiziert der Service die Sequenz nach plan.days.
     * Ein Baustein bündelt dabei mehrere Platzierungen zu EINEM Eintrag — dessen
     * Zeitspanne muss alle seine Einheiten umfassen, nicht nur die erste.
     */
    public function test_publish_projects_baustein_with_full_duration(): void {
        $this->resetAfterTest(true);

        $service = new grid_service();
        $gridid = $service->create_grid(1006, 'Sequenzplan', 7);

        $state = [
            'config' => [
                'days' => ['Montag'],
                'ankerzeiten' => [
                    'vormittag' => ['start' => '08:30', 'end' => '12:30'],
                    'nachmittag' => ['start' => '13:15', 'end' => '17:30'],
                ],
            ],
            'plan' => ['days' => ['Montag' => []]],
            'sequenz' => [
                'version' => 1,
                'tage' => [[
                    'tag' => 1,
                    'bezeichnung' => 'Montag',
                    'anker' => [
                        'vormittag' => ['sequenz' => ['p1', 'p2', 'p3']],
                        'nachmittag' => ['sequenz' => []],
                    ],
                ]],
                'platzierungen' => [
                    // Zwei Einheiten desselben Bausteins (45 + 60 Minuten) ….
                    'p1' => ['typ' => 'einheit', 'bausteinid' => 'b1', 'titel' => 'Teil 1', 'dauer' => 45],
                    'p2' => ['typ' => 'einheit', 'bausteinid' => 'b1', 'titel' => 'Teil 2', 'dauer' => 60],
                    // ... gefolgt von einer freien Einheit.
                    'p3' => ['typ' => 'einheit', 'titel' => 'Fallbeispiel', 'dauer' => 30],
                ],
                'bausteine' => ['b1' => ['titel' => 'Grundlagen', 'unterthemen' => '']],
                'einheitenauswahlen' => [],
            ],
        ];
        $service->save_user_state($gridid, 7, $state);
        $service->publish_roterfaden(1006, $gridid, $state, 7);

        $published = $service->get_roterfaden_state(1006)['state'];
        $items = $published['plan']['days']['Montag'];

        $this->assertCount(2, $items);
        // Der Baustein-Block läuft von 08:30 bis 10:15 (105 Minuten, nicht 45).
        $this->assertSame('Grundlagen', $items[0]['title']);
        $this->assertSame(510, $items[0]['startMin']);
        $this->assertSame(615, $items[0]['endMin']);
        // Die folgende Einheit schließt direkt an den vollen Baustein an.
        $this->assertSame('Fallbeispiel', $items[1]['title']);
        $this->assertSame(615, $items[1]['startMin']);
        $this->assertSame(645, $items[1]['endMin']);
    }

    public function test_set_roterfaden_visibility_unpublishes(): void {
        $this->resetAfterTest(true);

        $service = new grid_service();
        $gridid = $service->create_grid(1005, 'Published', 9);
        $service->publish_roterfaden(1005, $gridid, ['units' => [['uid' => 'a']]], 9);

        $this->assertTrue($service->get_roterfaden_state(1005)['ispublished']);

        $this->assertTrue($service->set_roterfaden_visibility(1005, false, 9));
        $this->assertFalse($service->get_roterfaden_state(1005)['ispublished']);
    }
}
