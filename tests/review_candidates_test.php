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
 * Unit tests for review candidates.
 *
 * @package    mod_seminarplaner
 * @copyright  2026 Guido Brombach <gibro@posteo.de>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

use mod_seminarplaner\external\api;
use mod_seminarplaner\local\service\method_card_service;

/**
 * DB-backed tests for the review candidate diff (review.php, step 2).
 *
 * The candidate list shows the activity's seminar units that are new or changed
 * compared to an existing global method set. Attachments are part of a unit:
 * adding a handout to a unit whose text stayed the same must offer it for review.
 */
final class review_candidates_test extends advanced_testcase {
    /** @var int Course module id of the activity the units live in. */
    private int $cmid = 0;

    /** @var int Module context id of that activity. */
    private int $contextid = 0;

    /** @var int Id of the global method set compared against. */
    private int $setid = 0;

    /** @var int Current version id of that set. */
    private int $versionid = 0;

    protected function setUp(): void {
        parent::setUp();

        if (!class_exists('\\local_seminarplaner\\local\\repository\\methodset_repository')) {
            $this->markTestSkipped('local_seminarplaner ist nicht installiert.');
        }

        $this->resetAfterTest(true);
        $this->setAdminUser();
        $this->create_activity();
        $this->create_published_set();
    }

    /**
     * Create the activity whose units get submitted.
     *
     * @return void
     */
    private function create_activity(): void {
        $generator = $this->getDataGenerator();
        $course = $generator->create_course();
        $module = $generator->create_module('seminarplaner', ['course' => $course->id, 'name' => 'Quelle']);
        $cm = get_coursemodule_from_instance('seminarplaner', $module->id);

        $this->cmid = (int)$cm->id;
        $this->contextid = (int)context_module::instance($cm->id)->id;
    }

    /**
     * Create a published global method set with an empty snapshot.
     *
     * @return void
     */
    private function create_published_set(): void {
        global $DB;

        $now = time();
        $this->setid = (int)$DB->insert_record('local_kgen_methodset', (object)[
            'shortname' => 'SET1',
            'displayname' => 'Bestehende Sammlung',
            'scopecontextid' => (int)context_system::instance()->id,
            'status' => 'published',
            'concepttype' => 'sammlung',
            'currentversion' => 0,
            'timecreated' => $now,
            'timemodified' => $now,
        ]);
        $this->versionid = (int)$DB->insert_record('local_kgen_methodset_ver', (object)[
            'methodsetid' => $this->setid,
            'versionnum' => 1,
            'status' => 'published',
            'snapshotjson' => '{}',
            'timecreated' => $now,
            'timemodified' => $now,
        ]);
        $DB->set_field('local_kgen_methodset', 'currentversion', $this->versionid, ['id' => $this->setid]);
    }

    /**
     * Insert one unit into the global set.
     *
     * @param string $title Unit title.
     * @param string $kurzbeschreibung Short description.
     * @return int Global method id.
     */
    private function create_set_unit(string $title, string $kurzbeschreibung = 'Kurzbeschreibung'): int {
        global $DB;

        $now = time();

        return (int)$DB->insert_record('local_kgen_method', (object)[
            'methodsetid' => $this->setid,
            'methodsetversionid' => $this->versionid,
            'title' => $title,
            'kurzbeschreibung' => $kurzbeschreibung,
            'timecreated' => $now,
            'timemodified' => $now,
        ]);
    }

    /**
     * Attach a file to a unit of the global set.
     *
     * @param int $globalmethodid Global method id.
     * @param string $filename File name.
     * @return void
     */
    private function attach_file_to_set_unit(int $globalmethodid, string $filename): void {
        global $DB;

        $itemid = $globalmethodid + 5000;
        get_file_storage()->create_file_from_string((object)[
            'contextid' => (int)context_system::instance()->id,
            'component' => 'local_seminarplaner',
            'filearea' => 'method_material',
            'itemid' => $itemid,
            'filepath' => '/',
            'filename' => $filename,
            'userid' => 2,
        ], 'inhalt von ' . $filename);
        $DB->insert_record('local_kgen_method_file', (object)[
            'methodid' => $globalmethodid,
            'kind' => 'material',
            'fileitemid' => $itemid,
            'timecreated' => time(),
        ]);
    }

    /**
     * Put units into the activity library.
     *
     * @param array $units Method card payloads.
     * @return void
     */
    private function set_activity_units(array $units): void {
        global $USER;

        (new method_card_service())->save_methods($this->cmid, (int)$USER->id, $this->contextid, $units);
    }

    /**
     * Build an activity unit payload matching a set unit's text.
     *
     * @param string $title Unit title.
     * @param array $overrides Extra card fields, e.g. materialien.
     * @return array
     */
    private function activity_unit(string $title, array $overrides = []): array {
        return array_merge([
            'id' => 'unit' . preg_replace('/[^a-z0-9]/i', '', $title),
            'titel' => $title,
            'kurzbeschreibung' => 'Kurzbeschreibung',
        ], $overrides);
    }

    /**
     * Build a materialien entry that save_methods() stores as a real file.
     *
     * @param string $filename File name.
     * @return array
     */
    private function file_entry(string $filename): array {
        return ['name' => $filename, 'contentbase64' => base64_encode('inhalt von ' . $filename)];
    }

    /**
     * Fetch the candidate list for the set under test.
     *
     * @return array<string, array<string, mixed>> Candidates indexed by title.
     */
    private function candidates_by_title(): array {
        $result = api::get_review_method_candidates($this->cmid, $this->setid);
        $out = [];
        foreach ((array)($result['candidates'] ?? []) as $candidate) {
            $out[(string)$candidate['title']] = $candidate;
        }
        return $out;
    }

    public function test_added_attachment_makes_unchanged_unit_a_candidate(): void {
        $this->create_set_unit('Hallo');
        $this->set_activity_units([
            $this->activity_unit('Hallo', ['materialien' => [$this->file_entry('ZIM-Papier.pdf')]]),
        ]);

        $candidates = $this->candidates_by_title();

        $this->assertArrayHasKey('Hallo', $candidates);
        $this->assertSame('changed', $candidates['Hallo']['status']);
        $this->assertContains('Materialien', $candidates['Hallo']['changedfields']);
    }

    public function test_identical_attachment_produces_no_candidate(): void {
        $unitid = $this->create_set_unit('Hallo');
        $this->attach_file_to_set_unit($unitid, 'ZIM-Papier.pdf');
        $this->set_activity_units([
            $this->activity_unit('Hallo', ['materialien' => [$this->file_entry('ZIM-Papier.pdf')]]),
        ]);

        // Guards against the opposite failure: every unit carrying a file would
        // otherwise be reported as changed forever.
        $this->assertSame([], $this->candidates_by_title());
    }

    public function test_removed_attachment_is_detected(): void {
        $unitid = $this->create_set_unit('Hallo');
        $this->attach_file_to_set_unit($unitid, 'ZIM-Papier.pdf');
        $this->set_activity_units([$this->activity_unit('Hallo')]);

        $candidates = $this->candidates_by_title();

        $this->assertArrayHasKey('Hallo', $candidates);
        $this->assertContains('Materialien', $candidates['Hallo']['changedfields']);
    }

    public function test_additional_attachment_next_to_an_existing_one_is_detected(): void {
        $unitid = $this->create_set_unit('Hallo');
        $this->attach_file_to_set_unit($unitid, 'Handout.pdf');
        $this->set_activity_units([
            $this->activity_unit('Hallo', [
                'materialien' => [$this->file_entry('Handout.pdf'), $this->file_entry('Folie.pdf')],
            ]),
        ]);

        $candidates = $this->candidates_by_title();

        $this->assertArrayHasKey('Hallo', $candidates);
        $this->assertContains('Materialien', $candidates['Hallo']['changedfields']);
    }

    public function test_text_change_is_still_detected_without_attachments(): void {
        $this->create_set_unit('Hallo', 'Alte Kurzbeschreibung');
        $this->set_activity_units([
            $this->activity_unit('Hallo', ['kurzbeschreibung' => 'Neue Kurzbeschreibung']),
        ]);

        $candidates = $this->candidates_by_title();

        $this->assertArrayHasKey('Hallo', $candidates);
        $this->assertContains('Kurzbeschreibung', $candidates['Hallo']['changedfields']);
        $this->assertNotContains('Materialien', $candidates['Hallo']['changedfields']);
    }

    public function test_unit_unknown_to_the_set_is_reported_as_new(): void {
        $this->create_set_unit('Hallo');
        $this->set_activity_units([
            $this->activity_unit('Hallo'),
            $this->activity_unit('Kartenabfrage'),
        ]);

        $candidates = $this->candidates_by_title();

        $this->assertArrayNotHasKey('Hallo', $candidates);
        $this->assertArrayHasKey('Kartenabfrage', $candidates);
        $this->assertSame('new', $candidates['Kartenabfrage']['status']);
    }
}
