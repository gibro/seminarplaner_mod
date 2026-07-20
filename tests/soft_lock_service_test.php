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
 * Unit tests for soft lock service.
 *
 * @package    mod_seminarplaner
 * @copyright  2026 Guido Brombach <gibro@posteo.de>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

use mod_seminarplaner\local\service\soft_lock_service;

/**
 * DB-backed tests for soft lock service.
 */
final class mod_seminarplaner_soft_lock_service_test extends advanced_testcase {
    public function test_acquire_and_release_lock(): void {
        $this->resetAfterTest(true);

        $service = new soft_lock_service();
        $lock = $service->acquire(2001, 5, 300);

        $this->assertTrue($lock['acquired']);
        $this->assertNotEmpty($lock['token']);

        $status = $service->status(2001);
        $this->assertTrue($status['locked']);
        $this->assertSame(5, $status['holder']);

        $released = $service->release(2001, 5, $lock['token']);
        $this->assertTrue($released);
        $this->assertFalse($service->status(2001)['locked']);
    }

    public function test_conflict_when_lock_owned_by_other_user(): void {
        $this->resetAfterTest(true);

        $service = new soft_lock_service();
        $first = $service->acquire(2002, 6, 300);
        $this->assertTrue($first['acquired']);

        $second = $service->acquire(2002, 7, 300);
        $this->assertFalse($second['acquired']);
        $this->assertSame(6, $second['holder']);
    }

    public function test_break_lock_clears_lock_held_by_other_user(): void {
        $this->resetAfterTest(true);

        $service = new soft_lock_service();
        $held = $service->acquire(2003, 8, 300);
        $this->assertTrue($held['acquired']);
        $this->assertTrue($service->status(2003)['locked']);

        $service->break_lock(2003);
        $this->assertFalse($service->status(2003)['locked']);

        // After a break another user can take the lock.
        $reacquired = $service->acquire(2003, 9, 300);
        $this->assertTrue($reacquired['acquired']);
        $this->assertSame(9, $service->status(2003)['holder']);
    }
}
