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
 * Tests for live co-editing presence.
 *
 * @package    mod_seminarplaner
 * @copyright  2026 Guido Brombach <gibro@posteo.de>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

use core_external\external_api;
use mod_seminarplaner\external\api;
use mod_seminarplaner\local\service\grid_service;
use mod_seminarplaner\local\service\presence_service;

/**
 * Live-Mitbearbeiten: Lebenszeichen, Anwesenheit, Versionsstand.
 *
 * @covers \mod_seminarplaner\local\service\presence_service
 * @covers \mod_seminarplaner\external\api::ping_plan
 */
final class presence_test extends advanced_testcase {
    /** @var int Course module id. */
    private int $cmid = 0;

    /** @var int Plan id in that activity. */
    private int $gridid = 0;

    /** @var stdClass First trainer. */
    private $anna;

    /** @var stdClass Second trainer. */
    private $ben;

    protected function setUp(): void {
        parent::setUp();

        $this->resetAfterTest(true);
        $this->setAdminUser();
        $this->preventResetByRollback();
        $this->redirectMessages();

        $generator = $this->getDataGenerator();
        $course = $generator->create_course();
        $module = $generator->create_module('seminarplaner', ['course' => $course->id, 'name' => 'Planung']);
        $cm = get_coursemodule_from_instance('seminarplaner', $module->id);
        $this->cmid = (int)$cm->id;
        $this->anna = $generator->create_and_enrol($course, 'editingteacher', ['firstname' => 'Anna', 'lastname' => 'Alt']);
        $this->ben = $generator->create_and_enrol($course, 'editingteacher', ['firstname' => 'Ben', 'lastname' => 'Bau']);
        $this->gridid = (new grid_service())->create_grid($this->cmid, 'Plan', (int)$this->anna->id);
    }

    public function test_others_see_who_is_where_but_not_themselves(): void {
        $service = new presence_service();
        $now = 1000000;

        $this->assertSame([], $service->ping($this->gridid, (int)$this->anna->id, 2, 'px7', $now));
        $seenbyben = $service->ping($this->gridid, (int)$this->ben->id, 1, '', $now + 3);

        $this->assertSame([['userid' => (int)$this->anna->id, 'tag' => 2, 'pid' => 'px7']], $seenbyben);
    }

    public function test_silent_people_drop_out_and_old_rows_are_deleted(): void {
        global $DB;
        $service = new presence_service();
        $now = 1000000;
        $service->ping($this->gridid, (int)$this->anna->id, 1, '', $now);

        $later = $now + presence_service::ACTIVE_SECONDS + 1;
        $this->assertSame([], $service->ping($this->gridid, (int)$this->ben->id, 1, '', $later));
        $this->assertTrue($DB->record_exists('kgen_grid_presence', ['userid' => $this->anna->id]));

        $service->ping($this->gridid, (int)$this->ben->id, 1, '', $now + presence_service::PURGE_SECONDS + 1);
        $this->assertFalse($DB->record_exists('kgen_grid_presence', ['userid' => $this->anna->id]));
    }

    public function test_one_row_per_person_and_plan(): void {
        global $DB;
        $service = new presence_service();
        $service->ping($this->gridid, (int)$this->anna->id, 1, '', 1000000);
        $service->ping($this->gridid, (int)$this->anna->id, 3, 'p2', 1000005);

        $rows = $DB->get_records('kgen_grid_presence', ['gridid' => $this->gridid]);
        $this->assertCount(1, $rows);
        $this->assertSame(3, (int)reset($rows)->tag);
    }

    public function test_ping_reports_the_current_version_and_named_editors(): void {
        $hash = (new grid_service())->save_user_state($this->gridid, (int)$this->anna->id, ['config' => ['days' => ['Montag']]]);

        $this->setUser($this->anna);
        api::ping_plan($this->cmid, $this->gridid, 1, 'px1');

        $this->setUser($this->ben);
        $result = external_api::clean_returnvalue(
            api::ping_plan_returns(),
            api::ping_plan($this->cmid, $this->gridid, 1, '')
        );

        $this->assertSame($hash, $result['versionhash']);
        $this->assertCount(1, $result['editors']);
        $this->assertSame('Anna Alt', $result['editors'][0]['fullname']);
        $this->assertSame('px1', $result['editors'][0]['pid']);
    }

    public function test_ping_refuses_a_plan_of_another_activity(): void {
        $generator = $this->getDataGenerator();
        $othercourse = $generator->create_course();
        $othermodule = $generator->create_module('seminarplaner', ['course' => $othercourse->id]);
        $othercm = get_coursemodule_from_instance('seminarplaner', $othermodule->id);
        $othergrid = (new grid_service())->create_grid((int)$othercm->id, 'Fremd', 2);

        $this->setUser($this->anna);
        $this->expectException(invalid_parameter_exception::class);
        api::ping_plan($this->cmid, $othergrid, 1, '');
    }

    public function test_privacy_deletion_removes_presence(): void {
        global $DB;
        (new presence_service())->ping($this->gridid, (int)$this->anna->id, 1, '');

        \mod_seminarplaner\privacy\provider::delete_data_for_all_users_in_context(context_module::instance($this->cmid));

        $this->assertFalse($DB->record_exists('kgen_grid_presence', ['gridid' => $this->gridid]));
    }
}
