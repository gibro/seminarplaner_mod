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
 * Unit tests for grid to sequence converter.
 *
 * @package    mod_seminarplaner
 * @copyright  2026 Guido Brombach <gibro@posteo.de>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

use mod_seminarplaner\local\sequence\grid_to_sequence_converter;
use mod_seminarplaner\local\sequence\sequence_state;

/**
 * Tests for the deterministic grid to sequence conversion (D20/D43).
 */
final class mod_seminarplaner_grid_to_sequence_converter_test extends basic_testcase {
    /**
     * Build a realistic legacy grid state fixture.
     *
     * @param array $days Plan day map.
     * @param array|null $config Optional config override.
     * @return array
     */
    private function gridstate(array $days, ?array $config = null): array {
        return [
            'meta' => ['title' => 'Testseminar'],
            'config' => $config ?? [
                'preset' => 'standard-week',
                'days' => ['Montag', 'Dienstag'],
                'timeRange' => ['start' => '08:30', 'end' => '17:30'],
                'granularity' => 15,
                'breaks' => [['days' => ['all'], 'start' => '12:00', 'duration' => 60]],
            ],
            'plan' => ['days' => $days],
        ];
    }

    public function test_empty_state_yields_empty_sequence(): void {
        $converter = new grid_to_sequence_converter();
        $sequenz = $converter->convert([]);

        $this->assertSame(sequence_state::FORMAT_VERSION, $sequenz['version']);
        $this->assertSame([], $sequenz['tage']);
        $this->assertSame([], sequence_state::validate($sequenz));
    }

    public function test_entries_are_ordered_by_start_time_and_split_by_midday(): void {
        $state = $this->gridstate([
            'Montag' => [
                // Deliberately unordered.
                ['uid' => 'm2', 'kind' => 'method', 'title' => 'Gruppenarbeit', 'entryId' => 'e2',
                    'startMin' => 600, 'endMin' => 720],
                ['uid' => 'm1', 'kind' => 'method', 'title' => 'Begrüßung', 'entryId' => 'e1',
                    'startMin' => 510, 'endMin' => 600],
                ['uid' => 'm3', 'kind' => 'method', 'title' => 'Nachmittagseinheit', 'entryId' => 'e3',
                    'startMin' => 780, 'endMin' => 840],
            ],
        ]);

        $sequenz = (new grid_to_sequence_converter())->convert($state);

        $this->assertSame([], sequence_state::validate($sequenz));
        $this->assertCount(2, $sequenz['tage']);
        $montag = $sequenz['tage'][0];
        $this->assertSame('Montag', $montag['bezeichnung']);
        $this->assertSame(1, $montag['tag']);

        $vormittag = $montag['anker']['vormittag']['sequenz'];
        $nachmittag = $montag['anker']['nachmittag']['sequenz'];
        $this->assertCount(2, $vormittag);
        $this->assertCount(1, $nachmittag);
        $this->assertSame('Begrüßung', $sequenz['platzierungen'][$vormittag[0]]['titel']);
        $this->assertSame('Gruppenarbeit', $sequenz['platzierungen'][$vormittag[1]]['titel']);
        $this->assertSame('Nachmittagseinheit', $sequenz['platzierungen'][$nachmittag[0]]['titel']);

        // Duration snapshot and library reference are preserved.
        $first = $sequenz['platzierungen'][$vormittag[0]];
        $this->assertSame(90, $first['dauer']);
        $auswahl = $sequenz['einheitenauswahlen'][$first['einheitenauswahl']];
        $this->assertSame(['e1'], $auswahl['kandidaten']);
        $this->assertSame('e1', $auswahl['aktiv']);
    }

    public function test_midday_break_becomes_divider_other_breaks_stay(): void {
        $state = $this->gridstate([
            'Montag' => [
                ['uid' => 'b1', 'kind' => 'break', 'title' => 'Mittagspause', 'startMin' => 720, 'endMin' => 780],
                ['uid' => 'b2', 'kind' => 'break', 'title' => 'Kaffeepause', 'startMin' => 600, 'endMin' => 615],
                ['uid' => 'm1', 'kind' => 'method', 'title' => 'Einheit', 'entryId' => 'e1',
                    'startMin' => 510, 'endMin' => 600],
            ],
        ]);

        $sequenz = (new grid_to_sequence_converter())->convert($state);

        $this->assertSame([], sequence_state::validate($sequenz));
        $placements = $sequenz['platzierungen'];
        $titles = array_map(static fn(array $p): string => $p['titel'], $placements);
        $this->assertContains('Kaffeepause', $titles);
        $this->assertNotContains('Mittagspause', $titles);

        $vormittag = $sequenz['tage'][0]['anker']['vormittag']['sequenz'];
        $this->assertSame('pause', $placements[$vormittag[1]]['typ']);
        $this->assertSame(15, $placements[$vormittag[1]]['dauer']);
    }

    public function test_longest_break_wins_as_midday_cut(): void {
        // D45 migration rule: the longest configured break is the midday
        // break - even when a shorter one starts closer to 12:30.
        $state = $this->gridstate([
            'Montag' => [
                ['uid' => 'm1', 'kind' => 'method', 'title' => 'Vor der Kaffeepause', 'entryId' => 'e1',
                    'startMin' => 700, 'endMin' => 735],
                ['uid' => 'm2', 'kind' => 'method', 'title' => 'Zwischen den Pausen', 'entryId' => 'e2',
                    'startMin' => 765, 'endMin' => 780],
                ['uid' => 'm3', 'kind' => 'method', 'title' => 'Nach der Mittagspause', 'entryId' => 'e3',
                    'startMin' => 840, 'endMin' => 900],
            ],
        ], [
            'days' => ['Montag'],
            'timeRange' => ['start' => '08:30', 'end' => '17:30'],
            'granularity' => 15,
            'breaks' => [
                // 30 min at 12:15 - closest to 12:30, but only the coffee break.
                ['days' => ['all'], 'start' => '12:15', 'duration' => 30],
                // 60 min at 13:00 - the longest break is the midday cut.
                ['days' => ['all'], 'start' => '13:00', 'duration' => 60],
            ],
        ]);

        $sequenz = (new grid_to_sequence_converter())->convert($state);

        $this->assertSame([], sequence_state::validate($sequenz));
        $vormittag = $sequenz['tage'][0]['anker']['vormittag']['sequenz'];
        $nachmittag = $sequenz['tage'][0]['anker']['nachmittag']['sequenz'];
        $this->assertCount(2, $vormittag);
        $this->assertCount(1, $nachmittag);
        $this->assertSame('Vor der Kaffeepause', $sequenz['platzierungen'][$vormittag[0]]['titel']);
        $this->assertSame('Zwischen den Pausen', $sequenz['platzierungen'][$vormittag[1]]['titel']);
        $this->assertSame('Nach der Mittagspause', $sequenz['platzierungen'][$nachmittag[0]]['titel']);
    }

    public function test_adjacent_flow_segments_merge_within_anchor(): void {
        $state = $this->gridstate([
            'Montag' => [
                // One unit flowing around a removed obstacle: two morning segments.
                ['uid' => 's1', 'kind' => 'method', 'title' => 'Lange Einheit', 'entryId' => 'e9',
                    'flowid' => 'f1', 'flowOrder' => 1, 'flowTotal' => 3, 'startMin' => 540, 'endMin' => 600],
                ['uid' => 's2', 'kind' => 'method', 'title' => 'Lange Einheit', 'entryId' => 'e9',
                    'flowid' => 'f1', 'flowOrder' => 2, 'flowTotal' => 3, 'startMin' => 600, 'endMin' => 660],
                // Third segment continues after lunch: separate placement.
                ['uid' => 's3', 'kind' => 'method', 'title' => 'Lange Einheit', 'entryId' => 'e9',
                    'flowid' => 'f1', 'flowOrder' => 3, 'flowTotal' => 3, 'startMin' => 780, 'endMin' => 810],
            ],
        ]);

        $sequenz = (new grid_to_sequence_converter())->convert($state);

        $this->assertSame([], sequence_state::validate($sequenz));
        $vormittag = $sequenz['tage'][0]['anker']['vormittag']['sequenz'];
        $nachmittag = $sequenz['tage'][0]['anker']['nachmittag']['sequenz'];
        $this->assertCount(1, $vormittag);
        $this->assertCount(1, $nachmittag);

        $morning = $sequenz['platzierungen'][$vormittag[0]];
        $this->assertSame(120, $morning['dauer']);
        $this->assertSame(['s1', 's2'], $morning['quelle']['uids']);

        $afternoon = $sequenz['platzierungen'][$nachmittag[0]];
        $this->assertSame(30, $afternoon['dauer']);
        $this->assertSame('f1', $afternoon['quelle']['flowid']);
    }

    public function test_unit_entries_become_module_placeholders(): void {
        $state = $this->gridstate([
            'Montag' => [
                ['uid' => 'u1', 'kind' => 'unit', 'title' => 'KI-Geschichte', 'unitid' => '17',
                    'slotkey' => '17|18', 'startMin' => 540, 'endMin' => 630],
                ['uid' => 'm1', 'kind' => 'method', 'title' => 'Vertiefung', 'entryId' => 'e5',
                    'parentunit' => '17', 'startMin' => 780, 'endMin' => 840],
            ],
        ]);

        $sequenz = (new grid_to_sequence_converter())->convert($state);

        $this->assertSame([], sequence_state::validate($sequenz));
        $this->assertArrayHasKey('b17', $sequenz['bausteine']);
        $baustein = $sequenz['bausteine']['b17'];
        $this->assertSame('KI-Geschichte', $baustein['titel']);
        $this->assertSame('17|18', $baustein['quelle']['slotkey']);
        $this->assertSame([], $baustein['varianten']);

        // Placeholder placement: module set, selection still unfilled.
        $vormittag = $sequenz['tage'][0]['anker']['vormittag']['sequenz'];
        $placeholder = $sequenz['platzierungen'][$vormittag[0]];
        $this->assertSame('b17', $placeholder['bausteinid']);
        $auswahl = $sequenz['einheitenauswahlen'][$placeholder['einheitenauswahl']];
        $this->assertSame([], $auswahl['kandidaten']);
        $this->assertNull($auswahl['aktiv']);

        // Afternoon method links to the same module: continuation via bausteinid.
        $nachmittag = $sequenz['tage'][0]['anker']['nachmittag']['sequenz'];
        $this->assertSame('b17', $sequenz['platzierungen'][$nachmittag[0]]['bausteinid']);
    }

    public function test_conversion_is_deterministic_and_leaves_input_untouched(): void {
        $days = [
            'Montag' => [
                ['uid' => 'm1', 'kind' => 'method', 'title' => 'A', 'entryId' => 'e1',
                    'startMin' => 540, 'endMin' => 600],
                ['uid' => 'u1', 'kind' => 'unit', 'title' => 'B', 'unitid' => '3',
                    'startMin' => 600, 'endMin' => 700],
            ],
        ];
        $state = $this->gridstate($days);
        $snapshot = json_encode($state);

        $converter = new grid_to_sequence_converter();
        $first = $converter->convert($state);
        $second = $converter->convert($state);

        $this->assertSame($first, $second);
        $this->assertSame($snapshot, json_encode($state), 'Input state must not be modified');
    }

    public function test_invalid_entries_and_missing_config_use_fallbacks(): void {
        $state = [
            'plan' => [
                'days' => [
                    'Mittwoch' => [
                        'kaputt',
                        ['uid' => 'x1', 'kind' => 'method', 'title' => 'Nullbreit', 'startMin' => 600, 'endMin' => 600],
                        ['uid' => 'x2', 'kind' => 'method', 'title' => 'Früh', 'startMin' => 500, 'endMin' => 560],
                        ['uid' => 'x3', 'kind' => 'method', 'title' => 'Spät', 'startMin' => 760, 'endMin' => 800],
                    ],
                ],
            ],
        ];

        $sequenz = (new grid_to_sequence_converter())->convert($state);

        $this->assertSame([], sequence_state::validate($sequenz));
        $this->assertCount(1, $sequenz['tage']);
        $tag = $sequenz['tage'][0];
        $this->assertSame('Mittwoch', $tag['bezeichnung']);
        // Fallback boundary 12:30: 500 -> morning, 760 -> afternoon.
        $this->assertCount(1, $tag['anker']['vormittag']['sequenz']);
        $this->assertCount(1, $tag['anker']['nachmittag']['sequenz']);
        // Broken and zero-length entries are skipped, legacy ref fallback used.
        $this->assertCount(2, $sequenz['platzierungen']);
        $pid = $tag['anker']['vormittag']['sequenz'][0];
        $auswahl = $sequenz['einheitenauswahlen'][$sequenz['platzierungen'][$pid]['einheitenauswahl']];
        $this->assertSame(['legacy:x2'], $auswahl['kandidaten']);
    }

    public function test_enrich_bausteine_fills_only_empty_fields(): void {
        $state = $this->gridstate([
            'Montag' => [
                ['uid' => 'u1', 'kind' => 'unit', 'title' => 'KI-Geschichte', 'unitid' => '17',
                    'startMin' => 540, 'endMin' => 630],
            ],
        ]);
        $converter = new grid_to_sequence_converter();
        $sequenz = $converter->convert($state);
        $sequenz['bausteine']['b17']['unterthemen'] = 'Schon gepflegt';

        $units = [
            ['id' => '17', 'title' => 'Anderer Titel', 'topics' => 'Aus dem Themenplan', 'objectives' => 'Die Lernenden können …'],
            ['id' => '99', 'title' => 'Unbeteiligt'],
        ];
        $enriched = $converter->enrich_bausteine($sequenz, $units);

        $baustein = $enriched['bausteine']['b17'];
        // Non-empty fields stay, empty ones are filled.
        $this->assertSame('KI-Geschichte', $baustein['titel']);
        $this->assertSame('Schon gepflegt', $baustein['unterthemen']);
        $this->assertSame('Die Lernenden können …', $baustein['themenplanreferenz']);
        $this->assertSame([], sequence_state::validate($enriched));

        // Without matching units nothing changes.
        $this->assertSame($enriched, $converter->enrich_bausteine($enriched, [['id' => 'x']]));
    }

    public function test_normalize_maps_keeps_empty_maps_as_json_objects(): void {
        // Simulate the PHP round trip of a freshly created plan: the
        // client sent {} for the map sections, json_decode made [] of it.
        $sequenz = json_decode(json_encode(sequence_state::create_empty()), true);
        $sequenz['bausteine'] = ['b1' => ['titel' => 'X', 'varianten' => [], 'aktivevariante' => null]];

        $normalized = sequence_state::normalize_maps($sequenz);
        $json = json_encode($normalized, JSON_UNESCAPED_UNICODE);

        $this->assertStringContainsString('"platzierungen":{}', $json);
        $this->assertStringContainsString('"einheitenauswahlen":{}', $json);
        $this->assertStringContainsString('"varianten":{}', $json);
        // Non-empty maps and the day list are untouched.
        $this->assertStringContainsString('"tage":[]', $json);
        $this->assertStringContainsString('"titel":"X"', $json);
    }

    public function test_validate_reports_broken_references(): void {
        $sequenz = sequence_state::create_empty();
        $day = sequence_state::create_day(1, 'Montag');
        $day['anker']['vormittag']['sequenz'][] = 'p1';
        $sequenz['tage'][] = $day;
        $sequenz['platzierungen']['p1'] = [
            'typ' => 'einheit',
            'bausteinid' => 'fehlt',
            'einheitenauswahl' => 'ea1',
            'dauer' => 30,
        ];
        // Neither the module nor the selection exist.
        $problems = sequence_state::validate($sequenz);
        $this->assertCount(2, $problems);
    }
}
