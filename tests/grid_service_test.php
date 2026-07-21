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

    /**
     * D67: Die Kopie traegt den Zustand des Originals, ist aber ein eigener Plan.
     */
    public function test_copy_grid_duplicates_state_into_an_independent_plan(): void {
        $this->resetAfterTest(true);

        $service = new grid_service();
        $sourceid = $service->create_grid(1006, 'Grundkurs', 4, 'Beschreibung');
        $service->save_user_state($sourceid, 4, [
            'config' => ['days' => ['Montag'], 'ankerzeiten' => ['vormittag' => ['start' => '09:00']]],
            'seminarziele' => [['id' => 'z1', 'text' => 'Ziel eins']],
        ]);

        $copy = $service->copy_grid(1006, $sourceid, 4);

        $this->assertGreaterThan(0, $copy['gridid']);
        $this->assertNotSame($sourceid, $copy['gridid']);
        $this->assertSame('Grundkurs (Kopie)', $copy['name']);

        // Anker-Zeiten (D45) und Seminarziele (D61) sind mitgekommen.
        $copied = $service->get_user_state($copy['gridid'], 4);
        $this->assertSame('09:00', $copied['state']['config']['ankerzeiten']['vormittag']['start']);
        $this->assertSame('Ziel eins', $copied['state']['seminarziele'][0]['text']);
        $this->assertSame('Beschreibung', $service->list_grids(1006)[$copy['gridid']]->description);

        // Eigenstaendig: eine Aenderung an der Kopie laesst das Original kalt.
        $service->save_user_state($copy['gridid'], 4, ['seminarziele' => [['id' => 'z1', 'text' => 'Anders']]]);
        $original = $service->get_user_state($sourceid, 4);
        $this->assertSame('Ziel eins', $original['state']['seminarziele'][0]['text']);
    }

    /**
     * D67: Mehrfaches Kopieren zaehlt hoch, statt gleichnamige Plaene zu erzeugen.
     */
    public function test_copy_grid_names_stay_distinguishable(): void {
        $this->resetAfterTest(true);

        $service = new grid_service();
        $sourceid = $service->create_grid(1007, 'Grundkurs', 4);
        $service->save_user_state($sourceid, 4, ['config' => ['days' => ['Montag']]]);

        $first = $service->copy_grid(1007, $sourceid, 4);
        $second = $service->copy_grid(1007, $sourceid, 4);
        // Die Kopie einer Kopie stapelt den Zusatz nicht.
        $third = $service->copy_grid(1007, $first['gridid'], 4);

        $this->assertSame('Grundkurs (Kopie)', $first['name']);
        $this->assertSame('Grundkurs (Kopie 2)', $second['name']);
        $this->assertSame('Grundkurs (Kopie 3)', $third['name']);
    }

    /**
     * D35: Die Uebersetzungs-Anzeige gehoert zum Umstieg, nicht zu einer frischen Kopie.
     */
    public function test_copy_grid_marks_intro_as_seen(): void {
        $this->resetAfterTest(true);

        $service = new grid_service();
        $sourceid = $service->create_grid(1008, 'Grundkurs', 4);
        $service->save_user_state($sourceid, 4, ['config' => ['days' => ['Montag']]]);

        $copy = $service->copy_grid(1008, $sourceid, 4);

        $this->assertTrue($service->get_intro_seen($copy['gridid'], 4));
    }

    /**
     * D9/D19: Baustein-Stammdaten kommen auch ohne den einmaligen Upgrade-Schritt an.
     *
     * Der Fehler dahinter: die Anreicherung lief nur im Schritt 2026070908,
     * jede spaeter abgeleitete Sequenz blieb ohne Unterthemen und ohne die
     * ehemaligen Lernziele des Bausteins.
     */
    public function test_baustein_master_data_arrives_without_the_upgrade_step(): void {
        global $DB;
        $this->resetAfterTest(true);

        $cmid = 1011;
        $DB->insert_record('kgen_planning_state', (object)[
            'cmid' => $cmid,
            'statejson' => json_encode(['units' => [[
                'id' => 'u1',
                'title' => 'Einstieg',
                'topics' => 'Erwartungen; Ablauf',
                'objectives' => 'Die Teilnehmenden können den Anlass benennen.',
            ]]]),
            'versionhash' => 'h',
            'timecreated' => time(),
            'timemodified' => time(),
            'createdby' => 4,
            'modifiedby' => 4,
        ]);

        $service = new grid_service();
        $gridid = $service->create_grid($cmid, 'Nach dem Upgrade importiert', 4);
        // Sequenz mit einem Baustein, der auf die Planungs-Unit zeigt, aber
        // (wie nach einem Import) noch keine Stammdaten traegt.
        $service->save_user_state($gridid, 4, ['sequenz' => [
            'version' => 1,
            'tage' => [],
            'platzierungen' => [],
            'einheitenauswahlen' => [],
            'bausteine' => ['b1' => [
                'titel' => '',
                'unterthemen' => '',
                'themenplanreferenz' => '',
                'quelle' => ['unitid' => 'u1'],
            ]],
        ]]);

        $baustein = $service->get_user_state($gridid, 4)['state']['sequenz']['bausteine']['b1'];
        $this->assertSame('Erwartungen; Ablauf', $baustein['unterthemen']);
        $this->assertSame('Die Teilnehmenden können den Anlass benennen.', $baustein['themenplanreferenz']);
    }

    /**
     * D9/D19: Bewusst geleerte Felder bleiben leer - die Anreicherung laeuft nur einmal.
     */
    public function test_baustein_enrichment_does_not_refill_cleared_fields(): void {
        global $DB;
        $this->resetAfterTest(true);

        $cmid = 1012;
        $DB->insert_record('kgen_planning_state', (object)[
            'cmid' => $cmid,
            'statejson' => json_encode(['units' => [[
                'id' => 'u1', 'title' => 'Einstieg', 'topics' => 'Erwartungen', 'objectives' => 'Altes Lernziel',
            ]]]),
            'versionhash' => 'h',
            'timecreated' => time(),
            'timemodified' => time(),
            'createdby' => 4,
            'modifiedby' => 4,
        ]);

        $service = new grid_service();
        $gridid = $service->create_grid($cmid, 'Plan', 4);
        $base = ['sequenz' => [
            'version' => 1, 'tage' => [], 'platzierungen' => [], 'einheitenauswahlen' => [],
            'bausteine' => ['b1' => [
                'titel' => '', 'unterthemen' => '', 'themenplanreferenz' => '', 'quelle' => ['unitid' => 'u1'],
            ]],
        ]];
        $service->save_user_state($gridid, 4, $base);

        // Erste Uebernahme hat stattgefunden ...
        $state = $service->get_user_state($gridid, 4)['state'];
        $this->assertSame('Erwartungen', $state['sequenz']['bausteine']['b1']['unterthemen']);

        // ... jetzt leert die Referentin das Feld bewusst.
        $state['sequenz']['bausteine']['b1']['unterthemen'] = '';
        $service->save_user_state($gridid, 4, $state);

        $after = $service->get_user_state($gridid, 4)['state']['sequenz']['bausteine']['b1'];
        $this->assertSame('', $after['unterthemen'], 'Geleertes Feld darf nicht wieder aufgefuellt werden.');
    }

    /**
     * Ein Plan aus einer anderen Aktivitaet laesst sich nicht herueberkopieren.
     */
    public function test_copy_grid_rejects_foreign_plan(): void {
        $this->resetAfterTest(true);

        $service = new grid_service();
        $foreignid = $service->create_grid(1009, 'Fremd', 4);

        $this->expectException(\invalid_parameter_exception::class);
        $service->copy_grid(1010, $foreignid, 4);
    }
}
