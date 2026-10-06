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
 * Unit tests for copying a seminar unit in the library.
 *
 * @package    mod_seminarplaner
 * @copyright  2026 Guido Brombach <gibro@posteo.de>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

use mod_seminarplaner\local\service\method_card_service;

/**
 * A copy carries its own attachments, so changing or deleting one side leaves the other intact.
 */
final class copy_method_test extends advanced_testcase {
    /** @var int Course module id. */
    private int $cmid = 0;

    /** @var int Module context id. */
    private int $contextid = 0;

    protected function setUp(): void {
        parent::setUp();
        $this->resetAfterTest(true);
        $this->setAdminUser();

        $generator = $this->getDataGenerator();
        $course = $generator->create_course();
        $module = $generator->create_module('seminarplaner', ['course' => $course->id]);
        $cm = get_coursemodule_from_instance('seminarplaner', $module->id);
        $this->cmid = (int)$cm->id;
        $this->contextid = (int)context_module::instance($cm->id)->id;
    }

    private function save(array $methods): void {
        (new method_card_service())->save_methods($this->cmid, (int)$GLOBALS['USER']->id, $this->contextid, $methods);
    }

    private function load(): array {
        $out = [];
        foreach ((new method_card_service())->get_methods($this->cmid, (int)$GLOBALS['USER']->id, $this->contextid) as $m) {
            $out[$m['id']] = $m;
        }
        return $out;
    }

    private function names(array $method): array {
        return array_map(fn($f) => (string)$f['name'], (array)($method['materialien'] ?? []));
    }

    public function test_copy_gets_its_own_attachments(): void {
        $this->save([[
            'id' => 'orig',
            'titel' => 'Kennenlernrunde',
            'materialien' => [['name' => 'Handout.pdf', 'contentbase64' => base64_encode('inhalt')]],
        ]]);
        $orig = $this->load()['orig'];
        $this->assertSame(['Handout.pdf'], $this->names($orig));

        // So schickt die Bibliothek die Kopie: Dateiliste vom Original plus _copyfrom.
        $copy = $orig;
        $copy['id'] = 'kopie';
        $copy['titel'] = 'Kennenlernrunde (Kopie)';
        $copy['_copyfrom'] = 'orig';
        $copy['materialien'] = [['name' => 'Handout.pdf']];
        $this->save([$orig, $copy]);

        $stored = $this->load();
        $this->assertSame(['Handout.pdf'], $this->names($stored['kopie']));
        $this->assertArrayNotHasKey('_copyfrom', $stored['kopie']);
        $this->assertNotSame(
            (int)$stored['orig']['materialien'][0]['itemid'],
            (int)$stored['kopie']['materialien'][0]['itemid']
        );

        // Ein zweites Speichern mit noch anhängendem _copyfrom legt keine Doppel an.
        $again = $stored['kopie'];
        $again['_copyfrom'] = 'orig';
        $this->save([$stored['orig'], $again]);
        $this->assertSame(['Handout.pdf'], $this->names($this->load()['kopie']));

        // Das Original löschen: Die Datei der Kopie bleibt.
        $this->save([$this->load()['kopie']]);
        $stored = $this->load();
        $this->assertArrayNotHasKey('orig', $stored);
        $this->assertSame(['Handout.pdf'], $this->names($stored['kopie']));
        $fs = get_file_storage();
        $file = $fs->get_file($this->contextid, 'mod_seminarplaner', 'method_materialien',
            (int)$stored['kopie']['materialien'][0]['itemid'], '/', 'Handout.pdf');
        $this->assertNotFalse($file);
        $this->assertSame('inhalt', $file->get_content());
    }
}
