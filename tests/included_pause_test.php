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
 * Tests for breaks included in a placed unit (D88).
 *
 * @package    mod_seminarplaner
 * @copyright  2026 Guido Brombach <gibro@posteo.de>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

use mod_seminarplaner\local\sequence\roterfaden_model;
use mod_seminarplaner\local\sequence\sequence_merger;
use mod_seminarplaner\local\sequence\sequence_state;
use mod_seminarplaner\local\service\grid_service;

/**
 * Eine Pause in einer eingeplanten Seminareinheit (D88).
 *
 * Die Pause haengt an der Platzierung, hat nur eine Dauer (die Lage bestimmt
 * die Gruppe) und verlaengert die Einheit: `dauer` bleibt die Arbeitszeit.
 *
 * @covers \mod_seminarplaner\local\sequence\sequence_state
 * @covers \mod_seminarplaner\local\sequence\roterfaden_model
 * @covers \mod_seminarplaner\local\sequence\sequence_merger
 * @covers \mod_seminarplaner\local\service\grid_service
 */
final class included_pause_test extends advanced_testcase {
    /**
     * Ein Tag: Einheit mit eingeschlossener Pause, danach eine zweite Einheit.
     *
     * @return array
     */
    private function plan(): array {
        return [
            'config' => [
                'days' => ['Montag'],
                'ankerzeiten' => [
                    'vormittag' => ['start' => '09:00', 'end' => '12:30'],
                    'nachmittag' => ['start' => '13:30', 'end' => '17:00'],
                ],
            ],
            'meta' => ['title' => ''],
            'plan' => ['days' => ['Montag' => []]],
            'sequenz' => [
                'version' => 1,
                'tage' => [[
                    'tag' => 1,
                    'bezeichnung' => 'Montag',
                    'anker' => [
                        'vormittag' => ['sequenz' => ['p1', 'p2']],
                        'nachmittag' => ['sequenz' => []],
                    ],
                ]],
                'platzierungen' => [
                    'p1' => [
                        'typ' => 'einheit', 'bausteinid' => null, 'einheitenauswahl' => 'ea1',
                        'titel' => 'Planspiel', 'dauer' => 90, 'inklpause' => 15,
                    ],
                    'p2' => [
                        'typ' => 'einheit', 'bausteinid' => null, 'einheitenauswahl' => 'ea2',
                        'titel' => 'Auswertung', 'dauer' => 45,
                    ],
                ],
                'einheitenauswahlen' => [
                    'ea1' => ['kandidaten' => ['c1'], 'aktiv' => 'c1'],
                    'ea2' => ['kandidaten' => ['c2'], 'aktiv' => 'c2'],
                ],
                'bausteine' => [],
            ],
        ];
    }

    public function test_included_pause_counts_only_on_units(): void {
        $this->assertSame(15, sequence_state::included_pause(['typ' => 'einheit', 'dauer' => 90, 'inklpause' => 15]));
        $this->assertSame(0, sequence_state::included_pause(['typ' => 'einheit', 'dauer' => 90]));
        $this->assertSame(0, sequence_state::included_pause(['typ' => 'einheit', 'inklpause' => -5]));
        // Eine Pause schliesst keine Pause ein.
        $this->assertSame(0, sequence_state::included_pause(['typ' => 'pause', 'dauer' => 15, 'inklpause' => 15]));
        $this->assertSame(0, sequence_state::included_pause(null));
    }

    public function test_validate_accepts_the_field_on_units_only(): void {
        $sequenz = $this->plan()['sequenz'];
        $this->assertSame([], sequence_state::validate($sequenz));

        $sequenz['platzierungen']['p1']['inklpause'] = -1;
        $sequenz['platzierungen']['p3'] = ['typ' => 'pause', 'titel' => 'Pause', 'dauer' => 15, 'inklpause' => 10];
        $sequenz['tage'][0]['anker']['nachmittag']['sequenz'] = ['p3'];
        $problems = sequence_state::validate($sequenz);

        $this->assertCount(2, $problems);
        $this->assertStringContainsString('p1', $problems[0]);
        $this->assertStringContainsString('p3', $problems[1]);
    }

    public function test_roterfaden_lengthens_the_unit_and_notes_the_pause(): void {
        $days = roterfaden_model::build_days($this->plan());
        $blocks = $days[0]['anchors'][0]['blocks'];

        // 90 Min. Arbeit + 15 Min. Pause = 105 Min.; die Folgeeinheit beginnt 10:45.
        $this->assertSame(105, $blocks[0]['minutes']);
        $this->assertSame(15, $blocks[0]['pause']);
        $this->assertSame(105, $blocks[0]['themen'][0]['minutes']);
        $this->assertSame(15, $blocks[0]['themen'][0]['pause']);
        $this->assertSame((10 * 60) + 45, $blocks[1]['startMin']);
        $this->assertSame(0, $blocks[1]['pause']);
    }

    public function test_published_snapshot_keeps_the_pause_and_shifts_the_times(): void {
        $this->resetAfterTest(true);
        $service = new grid_service();
        $gridid = $service->create_grid(1088, 'Pausenplan', 7);
        $state = $this->plan();
        $service->save_user_state($gridid, 7, $state);
        $service->publish_roterfaden(1088, $gridid, $state, 7);

        $published = $service->get_roterfaden_state(1088)['state'];
        // Das Handout entsteht aus diesem Schnappschuss - die Pause muss drin sein.
        $this->assertSame(15, $published['sequenz']['platzierungen']['p1']['inklpause']);

        $items = $published['plan']['days']['Montag'];
        $this->assertSame(9 * 60, $items[0]['startMin']);
        $this->assertSame((10 * 60) + 45, $items[0]['endMin']);
        $this->assertSame((10 * 60) + 45, $items[1]['startMin']);
    }

    public function test_concurrent_saves_keep_pause_and_duration_change(): void {
        $base = $this->plan();
        unset($base['sequenz']['platzierungen']['p1']['inklpause']);
        // A schliesst eine Pause ein, B aendert gleichzeitig die Arbeitszeit.
        $theirs = $base;
        $theirs['sequenz']['platzierungen']['p1']['inklpause'] = 20;
        $mine = $base;
        $mine['sequenz']['platzierungen']['p1']['dauer'] = 75;

        $basesections = ['sequenz' => $base['sequenz'], 'config' => $base['config'], 'meta' => $base['meta']];
        $result = (new sequence_merger())->merge_state($basesections, $theirs, $mine);

        $p1 = $result['state']['sequenz']['platzierungen']['p1'];
        $this->assertSame(20, $p1['inklpause']);
        $this->assertSame(75, $p1['dauer']);
        $this->assertSame([], $result['conflicts']);
    }

    public function test_removing_the_pause_survives_a_concurrent_title_change(): void {
        $base = $this->plan();
        $theirs = $base;
        $theirs['sequenz']['platzierungen']['p1']['titel'] = 'Planspiel (neu)';
        $mine = $base;
        unset($mine['sequenz']['platzierungen']['p1']['inklpause']);

        $basesections = ['sequenz' => $base['sequenz'], 'config' => $base['config'], 'meta' => $base['meta']];
        $result = (new sequence_merger())->merge_state($basesections, $theirs, $mine);

        $p1 = $result['state']['sequenz']['platzierungen']['p1'];
        $this->assertArrayNotHasKey('inklpause', $p1);
        $this->assertSame('Planspiel (neu)', $p1['titel']);
        $this->assertSame([], $result['conflicts']);
    }

    public function test_both_sides_changing_the_pause_keeps_the_first_save(): void {
        $base = $this->plan();
        $theirs = $base;
        $theirs['sequenz']['platzierungen']['p1']['inklpause'] = 10;
        $mine = $base;
        $mine['sequenz']['platzierungen']['p1']['inklpause'] = 30;

        $basesections = ['sequenz' => $base['sequenz'], 'config' => $base['config'], 'meta' => $base['meta']];
        $result = (new sequence_merger())->merge_state($basesections, $theirs, $mine);

        $this->assertSame(10, $result['state']['sequenz']['platzierungen']['p1']['inklpause']);
        $this->assertCount(1, $result['conflicts']);
        $this->assertSame('p1', $result['conflicts'][0]['id']);
    }
}
