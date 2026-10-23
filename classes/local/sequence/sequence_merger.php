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
 * Three-way merge of concurrently edited plan states.
 *
 * @package    mod_seminarplaner
 * @copyright  2026 Guido Brombach <gibro@posteo.de>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace mod_seminarplaner\local\sequence;

/**
 * Merges two saves that started from the same base version.
 *
 * Zwei Referent*innen bearbeiten denselben Plan: beide laden Version X,
 * A speichert zuerst ("theirs" aus Sicht von B), B speichert danach mit
 * veraltetem Hash ("mine"). Frueher ersetzte Bs Sequenz die von A
 * vollstaendig. Mit der Basis X, die der Client mitschickt, laesst sich je
 * Platzierung und je Feld entscheiden, wer was geaendert hat:
 *
 * - nur eine Seite hat geaendert: deren Fassung gilt;
 * - beide haben dasselbe Feld unterschiedlich geaendert: echter Konflikt,
 *   die zuerst gespeicherte Fassung (theirs) gilt und der Konflikt wird
 *   gemeldet, damit der Client einen Hinweis zeigen kann.
 *
 * Reihenfolgen in den Ankern werden als Listen zusammengefuehrt: Einfuegen
 * und Entfernen beider Seiten bleiben erhalten; haben beide dieselbe Liste
 * umsortiert, gilt die Reihenfolge von theirs.
 */
class sequence_merger {
    /** @var string[] Map sections of the sequence, merged entry by entry. */
    private const MAP_KEYS = ['platzierungen', 'einheitenauswahlen', 'bausteine'];

    /** @var array<int, array{bereich: string, id: string, titel: string}> Conflicts of the current run. */
    private $conflicts = [];

    /**
     * Merge the tracked top level sections of two states.
     *
     * Only keys present in $base are merged three-way; everything else in
     * $mine is returned unchanged (the caller has merged it already).
     *
     * @param array $base Tracked sections as the client loaded them.
     * @param array $theirs Currently stored state.
     * @param array $mine Incoming state.
     * @return array{state: array, conflicts: array}
     */
    public function merge_state(array $base, array $theirs, array $mine): array {
        $this->conflicts = [];
        $result = $mine;
        foreach ($base as $key => $basevalue) {
            if (!is_string($key)) {
                continue;
            }
            $t = $theirs[$key] ?? null;
            $m = $mine[$key] ?? null;
            if ($key === sequence_state::STATE_KEY && is_array($basevalue) && is_array($t) && is_array($m)) {
                $merged = $this->merge_sequenz($basevalue, $t, $m);
            } else {
                $merged = $this->pick($basevalue, $t, $m, $key, '', '');
            }
            if ($merged === null) {
                unset($result[$key]);
            } else {
                $result[$key] = $merged;
            }
        }
        $this->resolve_conflict_titles($result[sequence_state::STATE_KEY] ?? null);
        return ['state' => $result, 'conflicts' => $this->conflicts];
    }

    /**
     * Merge the sequence section.
     *
     * @param array $b Base sequence.
     * @param array $t Stored sequence.
     * @param array $m Incoming sequence.
     * @return array
     */
    private function merge_sequenz(array $b, array $t, array $m): array {
        $result = [];
        foreach ($this->union_keys($t, $m, $b) as $key) {
            if (in_array($key, self::MAP_KEYS, true)) {
                $result[$key] = $this->merge_map(
                    $key,
                    $this->as_array($b[$key] ?? []),
                    $this->as_array($t[$key] ?? []),
                    $this->as_array($m[$key] ?? [])
                );
            } else if ($key === 'tage') {
                // Platzhalter, damit die Schluesselreihenfolge erhalten bleibt;
                // die Tage brauchen die fertig zusammengefuehrten Platzierungen.
                $result[$key] = [];
            } else {
                $value = $this->pick($b[$key] ?? null, $t[$key] ?? null, $m[$key] ?? null, $key, '', '');
                if ($value !== null) {
                    $result[$key] = $value;
                }
            }
        }
        if (array_key_exists('tage', $result)) {
            $result['tage'] = $this->merge_tage(
                $this->as_array($b['tage'] ?? []),
                $this->as_array($t['tage'] ?? []),
                $this->as_array($m['tage'] ?? []),
                $this->as_array($result['platzierungen'] ?? [])
            );
        }
        return $result;
    }

    /**
     * Merge a map section (placements, unit selections, Bausteine) by id.
     *
     * @param string $section Section name for conflict reports.
     * @param array $b Base map.
     * @param array $t Stored map.
     * @param array $m Incoming map.
     * @return array
     */
    private function merge_map(string $section, array $b, array $t, array $m): array {
        $result = [];
        foreach ($this->union_keys($t, $m, $b) as $id) {
            $bv = $b[$id] ?? null;
            $tv = $t[$id] ?? null;
            $mv = $m[$id] ?? null;
            if ($this->same($mv, $bv)) {
                $value = $tv;
            } else if ($this->same($tv, $bv) || $this->same($tv, $mv)) {
                $value = $mv;
            } else if (is_array($bv) && is_array($tv) && is_array($mv) && $this->is_map($tv) && $this->is_map($mv)) {
                $value = $this->merge_fields($section, (string)$id, $bv, $tv, $mv);
            } else {
                // Geloescht gegen geaendert oder dieselbe neue Id auf beiden
                // Seiten: die zuerst gespeicherte Fassung gilt.
                $this->add_conflict($section, (string)$id, $tv ?? $mv);
                $value = $tv;
            }
            if ($value !== null) {
                $result[$id] = $value;
            }
        }
        return $result;
    }

    /**
     * Merge one map entry field by field.
     *
     * @param string $section Section name for conflict reports.
     * @param string $id Entry id.
     * @param array $b Base entry.
     * @param array $t Stored entry.
     * @param array $m Incoming entry.
     * @return array
     */
    private function merge_fields(string $section, string $id, array $b, array $t, array $m): array {
        $result = [];
        $conflict = false;
        foreach ($this->union_keys($t, $m, $b) as $field) {
            $bv = $b[$field] ?? null;
            $tv = $t[$field] ?? null;
            $mv = $m[$field] ?? null;
            // Die Seite, deren Fassung gilt, entscheidet auch, ob das Feld
            // existiert - ein dort entferntes Feld wird nicht als null belebt.
            if ($this->same($mv, $bv)) {
                $winner = $t;
            } else if ($this->same($tv, $bv) || $this->same($tv, $mv)) {
                $winner = $m;
            } else {
                $conflict = true;
                $winner = $t;
            }
            if (array_key_exists($field, $winner)) {
                $result[$field] = $winner[$field];
            }
        }
        if ($conflict) {
            $this->add_conflict($section, $id, $t);
        }
        return $result;
    }

    /**
     * Merge the day list and the ordered anchor sequences.
     *
     * @param array $b Base days.
     * @param array $t Stored days.
     * @param array $m Incoming days.
     * @param array $placements Merged placements.
     * @return array
     */
    private function merge_tage(array $b, array $t, array $m, array $placements): array {
        $skb = $this->skeleton($b);
        $skt = $this->skeleton($t);
        $skm = $this->skeleton($m);
        if ($this->same($skm, $skb) || $this->same($skt, $skm)) {
            $frame = $t;
        } else if ($this->same($skt, $skb)) {
            $frame = $m;
        } else {
            $this->conflicts[] = ['bereich' => 'tage', 'id' => '', 'titel' => ''];
            $frame = $t;
        }

        $bdays = $this->days_by_tag($b);
        $tdays = $this->days_by_tag($t);
        $mdays = $this->days_by_tag($m);
        foreach ($frame as $index => $day) {
            if (!is_array($day) || !isset($day['anker']) || !is_array($day['anker'])) {
                continue;
            }
            $tag = $this->day_key($day, (int)$index);
            foreach ($day['anker'] as $anker => $data) {
                $lb = $this->anchor_list($bdays[$tag] ?? null, (string)$anker);
                $lt = $this->anchor_list($tdays[$tag] ?? null, (string)$anker);
                $lm = $this->anchor_list($mdays[$tag] ?? null, (string)$anker);
                $label = trim((string)($day['bezeichnung'] ?? '') . ' ' . $anker);
                $frame[$index]['anker'][$anker] = is_array($data) ? $data : [];
                $frame[$index]['anker'][$anker]['sequenz'] = $this->merge_list($lb, $lt, $lm, $tag . ':' . $anker, $label);
            }
        }

        return $this->clean_references($frame, $t, $placements);
    }

    /**
     * Merge an ordered list of placement ids.
     *
     * @param array $lb Base list.
     * @param array $lt Stored list.
     * @param array $lm Incoming list.
     * @param string $id Anchor id for conflict reports.
     * @param string $label Anchor label for conflict reports.
     * @return array
     */
    private function merge_list(array $lb, array $lt, array $lm, string $id, string $label): array {
        if ($this->same($lm, $lb)) {
            return $lt;
        }
        if ($this->same($lt, $lb) || $this->same($lt, $lm)) {
            return $lm;
        }
        $mreordered = !$this->order_kept($lb, $lm);
        $treordered = !$this->order_kept($lb, $lt);
        if ($mreordered && $treordered) {
            // Beide haben umsortiert: Reihenfolge von theirs, aber neu
            // eingefuegte Platzierungen von mine gehen nicht verloren.
            $this->conflicts[] = ['bereich' => 'reihenfolge', 'id' => $id, 'titel' => $label];
            return $this->insert_additions($lt, $lm, $lb);
        }
        if ($mreordered) {
            $frame = $lm;
            $other = $lt;
        } else {
            $frame = $lt;
            $other = $lm;
        }
        $removed = array_diff($lb, $other);
        $result = array_values(array_filter($frame, static function ($pid) use ($removed): bool {
            return !in_array($pid, $removed, true);
        }));
        return $this->insert_additions($result, $other, $lb);
    }

    /**
     * Insert the additions of one side after their predecessor there.
     *
     * @param array $result List to insert into.
     * @param array $other Side whose additions are inserted.
     * @param array $base Base list.
     * @return array
     */
    private function insert_additions(array $result, array $other, array $base): array {
        foreach (array_values($other) as $index => $pid) {
            if (in_array($pid, $base, true) || in_array($pid, $result, true)) {
                continue;
            }
            $position = 0;
            for ($j = $index - 1; $j >= 0; $j--) {
                $found = array_search($other[$j], $result, true);
                if ($found !== false) {
                    $position = $found + 1;
                    break;
                }
            }
            array_splice($result, $position, 0, [$pid]);
        }
        return $result;
    }

    /**
     * Drop dangling and duplicate ids, re-anchor placements kept by a conflict.
     *
     * @param array $tage Merged days.
     * @param array $theirs Stored days.
     * @param array $placements Merged placements.
     * @return array
     */
    private function clean_references(array $tage, array $theirs, array $placements): array {
        $theirlocation = [];
        foreach ($theirs as $index => $day) {
            if (!is_array($day) || !is_array($day['anker'] ?? null)) {
                continue;
            }
            foreach ($day['anker'] as $anker => $data) {
                foreach ($this->anchor_list($day, (string)$anker) as $position => $pid) {
                    $theirlocation[$pid] = [$this->day_key($day, (int)$index), (string)$anker, $position];
                }
            }
        }

        // Eine Platzierung darf nur an einer Stelle stehen. Haben beide Seiten
        // sie verschoben, gilt die Stelle von theirs.
        $seen = [];
        foreach ($tage as $index => $day) {
            if (!is_array($day) || !is_array($day['anker'] ?? null)) {
                continue;
            }
            $tag = $this->day_key($day, (int)$index);
            foreach ($day['anker'] as $anker => $data) {
                foreach ($this->anchor_list($day, (string)$anker) as $pid) {
                    $seen[$pid][] = [$tag, (string)$anker];
                }
            }
        }
        $keep = [];
        foreach ($seen as $pid => $locations) {
            $keep[$pid] = $locations[0];
            if (count($locations) > 1) {
                $this->add_conflict('platzierungen', (string)$pid, $placements[$pid] ?? null);
                if (isset($theirlocation[$pid])) {
                    foreach ($locations as $location) {
                        if ($location[0] === $theirlocation[$pid][0] && $location[1] === $theirlocation[$pid][1]) {
                            $keep[$pid] = $location;
                        }
                    }
                }
            }
        }

        foreach ($tage as $index => $day) {
            if (!is_array($day) || !is_array($day['anker'] ?? null)) {
                continue;
            }
            $tag = $this->day_key($day, (int)$index);
            foreach ($day['anker'] as $anker => $data) {
                $list = [];
                foreach ($this->anchor_list($day, (string)$anker) as $pid) {
                    if (!array_key_exists($pid, $placements) || in_array($pid, $list, true)) {
                        continue;
                    }
                    if ($keep[$pid] !== [$tag, (string)$anker]) {
                        continue;
                    }
                    $list[] = $pid;
                }
                $tage[$index]['anker'][$anker]['sequenz'] = $list;
            }
        }

        // Hat mine eine Platzierung geloescht, die theirs zugleich geaendert
        // hat, bleibt sie (Konflikt, theirs gilt) - dann auch an ihrer Stelle.
        $placed = array_keys($keep);
        foreach ($theirlocation as $pid => $location) {
            if (!array_key_exists($pid, $placements) || in_array($pid, $placed, true)) {
                continue;
            }
            if (!$this->was_conflict('platzierungen', (string)$pid)) {
                continue;
            }
            foreach ($tage as $index => $day) {
                if ($this->day_key($day, (int)$index) !== $location[0] || !isset($day['anker'][$location[1]])) {
                    continue;
                }
                $list = $this->anchor_list($day, $location[1]);
                array_splice($list, min($location[2], count($list)), 0, [$pid]);
                $tage[$index]['anker'][$location[1]]['sequenz'] = $list;
            }
        }
        return $tage;
    }

    /**
     * Three-way pick of a whole value.
     *
     * @param mixed $b Base value.
     * @param mixed $t Stored value.
     * @param mixed $m Incoming value.
     * @param string $bereich Section name for conflict reports.
     * @param string $id Entry id for conflict reports.
     * @param string $titel Title for conflict reports.
     * @return mixed
     */
    private function pick($b, $t, $m, string $bereich, string $id, string $titel) {
        if ($this->same($m, $b)) {
            return $t;
        }
        if ($this->same($t, $b) || $this->same($t, $m)) {
            return $m;
        }
        $this->conflicts[] = ['bereich' => $bereich, 'id' => $id, 'titel' => $titel];
        return $t;
    }

    /**
     * Record a conflict on a map entry once.
     *
     * @param string $section Section name.
     * @param string $id Entry id.
     * @param mixed $entry Entry used for the title.
     */
    private function add_conflict(string $section, string $id, $entry): void {
        if ($this->was_conflict($section, $id)) {
            return;
        }
        $titel = is_array($entry) && isset($entry['titel']) && is_scalar($entry['titel']) ? (string)$entry['titel'] : '';
        $this->conflicts[] = ['bereich' => $section, 'id' => $id, 'titel' => $titel];
    }

    /**
     * Whether a conflict on this entry was recorded already.
     *
     * @param string $section Section name.
     * @param string $id Entry id.
     * @return bool
     */
    private function was_conflict(string $section, string $id): bool {
        foreach ($this->conflicts as $conflict) {
            if ($conflict['bereich'] === $section && $conflict['id'] === $id) {
                return true;
            }
        }
        return false;
    }

    /**
     * Name unit selection conflicts after the placement that shows them.
     *
     * @param mixed $sequenz Merged sequence section.
     */
    private function resolve_conflict_titles($sequenz): void {
        $placements = is_array($sequenz) ? $this->as_array($sequenz['platzierungen'] ?? []) : [];
        foreach ($this->conflicts as $index => $conflict) {
            if ($conflict['titel'] !== '' || $conflict['bereich'] !== 'einheitenauswahlen') {
                continue;
            }
            foreach ($placements as $placement) {
                if (is_array($placement) && (string)($placement['einheitenauswahl'] ?? '') === $conflict['id']) {
                    $this->conflicts[$index]['titel'] = (string)($placement['titel'] ?? '');
                    break;
                }
            }
        }
    }

    /**
     * Day list without anchor contents, for detecting structural changes.
     *
     * @param array $tage Days.
     * @return array
     */
    private function skeleton(array $tage): array {
        $skeleton = [];
        foreach ($tage as $day) {
            if (is_array($day) && is_array($day['anker'] ?? null)) {
                foreach ($day['anker'] as $anker => $data) {
                    $day['anker'][$anker] = is_array($data) ? array_diff_key($data, ['sequenz' => true]) : $data;
                }
            }
            $skeleton[] = $day;
        }
        return $skeleton;
    }

    /**
     * Index days by their day number.
     *
     * @param array $tage Days.
     * @return array
     */
    private function days_by_tag(array $tage): array {
        $result = [];
        foreach ($tage as $index => $day) {
            if (is_array($day)) {
                $result[$this->day_key($day, (int)$index)] = $day;
            }
        }
        return $result;
    }

    /**
     * Stable key of a day: its number, else its position.
     *
     * @param mixed $day Day record.
     * @param int $index Position in the day list.
     * @return string
     */
    private function day_key($day, int $index): string {
        if (is_array($day) && isset($day['tag']) && is_scalar($day['tag'])) {
            return 't' . $day['tag'];
        }
        return 'i' . $index;
    }

    /**
     * Ordered placement ids of one anchor.
     *
     * @param mixed $day Day record.
     * @param string $anker Anchor name.
     * @return string[]
     */
    private function anchor_list($day, string $anker): array {
        $list = is_array($day) ? ($day['anker'][$anker]['sequenz'] ?? []) : [];
        if (!is_array($list)) {
            return [];
        }
        $result = [];
        foreach ($list as $pid) {
            if (is_scalar($pid)) {
                $result[] = (string)$pid;
            }
        }
        return $result;
    }

    /**
     * Whether the common elements keep their base order.
     *
     * @param array $base Base list.
     * @param array $list Changed list.
     * @return bool
     */
    private function order_kept(array $base, array $list): bool {
        $inlist = array_values(array_filter($base, static function ($pid) use ($list): bool {
            return in_array($pid, $list, true);
        }));
        $inbase = array_values(array_filter($list, static function ($pid) use ($base): bool {
            return in_array($pid, $base, true);
        }));
        return $inlist === $inbase;
    }

    /**
     * Keys of the given arrays in first-seen order.
     *
     * @param array ...$arrays Arrays.
     * @return array
     */
    private function union_keys(array ...$arrays): array {
        $keys = [];
        foreach ($arrays as $array) {
            foreach (array_keys($array) as $key) {
                $keys[$key] = true;
            }
        }
        return array_keys($keys);
    }

    /**
     * Value as array (maps may arrive as stdClass after normalize_maps).
     *
     * @param mixed $value Value.
     * @return array
     */
    private function as_array($value): array {
        if ($value instanceof \stdClass) {
            return (array)$value;
        }
        return is_array($value) ? $value : [];
    }

    /**
     * Whether the value is a string keyed map.
     *
     * @param array $value Value.
     * @return bool
     */
    private function is_map(array $value): bool {
        return $value === [] || !array_is_list($value);
    }

    /**
     * Order-insensitive deep equality for maps, order-sensitive for lists.
     *
     * @param mixed $a First value.
     * @param mixed $b Second value.
     * @return bool
     */
    private function same($a, $b): bool {
        return $this->canonical($a) === $this->canonical($b);
    }

    /**
     * Canonical form for comparison.
     *
     * @param mixed $value Value.
     * @return mixed
     */
    private function canonical($value) {
        if ($value instanceof \stdClass) {
            $value = (array)$value;
        }
        if (!is_array($value)) {
            return $value;
        }
        if (!array_is_list($value)) {
            ksort($value, SORT_STRING);
        }
        foreach ($value as $key => $item) {
            $value[$key] = $this->canonical($item);
        }
        return $value;
    }
}
