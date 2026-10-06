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
 * Unit tests for adopting single global methods.
 *
 * @package    mod_seminarplaner
 * @copyright  2026 Guido Brombach <gibro@posteo.de>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

use mod_seminarplaner\external\api;
use mod_seminarplaner\local\service\method_card_service;

/**
 * DB-backed tests for adopt_global_method (D33).
 *
 * Gibt es lokal schon eine Einheit mit dem Titel der globalen Methode, wird sie
 * wiederverwendet statt eine zweite gleichnamige Kopie anzulegen.
 */
final class adopt_global_method_test extends advanced_testcase {
    /** @var int Course module id of the activity. */
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
     * Activity plus a published system-wide set with the given method titles.
     *
     * @param string[] $titles
     * @return int[] Global method ids in the order of $titles.
     */
    private function setup_activity_and_set(array $titles): array {
        global $DB;

        $generator = $this->getDataGenerator();
        $course = $generator->create_course();
        $module = $generator->create_module('seminarplaner', ['course' => $course->id, 'name' => 'Ziel']);
        $cm = get_coursemodule_from_instance('seminarplaner', $module->id);
        $this->cmid = (int)$cm->id;
        $this->contextid = (int)context_module::instance($cm->id)->id;

        $now = time();
        $setid = (int)$DB->insert_record('local_kgen_methodset', (object)[
            'shortname' => 'SAMML',
            'displayname' => 'Sammlung',
            'scopecontextid' => (int)context_system::instance()->id,
            'status' => 'published',
            'concepttype' => 'sammlung',
            'currentversion' => 0,
            'timecreated' => $now,
            'timemodified' => $now,
        ]);
        $versionid = (int)$DB->insert_record('local_kgen_methodset_ver', (object)[
            'methodsetid' => $setid,
            'versionnum' => 1,
            'status' => 'published',
            'snapshotjson' => '{}',
            'timecreated' => $now,
            'timemodified' => $now,
        ]);
        $DB->set_field('local_kgen_methodset', 'currentversion', $versionid, ['id' => $setid]);

        $ids = [];
        foreach ($titles as $title) {
            $ids[] = (int)$DB->insert_record('local_kgen_method', (object)[
                'methodsetid' => $setid,
                'methodsetversionid' => $versionid,
                'title' => $title,
                'kurzbeschreibung' => 'Global: ' . $title,
                'timecreated' => $now,
                'timemodified' => $now,
            ]);
        }
        return $ids;
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
     * Zweimal dieselbe Methode uebernehmen ergibt eine Karte, nicht zwei.
     */
    public function test_adopting_twice_keeps_one_card(): void {
        $this->resetAfterTest(true);
        $this->setAdminUser();
        [$methodid] = $this->setup_activity_and_set(['Blitzlicht']);

        $first = api::adopt_global_method($this->cmid, $methodid);
        $second = api::adopt_global_method($this->cmid, $methodid);

        $this->assertFalse($first['alreadylocal']);
        $this->assertTrue($second['alreadylocal']);
        $this->assertSame($first['localid'], $second['localid']);
        $this->assertCount(1, $this->get_library());
    }

    /**
     * Eine schon vorhandene lokale Einheit gleichen Titels (Gross-/Kleinschreibung
     * und Leerraum egal) wird verwendet und bleibt unveraendert.
     */
    public function test_existing_local_unit_with_same_title_is_reused(): void {
        global $USER;
        $this->resetAfterTest(true);
        $this->setAdminUser();
        [$methodid] = $this->setup_activity_and_set(['Blitzlicht']);

        (new method_card_service())->save_methods($this->cmid, (int)$USER->id, $this->contextid, [
            ['id' => 'lokal-1', 'titel' => ' blitzlicht ', 'kurzbeschreibung' => 'Meine Fassung'],
        ]);

        $result = api::adopt_global_method($this->cmid, $methodid);

        $this->assertTrue($result['alreadylocal']);
        $this->assertSame('lokal-1', $result['localid']);
        $library = $this->get_library();
        $this->assertCount(1, $library);
        $this->assertSame('Meine Fassung', $library[0]['kurzbeschreibung']);
    }

    /**
     * Ein neuer Titel kommt weiterhin als eigene Kopie hinzu.
     */
    public function test_new_title_is_added_as_copy(): void {
        global $USER;
        $this->resetAfterTest(true);
        $this->setAdminUser();
        [$methodid] = $this->setup_activity_and_set(['Gruppenarbeit']);

        (new method_card_service())->save_methods($this->cmid, (int)$USER->id, $this->contextid, [
            ['id' => 'lokal-1', 'titel' => 'Blitzlicht'],
        ]);

        $result = api::adopt_global_method($this->cmid, $methodid);

        $this->assertFalse($result['alreadylocal']);
        $this->assertSame(['Blitzlicht', 'Gruppenarbeit'], array_column($this->get_library(), 'titel'));
    }

    /**
     * Die Detailansicht liefert die vollen Texte (bereinigt) und laesst den Bestand unberuehrt.
     */
    public function test_details_show_full_content_without_adopting(): void {
        global $DB;
        $this->resetAfterTest(true);
        $this->setAdminUser();
        [$methodid] = $this->setup_activity_and_set(['Blitzlicht']);
        $DB->update_record('local_kgen_method', (object)[
            'id' => $methodid,
            'ablauf' => '<p>Reihum ein Satz.</p><script>alert(1)</script>',
            'lernziele' => '<ul><li>Stimmung erfassen</li></ul>',
            'raumanforderungen' => 'Stuhlkreis',
            'zeitbedarf' => '15',
        ]);

        $details = api::get_global_method_details($this->cmid, $methodid);
        $details = \core_external\external_api::clean_returnvalue(api::get_global_method_details_returns(), $details);

        $this->assertSame('Blitzlicht', $details['titel']);
        $this->assertSame('Sammlung', $details['setname']);
        $this->assertSame('15', $details['zeitbedarf']);
        $this->assertSame(['Stuhlkreis'], $details['raum']);
        $this->assertStringContainsString('Reihum ein Satz.', $details['ablauf']);
        $this->assertStringNotContainsString('<script', $details['ablauf']);
        $this->assertStringContainsString('Stimmung erfassen', $details['lernziele']);
        $this->assertSame([], $details['attachments']);
        $this->assertCount(0, $this->get_library());
    }

    /**
     * Methoden ausserhalb der fuer die Aktivitaet sichtbaren Sammlungen bleiben verborgen.
     */
    public function test_details_reject_method_outside_visible_sets(): void {
        global $DB;
        $this->resetAfterTest(true);
        $this->setAdminUser();
        [$methodid] = $this->setup_activity_and_set(['Blitzlicht']);
        $setid = (int)$DB->get_field('local_kgen_method', 'methodsetid', ['id' => $methodid]);
        $DB->set_field('local_kgen_methodset', 'status', 'draft', ['id' => $setid]);

        $this->expectException(invalid_parameter_exception::class);
        api::get_global_method_details($this->cmid, $methodid);
    }
}
