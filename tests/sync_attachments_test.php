<?php
// This file is part of Moodle - http://moodle.org/

defined('MOODLE_INTERNAL') || die();

use mod_seminarplaner\external\api;
use mod_seminarplaner\local\service\method_card_service;
use mod_seminarplaner\local\service\methodset_sync_service;

/**
 * DB-backed tests for attachments travelling through the method set sync.
 *
 * A unit already present in an activity used to keep its old attachments forever:
 * the sync tracked the text fields only, so a handout added to the published set
 * never reached the activities using it.
 */
final class mod_seminarplaner_sync_attachments_test extends advanced_testcase {
    /** @var int Course module id of the activity linked to the set. */
    private int $cmid = 0;

    /** @var int Module context id of that activity. */
    private int $contextid = 0;

    /** @var int Method set id. */
    private int $setid = 0;

    protected function setUp(): void {
        parent::setUp();

        if (!class_exists('\\local_seminarplaner\\local\\repository\\methodset_repository')) {
            $this->markTestSkipped('local_seminarplaner ist nicht installiert.');
        }

        $this->resetAfterTest(true);
        $this->setAdminUser();

        $generator = $this->getDataGenerator();
        $course = $generator->create_course();
        $module = $generator->create_module('seminarplaner', ['course' => $course->id]);
        $cm = get_coursemodule_from_instance('seminarplaner', $module->id);
        $this->cmid = (int)$cm->id;
        $this->contextid = (int)context_module::instance($cm->id)->id;

        global $DB;
        $now = time();
        $this->setid = (int)$DB->insert_record('local_kgen_methodset', (object)[
            'shortname' => 'SYNCSET',
            'displayname' => 'Sync Set',
            'scopecontextid' => (int)context_system::instance()->id,
            'status' => 'published',
            'concepttype' => 'sammlung',
            'currentversion' => 0,
            'timecreated' => $now,
            'timemodified' => $now,
        ]);
    }

    /**
     * Publish a new version of the set and make it current.
     *
     * @param int $versionnum Version number.
     * @return int Version id.
     */
    private function publish_version(int $versionnum): int {
        global $DB;

        $now = time();
        $versionid = (int)$DB->insert_record('local_kgen_methodset_ver', (object)[
            'methodsetid' => $this->setid,
            'versionnum' => $versionnum,
            'status' => 'published',
            'snapshotjson' => '{}',
            'timecreated' => $now,
            'timemodified' => $now,
        ]);
        $DB->set_field('local_kgen_methodset', 'currentversion', $versionid, ['id' => $this->setid]);

        return $versionid;
    }

    /**
     * Insert a unit into a set version.
     *
     * @param int $versionid Version id.
     * @param string $title Unit title.
     * @return int Global method id.
     */
    private function add_set_unit(int $versionid, string $title): int {
        global $DB;

        $now = time();

        return (int)$DB->insert_record('local_kgen_method', (object)[
            'methodsetid' => $this->setid,
            'methodsetversionid' => $versionid,
            'title' => $title,
            'kurzbeschreibung' => 'Kurz',
            'timecreated' => $now,
            'timemodified' => $now,
        ]);
    }

    /**
     * Attach a file to a unit of the set.
     *
     * @param int $globalmethodid Global method id.
     * @param string $filename File name.
     * @return void
     */
    private function attach_to_set_unit(int $globalmethodid, string $filename): void {
        global $DB;

        // One link per method carrying all its files, the way the importer stores them -
        // a second link on the same itemid would list every file twice.
        $itemid = (int)$DB->get_field('local_kgen_method_file', 'fileitemid',
            ['methodid' => $globalmethodid, 'kind' => 'material'], IGNORE_MULTIPLE);
        $isnewlink = ($itemid <= 0);
        if ($isnewlink) {
            $itemid = $globalmethodid + 700000;
        }

        get_file_storage()->create_file_from_string((object)[
            'contextid' => (int)context_system::instance()->id,
            'component' => 'local_seminarplaner',
            'filearea' => 'method_material',
            'itemid' => $itemid,
            'filepath' => '/',
            'filename' => $filename,
            'userid' => 2,
        ], 'inhalt von ' . $filename);

        if ($isnewlink) {
            $DB->insert_record('local_kgen_method_file', (object)[
                'methodid' => $globalmethodid,
                'kind' => 'material',
                'fileitemid' => $itemid,
                'timecreated' => time(),
            ]);
        }
    }

    /**
     * Take the pending update over, the way the user's "Ausstehende Updates
     * übernehmen" action does (D54: nothing is applied automatically).
     *
     * @param int $versionid Newly published version id.
     * @return void
     */
    private function apply_update(int $versionid): void {
        $service = new methodset_sync_service();
        $service->sync_published_methodset($this->setid, $versionid, 2);
        $service->apply_pending_update_for_activity($this->cmid, $this->setid, 2);
    }

    /**
     * Attachment filenames of one activity unit.
     *
     * @param string $title Unit title.
     * @return string[]
     */
    private function activity_attachments(string $title): array {
        global $USER;

        $methods = (new method_card_service())->get_methods($this->cmid, (int)$USER->id, $this->contextid);
        foreach ($methods as $method) {
            if ((string)($method['titel'] ?? '') !== $title) {
                continue;
            }
            $names = array_map(static function($entry) {
                return (string)($entry['name'] ?? '');
            }, (array)($method['materialien'] ?? []));
            sort($names);
            return $names;
        }
        return [];
    }

    /**
     * Replace the activity's units.
     *
     * @param array $methods Method payloads.
     * @return void
     */
    private function save_activity_methods(array $methods): void {
        global $USER;

        (new method_card_service())->save_methods($this->cmid, (int)$USER->id, $this->contextid, $methods);
    }

    public function test_attachment_added_to_the_set_reaches_an_already_imported_unit(): void {
        $v1 = $this->publish_version(1);
        $this->add_set_unit($v1, 'Hallo');
        api::import_global_methodset($this->cmid, $this->setid);
        $this->assertSame([], $this->activity_attachments('Hallo'));

        $v2 = $this->publish_version(2);
        $unitid = $this->add_set_unit($v2, 'Hallo');
        $this->attach_to_set_unit($unitid, 'Handout.pdf');
        $this->apply_update($v2);

        $this->assertSame(['Handout.pdf'], $this->activity_attachments('Hallo'));
    }

    public function test_locally_added_attachment_survives_the_update(): void {
        $v1 = $this->publish_version(1);
        $this->add_set_unit($v1, 'Hallo');
        api::import_global_methodset($this->cmid, $this->setid);

        // The trainer adds their own handout to the linked unit.
        global $USER;
        $methods = (new method_card_service())->get_methods($this->cmid, (int)$USER->id, $this->contextid);
        $methods[0]['materialien'] = [['name' => 'Eigenes.pdf', 'contentbase64' => base64_encode('lokal')]];
        $this->save_activity_methods($methods);
        $this->assertSame(['Eigenes.pdf'], $this->activity_attachments('Hallo'));

        $v2 = $this->publish_version(2);
        $unitid = $this->add_set_unit($v2, 'Hallo');
        $this->attach_to_set_unit($unitid, 'Handout.pdf');
        $this->apply_update($v2);

        // Local protection: the set must not delete what the trainer added. Without a
        // baseline for attachments this is the case that would lose data.
        $this->assertSame(['Eigenes.pdf'], $this->activity_attachments('Hallo'));
    }

    public function test_attachment_removed_from_the_set_disappears_when_nothing_was_changed_locally(): void {
        $v1 = $this->publish_version(1);
        $unit1 = $this->add_set_unit($v1, 'Hallo');
        $this->attach_to_set_unit($unit1, 'Handout.pdf');
        api::import_global_methodset($this->cmid, $this->setid);
        $this->assertSame(['Handout.pdf'], $this->activity_attachments('Hallo'));

        $v2 = $this->publish_version(2);
        $this->add_set_unit($v2, 'Hallo');
        $this->apply_update($v2);

        $this->assertSame([], $this->activity_attachments('Hallo'));
    }

    /**
     * Strip the attachment baseline from a card, the way every card linked before
     * attachments were tracked looks.
     *
     * @param string $title Unit title.
     * @return void
     */
    private function make_card_legacy(string $title): void {
        global $USER;

        $service = new method_card_service();
        $methods = $service->get_methods($this->cmid, (int)$USER->id, $this->contextid);
        foreach ($methods as $index => $method) {
            if ((string)($method['titel'] ?? '') === $title) {
                unset($methods[$index]['_kgsync']['sourcehashes']['materialien']);
            }
        }
        $service->save_methods($this->cmid, (int)$USER->id, $this->contextid, $methods);
    }

    public function test_legacy_card_without_baseline_keeps_locally_added_attachment(): void {
        $v1 = $this->publish_version(1);
        $this->add_set_unit($v1, 'Hallo');
        api::import_global_methodset($this->cmid, $this->setid);

        global $USER;
        $methods = (new method_card_service())->get_methods($this->cmid, (int)$USER->id, $this->contextid);
        $methods[0]['materialien'] = [['name' => 'Eigenes.pdf', 'contentbase64' => base64_encode('lokal')]];
        $this->save_activity_methods($methods);
        $this->make_card_legacy('Hallo');

        $v2 = $this->publish_version(2);
        $unitid = $this->add_set_unit($v2, 'Hallo');
        $this->attach_to_set_unit($unitid, 'Handout.pdf');
        $this->apply_update($v2);

        // The baseline is reconstructed from the old set version (which had no files),
        // so the local file reads as a local change and is protected.
        $this->assertSame(['Eigenes.pdf'], $this->activity_attachments('Hallo'));
    }

    public function test_legacy_card_without_local_changes_still_receives_the_update(): void {
        $v1 = $this->publish_version(1);
        $unit1 = $this->add_set_unit($v1, 'Hallo');
        $this->attach_to_set_unit($unit1, 'A.pdf');
        api::import_global_methodset($this->cmid, $this->setid);
        $this->make_card_legacy('Hallo');
        $this->assertSame(['A.pdf'], $this->activity_attachments('Hallo'));

        $v2 = $this->publish_version(2);
        $unit2 = $this->add_set_unit($v2, 'Hallo');
        $this->attach_to_set_unit($unit2, 'A.pdf');
        $this->attach_to_set_unit($unit2, 'B.pdf');
        $this->apply_update($v2);

        // Local list equals the old set version, so nothing was changed locally and the
        // reconstruction must let the update through instead of freezing the card.
        $this->assertSame(['A.pdf', 'B.pdf'], $this->activity_attachments('Hallo'));
    }

    public function test_save_without_materialien_key_keeps_the_attachments(): void {
        $v1 = $this->publish_version(1);
        $unitid = $this->add_set_unit($v1, 'Hallo');
        $this->attach_to_set_unit($unitid, 'Handout.pdf');
        api::import_global_methodset($this->cmid, $this->setid);
        $this->assertSame(['Handout.pdf'], $this->activity_attachments('Hallo'));

        global $USER;
        $methods = (new method_card_service())->get_methods($this->cmid, (int)$USER->id, $this->contextid);
        unset($methods[0]['materialien']);
        $this->save_activity_methods($methods);

        $this->assertSame(['Handout.pdf'], $this->activity_attachments('Hallo'));
    }

    public function test_save_with_an_explicitly_empty_list_still_removes_the_attachments(): void {
        $v1 = $this->publish_version(1);
        $unitid = $this->add_set_unit($v1, 'Hallo');
        $this->attach_to_set_unit($unitid, 'Handout.pdf');
        api::import_global_methodset($this->cmid, $this->setid);

        global $USER;
        $methods = (new method_card_service())->get_methods($this->cmid, (int)$USER->id, $this->contextid);
        $methods[0]['materialien'] = [];
        $this->save_activity_methods($methods);

        $this->assertSame([], $this->activity_attachments('Hallo'));
    }
}
