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
 * Ableitung des Roten Fadens aus dem veroeffentlichten Snapshot (PHP-Seite).
 *
 * @package    mod_seminarplaner
 * @copyright  2026 Guido Brombach <gibro@posteo.de>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace mod_seminarplaner\local\sequence;

defined('MOODLE_INTERNAL') || die();

/**
 * Tage, Anker und Bloecke des Roten Fadens aus einem Snapshot ableiten.
 *
 * Spiegelbild von amd/src/roterfadenmodel.js — Zeile fuer Zeile dieselbe Regel,
 * damit Moodle-App und Browser denselben Ablauf zeigen. Der Browser rechnet
 * weiterhin im Client (die Seite laedt den Snapshot per Webservice), die
 * Moodle-App kann kein AMD-Modul ausfuehren und braucht das Ergebnis fertig
 * vom Server. Wer hier etwas aendert, aendert es auch dort (und umgekehrt);
 * tests/mobile_test.php haelt diese Seite an Beispielen fest, die dieselbe
 * Ableitung beschreiben.
 *
 * @package    mod_seminarplaner
 * @copyright  2026 Guido Brombach <gibro@posteo.de>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class roterfaden_model {

    /** @var string[] Wochentage in der Reihenfolge, in der Seminare geplant werden. */
    public const DAYS_ALL = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

    /** @var string[] Die beiden Anker eines Seminartages. */
    public const ANCHORS = ['vormittag', 'nachmittag'];

    /**
     * Seminarphase aus einem Freitext ableiten (wie sequenz.js/grid.js).
     *
     * @param mixed $phase Phasenangabe der Methodenkarte (String oder Liste).
     * @return string Phasenschluessel oder leerer String.
     */
    public static function phase_key($phase): string {
        $phasekeys = [
            'orientierung' => ['orientierung', 'warm-up', 'einstieg'],
            'erfahrung' => ['erfahrung', 'erwartungsabfrage', 'vorwissen'],
            'analyse' => ['analyse'],
            'handlung' => ['handlung', 'aktion', 'praxis'],
            'transfer' => ['transfer', 'abschluss', 'auswertung'],
        ];
        $raw = is_array($phase) ? implode(', ', array_filter($phase)) : $phase;
        $clean = \core_text::strtolower(trim((string)$raw));
        if ($clean === '') {
            return '';
        }
        foreach ($phasekeys as $key => $needles) {
            foreach ($needles as $needle) {
                if (strpos($clean, $needle) !== false) {
                    return $key;
                }
            }
        }
        return '';
    }

    /**
     * "HH:MM" in Minuten seit Mitternacht umrechnen.
     *
     * @param mixed $value Uhrzeit als String.
     * @return int|null Minuten oder null bei ungueltiger Eingabe.
     */
    public static function parse_clock($value): ?int {
        if (!is_string($value) || strpos($value, ':') === false) {
            return null;
        }
        [$hh, $mm] = array_pad(explode(':', $value), 2, null);
        if (!is_numeric($hh) || !is_numeric($mm)) {
            return null;
        }
        return (int)$hh * 60 + (int)$mm;
    }

    /**
     * Minuten als "HH:MM" ausgeben.
     *
     * @param int $min Minuten seit Mitternacht.
     * @return string
     */
    public static function clock_label(int $min): string {
        return sprintf('%02d:%02d', intdiv(max(0, $min), 60), max(0, $min) % 60);
    }

    /**
     * Dauer als "20 Min" / "2 Std" / "1 Std 30 Min" ausgeben.
     *
     * @param int $minutes Dauer in Minuten.
     * @return string
     */
    public static function duration_label(int $minutes): string {
        $total = max(0, $minutes);
        $h = intdiv($total, 60);
        $m = $total % 60;
        if (!$h) {
            return $m . ' Min';
        }
        return $m ? ($h . ' Std ' . $m . ' Min') : ($h . ' Std');
    }

    /**
     * Ankerzeiten aus der Konfiguration ableiten.
     *
     * Ohne konfigurierte Ankerzeiten schneidet die laengste Pause den Tag —
     * deckungsgleich mit grid.js (deriveAnkerzeiten) und importexport.js.
     *
     * @param array $config Konfigurationsabschnitt des Plans.
     * @return array Ankerzeiten mit vormittag/nachmittag und den Randtag-Flags.
     */
    public static function derive_ankerzeiten(array $config): array {
        $az = $config['ankerzeiten'] ?? null;
        if (
            is_array($az) && isset($az['vormittag']['start'], $az['nachmittag']['start'])
                && self::parse_clock($az['vormittag']['start']) !== null
                && self::parse_clock($az['nachmittag']['start']) !== null
        ) {
            return $az;
        }
        $range = $config['timeRange'] ?? [];
        $start = self::parse_clock($range['start'] ?? null) === null ? '08:30' : $range['start'];
        $end = self::parse_clock($range['end'] ?? null) === null ? '17:30' : $range['end'];
        $best = null;
        foreach ((array)($config['breaks'] ?? []) as $brk) {
            if (!is_array($brk) || self::parse_clock($brk['start'] ?? null) === null) {
                continue;
            }
            $duration = max(0, (int)($brk['duration'] ?? 0));
            if ($duration && (!$best || $duration > $best['duration'])) {
                $best = ['start' => $brk['start'], 'duration' => $duration];
            }
        }
        return [
            'vormittag' => ['start' => $start, 'end' => $best ? $best['start'] : '12:30'],
            'nachmittag' => [
                'start' => $best ? self::clock_label(self::parse_clock($best['start']) + $best['duration']) : '12:30',
                'end' => $end,
            ],
            'ersterTagNurNachmittag' => false,
            'letzterTagNurVormittag' => false,
        ];
    }

    /**
     * Tage/Anker/Bloecke aus einem veroeffentlichten Snapshot ableiten.
     *
     * @param array $state Entschluesselter Snapshot (statejson).
     * @return array Tage mit Ankern, Bloecken und deren Themen.
     */
    public static function build_days(array $state): array {
        $seq = $state['sequenz'] ?? null;
        if (is_array($seq) && !empty($seq['tage']) && is_array($seq['tage'])) {
            return self::build_from_sequence($state);
        }
        return self::build_from_plan($state);
    }

    /**
     * Ableitung aus der Sequenz (seit D20 die massgebliche Struktur).
     *
     * @param array $state Snapshot.
     * @return array Tage.
     */
    private static function build_from_sequence(array $state): array {
        $seq = is_array($state['sequenz'] ?? null) ? $state['sequenz'] : [];
        $config = is_array($state['config'] ?? null) ? $state['config'] : [];
        $placements = is_array($seq['platzierungen'] ?? null) ? $seq['platzierungen'] : [];
        $bausteine = is_array($seq['bausteine'] ?? null) ? $seq['bausteine'] : [];
        $auswahlen = is_array($seq['einheitenauswahlen'] ?? null) ? $seq['einheitenauswahlen'] : [];
        $cards = [];
        foreach ((array)($state['methodcards'] ?? []) as $card) {
            if (is_array($card) && isset($card['id'])) {
                $cards[(string)$card['id']] = $card;
            }
        }
        $configdays = is_array($config['days'] ?? null) ? array_values($config['days']) : [];

        $az = self::derive_ankerzeiten($config);
        $anchorframe = [
            'vormittag' => [
                'start' => self::parse_clock($az['vormittag']['start'] ?? null),
                'end' => self::parse_clock($az['vormittag']['end'] ?? null),
            ],
            'nachmittag' => [
                'start' => self::parse_clock($az['nachmittag']['start'] ?? null),
                'end' => self::parse_clock($az['nachmittag']['end'] ?? null),
            ],
        ];
        $tage = array_values((array)($seq['tage'] ?? []));
        $tagecount = count($tage);
        $seenbausteine = [];
        $days = [];
        $num = 0;

        foreach ($tage as $idx => $tag) {
            $bez = (string)($tag['bezeichnung'] ?? '');
            $dayname = ($bez !== '' && in_array($bez, $configdays, true)) ? $bez : (string)($configdays[$idx] ?? '');
            if ($dayname === '') {
                continue;
            }
            // D45: An Anreise-/Abreisetagen entfaellt ein Anker vollstaendig.
            $off = [
                'vormittag' => $idx === 0 && !empty($az['ersterTagNurNachmittag']),
                'nachmittag' => $idx === ($tagecount - 1) && !empty($az['letzterTagNurVormittag']),
            ];
            $anchors = [];

            foreach (self::ANCHORS as $ankername) {
                if ($off[$ankername]) {
                    continue;
                }
                $frame = $anchorframe[$ankername];
                $pids = $tag['anker'][$ankername]['sequenz'] ?? [];
                $items = [];
                foreach ((array)$pids as $pid) {
                    if (is_array($placements[(string)$pid] ?? null)) {
                        $items[] = ['pid' => (string)$pid, 'data' => $placements[(string)$pid]];
                    }
                }

                // Aufeinanderfolgende Platzierungen desselben Bausteins buendeln.
                $groups = [];
                foreach ($items as $entry) {
                    $bid = (($entry['data']['typ'] ?? '') === 'einheit')
                        ? ((string)($entry['data']['bausteinid'] ?? '') ?: null)
                        : null;
                    $lastindex = $groups ? array_key_last($groups) : null;
                    if ($lastindex !== null && $bid !== null && $groups[$lastindex]['bausteinid'] === $bid) {
                        $groups[$lastindex]['items'][] = $entry;
                        continue;
                    }
                    $groups[] = ['bausteinid' => $bid, 'items' => [$entry]];
                }

                $clock = $frame['start'] === null ? 0 : $frame['start'];
                $blocks = [];
                foreach ($groups as $group) {
                    $groupminutes = 0;
                    foreach ($group['items'] as $entry) {
                        $groupminutes += max(0, (int)($entry['data']['dauer'] ?? 0));
                    }
                    // Pausen sind keine Programmpunkte — sie ruecken die Uhr weiter,
                    // erscheinen aber nicht als Block.
                    if (($group['items'][0]['data']['typ'] ?? '') === 'pause') {
                        $clock += $groupminutes;
                        continue;
                    }

                    $baustein = $group['bausteinid'] ? ($bausteine[$group['bausteinid']] ?? null) : null;
                    $themen = [];
                    foreach ($group['items'] as $entry) {
                        $placement = $entry['data'];
                        $auswahl = !empty($placement['einheitenauswahl'])
                            ? ($auswahlen[(string)$placement['einheitenauswahl']] ?? null)
                            : null;
                        $aktiv = (is_array($auswahl) && ($auswahl['aktiv'] ?? null) !== null)
                            ? (string)$auswahl['aktiv'] : '';
                        $card = $aktiv !== '' ? ($cards[$aktiv] ?? null) : null;
                        $title = trim((string)($placement['titel'] ?? ''));
                        if ($title === '') {
                            $title = trim((string)(is_array($card) ? ($card['titel'] ?? '') : ''));
                        }
                        if ($title === '') {
                            $title = trim((string)(is_array($baustein) ? ($baustein['titel'] ?? '') : ''));
                        }
                        $themen[] = [
                            'title' => $title !== '' ? $title : 'Seminareinheit',
                            'phase' => self::phase_key(is_array($card) ? ($card['seminarphase'] ?? '') : ''),
                            'minutes' => max(0, (int)($placement['dauer'] ?? 0)),
                        ];
                    }

                    $continuation = !empty($group['bausteinid']) && !empty($seenbausteine[$group['bausteinid']]);
                    if ($group['bausteinid']) {
                        $seenbausteine[$group['bausteinid']] = true;
                    }
                    $num++;
                    $bausteintitel = trim((string)(is_array($baustein) ? ($baustein['titel'] ?? '') : ''));
                    // Wie im JS: die Blockphase ist die Phase der ERSTEN Einheit,
                    // sobald ueberhaupt eine Einheit der Gruppe eine Phase traegt.
                    $hasphase = false;
                    foreach ($themen as $theme) {
                        if ($theme['phase'] !== '') {
                            $hasphase = true;
                            break;
                        }
                    }
                    $blocks[] = [
                        'id' => $dayname . '-' . $ankername . '-' . $group['items'][0]['pid'],
                        'num' => $num,
                        'title' => $bausteintitel !== '' ? $bausteintitel : $themen[0]['title'],
                        'continuation' => $continuation,
                        'startMin' => $clock,
                        'minutes' => $groupminutes,
                        'phase' => $hasphase ? $themen[0]['phase'] : '',
                        'themen' => $themen,
                    ];
                    $clock += $groupminutes;
                }

                if ($blocks) {
                    $anchors[] = [
                        'key' => $ankername,
                        'name' => self::anchor_label($ankername),
                        'start' => $frame['start'],
                        'end' => $frame['end'],
                        'blocks' => $blocks,
                    ];
                }
            }

            if ($anchors) {
                $days[] = self::day($dayname, $anchors);
            }
        }

        return $days;
    }

    /**
     * Fallback fuer Snapshots aus der Zeit vor der Sequenz.
     *
     * Jeder Grid-Eintrag ist ein Block, seine Unterthemen werden zu Themen-Zeilen.
     *
     * @param array $state Snapshot.
     * @return array Tage.
     */
    private static function build_from_plan(array $state): array {
        $plandays = is_array($state['plan']['days'] ?? null) ? $state['plan']['days'] : [];
        $config = is_array($state['config'] ?? null) ? $state['config'] : [];
        $units = is_array($state['planningState']['units'] ?? null) ? $state['planningState']['units'] : [];
        $daynames = (is_array($config['days'] ?? null) && $config['days'])
            ? array_values($config['days']) : self::DAYS_ALL;
        $az = self::derive_ankerzeiten($config);
        $middaycut = self::parse_clock($az['nachmittag']['start'] ?? null);
        $frames = [
            'vormittag' => [
                'start' => self::parse_clock($az['vormittag']['start'] ?? null),
                'end' => self::parse_clock($az['vormittag']['end'] ?? null),
            ],
            'nachmittag' => [
                'start' => self::parse_clock($az['nachmittag']['start'] ?? null),
                'end' => self::parse_clock($az['nachmittag']['end'] ?? null),
            ],
        ];

        $days = [];
        $num = 0;
        foreach ($daynames as $dayname) {
            $list = [];
            foreach ((array)($plandays[$dayname] ?? []) as $entry) {
                if (is_array($entry) && ($entry['kind'] ?? '') !== 'break') {
                    $list[] = $entry;
                }
            }
            usort($list, function ($a, $b) {
                return ((int)($a['startMin'] ?? 0)) <=> ((int)($b['startMin'] ?? 0));
            });
            $buckets = ['vormittag' => [], 'nachmittag' => []];

            foreach ($list as $entry) {
                $startmin = (int)($entry['startMin'] ?? 0);
                $endmin = (int)($entry['endMin'] ?? $startmin);
                $unit = ($entry['kind'] ?? '') === 'unit' ? self::resolve_unit($entry, $units) : null;
                $title = (string)((is_array($unit) ? ($unit['title'] ?? '') : '') ?: ($entry['title'] ?? ''));
                $title = $title !== '' ? $title : 'Seminareinheit';
                $phase = self::phase_key($entry['sqPhase'] ?? ($entry['phase'] ?? ''));
                $minutes = max(0, $endmin - $startmin);
                $topics = self::split_topics((is_array($unit) ? ($unit['topics'] ?? '') : '') ?: ($entry['topics'] ?? ''));
                $themen = [];
                foreach ($topics as $topic) {
                    $themen[] = ['title' => $topic, 'phase' => $phase, 'minutes' => 0];
                }
                if (!$themen) {
                    $themen[] = ['title' => $title, 'phase' => $phase, 'minutes' => $minutes];
                }
                $num++;
                $anchorkey = ($middaycut !== null && $startmin >= $middaycut) ? 'nachmittag' : 'vormittag';
                $buckets[$anchorkey][] = [
                    'id' => $dayname . '-' . $anchorkey . '-' . ((string)($entry['uid'] ?? '') ?: (string)$num),
                    'num' => $num,
                    'title' => $title,
                    'continuation' => false,
                    'startMin' => $startmin,
                    'minutes' => $minutes,
                    'phase' => $phase,
                    'themen' => $themen,
                ];
            }

            $anchors = [];
            foreach (self::ANCHORS as $ankername) {
                if (!$buckets[$ankername]) {
                    continue;
                }
                $anchors[] = [
                    'key' => $ankername,
                    'name' => self::anchor_label($ankername),
                    'start' => $frames[$ankername]['start'],
                    'end' => $frames[$ankername]['end'],
                    'blocks' => $buckets[$ankername],
                ];
            }
            if ($anchors) {
                $days[] = self::day((string)$dayname, $anchors);
            }
        }

        return $days;
    }

    /**
     * Einen Tag samt Programmpunktzahl zusammensetzen.
     *
     * @param string $dayname Name des Tages.
     * @param array $anchors Anker des Tages.
     * @return array
     */
    private static function day(string $dayname, array $anchors): array {
        $count = 0;
        foreach ($anchors as $anchor) {
            $count += count($anchor['blocks']);
        }
        return ['name' => $dayname, 'anchors' => $anchors, 'count' => $count];
    }

    /**
     * Beschriftung eines Ankers.
     *
     * @param string $ankername vormittag|nachmittag.
     * @return string
     */
    private static function anchor_label(string $ankername): string {
        return $ankername === 'nachmittag' ? 'Nachmittag' : 'Vormittag';
    }

    /**
     * Die zu einem Grid-Eintrag gehoerende Seminareinheit finden (Legacy-Pfad).
     *
     * @param array $entry Grid-Eintrag.
     * @param array $units Einheiten des Planungszustands.
     * @return array|null
     */
    private static function resolve_unit(array $entry, array $units): ?array {
        $slotkey = trim((string)($entry['slotkey'] ?? ''));
        if ($slotkey !== '') {
            $variants = [];
            foreach ($units as $unit) {
                if (is_array($unit) && trim((string)($unit['slotkey'] ?? '')) === $slotkey) {
                    $variants[] = $unit;
                }
            }
            if ($variants) {
                foreach ($variants as $variant) {
                    if (($variant['active'] ?? null) !== false) {
                        return $variant;
                    }
                }
                return $variants[0];
            }
        }
        $unitid = (string)($entry['unitid'] ?? '');
        if ($unitid === '') {
            return null;
        }
        foreach ($units as $unit) {
            if (is_array($unit) && (string)($unit['id'] ?? '') === $unitid) {
                return $unit;
            }
        }
        return null;
    }

    /**
     * Rich-Text-Unterthemen in einzelne Themen-Zeilen zerlegen.
     *
     * Bewusst NICHT an Kommas trennen: ein Unterthema pro Zeile.
     *
     * @param mixed $html Unterthemen als Rich Text.
     * @return string[]
     */
    private static function split_topics($html): array {
        $withbreaks = preg_replace('/<\s*br\s*\/?\s*>/i', "\n", (string)$html);
        $withbreaks = preg_replace('/<\/\s*(?:p|div|li|tr|h[1-6])\s*>/i', "\n", $withbreaks);
        $withbreaks = preg_replace('/<[^>]*>/', ' ', $withbreaks);
        $decoded = html_entity_decode($withbreaks, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $lines = [];
        foreach (preg_split('/\r?\n/', $decoded) as $line) {
            $line = preg_replace('/^[\s\-–—*·•]+/u', '', $line);
            $line = trim(preg_replace('/\s+/u', ' ', $line));
            if ($line !== '') {
                $lines[] = $line;
            }
        }
        return $lines;
    }
}
