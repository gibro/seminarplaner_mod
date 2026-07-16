<?php
// This file is part of Moodle - http://moodle.org/

defined('MOODLE_INTERNAL') || die();

use core_privacy\local\request\approved_contextlist;
use core_privacy\local\request\userlist;
use core_privacy\local\request\writer;
use mod_seminarplaner\local\service\grid_service;
use mod_seminarplaner\privacy\provider;

/**
 * Privacy provider tests for mod_seminarplaner.
 */
final class mod_seminarplaner_privacy_provider_test extends advanced_testcase {
    /** @var \stdClass */
    private $user;
    /** @var \context_module */
    private $context;
    /** @var int */
    private $cmid;
    /** @var int */
    private $gridid;

    protected function setUp(): void {
        parent::setUp();
        $this->resetAfterTest(true);

        $generator = $this->getDataGenerator();
        $course = $generator->create_course();
        $this->user = $generator->create_user();
        $module = $generator->create_module('seminarplaner', ['course' => $course->id, 'name' => 'Privacy']);
        $cm = get_coursemodule_from_instance('seminarplaner', $module->id);
        $this->cmid = (int)$cm->id;
        $this->context = context_module::instance($this->cmid);

        // The user owns a grid and a personal grid state.
        $service = new grid_service();
        $this->gridid = $service->create_grid($this->cmid, 'Owned grid', (int)$this->user->id);
        $service->save_user_state($this->gridid, (int)$this->user->id, ['x' => 1]);
    }

    public function test_get_contexts_for_userid_includes_activity(): void {
        $contextlist = provider::get_contexts_for_userid((int)$this->user->id);
        // get_contextids() ist als int[] dokumentiert, liefert die IDs aber roh
        // aus der DB — unter MariaDB also Strings. assertContains vergleicht
        // strikt, deshalb hier casten statt auf den Docblock zu vertrauen.
        $contextids = array_map('intval', $contextlist->get_contextids());
        $this->assertContains((int)$this->context->id, $contextids);
    }

    public function test_get_users_in_context_includes_owner(): void {
        $userlist = new userlist($this->context, 'mod_seminarplaner');
        provider::get_users_in_context($userlist);
        $this->assertContains((int)$this->user->id, $userlist->get_userids());
    }

    public function test_export_user_data_writes_grid_state(): void {
        writer::reset();

        $contextlist = new approved_contextlist($this->user, 'mod_seminarplaner', [$this->context->id]);
        provider::export_user_data($contextlist);

        $writer = writer::with_context($this->context);
        $this->assertTrue($writer->has_any_data());
        $exported = $writer->get_data(['grid_user_state']);
        $this->assertNotEmpty($exported);
    }

    public function test_delete_data_for_user_removes_state_and_anonymises_grid(): void {
        global $DB;

        $contextlist = new approved_contextlist($this->user, 'mod_seminarplaner', [$this->context->id]);
        provider::delete_data_for_user($contextlist);

        // Personal state is removed.
        $this->assertFalse($DB->record_exists('kgen_grid_user_state', [
            'gridid' => $this->gridid,
            'userid' => (int)$this->user->id,
        ]));

        // Shared grid is kept but the author reference is anonymised.
        $this->assertTrue($DB->record_exists('kgen_grid', ['id' => $this->gridid]));
        $this->assertSame(0, (int)$DB->get_field('kgen_grid', 'createdby', ['id' => $this->gridid]));
    }
}
