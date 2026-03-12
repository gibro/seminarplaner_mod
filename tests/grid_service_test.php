<?php
// This file is part of Moodle - http://moodle.org/

defined('MOODLE_INTERNAL') || die();

use mod_seminarplaner\local\service\grid_service;

/**
 * DB-backed tests for grid service.
 */
final class mod_seminarplaner_grid_service_test extends advanced_testcase {
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
        $this->assertSame(['x' => 1], $state['state']);
        $this->assertNotEmpty($state['versionhash']);
    }

    public function test_save_state_conflict_detected(): void {
        $this->resetAfterTest(true);

        $service = new grid_service();
        $gridid = $service->create_grid(1003, 'Grid C', 4);
        $firsthash = $service->save_user_state($gridid, 4, ['a' => 1]);

        $this->expectException(coding_exception::class);
        $service->save_user_state($gridid, 4, ['a' => 2], $firsthash . 'mismatch');
    }
}
