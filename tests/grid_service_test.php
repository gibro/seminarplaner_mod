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
}
