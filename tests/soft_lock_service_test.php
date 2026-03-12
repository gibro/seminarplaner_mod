<?php
// This file is part of Moodle - http://moodle.org/

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
}
