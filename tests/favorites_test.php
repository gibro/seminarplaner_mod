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
 * Tests for personal favourite seminar units (D89).
 *
 * @package    mod_seminarplaner
 * @copyright  2026 Guido Brombach <gibro@posteo.de>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

use mod_seminarplaner\external\api;

/**
 * DB-backed tests for the favourites endpoints.
 *
 * Favourites are personal and per activity: one person's heart must neither
 * show up for a colleague nor in another activity, and nothing may land in the
 * shared method cards.
 */
final class favorites_test extends advanced_testcase {
    /** @var int Course module id of the first activity. */
    private int $cmid = 0;

    /** @var int Course module id of a second activity in the same course. */
    private int $othercmid = 0;

    /** @var stdClass First trainer. */
    private stdClass $trainer;

    /** @var stdClass Second trainer. */
    private stdClass $colleague;

    protected function setUp(): void {
        parent::setUp();

        $this->resetAfterTest(true);
        $this->setAdminUser();
        $this->preventResetByRollback();
        $this->redirectMessages();

        $generator = $this->getDataGenerator();
        $course = $generator->create_course();
        $module = $generator->create_module('seminarplaner', ['course' => $course->id, 'name' => 'Planung']);
        $other = $generator->create_module('seminarplaner', ['course' => $course->id, 'name' => 'Andere']);
        $this->cmid = (int)get_coursemodule_from_instance('seminarplaner', $module->id)->id;
        $this->othercmid = (int)get_coursemodule_from_instance('seminarplaner', $other->id)->id;
        $this->trainer = $generator->create_and_enrol($course, 'editingteacher');
        $this->colleague = $generator->create_and_enrol($course, 'editingteacher');
    }

    /**
     * Marking, unmarking and reading back stay per person and per activity.
     *
     * @covers \mod_seminarplaner\external\api::set_favorite
     * @covers \mod_seminarplaner\external\api::get_favorites
     */
    public function test_favorites_are_personal_and_per_activity(): void {
        $this->setUser($this->trainer);
        api::set_favorite($this->cmid, 'm-1', true);
        api::set_favorite($this->cmid, 'm-2', true);
        // Doppelt markieren legt keinen zweiten Eintrag an.
        $result = api::set_favorite($this->cmid, 'm-1', true);
        $this->assertSame(['m-2', 'm-1'], $result['ids']);

        $result = api::set_favorite($this->cmid, 'm-2', false);
        $this->assertSame(['m-1'], $result['ids']);
        $this->assertSame(['m-1'], api::get_favorites($this->cmid)['ids']);
        $this->assertSame([], api::get_favorites($this->othercmid)['ids']);

        $this->setUser($this->colleague);
        $this->assertSame([], api::get_favorites($this->cmid)['ids']);

        // Der letzte entfernte Favorit räumt die Einstellung ganz weg.
        $this->setUser($this->trainer);
        api::set_favorite($this->cmid, 'm-1', false);
        $this->assertNull(get_user_preferences('mod_seminarplaner_favorites_' . $this->cmid, null, $this->trainer->id));
    }

    /**
     * Deleting the activity takes everyone's favourites for it along.
     *
     * @covers ::seminarplaner_delete_instance
     */
    public function test_deleting_activity_removes_favorites(): void {
        global $DB;

        $this->setUser($this->trainer);
        api::set_favorite($this->cmid, 'm-1', true);
        api::set_favorite($this->othercmid, 'm-9', true);
        $this->setAdminUser();

        course_delete_module($this->cmid);

        $this->assertFalse($DB->record_exists('user_preferences', ['name' => 'mod_seminarplaner_favorites_' . $this->cmid]));
        $this->assertTrue($DB->record_exists('user_preferences', ['name' => 'mod_seminarplaner_favorites_' . $this->othercmid]));
    }

    /**
     * People without planning rights cannot read or set favourites.
     *
     * @covers \mod_seminarplaner\external\api::set_favorite
     */
    public function test_students_cannot_set_favorites(): void {
        $course = get_course(get_coursemodule_from_id('seminarplaner', $this->cmid)->course);
        $student = $this->getDataGenerator()->create_and_enrol($course, 'student');
        $this->setUser($student);

        $this->expectException(required_capability_exception::class);
        api::set_favorite($this->cmid, 'm-1', true);
    }
}
