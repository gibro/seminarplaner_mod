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
 * Tests for the read endpoint behind the live presenter view (D69).
 *
 * @package    mod_seminarplaner
 * @copyright  2026 Guido Brombach <gibro@posteo.de>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

use mod_seminarplaner\external\api;
use mod_seminarplaner\local\service\grid_service;
use mod_seminarplaner\local\service\method_card_service;

/**
 * DB-backed tests for mod_seminarplaner_get_live_state.
 *
 * The live view is open to people who only run a seminar, not just to those who
 * may edit it. That is why it has its own endpoint and its own capability - the
 * tests below pin down both the payload and who gets to see it.
 */
final class live_state_test extends advanced_testcase {
    /** @var int Course module id of the activity under test. */
    private int $cmid = 0;

    /** @var int Module context id of that activity. */
    private int $contextid = 0;

    /** @var int Course id the activity lives in. */
    private int $courseid = 0;

    protected function setUp(): void {
        parent::setUp();

        $this->resetAfterTest(true);
        $this->setAdminUser();

        $generator = $this->getDataGenerator();
        $course = $generator->create_course();
        $module = $generator->create_module('seminarplaner', ['course' => $course->id, 'name' => 'Durchführung']);
        $cm = get_coursemodule_from_instance('seminarplaner', $module->id);

        $this->courseid = (int)$course->id;
        $this->cmid = (int)$cm->id;
        $this->contextid = (int)context_module::instance($cm->id)->id;
    }

    /**
     * Store one seminar unit carrying the fields the prompter shows.
     *
     * @return string Id of the stored unit.
     */
    private function store_unit(): string {
        $service = new method_card_service();
        $service->save_methods($this->cmid, (int)$GLOBALS['USER']->id, $this->contextid, [[
            'id' => 'unit1',
            'titel' => 'Kennenlernrunde',
            'seminarphase' => ['Orientierung'],
            'zeitbedarf' => '45',
            'ablauf' => '<h3>Ankommen</h3><p>Stuhlkreis bilden.</p><h3>Vorstellen</h3><p>Reihum.</p>',
            'materialtechnik' => '<ul><li>Flipchart</li><li>Marker</li></ul>',
            'kurzbeschreibung' => '<p>Nicht Teil der Live-Ansicht.</p>',
            'risiken' => '<p>Auch nicht.</p>',
        ]]);

        return 'unit1';
    }

    /**
     * Store a plan whose sequence places that unit once.
     *
     * @param string $unitid Id of the placed seminar unit.
     * @return int Grid id.
     */
    private function store_plan(string $unitid): int {
        $service = new grid_service();
        $gridid = $service->create_grid($this->cmid, 'Tagesseminar', (int)$GLOBALS['USER']->id);
        $service->save_user_state($gridid, (int)$GLOBALS['USER']->id, [
            'config' => [
                'days' => ['Montag'],
                'ankerzeiten' => [
                    'vormittag' => ['start' => '09:00', 'end' => '12:30'],
                    'nachmittag' => ['start' => '13:30', 'end' => '17:00'],
                ],
            ],
            'sequenz' => [
                'version' => 1,
                'tage' => [[
                    'tag' => 1,
                    'bezeichnung' => 'Montag',
                    'anker' => [
                        'vormittag' => ['sequenz' => ['px1']],
                        'nachmittag' => ['sequenz' => []],
                    ],
                ]],
                'platzierungen' => ['px1' => [
                    'typ' => 'einheit',
                    'titel' => 'Kennenlernrunde',
                    'dauer' => 45,
                    'bausteinid' => null,
                    'einheitenauswahl' => 'ea1',
                ]],
                'einheitenauswahlen' => ['ea1' => ['kandidaten' => [$unitid], 'aktiv' => $unitid]],
                'bausteine' => [],
            ],
        ]);

        return $gridid;
    }

    public function test_returns_plan_sequence_and_live_fields(): void {
        $unitid = $this->store_unit();
        $gridid = $this->store_plan($unitid);

        $result = api::get_live_state($this->cmid, 0);

        // Ohne gridid faellt die Wahl auf den ersten Plan der Aktivitaet.
        $this->assertSame($gridid, $result['gridid']);
        $this->assertSame([['id' => $gridid, 'name' => 'Tagesseminar']], $result['grids']);

        $state = json_decode($result['statejson'], true);
        $this->assertSame(['px1'], $state['sequenz']['tage'][0]['anker']['vormittag']['sequenz']);
        $this->assertSame(45, $state['sequenz']['platzierungen']['px1']['dauer']);

        $cards = json_decode($result['cardsjson'], true);
        $this->assertCount(1, $cards);
        $this->assertSame('Kennenlernrunde', $cards[0]['titel']);
        // Der Souffleur zeigt Arbeitsauftrag und Checkliste ...
        $this->assertStringContainsString('Ankommen', $cards[0]['ablauf']);
        $this->assertStringContainsString('Flipchart', $cards[0]['materialtechnik']);
        $this->assertSame([], $cards[0]['materialien']);
        // ... aber nicht die uebrigen Felder der Seminareinheit.
        $this->assertArrayNotHasKey('kurzbeschreibung', $cards[0]);
        $this->assertArrayNotHasKey('risiken', $cards[0]);
    }

    public function test_foreign_grid_id_falls_back_to_own_plan(): void {
        $unitid = $this->store_unit();
        $gridid = $this->store_plan($unitid);

        // Ein Plan einer anderen Aktivitaet darf hier keinen Zustand liefern.
        $foreign = (new grid_service())->create_grid($this->cmid + 4711, 'Fremd', (int)$GLOBALS['USER']->id);
        $result = api::get_live_state($this->cmid, $foreign);

        $this->assertSame($gridid, $result['gridid']);
    }

    public function test_requires_the_live_capability(): void {
        $this->store_plan($this->store_unit());

        $student = $this->getDataGenerator()->create_and_enrol(
            get_course($this->courseid),
            'student'
        );
        $this->setUser($student);

        // Teilnehmende sehen den Roten Faden, nicht den Souffleur.
        $this->expectException(required_capability_exception::class);
        api::get_live_state($this->cmid, 0);
    }

    public function test_runs_without_edit_rights(): void {
        $this->store_plan($this->store_unit());

        $user = $this->getDataGenerator()->create_and_enrol(get_course($this->courseid), 'student');
        $roleid = $this->getDataGenerator()->create_role();
        role_assign($roleid, $user->id, context_module::instance($this->cmid));
        assign_capability(
            'mod/seminarplaner:viewlive',
            CAP_ALLOW,
            $roleid,
            context_module::instance($this->cmid)
        );
        $this->setUser($user);

        // Reine Durchfuehrende haben weder managegrids noch managemethods (D69).
        $this->assertFalse(has_capability('mod/seminarplaner:managegrids', context_module::instance($this->cmid)));
        $result = api::get_live_state($this->cmid, 0);
        $this->assertNotEmpty(json_decode($result['statejson'], true)['sequenz']['tage']);
    }
}
