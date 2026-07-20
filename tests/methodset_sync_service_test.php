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
 * Unit tests for methodset sync service.
 *
 * @package    mod_seminarplaner
 * @copyright  2026 Guido Brombach <gibro@posteo.de>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

use mod_seminarplaner\local\service\methodset_sync_service;

/**
 * DB-backed tests for method set sync bookkeeping.
 *
 * Covers the pending-update detection used by the activity "Ausstehende Updates"
 * indicator. The content-merge/apply path needs a real module context and is
 * exercised manually (see Workflow 11 in TEST_WORKFLOWS.md).
 */
final class mod_seminarplaner_methodset_sync_service_test extends advanced_testcase {
    /**
     * Insert a minimal global method set record and return its id.
     *
     * @param string $status
     * @param int $currentversion
     * @return int
     */
    private function create_methodset(string $status, int $currentversion): int {
        global $DB;

        return (int)$DB->insert_record('local_kgen_methodset', (object)[
            'shortname' => 'SET1',
            'displayname' => 'Set One',
            'status' => $status,
            'currentversion' => $currentversion,
            'timecreated' => time(),
            'timemodified' => time(),
        ]);
    }

    public function test_link_roundtrip(): void {
        $this->resetAfterTest(true);

        $setid = $this->create_methodset('published', 11);
        $service = new methodset_sync_service();
        $service->upsert_activity_set_link(7001, $setid, 11, 5);

        $links = $service->list_activity_links(7001);
        $this->assertCount(1, $links);
        $this->assertSame($setid, $links[0]['methodsetid']);
        // D54: auto-sync is gone; new links never auto-update.
        $this->assertFalse($links[0]['autosyncenabled']);
        $this->assertFalse($links[0]['haspending']);
    }

    public function test_sync_never_auto_applies_and_marks_pending(): void {
        $this->resetAfterTest(true);

        // Activity is linked to version 11.
        $setid = $this->create_methodset('published', 12);
        $service = new methodset_sync_service();
        $service->upsert_activity_set_link(7002, $setid, 11, 5);

        // A new version 12 is published.
        $applied = $service->sync_published_methodset($setid, 12, 5);

        // D54: nothing is ever auto-applied; the link is only flagged as pending.
        // Applying stays the deliberate "Ausstehende Updates übernehmen" action.
        $this->assertSame(0, $applied);
        $links = $service->list_activity_links(7002);
        $this->assertTrue($links[0]['haspending']);
        $this->assertSame(12, $links[0]['pendingversionid']);
    }

    public function test_apply_pending_returns_false_without_link(): void {
        $this->resetAfterTest(true);

        $service = new methodset_sync_service();
        $this->assertFalse($service->apply_pending_update_for_activity(7003, 999, 5));
    }
}
