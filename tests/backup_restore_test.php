<?php
// This file is part of Moodle - http://moodle.org/

defined('MOODLE_INTERNAL') || die();

global $CFG;
require_once($CFG->dirroot . '/backup/util/includes/backup_includes.php');
require_once($CFG->dirroot . '/backup/util/includes/restore_includes.php');

use mod_seminarplaner\local\service\grid_service;

/**
 * Backup and restore roundtrip tests for mod_seminarplaner.
 *
 * Covers the deploy-critical guarantee that grids and the published Common Thread
 * survive a course backup/restore (also triggered by activity duplication and
 * course import). See Workflow 21/22 in TEST_WORKFLOWS.md.
 */
final class mod_seminarplaner_backup_restore_test extends advanced_testcase {
    public function test_backup_restore_preserves_grid_and_roterfaden(): void {
        global $USER;

        $this->resetAfterTest(true);
        $this->setAdminUser();

        $generator = $this->getDataGenerator();
        $sourcecourse = $generator->create_course();
        $module = $generator->create_module('seminarplaner', ['course' => $sourcecourse->id, 'name' => 'Source']);
        $cm = get_coursemodule_from_instance('seminarplaner', $module->id);
        $sourcecmid = (int)$cm->id;

        // Seed a grid and a published Common Thread on the source activity.
        $service = new grid_service();
        $gridid = $service->create_grid($sourcecmid, 'Plan A', (int)$USER->id);
        $service->publish_roterfaden($sourcecmid, $gridid, ['units' => [['uid' => 'u1']]], (int)$USER->id);
        $this->assertTrue($service->get_roterfaden_state($sourcecmid)['ispublished']);

        // Backup the single activity, including user data (grids count as user data).
        $bc = new backup_controller(
            backup::TYPE_1ACTIVITY,
            $sourcecmid,
            backup::FORMAT_MOODLE,
            backup::INTERACTIVE_NO,
            backup::MODE_IMPORT,
            (int)$USER->id
        );
        $plan = $bc->get_plan();
        if ($plan->setting_exists('users')) {
            $plan->get_setting('users')->set_value(true);
        }
        $backupid = $bc->get_backupid();
        $bc->execute_plan();
        $bc->destroy();

        // Restore into a fresh course as a new activity.
        $targetcourse = $generator->create_course();
        $rc = new restore_controller(
            $backupid,
            $targetcourse->id,
            backup::INTERACTIVE_NO,
            backup::MODE_IMPORT,
            (int)$USER->id,
            backup::TARGET_NEW_COURSE
        );
        $this->assertTrue($rc->execute_precheck());
        $rc->execute_plan();
        $rc->destroy();

        // Locate the restored activity and assert its data survived under the new cmid.
        $restoredmodules = get_coursemodules_in_course('seminarplaner', $targetcourse->id);
        $this->assertCount(1, $restoredmodules);
        $restoredcm = reset($restoredmodules);
        $restoredcmid = (int)$restoredcm->id;
        $this->assertNotSame($sourcecmid, $restoredcmid);

        $restoredgrids = $service->list_grids($restoredcmid);
        $this->assertCount(1, $restoredgrids);
        $restoredgrid = reset($restoredgrids);
        $this->assertSame('Plan A', $restoredgrid->name);

        $this->assertTrue($service->get_roterfaden_state($restoredcmid)['ispublished']);
    }
}
