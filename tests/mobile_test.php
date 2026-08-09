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
 * Unit tests for the Moodle App view.
 *
 * @package    mod_seminarplaner
 * @copyright  2026 Guido Brombach <gibro@posteo.de>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

use mod_seminarplaner\local\sequence\roterfaden_model;
use mod_seminarplaner\local\service\grid_service;
use mod_seminarplaner\output\mobile;

/**
 * Der Rote Faden in der Moodle App.
 *
 * Zwei Dinge muessen stimmen: die Ableitung aus dem Schnappschuss (dieselbe
 * Rechnung, die im Browser roterfadenmodel.js macht) und die Ausgabe, die die
 * App bekommt — samt der Frage, wer sie ueberhaupt zu sehen bekommt.
 */
final class mobile_test extends advanced_testcase {

    /** @var int Course module id of the activity under test. */
    private int $cmid = 0;

    /** @var int Course id the activity lives in. */
    private int $courseid = 0;

    protected function setUp(): void {
        parent::setUp();

        $this->resetAfterTest(true);
        $this->setAdminUser();

        $generator = $this->getDataGenerator();
        $course = $generator->create_course();
        $module = $generator->create_module('seminarplaner', ['course' => $course->id, 'name' => 'Grundlagenseminar']);
        $cm = get_coursemodule_from_instance('seminarplaner', $module->id);

        $this->courseid = (int)$course->id;
        $this->cmid = (int)$cm->id;
    }

    /**
     * Ein zweitaegiger Ablauf: gebuendelter Baustein, Pause, lose Einheit,
     * am zweiten Tag die Fortsetzung desselben Bausteins.
     *
     * @param string $loosetitle Titel der losen Einheit (fuer den Klammer-Test).
     * @return array Der Zustand, wie er veroeffentlicht wird.
     */
    private function build_state(string $loosetitle = 'Rollenspiel'): array {
        return [
            'config' => [
                'days' => ['Montag', 'Dienstag'],
                'ankerzeiten' => [
                    'vormittag' => ['start' => '09:00', 'end' => '12:30'],
                    'nachmittag' => ['start' => '13:30', 'end' => '17:00'],
                ],
            ],
            'methodcards' => [
                ['id' => 'c1', 'titel' => 'Kennenlernrunde', 'seminarphase' => ['Orientierung']],
            ],
            'sequenz' => [
                'version' => 1,
                'tage' => [
                    [
                        'tag' => 1,
                        'bezeichnung' => 'Montag',
                        'anker' => [
                            'vormittag' => ['sequenz' => ['px1', 'px2', 'px3', 'px4']],
                            'nachmittag' => ['sequenz' => []],
                        ],
                    ],
                    [
                        'tag' => 2,
                        'bezeichnung' => 'Dienstag',
                        'anker' => [
                            'vormittag' => ['sequenz' => ['px5']],
                            'nachmittag' => ['sequenz' => []],
                        ],
                    ],
                ],
                'platzierungen' => [
                    'px1' => [
                        'typ' => 'einheit', 'titel' => 'Ankommen', 'dauer' => 45,
                        'bausteinid' => 'b1', 'einheitenauswahl' => 'ea1',
                    ],
                    'px2' => [
                        'typ' => 'einheit', 'titel' => 'Erwartungen', 'dauer' => 30,
                        'bausteinid' => 'b1', 'einheitenauswahl' => null,
                    ],
                    'px3' => ['typ' => 'pause', 'titel' => 'Kaffeepause', 'dauer' => 30],
                    'px4' => [
                        'typ' => 'einheit', 'titel' => $loosetitle, 'dauer' => 60,
                        'bausteinid' => null, 'einheitenauswahl' => null,
                    ],
                    'px5' => [
                        'typ' => 'einheit', 'titel' => 'Vertiefung', 'dauer' => 60,
                        'bausteinid' => 'b1', 'einheitenauswahl' => null,
                    ],
                ],
                'einheitenauswahlen' => ['ea1' => ['kandidaten' => ['c1'], 'aktiv' => 'c1']],
                'bausteine' => ['b1' => ['titel' => 'Einstieg ins Thema']],
            ],
        ];
    }

    /**
     * Den Ablauf als Roten Faden veroeffentlichen.
     *
     * @param array $state Zustand.
     * @return void
     */
    private function publish(array $state): void {
        $service = new grid_service();
        $gridid = $service->create_grid($this->cmid, 'Zweitagesseminar', (int)$GLOBALS['USER']->id);
        $service->save_user_state($gridid, (int)$GLOBALS['USER']->id, $state);
        $service->publish_roterfaden($this->cmid, $gridid, $state, (int)$GLOBALS['USER']->id);
    }

    public function test_build_days_bundles_bausteine_and_skips_pauses(): void {
        $days = roterfaden_model::build_days($this->build_state());

        $this->assertCount(2, $days);
        $this->assertSame('Montag', $days[0]['name']);
        $this->assertSame(2, $days[0]['count']);
        // Der Nachmittag ist leer und taucht deshalb gar nicht auf.
        $this->assertCount(1, $days[0]['anchors']);
        $this->assertSame('vormittag', $days[0]['anchors'][0]['key']);
        $this->assertSame(9 * 60, $days[0]['anchors'][0]['start']);

        $blocks = $days[0]['anchors'][0]['blocks'];
        $this->assertCount(2, $blocks);

        // Zwei Platzierungen desselben Bausteins sind EIN Block mit zwei Themen.
        $this->assertSame(1, $blocks[0]['num']);
        $this->assertSame('Einstieg ins Thema', $blocks[0]['title']);
        $this->assertSame(9 * 60, $blocks[0]['startMin']);
        $this->assertSame(75, $blocks[0]['minutes']);
        $this->assertSame('orientierung', $blocks[0]['phase']);
        $this->assertFalse($blocks[0]['continuation']);
        $this->assertSame(['Ankommen', 'Erwartungen'], array_column($blocks[0]['themen'], 'title'));

        // Die Pause ist kein Programmpunkt, rueckt die Uhr aber weiter.
        $this->assertSame('Rollenspiel', $blocks[1]['title']);
        $this->assertSame((10 * 60) + 45, $blocks[1]['startMin']);
        $this->assertSame(60, $blocks[1]['minutes']);
        $this->assertSame('', $blocks[1]['phase']);

        // Derselbe Baustein am zweiten Tag ist eine Fortsetzung.
        $second = $days[1]['anchors'][0]['blocks'][0];
        $this->assertSame(3, $second['num']);
        $this->assertTrue($second['continuation']);
    }

    public function test_build_days_falls_back_to_legacy_plan(): void {
        $days = roterfaden_model::build_days([
            'config' => [
                'days' => ['Montag'],
                'ankerzeiten' => [
                    'vormittag' => ['start' => '09:00', 'end' => '12:30'],
                    'nachmittag' => ['start' => '13:30', 'end' => '17:00'],
                ],
            ],
            'plan' => ['days' => ['Montag' => [
                ['kind' => 'unit', 'uid' => 'u1', 'startMin' => 540, 'endMin' => 600,
                    'title' => 'Alter Eintrag', 'phase' => 'Analyse',
                    'topics' => '<p>Erstes Thema</p><p>Zweites Thema</p>'],
                ['kind' => 'break', 'uid' => 'b', 'startMin' => 600, 'endMin' => 615],
                ['kind' => 'unit', 'uid' => 'u2', 'startMin' => 840, 'endMin' => 900, 'title' => 'Nach der Pause'],
            ]]],
        ]);

        $this->assertCount(1, $days);
        $this->assertCount(2, $days[0]['anchors']);
        $vormittag = $days[0]['anchors'][0];
        $this->assertSame('vormittag', $vormittag['key']);
        $this->assertSame('analyse', $vormittag['blocks'][0]['phase']);
        // Rich-Text-Unterthemen werden zu einzelnen Themenzeilen.
        $this->assertSame(
            ['Erstes Thema', 'Zweites Thema'],
            array_column($vormittag['blocks'][0]['themen'], 'title')
        );
        // Alles ab der Mittagsgrenze gehoert zum Nachmittag.
        $this->assertSame('nachmittag', $days[0]['anchors'][1]['key']);
        $this->assertSame('Nach der Pause', $days[0]['anchors'][1]['blocks'][0]['title']);
    }

    public function test_duration_labels(): void {
        $this->assertSame('20 Min', roterfaden_model::duration_label(20));
        $this->assertSame('2 Std', roterfaden_model::duration_label(120));
        $this->assertSame('1 Std 30 Min', roterfaden_model::duration_label(90));
        $this->assertSame('09:05', roterfaden_model::clock_label(545));
    }

    public function test_course_view_renders_the_published_thread(): void {
        $this->publish($this->build_state());

        $result = mobile::mobile_course_view(['cmid' => $this->cmid, 'courseid' => $this->courseid]);
        $html = $result['templates'][0]['html'];

        $this->assertSame('main', $result['templates'][0]['id']);
        $this->assertStringContainsString('Montag', $html);
        $this->assertStringContainsString('Dienstag', $html);
        $this->assertStringContainsString('Einstieg ins Thema', $html);
        $this->assertStringContainsString('Vormittag', $html);
        $this->assertStringContainsString('09:00', $html);
        $this->assertStringContainsString('1 Std 15 Min', $html);
        $this->assertStringContainsString(get_string('phase_orientierung', 'mod_seminarplaner'), $html);
        $this->assertStringContainsString(get_string('mobile_continuation', 'mod_seminarplaner'), $html);
        $this->assertStringContainsString(
            get_string('mobile_days', 'mod_seminarplaner', 2)
                . ' · ' . get_string('mobile_items', 'mod_seminarplaner', 3),
            $html
        );
        // Der leere Nachmittag steht nicht in der Ausgabe.
        $this->assertStringNotContainsString('Nachmittag', $html);
    }

    public function test_course_view_without_published_thread_shows_the_hint(): void {
        $result = mobile::mobile_course_view(['cmid' => $this->cmid, 'courseid' => $this->courseid]);
        $html = $result['templates'][0]['html'];

        $this->assertStringContainsString(
            get_string('roterfaden_empty', 'mod_seminarplaner'),
            $html
        );
    }

    public function test_course_view_needs_the_roterfaden_capability(): void {
        $this->publish($this->build_state());

        $student = $this->getDataGenerator()->create_and_enrol(get_course($this->courseid), 'student');
        $studentrole = $GLOBALS['DB']->get_record('role', ['shortname' => 'student'], '*', MUST_EXIST);
        $context = context_module::instance($this->cmid);
        assign_capability(
            'mod/seminarplaner:viewroterfaden',
            CAP_PROHIBIT,
            (int)$studentrole->id,
            $context->id,
            true
        );
        $this->setUser($student);

        $result = mobile::mobile_course_view(['cmid' => $this->cmid, 'courseid' => $this->courseid]);
        $html = $result['templates'][0]['html'];

        $this->assertStringContainsString(get_string('mobile_noaccess', 'mod_seminarplaner'), $html);
        $this->assertStringNotContainsString('Einstieg ins Thema', $html);
    }

    public function test_curly_braces_in_titles_cannot_reach_angular(): void {
        // Ein "{{" im Seminartitel waere in der App eine Interpolation und
        // liesse die ganze Ansicht leer — es muss als Entitaet ankommen.
        $this->publish($this->build_state('Planspiel {{ausbruch}}'));

        $result = mobile::mobile_course_view(['cmid' => $this->cmid, 'courseid' => $this->courseid]);
        $html = $result['templates'][0]['html'];

        $this->assertStringNotContainsString('{{', $html);
        $this->assertStringNotContainsString('}}', $html);
        $this->assertStringContainsString('&#123;&#123;ausbruch&#125;&#125;', $html);
    }
}
