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
 * Tests for assigning Referent*innen to placed seminar units (D84).
 *
 * @package    mod_seminarplaner
 * @copyright  2026 Guido Brombach <gibro@posteo.de>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

use mod_seminarplaner\external\api;
use mod_seminarplaner\local\sequence\sequence_state;
use mod_seminarplaner\local\service\grid_service;

/**
 * DB-backed tests for the Referent*innen assignment.
 *
 * The assignment lives on the placement in the sequence, not on the library
 * card, and it names people of THIS course. Both halves are load bearing: the
 * first lets the same unit be held by different people in two plans, the
 * second keeps course staff out of plans that leave the course.
 */
final class referenten_test extends advanced_testcase {
    /** @var int Course module id of the activity under test. */
    private int $cmid = 0;

    /** @var int Course id the activity lives in. */
    private int $courseid = 0;

    /** @var int A trainer enrolled in that course. */
    private int $trainerid = 0;

    /** @var int A student enrolled in that course. */
    private int $studentid = 0;

    protected function setUp(): void {
        parent::setUp();

        $this->resetAfterTest(true);
        $this->setAdminUser();
        // Ohne das verschickt das Einschreiben eine Willkommensmail, deren
        // Renderer das Theme festnagelt - jeder spaetere Kontextwechsel im
        // Webservice laeuft danach in eine coding_exception.
        $this->preventResetByRollback();
        $this->redirectMessages();

        $generator = $this->getDataGenerator();
        $course = $generator->create_course();
        $module = $generator->create_module('seminarplaner', ['course' => $course->id, 'name' => 'Planung']);
        $cm = get_coursemodule_from_instance('seminarplaner', $module->id);

        $this->courseid = (int)$course->id;
        $this->cmid = (int)$cm->id;
        $this->trainerid = (int)$generator->create_and_enrol($course, 'editingteacher')->id;
        $this->studentid = (int)$generator->create_and_enrol($course, 'student')->id;
    }

    /**
     * Build a one placement sequence carrying the given assignment.
     *
     * @param array $referenten User ids to assign.
     * @return array State payload.
     */
    private function state_with_referenten(array $referenten): array {
        $placement = [
            'typ' => 'einheit',
            'titel' => 'Kennenlernrunde',
            'dauer' => 45,
            'bausteinid' => null,
            'einheitenauswahl' => 'ea1',
        ];
        if ($referenten) {
            $placement['referenten'] = $referenten;
        }
        return [
            'config' => ['days' => ['Montag']],
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
                'platzierungen' => ['px1' => $placement],
                'einheitenauswahlen' => ['ea1' => ['kandidaten' => ['unit1'], 'aktiv' => 'unit1']],
                'bausteine' => [],
            ],
        ];
    }

    /**
     * Read back the stored assignment of the single placement.
     *
     * @param int $gridid Grid id.
     * @return array Stored user ids.
     */
    private function stored_referenten(int $gridid): array {
        $state = (new grid_service())->get_user_state($gridid, (int)$GLOBALS['USER']->id)['state'];
        return $state['sequenz']['platzierungen']['px1']['referenten'] ?? [];
    }

    public function test_assignment_survives_a_save(): void {
        $service = new grid_service();
        $gridid = $service->create_grid($this->cmid, 'Plan A', (int)$GLOBALS['USER']->id);
        $service->save_user_state($gridid, (int)$GLOBALS['USER']->id, $this->state_with_referenten([$this->trainerid]));

        $this->assertSame([$this->trainerid], $this->stored_referenten($gridid));
    }

    public function test_people_who_may_not_plan_here_are_dropped(): void {
        $service = new grid_service();
        $gridid = $service->create_grid($this->cmid, 'Plan B', (int)$GLOBALS['USER']->id);

        // Teilnehmende und Personen aus einem anderen Kurs halten keine
        // Seminareinheit dieser Aktivitaet - der Speicherpfad wirft beide raus,
        // die Trainerin bleibt.
        $stranger = (int)$this->getDataGenerator()->create_user()->id;
        $service->save_user_state($gridid, (int)$GLOBALS['USER']->id, $this->state_with_referenten([
            $this->trainerid,
            $this->studentid,
            $stranger,
        ]));

        $this->assertSame([$this->trainerid], $this->stored_referenten($gridid));
    }

    public function test_plans_without_assignment_keep_the_key_absent(): void {
        $service = new grid_service();
        $gridid = $service->create_grid($this->cmid, 'Plan C', (int)$GLOBALS['USER']->id);
        $service->save_user_state($gridid, (int)$GLOBALS['USER']->id, $this->state_with_referenten([]));

        $state = $service->get_user_state($gridid, (int)$GLOBALS['USER']->id)['state'];
        $this->assertArrayNotHasKey('referenten', $state['sequenz']['platzierungen']['px1']);
    }

    public function test_published_common_thread_carries_no_assignment(): void {
        $service = new grid_service();
        $gridid = $service->create_grid($this->cmid, 'Plan D', (int)$GLOBALS['USER']->id);
        $state = $this->state_with_referenten([$this->trainerid]);
        $service->save_user_state($gridid, (int)$GLOBALS['USER']->id, $state);

        // Der Rote Faden ist die Teilnehmenden-Sicht; das Handout entsteht aus
        // genau diesem Schnappschuss und darf niemanden benennen.
        $service->publish_roterfaden($this->cmid, $gridid, $state, (int)$GLOBALS['USER']->id);

        $published = $service->get_roterfaden_state($this->cmid)['state'];
        $this->assertArrayNotHasKey('referenten', $published['sequenz']['platzierungen']['px1']);
    }

    public function test_option_list_offers_staff_but_not_participants(): void {
        $result = api::get_referenten($this->cmid);
        $ids = array_map(static fn(array $person): int => $person['id'], $result['referenten']);

        $this->assertContains($this->trainerid, $ids);
        $this->assertNotContains($this->studentid, $ids);
        foreach ($result['referenten'] as $person) {
            $this->assertNotEmpty($person['fullname']);
            $this->assertNotEmpty($person['avatarurl']);
        }
    }

    public function test_option_list_stays_closed_for_participants(): void {
        $this->setUser($this->studentid);

        $this->expectException(required_capability_exception::class);
        api::get_referenten($this->cmid);
    }

    public function test_strip_removes_every_assignment(): void {
        $sequenz = $this->state_with_referenten([$this->trainerid])['sequenz'];
        $stripped = sequence_state::strip_referenten($sequenz);

        $this->assertTrue(sequence_state::has_referenten($sequenz));
        $this->assertFalse(sequence_state::has_referenten($stripped));
    }

    public function test_normalize_drops_duplicates_and_junk(): void {
        $this->assertSame([7, 9], sequence_state::normalize_referenten([7, '9', 7, 0, -1, 'x']));
    }
}
