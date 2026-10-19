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
 * Tests for the three-way merge of concurrent plan saves.
 *
 * @package    mod_seminarplaner
 * @copyright  2026 Guido Brombach <gibro@posteo.de>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

use mod_seminarplaner\local\sequence\sequence_merger;
use mod_seminarplaner\local\service\grid_service;

/**
 * Zwei Referent*innen bearbeiten gleichzeitig denselben Plan.
 *
 * @covers \mod_seminarplaner\local\sequence\sequence_merger
 * @covers \mod_seminarplaner\local\service\grid_service::save_user_state_merging
 */
final class sequence_merger_test extends advanced_testcase {
    /**
     * Ein Plan mit einem Tag und drei Einheiten am Vormittag.
     *
     * @return array
     */
    private function plan(): array {
        $placement = static function (string $titel, string $ea): array {
            return ['typ' => 'einheit', 'bausteinid' => null, 'einheitenauswahl' => $ea, 'titel' => $titel, 'dauer' => 30];
        };
        return [
            'config' => ['days' => ['Montag']],
            'meta' => ['title' => ''],
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
                    'p1' => $placement('Ankommen', 'ea1'),
                    'p2' => $placement('Erwartungen', 'ea2'),
                    'p3' => $placement('Input', 'ea3'),
                ],
                'einheitenauswahlen' => [
                    'ea1' => ['kandidaten' => ['c1'], 'aktiv' => 'c1'],
                    'ea2' => ['kandidaten' => ['c2'], 'aktiv' => 'c2'],
                    'ea3' => ['kandidaten' => ['c3'], 'aktiv' => 'c3'],
                ],
                'bausteine' => [],
            ],
        ];
    }

    /**
     * Basis, wie der Client sie mitschickt.
     *
     * @param array $state Full state.
     * @return array
     */
    private function base(array $state): array {
        return ['sequenz' => $state['sequenz'], 'config' => $state['config'], 'meta' => $state['meta']];
    }

    /**
     * Platzierungs-IDs des Vormittags.
     *
     * @param array $state Merged state.
     * @return array
     */
    private function vormittag(array $state): array {
        return $state['sequenz']['tage'][0]['anker']['vormittag']['sequenz'];
    }

    public function test_changes_to_different_placements_are_both_kept(): void {
        $base = $this->plan();
        $theirs = $base;
        $theirs['sequenz']['platzierungen']['p1']['titel'] = 'TAB-A Titel';
        $mine = $base;
        $mine['sequenz']['platzierungen']['p2']['titel'] = 'TAB-B Titel';

        $result = (new sequence_merger())->merge_state($this->base($base), $theirs, $mine);

        $this->assertSame('TAB-A Titel', $result['state']['sequenz']['platzierungen']['p1']['titel']);
        $this->assertSame('TAB-B Titel', $result['state']['sequenz']['platzierungen']['p2']['titel']);
        $this->assertSame([], $result['conflicts']);
    }

    public function test_different_fields_of_one_placement_are_both_kept(): void {
        $base = $this->plan();
        $theirs = $base;
        $theirs['sequenz']['platzierungen']['p2']['titel'] = 'Neuer Titel';
        $mine = $base;
        $mine['sequenz']['platzierungen']['p2']['dauer'] = 45;

        $result = (new sequence_merger())->merge_state($this->base($base), $theirs, $mine);

        $p2 = $result['state']['sequenz']['platzierungen']['p2'];
        $this->assertSame('Neuer Titel', $p2['titel']);
        $this->assertSame(45, $p2['dauer']);
        $this->assertSame([], $result['conflicts']);
    }

    public function test_same_field_changed_on_both_sides_keeps_first_save_and_reports(): void {
        $base = $this->plan();
        $theirs = $base;
        $theirs['sequenz']['platzierungen']['p2']['titel'] = 'Fassung A';
        $mine = $base;
        $mine['sequenz']['platzierungen']['p2']['titel'] = 'Fassung B';
        $mine['sequenz']['platzierungen']['p3']['dauer'] = 60;

        $result = (new sequence_merger())->merge_state($this->base($base), $theirs, $mine);

        $this->assertSame('Fassung A', $result['state']['sequenz']['platzierungen']['p2']['titel']);
        // Der Rest von Bs Aenderungen kommt trotzdem durch.
        $this->assertSame(60, $result['state']['sequenz']['platzierungen']['p3']['dauer']);
        $this->assertCount(1, $result['conflicts']);
        $this->assertSame('platzierungen', $result['conflicts'][0]['bereich']);
        $this->assertSame('p2', $result['conflicts'][0]['id']);
        $this->assertSame('Fassung A', $result['conflicts'][0]['titel']);
    }

    public function test_insertions_from_both_sides_land_in_order(): void {
        $base = $this->plan();
        $theirs = $base;
        $theirs['sequenz']['platzierungen']['pA'] = ['typ' => 'pause', 'titel' => 'Pause A', 'dauer' => 15];
        $theirs['sequenz']['tage'][0]['anker']['vormittag']['sequenz'] = ['p1', 'pA', 'p2', 'p3'];
        $mine = $base;
        $mine['sequenz']['platzierungen']['pB'] = ['typ' => 'pause', 'titel' => 'Pause B', 'dauer' => 15];
        $mine['sequenz']['tage'][0]['anker']['vormittag']['sequenz'] = ['p1', 'p2', 'p3', 'pB'];

        $result = (new sequence_merger())->merge_state($this->base($base), $theirs, $mine);

        $this->assertSame(['p1', 'pA', 'p2', 'p3', 'pB'], $this->vormittag($result['state']));
        $this->assertArrayHasKey('pA', $result['state']['sequenz']['platzierungen']);
        $this->assertArrayHasKey('pB', $result['state']['sequenz']['platzierungen']);
        $this->assertSame([], $result['conflicts']);
    }

    public function test_reorder_on_one_side_and_removal_on_the_other(): void {
        $base = $this->plan();
        $theirs = $base;
        unset($theirs['sequenz']['platzierungen']['p1']);
        $theirs['sequenz']['tage'][0]['anker']['vormittag']['sequenz'] = ['p2', 'p3'];
        $mine = $base;
        $mine['sequenz']['tage'][0]['anker']['vormittag']['sequenz'] = ['p3', 'p2', 'p1'];

        $result = (new sequence_merger())->merge_state($this->base($base), $theirs, $mine);

        $this->assertSame(['p3', 'p2'], $this->vormittag($result['state']));
        $this->assertArrayNotHasKey('p1', $result['state']['sequenz']['platzierungen']);
        $this->assertSame([], $result['conflicts']);
    }

    public function test_move_to_another_anchor_is_kept(): void {
        $base = $this->plan();
        $theirs = $base;
        $theirs['sequenz']['platzierungen']['p1']['titel'] = 'Ankommen (neu)';
        $mine = $base;
        $mine['sequenz']['tage'][0]['anker']['vormittag']['sequenz'] = ['p1', 'p2'];
        $mine['sequenz']['tage'][0]['anker']['nachmittag']['sequenz'] = ['p3'];

        $result = (new sequence_merger())->merge_state($this->base($base), $theirs, $mine);

        $this->assertSame(['p1', 'p2'], $this->vormittag($result['state']));
        $this->assertSame(['p3'], $result['state']['sequenz']['tage'][0]['anker']['nachmittag']['sequenz']);
        $this->assertSame('Ankommen (neu)', $result['state']['sequenz']['platzierungen']['p1']['titel']);
    }

    public function test_deleted_on_one_side_edited_on_the_other_stays_in_place(): void {
        $base = $this->plan();
        $theirs = $base;
        $theirs['sequenz']['platzierungen']['p2']['titel'] = 'Noch gebraucht';
        $mine = $base;
        unset($mine['sequenz']['platzierungen']['p2']);
        $mine['sequenz']['tage'][0]['anker']['vormittag']['sequenz'] = ['p1', 'p3'];

        $result = (new sequence_merger())->merge_state($this->base($base), $theirs, $mine);

        $this->assertSame('Noch gebraucht', $result['state']['sequenz']['platzierungen']['p2']['titel']);
        $this->assertSame(['p1', 'p2', 'p3'], $this->vormittag($result['state']));
        $this->assertSame('p2', $result['conflicts'][0]['id']);
    }

    public function test_same_new_id_on_both_sides_never_duplicates_the_placement(): void {
        $base = $this->plan();
        $theirs = $base;
        $theirs['sequenz']['platzierungen']['px4'] = ['typ' => 'pause', 'titel' => 'Pause A', 'dauer' => 15];
        $theirs['sequenz']['tage'][0]['anker']['vormittag']['sequenz'] = ['px4', 'p1', 'p2', 'p3'];
        $mine = $base;
        $mine['sequenz']['platzierungen']['px4'] = ['typ' => 'pause', 'titel' => 'Pause B', 'dauer' => 10];
        $mine['sequenz']['tage'][0]['anker']['vormittag']['sequenz'] = ['p1', 'p2', 'p3', 'px4'];

        $result = (new sequence_merger())->merge_state($this->base($base), $theirs, $mine);

        $this->assertSame('Pause A', $result['state']['sequenz']['platzierungen']['px4']['titel']);
        $this->assertSame(1, count(array_keys($this->vormittag($result['state']), 'px4')));
        $this->assertNotEmpty($result['conflicts']);
    }

    public function test_config_changed_by_one_side_only_is_kept(): void {
        $base = $this->plan();
        $theirs = $base;
        $theirs['config']['days'] = ['Montag', 'Dienstag'];
        $mine = $base;
        $mine['sequenz']['platzierungen']['p1']['dauer'] = 20;

        $result = (new sequence_merger())->merge_state($this->base($base), $theirs, $mine);

        $this->assertSame(['Montag', 'Dienstag'], $result['state']['config']['days']);
        $this->assertSame(20, $result['state']['sequenz']['platzierungen']['p1']['dauer']);
    }

    /**
     * Der im Browser nachgestellte Fall, durch den echten Speicherpfad: zwei
     * Tabs laden denselben Stand, A speichert, B speichert danach mit dem
     * alten Hash. Vorher ersetzte Bs Sequenz die von A vollstaendig.
     */
    public function test_second_save_from_stale_tab_no_longer_drops_the_first(): void {
        $this->resetAfterTest(true);
        $service = new grid_service();
        $gridid = $service->create_grid(2001, 'Gleichzeitig', 5);
        $loaded = $this->plan();
        $hash = $service->save_user_state($gridid, 5, $loaded);
        $stored = $service->get_user_state($gridid, 5)['state'];
        $base = $this->base($stored);

        $taba = $stored;
        $taba['sequenz']['platzierungen']['p1']['titel'] = 'TAB-A Titel';
        $first = $service->save_user_state_merging($gridid, 5, $taba, $hash, $base);
        $this->assertFalse($first['merged']);

        $tabb = $stored;
        $tabb['sequenz']['platzierungen']['p2']['titel'] = 'TAB-B Titel';
        $second = $service->save_user_state_merging($gridid, 6, $tabb, $hash, $base);

        $this->assertTrue($second['merged']);
        $this->assertSame([], $second['conflicts']);
        $final = $service->get_user_state($gridid, 5)['state'];
        $this->assertSame('TAB-A Titel', $final['sequenz']['platzierungen']['p1']['titel']);
        $this->assertSame('TAB-B Titel', $final['sequenz']['platzierungen']['p2']['titel']);
        // Der Client bekommt den zusammengefuehrten Stand zurueck.
        $this->assertSame(json_decode(json_encode($final), true), json_decode($second['statejson'], true));
    }

    /**
     * Ohne mitgeschickte Basis (Alt-Client) bleibt das bisherige Verhalten.
     */
    public function test_save_without_base_keeps_legacy_behaviour(): void {
        $this->resetAfterTest(true);
        $service = new grid_service();
        $gridid = $service->create_grid(2002, 'Alt-Client', 5);
        $hash = $service->save_user_state($gridid, 5, $this->plan());
        $stored = $service->get_user_state($gridid, 5)['state'];

        $taba = $stored;
        $taba['sequenz']['platzierungen']['p1']['titel'] = 'TAB-A Titel';
        $service->save_user_state($gridid, 5, $taba, $hash);
        $tabb = $stored;
        $tabb['sequenz']['platzierungen']['p2']['titel'] = 'TAB-B Titel';
        $result = $service->save_user_state_merging($gridid, 6, $tabb, $hash, null);

        $this->assertTrue($result['merged']);
        $final = $service->get_user_state($gridid, 5)['state'];
        $this->assertSame('Ankommen', $final['sequenz']['platzierungen']['p1']['titel']);
    }
}
