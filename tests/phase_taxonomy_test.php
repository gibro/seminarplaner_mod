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
 * Unit tests for the seminar phase taxonomy.
 *
 * @package    mod_seminarplaner
 * @copyright  2026 Guido Brombach <gibro@posteo.de>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

global $CFG;
require_once($CFG->dirroot . '/mod/seminarplaner/locallib.php');

use mod_seminarplaner\local\sequence\roterfaden_model;

/**
 * Die sechste Seminarphase „Warmup/Aktivierung" (12. Oktober 2026).
 *
 * Vorher wurde ein „Warm-up" aus Alt-Bestand und Import still zur
 * Orientierung umgeschrieben. Jetzt hat es eine eigene Phase; „Einstieg"
 * bleibt Orientierung.
 */
final class phase_taxonomy_test extends advanced_testcase {

    /**
     * Die Phase steht in der Auswahl für Editor und Filter - als erste.
     */
    public function test_phase_options_start_with_warmup(): void {
        $options = seminarplaner_phase_options();
        $this->assertSame('Warmup/Aktivierung', array_key_first($options));
        $this->assertCount(6, $options);
    }

    /**
     * Alt-Bezeichnungen landen in der neuen Phase, „Einstieg" nicht.
     */
    public function test_normalize_maps_warmup_aliases(): void {
        $this->assertSame('Warmup/Aktivierung', seminarplaner_normalize_phase('Warm-up'));
        $this->assertSame('Warmup/Aktivierung', seminarplaner_normalize_phase('warmup'));
        $this->assertSame('Warmup/Aktivierung', seminarplaner_normalize_phase('Aktivierung'));
        $this->assertSame('Warmup/Aktivierung', seminarplaner_normalize_phase('Warmup/Aktivierung'));
        $this->assertSame('Orientierung', seminarplaner_normalize_phase('Einstieg'));
    }

    /**
     * Die App-Ableitung (Parität zu roterfadenmodel.js) erkennt die Phase.
     */
    public function test_roterfaden_phase_key(): void {
        $this->assertSame('warmup', roterfaden_model::phase_key('Warmup/Aktivierung'));
        $this->assertSame('warmup', roterfaden_model::phase_key(['Warm-up']));
        $this->assertSame('orientierung', roterfaden_model::phase_key('Einstieg'));
        // „Vorwissen aktivieren" ist Erfahrungserhebung, nicht Aktivierung.
        $this->assertSame('erfahrung', roterfaden_model::phase_key('Vorwissen aktivieren'));
        // Die Testumgebung läuft auf Englisch - die deutsche Fassung ausdrücklich.
        $this->assertSame('Warmup/Aktivierung',
            get_string_manager()->get_string('phase_warmup', 'mod_seminarplaner', null, 'de'));
    }
}
