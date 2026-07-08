<?php
// This file is part of Moodle - http://moodle.org/

namespace mod_seminarplaner\local\sequence;

defined('MOODLE_INTERNAL') || die();

/**
 * Deterministic conversion of legacy grid states to the D20 sequence model.
 *
 * The legacy grid places entries freely via startMin/endMin per weekday.
 * This converter derives the anchor sequence (D20): entries are grouped
 * into morning/afternoon by the configured midday break and ordered by
 * start time; the resulting list order replaces the time fields (D43
 * runs this once per stored grid state during plugin upgrade).
 *
 * The conversion is lossless in the sense of D20: every placement keeps
 * its original uid/flowid/time span under "quelle", and the legacy
 * "plan" section itself is never touched (the grid stays available as a
 * read-only overview, D34, and feeds the one-time translation view, D35).
 */
class grid_to_sequence_converter {
    /** @var int Fallback midday boundary 12:30 (Roter-Faden-Struktur). */
    public const DEFAULT_BOUNDARY_MIN = 750;

    /** @var string[] Canonical weekday order used by the grid. */
    private const WEEKDAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

    /**
     * Convert a decoded legacy grid state into a sequence section.
     *
     * @param array $gridstate Decoded grid state JSON.
     * @return array Sequence section (see sequence_state).
     */
    public function convert(array $gridstate): array {
        $sequenz = sequence_state::create_empty();

        $days = $this->resolve_days($gridstate);
        if (!$days) {
            return $sequenz;
        }

        $plandays = $this->plan_days($gridstate);
        $placementcounter = 0;

        foreach ($days as $daynumber => $dayname) {
            $day = sequence_state::create_day($daynumber + 1, $dayname);
            $boundary = $this->midday_boundary($gridstate, $dayname);

            $entries = $this->normalized_entries($plandays[$dayname] ?? []);
            $anchors = [
                sequence_state::ANKER_VORMITTAG => [],
                sequence_state::ANKER_NACHMITTAG => [],
            ];
            foreach ($entries as $entry) {
                if ($this->is_midday_break_entry($entry, $boundary)) {
                    continue;
                }
                $anchor = $entry['startMin'] < $boundary['start']
                    ? sequence_state::ANKER_VORMITTAG
                    : sequence_state::ANKER_NACHMITTAG;
                $anchors[$anchor][] = $entry;
            }

            foreach ($anchors as $ankername => $anchorentries) {
                foreach ($this->merge_flow_segments($anchorentries) as $entry) {
                    $placementcounter++;
                    $pid = 'p' . $placementcounter;
                    $this->append_placement($sequenz, $pid, $entry);
                    $day['anker'][$ankername]['sequenz'][] = $pid;
                }
            }

            $sequenz['tage'][] = $day;
        }

        return $sequenz;
    }

    /**
     * Resolve the ordered day list from config, adding stray plan days.
     *
     * @param array $gridstate Decoded grid state.
     * @return string[]
     */
    private function resolve_days(array $gridstate): array {
        $config = is_array($gridstate['config'] ?? null) ? $gridstate['config'] : [];
        $days = [];
        foreach ((array)($config['days'] ?? []) as $dayname) {
            $dayname = (string)$dayname;
            if ($dayname !== '' && !in_array($dayname, $days, true)) {
                $days[] = $dayname;
            }
        }

        $stray = array_diff(array_map('strval', array_keys($this->plan_days($gridstate))), $days);
        usort($stray, function(string $a, string $b): int {
            $posa = array_search($a, self::WEEKDAYS, true);
            $posb = array_search($b, self::WEEKDAYS, true);
            $posa = $posa === false ? PHP_INT_MAX : $posa;
            $posb = $posb === false ? PHP_INT_MAX : $posb;
            if ($posa !== $posb) {
                return $posa <=> $posb;
            }
            return strcmp($a, $b);
        });

        return array_merge($days, $stray);
    }

    /**
     * Extract plan day map from state.
     *
     * @param array $gridstate Decoded grid state.
     * @return array<string, array>
     */
    private function plan_days(array $gridstate): array {
        $plan = is_array($gridstate['plan'] ?? null) ? $gridstate['plan'] : [];
        return is_array($plan['days'] ?? null) ? $plan['days'] : [];
    }

    /**
     * Determine the midday break window for a day.
     *
     * Picks the configured break applying to the day whose start lies
     * closest to the 12:30 fallback; without any usable break config the
     * fallback window is a zero-length boundary at 12:30.
     *
     * @param array $gridstate Decoded grid state.
     * @param string $dayname Day name.
     * @return array{start:int, end:int}
     */
    private function midday_boundary(array $gridstate, string $dayname): array {
        $config = is_array($gridstate['config'] ?? null) ? $gridstate['config'] : [];
        $best = null;
        foreach ((array)($config['breaks'] ?? []) as $break) {
            if (!is_array($break)) {
                continue;
            }
            $appliesto = array_map('strval', (array)($break['days'] ?? []));
            if (!in_array('all', $appliesto, true) && !in_array($dayname, $appliesto, true)) {
                continue;
            }
            $start = $this->parse_minutes($break['start'] ?? null);
            if ($start === null) {
                continue;
            }
            $duration = max(0, (int)($break['duration'] ?? 0));
            $candidate = ['start' => $start, 'end' => $start + $duration];
            if ($best === null
                || abs($start - self::DEFAULT_BOUNDARY_MIN) < abs($best['start'] - self::DEFAULT_BOUNDARY_MIN)) {
                $best = $candidate;
            }
        }

        return $best ?? ['start' => self::DEFAULT_BOUNDARY_MIN, 'end' => self::DEFAULT_BOUNDARY_MIN];
    }

    /**
     * Filter and sort raw day entries deterministically.
     *
     * @param array $entries Raw entries of one day.
     * @return array[]
     */
    private function normalized_entries($entries): array {
        $normalized = [];
        foreach ((array)$entries as $entry) {
            if (!is_array($entry)) {
                continue;
            }
            $start = (int)($entry['startMin'] ?? 0);
            $end = (int)($entry['endMin'] ?? 0);
            if ($end <= $start) {
                continue;
            }
            $entry['startMin'] = $start;
            $entry['endMin'] = $end;
            $normalized[] = $entry;
        }
        usort($normalized, static function(array $a, array $b): int {
            if ($a['startMin'] !== $b['startMin']) {
                return $a['startMin'] <=> $b['startMin'];
            }
            if ($a['endMin'] !== $b['endMin']) {
                return $a['endMin'] <=> $b['endMin'];
            }
            return strcmp((string)($a['uid'] ?? ''), (string)($b['uid'] ?? ''));
        });
        return $normalized;
    }

    /**
     * Whether a break entry represents the fixed midday break.
     *
     * The midday break becomes the anchor divider in the sequence view
     * and is therefore not migrated as a placement of its own.
     *
     * @param array $entry Normalized entry.
     * @param array{start:int, end:int} $boundary Midday window.
     * @return bool
     */
    private function is_midday_break_entry(array $entry, array $boundary): bool {
        if ((string)($entry['kind'] ?? '') !== 'break') {
            return false;
        }
        if ($boundary['end'] <= $boundary['start']) {
            return false;
        }
        return $entry['startMin'] < $boundary['end'] && $entry['endMin'] > $boundary['start'];
    }

    /**
     * Merge directly consecutive segments of the same flow.
     *
     * The grid splits one logical unit into several timed segments when
     * it flows around breaks ("flowid"). Segments that end up adjacent
     * within the same anchor are one placement in the sequence model;
     * segments in different anchors stay separate (continuation across
     * the divider, resolved via the shared module per D20).
     *
     * @param array[] $entries Sorted entries of one anchor.
     * @return array[]
     */
    private function merge_flow_segments(array $entries): array {
        $merged = [];
        foreach ($entries as $entry) {
            $previous = $merged ? $merged[count($merged) - 1] : null;
            $flowid = trim((string)($entry['flowid'] ?? ''));
            if ($previous !== null
                && $flowid !== ''
                && $flowid === trim((string)($previous['flowid'] ?? ''))
                && (string)($entry['kind'] ?? '') !== 'break'
                && (string)($previous['kind'] ?? '') === (string)($entry['kind'] ?? '')) {
                $previous['endMin'] = max($previous['endMin'], $entry['endMin']);
                $previous['mergeduids'][] = (string)($entry['uid'] ?? '');
                $previous['mergedduration'] += $entry['endMin'] - $entry['startMin'];
                $merged[count($merged) - 1] = $previous;
                continue;
            }
            $entry['mergeduids'] = [(string)($entry['uid'] ?? '')];
            $entry['mergedduration'] = $entry['endMin'] - $entry['startMin'];
            $merged[] = $entry;
        }
        return $merged;
    }

    /**
     * Append one placement (plus selection/module records) to the section.
     *
     * @param array $sequenz Sequence section (by reference).
     * @param string $pid Placement id.
     * @param array $entry Merged grid entry.
     */
    private function append_placement(array &$sequenz, string $pid, array $entry): void {
        $kind = (string)($entry['kind'] ?? '');
        $quelle = [
            'uids' => $entry['mergeduids'],
            'flowid' => trim((string)($entry['flowid'] ?? '')),
            'startMin' => $entry['startMin'],
            'endMin' => $entry['endMin'],
        ];

        if ($kind === 'break') {
            $sequenz['platzierungen'][$pid] = [
                'typ' => sequence_state::TYP_PAUSE,
                'titel' => (string)($entry['title'] ?? 'Pause'),
                'dauer' => $entry['mergedduration'],
                'quelle' => $quelle,
            ];
            return;
        }

        $bausteinid = null;
        if ($kind === 'unit') {
            $bausteinid = $this->ensure_baustein($sequenz, $entry);
        } else if (trim((string)($entry['parentunit'] ?? '')) !== '') {
            $bausteinid = $this->ensure_baustein($sequenz, [
                'unitid' => trim((string)$entry['parentunit']),
            ]);
        }

        $auswahlid = 'ea' . substr($pid, 1);
        $kandidaten = [];
        $aktiv = null;
        if ($kind !== 'unit') {
            // Placed library unit: reference only, content stays in the library.
            $ref = trim((string)($entry['entryId'] ?? ''));
            if ($ref === '') {
                $ref = 'legacy:' . (string)($entry['uid'] ?? $pid);
            }
            $kandidaten = [$ref];
            $aktiv = $ref;
        }
        $sequenz['einheitenauswahlen'][$auswahlid] = [
            'kandidaten' => $kandidaten,
            'aktiv' => $aktiv,
        ];

        $sequenz['platzierungen'][$pid] = [
            'typ' => sequence_state::TYP_EINHEIT,
            'bausteinid' => $bausteinid,
            'einheitenauswahl' => $auswahlid,
            'titel' => (string)($entry['title'] ?? ''),
            'dauer' => $entry['mergedduration'],
            'quelle' => $quelle,
        ];
    }

    /**
     * Ensure a module record exists for a legacy planning unit.
     *
     * @param array $sequenz Sequence section (by reference).
     * @param array $entry Grid entry carrying unitid/title/slotkey.
     * @return string Module id.
     */
    private function ensure_baustein(array &$sequenz, array $entry): string {
        $unitid = trim((string)($entry['unitid'] ?? ''));
        $bausteinid = $unitid !== '' ? 'b' . $unitid : 'bx' . (count($sequenz['bausteine']) + 1);

        if (!isset($sequenz['bausteine'][$bausteinid])) {
            $sequenz['bausteine'][$bausteinid] = [
                'titel' => (string)($entry['title'] ?? ''),
                'unterthemen' => '',
                'themenplanreferenz' => '',
                'archiv' => null,
                'varianten' => [],
                'aktivevariante' => null,
                'quelle' => [
                    'unitid' => $unitid,
                    'slotkey' => trim((string)($entry['slotkey'] ?? '')),
                ],
            ];
        } else if ((string)$sequenz['bausteine'][$bausteinid]['titel'] === ''
            && trim((string)($entry['title'] ?? '')) !== '') {
            $sequenz['bausteine'][$bausteinid]['titel'] = (string)$entry['title'];
        }

        return $bausteinid;
    }

    /**
     * Parse "HH:MM" into minutes.
     *
     * @param mixed $value Raw value.
     * @return int|null
     */
    private function parse_minutes($value): ?int {
        if (!is_string($value) || !preg_match('/^(\d{1,2}):(\d{2})$/', trim($value), $matches)) {
            return null;
        }
        return ((int)$matches[1]) * 60 + (int)$matches[2];
    }
}
