<?php
// This file is part of Moodle - http://moodle.org/

defined('MOODLE_INTERNAL') || die();

use mod_seminarplaner\external\api;
use mod_seminarplaner\local\service\method_card_service;

/**
 * DB-backed tests that activities import the PUBLISHED version of a set, not whatever
 * currentversion happens to point at.
 *
 * currentversion follows the newest version even while it is an unpublished draft (a
 * re-submission creates one), so importing from it could pull unreviewed content into
 * activities. These tests pin the "published version wins" behaviour.
 */
final class mod_seminarplaner_published_version_import_test extends advanced_testcase {
    /** @var int Course module id. */
    private int $cmid = 0;

    /** @var int Module context id. */
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
        $module = $generator->create_module('seminarplaner', ['course' => $course->id, 'name' => 'Ziel']);
        $cm = get_coursemodule_from_instance('seminarplaner', $module->id);
        $this->cmid = (int)$cm->id;
        $this->contextid = (int)context_module::instance($cm->id)->id;

        global $DB;
        $now = time();
        $this->setid = (int)$DB->insert_record('local_kgen_methodset', (object)[
            'shortname' => 'PVSET',
            'displayname' => 'Published Version Set',
            'scopecontextid' => (int)context_system::instance()->id,
            'status' => 'published',
            'concepttype' => 'sammlung',
            'currentversion' => 0,
            'timecreated' => $now,
            'timemodified' => $now,
        ]);
    }

    /**
     * Insert a version and point currentversion at it, as create_version() does.
     *
     * @param int $versionnum Version number.
     * @param string $status Version status.
     * @return int Version id.
     */
    private function add_version(int $versionnum, string $status): int {
        global $DB;

        $now = time();
        $versionid = (int)$DB->insert_record('local_kgen_methodset_ver', (object)[
            'methodsetid' => $this->setid,
            'versionnum' => $versionnum,
            'status' => $status,
            'snapshotjson' => '{}',
            'timecreated' => $now,
            'timemodified' => $now,
        ]);
        // create_version() always moves currentversion to the newest version, even a draft.
        $DB->set_field('local_kgen_methodset', 'currentversion', $versionid, ['id' => $this->setid]);

        return $versionid;
    }

    /**
     * Insert a unit into a version.
     *
     * @param int $versionid Version id.
     * @param string $title Title.
     * @return void
     */
    private function add_unit(int $versionid, string $title): void {
        global $DB;

        $now = time();
        $DB->insert_record('local_kgen_method', (object)[
            'methodsetid' => $this->setid,
            'methodsetversionid' => $versionid,
            'title' => $title,
            'kurzbeschreibung' => 'Kurz zu ' . $title,
            'timecreated' => $now,
            'timemodified' => $now,
        ]);
    }

    /**
     * Titles the activity holds after an import.
     *
     * @return string[]
     */
    private function imported_titles(): array {
        global $USER;

        $methods = (new method_card_service())->get_methods($this->cmid, (int)$USER->id, $this->contextid);
        $titles = array_map(static function($method) {
            return (string)($method['titel'] ?? '');
        }, is_array($methods) ? $methods : []);
        sort($titles);
        return $titles;
    }

    public function test_import_reads_published_version_even_when_currentversion_points_at_a_review_draft(): void {
        $v1 = $this->add_version(1, 'published');
        $this->add_unit($v1, 'Freigegeben');

        // A re-submission created v2 (review) and dragged currentversion onto it. The set
        // itself is still published - exactly the broken state seen in production.
        $v2 = $this->add_version(2, 'review');
        $this->add_unit($v2, 'Freigegeben');
        $this->add_unit($v2, 'NochInPruefung');

        global $DB;
        $this->assertSame($v2, (int)$DB->get_field('local_kgen_methodset', 'currentversion', ['id' => $this->setid]));

        $result = api::import_global_methodset($this->cmid, $this->setid);
        $this->assertTrue($result['success']);

        // Only the published unit may arrive; the review-only unit must stay out.
        $this->assertSame(['Freigegeben'], $this->imported_titles());
    }

    public function test_import_reads_the_latest_published_version_when_several_exist(): void {
        $v1 = $this->add_version(1, 'published');
        $this->add_unit($v1, 'Alt');
        $v2 = $this->add_version(2, 'published');
        $this->add_unit($v2, 'Neu');

        // currentversion happens to match the latest published version here.
        $result = api::import_global_methodset($this->cmid, $this->setid);
        $this->assertTrue($result['success']);

        $this->assertSame(['Neu'], $this->imported_titles());
    }
}
