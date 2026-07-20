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
 * Unit tests for import global methodset.
 *
 * @package    mod_seminarplaner
 * @copyright  2026 Guido Brombach <gibro@posteo.de>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

use mod_seminarplaner\external\api;
use mod_seminarplaner\local\service\grid_service;
use mod_seminarplaner\local\service\method_card_service;

/**
 * DB-backed tests for importing global method sets into an activity.
 *
 * Covers the two shapes a Seminarkonzept can have: with a plan in its version
 * snapshot (D32, creates a new plan) and without one (a set published before
 * D32 that later got the Seminarkonzept label - the units then come in like a
 * collection, see Workflow 12 in TEST_WORKFLOWS.md).
 */
final class mod_seminarplaner_import_global_methodset_test extends advanced_testcase {
    /** @var int Course module id of the activity units are imported into. */
    private int $cmid = 0;

    /** @var int Module context id of that activity. */
    private int $contextid = 0;

    protected function setUp(): void {
        parent::setUp();

        if (!class_exists('\\local_seminarplaner\\local\\repository\\methodset_repository')) {
            $this->markTestSkipped('local_seminarplaner ist nicht installiert.');
        }
    }

    /**
     * Create the target activity and remember cm/context.
     *
     * @return void
     */
    private function create_activity(): void {
        $generator = $this->getDataGenerator();
        $course = $generator->create_course();
        $module = $generator->create_module('seminarplaner', ['course' => $course->id, 'name' => 'Ziel']);
        $cm = get_coursemodule_from_instance('seminarplaner', $module->id);

        $this->cmid = (int)$cm->id;
        $this->contextid = (int)context_module::instance($cm->id)->id;
    }

    /**
     * Insert a published global method set with one version carrying $snapshot.
     *
     * @param string $concepttype 'sammlung' or 'seminarkonzept'.
     * @param array $snapshot Version snapshot; an empty array yields "{}".
     * @param string $displayname
     * @return array{0:int,1:int} Set id and version id.
     */
    private function create_published_set(string $concepttype, array $snapshot,
        string $displayname = 'Globales Konzept'): array {
        global $DB;

        $now = time();
        $setid = (int)$DB->insert_record('local_kgen_methodset', (object)[
            'shortname' => 'KONZ1',
            'displayname' => $displayname,
            'scopecontextid' => (int)context_system::instance()->id,
            'status' => 'published',
            'concepttype' => $concepttype,
            'currentversion' => 0,
            'timecreated' => $now,
            'timemodified' => $now,
        ]);
        $versionid = (int)$DB->insert_record('local_kgen_methodset_ver', (object)[
            'methodsetid' => $setid,
            'versionnum' => 1,
            'status' => 'published',
            'snapshotjson' => json_encode($snapshot ?: new stdClass()),
            'timecreated' => $now,
            'timemodified' => $now,
        ]);
        $DB->set_field('local_kgen_methodset', 'currentversion', $versionid, ['id' => $setid]);

        return [$setid, $versionid];
    }

    /**
     * Insert one method row belonging to a set version.
     *
     * @param int $setid
     * @param int $versionid
     * @param string $title
     * @return int Method row id.
     */
    private function create_global_method(int $setid, int $versionid, string $title): int {
        global $DB;

        $now = time();

        return (int)$DB->insert_record('local_kgen_method', (object)[
            'methodsetid' => $setid,
            'methodsetversionid' => $versionid,
            'title' => $title,
            'kurzbeschreibung' => 'Kurz zu ' . $title,
            'timecreated' => $now,
            'timemodified' => $now,
        ]);
    }

    /**
     * Read the activity's method library.
     *
     * @return array
     */
    private function get_library(): array {
        global $USER;

        $methods = (new method_card_service())->get_methods($this->cmid, (int)$USER->id, $this->contextid);

        return is_array($methods) ? $methods : [];
    }

    /**
     * A Seminarkonzept whose snapshot carries no plan still imports its units.
     *
     * Every set published before D32 has an empty snapshot - the units live
     * only in local_kgen_method. Giving such a set the Seminarkonzept label in
     * manage.php used to make the import throw ("Seminarkonzept-Daten konnten
     * nicht gelesen werden") because a plan was required. The label decides
     * what a set is called, not whether it brings a plan.
     */
    public function test_import_seminarkonzept_without_plan_imports_units_and_creates_no_plan(): void {
        $this->resetAfterTest(true);
        $this->setAdminUser();
        $this->create_activity();

        [$setid, $versionid] = $this->create_published_set('seminarkonzept', [], 'Konzept ohne Plan');
        $this->create_global_method($setid, $versionid, 'Blitzlicht');
        $this->create_global_method($setid, $versionid, 'Gruppenarbeit');

        $result = api::import_global_methodset($this->cmid, $setid);

        $this->assertTrue($result['success']);
        $this->assertSame(2, $result['importedcount']);
        $this->assertSame(2, $result['totalcount']);
        $this->assertSame('Konzept ohne Plan', $result['setname']);
        // Ohne Plan im Snapshot entsteht kein Plan - die Einheiten kommen
        // trotzdem in die Bibliothek.
        $this->assertFalse($result['plancreated']);
        $this->assertSame('', $result['planname']);

        $library = $this->get_library();
        $titles = array_column($library, 'titel');
        sort($titles);
        $this->assertSame(['Blitzlicht', 'Gruppenarbeit'], $titles);

        $this->assertSame([], (new grid_service())->list_grids($this->cmid));

        // Auch ohne Plan bleiben es Konzept-Einheiten: das konzept--Praefix
        // sortiert sie in den Konzept-Tab, die Herkunft sagt in WELCHES.
        foreach ($library as $card) {
            $this->assertStringStartsWith('konzept-', (string)$card['id']);
            $this->assertSame($setid, (int)$card['_kgkonzept']['setid']);
            $this->assertSame('Konzept ohne Plan', (string)$card['_kgkonzept']['setname']);
            // Unabhaengige Kopie - kein Live-Link zum globalen Original.
            $this->assertArrayNotHasKey('_kgsync', $card);
        }

        // Ohne Marker erschiene der Konzept-Tab nie, obwohl importiert wurde.
        $konzepte = api::list_imported_konzepte($this->cmid)['konzepte'];
        $this->assertCount(1, $konzepte);
        $this->assertSame($setid, $konzepte[0]['setid']);
        $this->assertSame(2, $konzepte[0]['unitcount']);
        // "Hatte nie einen Plan" ist nicht "Plan wurde geloescht".
        $this->assertFalse($konzepte[0]['hadplan']);
        $this->assertFalse($konzepte[0]['planexists']);
    }

    /**
     * A Seminarkonzept with a plan creates that plan and rewrites references.
     */
    public function test_import_seminarkonzept_with_plan_creates_plan_and_rewrites_references(): void {
        global $USER;

        $this->resetAfterTest(true);
        $this->setAdminUser();
        $this->create_activity();

        $snapshot = [
            'typ' => 'seminarkonzept',
            'methods' => [
                ['id' => 'alt-1', 'titel' => 'Blitzlicht', 'kurzbeschreibung' => 'Kurz zu Blitzlicht'],
                ['id' => 'alt-2', 'titel' => 'Gruppenarbeit', 'kurzbeschreibung' => 'Kurz zu Gruppenarbeit'],
            ],
            'plan' => [
                'name' => 'Einstiegsseminar',
                'description' => 'Aus dem Konzept',
                'state' => [
                    \mod_seminarplaner\local\sequence\sequence_state::STATE_KEY => [
                        // 'version' ist Pflicht: ohne sie gilt der Abschnitt als
                        // nicht vorhanden (sequence_state::has_sequence) und
                        // save_user_state ersetzt ihn beim Anlegen des Plans
                        // durch einen frisch konvertierten, leeren.
                        'version' => \mod_seminarplaner\local\sequence\sequence_state::FORMAT_VERSION,
                        'tage' => [],
                        'platzierungen' => [],
                        'bausteine' => [],
                        'einheitenauswahlen' => [
                            'ea-1' => [
                                // legacy:-Referenzen zeigen in die Tageseintraege
                                // des Plans und bleiben unangetastet.
                                'kandidaten' => ['alt-1', 'alt-2', 'legacy:tag-eintrag'],
                                'aktiv' => 'alt-2',
                            ],
                        ],
                    ],
                ],
            ],
        ];
        [$setid, $versionid] = $this->create_published_set('seminarkonzept', $snapshot, 'Konzept mit Plan');
        $this->create_global_method($setid, $versionid, 'Blitzlicht');
        $this->create_global_method($setid, $versionid, 'Gruppenarbeit');

        $result = api::import_global_methodset($this->cmid, $setid);

        $this->assertTrue($result['success']);
        $this->assertTrue($result['plancreated']);
        $this->assertSame(2, $result['importedcount']);
        // Der Plan traegt den Namen aus dem Snapshot, nicht den des Sets.
        $this->assertSame('Einstiegsseminar', $result['planname']);

        $grids = (new grid_service())->list_grids($this->cmid);
        $this->assertCount(1, $grids);
        $grid = reset($grids);
        $this->assertSame('Einstiegsseminar', $grid->name);

        // Jede Einheit bekommt beim Import eine frische Id; die Kopie ist
        // unabhaengig vom globalen Original.
        $newids = [];
        foreach ($this->get_library() as $method) {
            $this->assertStringStartsWith('konzept-', (string)$method['id']);
            $this->assertArrayNotHasKey('_kgsync', $method);
            // Herkunft reist mit - Bibliothek und Picker gruppieren danach.
            $this->assertSame($setid, (int)$method['_kgkonzept']['setid']);
            $this->assertSame('Konzept mit Plan', (string)$method['_kgkonzept']['setname']);
            $newids[(string)$method['titel']] = (string)$method['id'];
        }
        $this->assertCount(2, $newids);

        $konzepte = api::list_imported_konzepte($this->cmid)['konzepte'];
        $this->assertCount(1, $konzepte);
        $this->assertTrue($konzepte[0]['hadplan']);
        $this->assertTrue($konzepte[0]['planexists']);
        $this->assertSame('Einstiegsseminar', $konzepte[0]['planname']);

        $state = (new grid_service())->get_user_state((int)$grid->id, (int)$USER->id);
        $auswahl = $state['state'][\mod_seminarplaner\local\sequence\sequence_state::STATE_KEY]
            ['einheitenauswahlen']['ea-1'];

        $this->assertSame([
            $newids['Blitzlicht'],
            $newids['Gruppenarbeit'],
            'legacy:tag-eintrag',
        ], $auswahl['kandidaten']);
        $this->assertSame($newids['Gruppenarbeit'], $auswahl['aktiv']);
    }
}
