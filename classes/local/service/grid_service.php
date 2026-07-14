<?php
// This file is part of Moodle - http://moodle.org/

namespace mod_seminarplaner\local\service;

use coding_exception;
use mod_seminarplaner\local\repository\grid_repository;
use mod_seminarplaner\local\sequence\sequence_state;

defined('MOODLE_INTERNAL') || die();

/**
 * Grid domain service.
 */
class grid_service {
    /** @var int Shared owner id used for collaborative grid state. */
    private const SHARED_STATE_USERID = 0;
    /** @var string Marker prefix used by client conflict handling. */
    private const CONFLICT_MARKER = 'GRID_TIME_CONFLICT:';

    /** @var grid_repository */
    private $repository;

    /**
     * Constructor.
     *
     * @param grid_repository|null $repository Repository dependency.
     */
    public function __construct(?grid_repository $repository = null) {
        $this->repository = $repository ?? new grid_repository();
    }

    /**
     * Create a new grid for activity.
     *
     * @param int $cmid Course module id.
     * @param string $name Grid name.
     * @param int $userid User id.
     * @param string|null $description Description.
     * @return int Grid id.
     */
    public function create_grid(int $cmid, string $name, int $userid, ?string $description = null): int {
        $name = trim($name);
        if ($cmid <= 0 || $userid <= 0 || $name === '') {
            throw new coding_exception('Invalid input for create_grid');
        }

        return $this->repository->create_grid($cmid, $name, $userid, $description);
    }

    /**
     * List active grids for activity.
     *
     * @param int $cmid Course module id.
     * @return array
     */
    public function list_grids(int $cmid): array {
        if ($cmid <= 0) {
            throw new coding_exception('Invalid cmid for list_grids');
        }

        return $this->repository->get_active_grids($cmid);
    }

    /**
     * Archive a grid in current activity context.
     *
     * @param int $cmid Course module id.
     * @param int $gridid Grid id.
     * @param int $userid User id.
     * @return bool
     */
    public function delete_grid(int $cmid, int $gridid, int $userid): bool {
        if ($cmid <= 0 || $gridid <= 0 || $userid <= 0) {
            throw new coding_exception('Invalid input for delete_grid');
        }
        $grid = $this->repository->get_grid($gridid);
        if (!$grid || (int)$grid->cmid !== $cmid || (int)$grid->isarchived === 1) {
            throw new \invalid_parameter_exception('Grid not found');
        }
        return $this->repository->archive_grid($gridid, $userid);
    }

    /**
     * Save shared grid state and return new version hash.
     *
     * @param int $gridid Grid id.
     * @param int $userid User id.
     * @param array $state State payload as array.
     * @param string|null $expectedhash Optional optimistic lock check hash.
     * @return string New version hash.
     */
    public function save_user_state(int $gridid, int $userid, array $state, ?string $expectedhash = null): string {
        if ($gridid <= 0 || $userid <= 0) {
            throw new coding_exception('Invalid input for save_user_state');
        }

        $existing = $this->repository->get_user_state($gridid, self::SHARED_STATE_USERID);
        if (!$existing) {
            $legacy = $this->repository->get_latest_state_for_grid($gridid);
            if ($legacy) {
                $this->repository->upsert_user_state(
                    $gridid,
                    self::SHARED_STATE_USERID,
                    (string)$legacy->statejson,
                    (string)$legacy->versionhash
                );
                $existing = $this->repository->get_user_state($gridid, self::SHARED_STATE_USERID);
            }
        }
        if ($existing && $expectedhash !== null && $expectedhash !== '' && $existing->versionhash !== $expectedhash) {
            $existingstate = json_decode((string)$existing->statejson, true);
            if (!is_array($existingstate)) {
                $existingstate = [];
            }
            $state = $this->merge_collaborative_state($existingstate, $state);
        }

        // Legacy grid clients do not know the sequence section (D20); keep
        // the stored one instead of letting their full-state save drop it.
        if ($existing && !isset($state[sequence_state::STATE_KEY])) {
            $existingstate = json_decode((string)$existing->statejson, true);
            if (is_array($existingstate) && isset($existingstate[sequence_state::STATE_KEY])) {
                $state[sequence_state::STATE_KEY] = $existingstate[sequence_state::STATE_KEY];
            }
        }

        $overlaps = $this->find_time_overlaps($state);
        if ($overlaps) {
            $days = [];
            foreach ($overlaps as $overlap) {
                $day = (string)($overlap['day'] ?? '');
                if ($day !== '') {
                    $days[$day] = $day;
                }
            }
            $payload = [
                'days' => array_values($days),
                'count' => count($overlaps),
            ];
            throw new \invalid_parameter_exception(self::CONFLICT_MARKER . json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        }

        // Empty sequence maps must stay JSON objects across the
        // decode/encode round trip, otherwise clients receive arrays and
        // silently lose entries (see sequence_state::normalize_maps).
        if (isset($state[sequence_state::STATE_KEY]) && is_array($state[sequence_state::STATE_KEY])) {
            $state[sequence_state::STATE_KEY] = sequence_state::normalize_maps($state[sequence_state::STATE_KEY]);
        }

        $json = json_encode($state, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($json === false) {
            throw new coding_exception('Failed to encode grid state JSON');
        }

        $newhash = sha1($json . '|' . microtime(true));
        $this->repository->upsert_user_state($gridid, self::SHARED_STATE_USERID, $json, $newhash);
        return $newhash;
    }

    /**
     * Merge two collaborative grid payloads.
     *
     * @param array $current Current persisted state.
     * @param array $incoming New incoming state from client.
     * @return array
     */
    private function merge_collaborative_state(array $current, array $incoming): array {
        if (!$current) {
            return $incoming;
        }

        $merged = $current;
        foreach (['meta', 'config', 'view', 'zoomIndex', 'sourceMode'] as $key) {
            if (array_key_exists($key, $incoming)) {
                $merged[$key] = $incoming[$key];
            }
        }

        // The sequence editor is the only writer of its section (D34);
        // an incoming sequence section therefore wins over the stored one.
        if (array_key_exists(sequence_state::STATE_KEY, $incoming)) {
            $merged[sequence_state::STATE_KEY] = $incoming[sequence_state::STATE_KEY];
        }

        $currentdays = [];
        if (isset($current['plan']) && is_array($current['plan']) && isset($current['plan']['days']) && is_array($current['plan']['days'])) {
            $currentdays = $current['plan']['days'];
        }
        $incomingdays = [];
        if (isset($incoming['plan']) && is_array($incoming['plan']) && isset($incoming['plan']['days']) && is_array($incoming['plan']['days'])) {
            $incomingdays = $incoming['plan']['days'];
        }

        $alldays = array_unique(array_merge(array_keys($currentdays), array_keys($incomingdays)));
        $mergeddays = [];
        foreach ($alldays as $day) {
            $mergeddays[$day] = $this->merge_day_entries(
                (array)($currentdays[$day] ?? []),
                (array)($incomingdays[$day] ?? [])
            );
        }

        if (!isset($merged['plan']) || !is_array($merged['plan'])) {
            $merged['plan'] = [];
        }
        $merged['plan']['days'] = $mergeddays;

        return $merged;
    }

    /**
     * Find overlapping entries in the plan state.
     *
     * @param array $state Plan state payload.
     * @return array<int, array{day:string}>
     */
    private function find_time_overlaps(array $state): array {
        $days = [];
        if (isset($state['plan']) && is_array($state['plan']) && isset($state['plan']['days']) && is_array($state['plan']['days'])) {
            $days = $state['plan']['days'];
        }
        if (!$days) {
            return [];
        }

        $overlaps = [];
        foreach ($days as $day => $entries) {
            if (!is_array($entries) || !$entries) {
                continue;
            }
            $normalized = [];
            foreach ($entries as $entry) {
                if (!is_array($entry)) {
                    continue;
                }
                $start = (int)($entry['startMin'] ?? 0);
                $end = (int)($entry['endMin'] ?? 0);
                if ($end <= $start) {
                    continue;
                }
                $normalized[] = [
                    'start' => $start,
                    'end' => $end,
                ];
            }
            usort($normalized, static function(array $a, array $b): int {
                if ($a['start'] !== $b['start']) {
                    return $a['start'] <=> $b['start'];
                }
                return $a['end'] <=> $b['end'];
            });
            for ($i = 1; $i < count($normalized); $i++) {
                $prev = $normalized[$i - 1];
                $curr = $normalized[$i];
                if ($curr['start'] < $prev['end']) {
                    $overlaps[] = ['day' => (string)$day];
                    break;
                }
            }
        }

        return $overlaps;
    }

    /**
     * Merge day entries by uid and keep anonymous entries.
     *
     * @param array $currententries
     * @param array $incomingentries
     * @return array
     */
    private function merge_day_entries(array $currententries, array $incomingentries): array {
        $byuid = [];
        $anonymous = [];
        $incomingflowids = [];

        foreach ($incomingentries as $entry) {
            if (!is_array($entry)) {
                continue;
            }
            $flowid = trim((string)($entry['flowid'] ?? ''));
            if ($flowid !== '') {
                $incomingflowids[$flowid] = true;
            }
        }

        foreach ($currententries as $entry) {
            if (!is_array($entry)) {
                continue;
            }
            $flowid = trim((string)($entry['flowid'] ?? ''));
            if ($flowid !== '' && isset($incomingflowids[$flowid])) {
                continue;
            }
            $uid = trim((string)($entry['uid'] ?? ''));
            if ($uid === '') {
                $anonymous[] = $entry;
                continue;
            }
            $byuid[$uid] = $entry;
        }

        foreach ($incomingentries as $entry) {
            if (!is_array($entry)) {
                continue;
            }
            $uid = trim((string)($entry['uid'] ?? ''));
            if ($uid === '') {
                $anonymous[] = $entry;
                continue;
            }
            // Incoming wins for same uid.
            $byuid[$uid] = $entry;
        }

        $merged = array_values($byuid);
        foreach ($anonymous as $entry) {
            $merged[] = $entry;
        }

        usort($merged, static function(array $a, array $b): int {
            $astart = (int)($a['startMin'] ?? 0);
            $bstart = (int)($b['startMin'] ?? 0);
            if ($astart !== $bstart) {
                return $astart <=> $bstart;
            }
            $aend = (int)($a['endMin'] ?? 0);
            $bend = (int)($b['endMin'] ?? 0);
            if ($aend !== $bend) {
                return $aend <=> $bend;
            }
            return strcmp((string)($a['uid'] ?? ''), (string)($b['uid'] ?? ''));
        });

        return $merged;
    }

    /**
     * Get shared grid state.
     *
     * @param int $gridid Grid id.
     * @param int $userid User id.
     * @return array{state: array, versionhash: string|null}
     */
    public function get_user_state(int $gridid, int $userid): array {
        if ($gridid <= 0 || $userid <= 0) {
            throw new coding_exception('Invalid input for get_user_state');
        }

        $record = $this->repository->get_user_state($gridid, self::SHARED_STATE_USERID);
        if (!$record) {
            $legacy = $this->repository->get_latest_state_for_grid($gridid);
            if ($legacy) {
                $this->repository->upsert_user_state(
                    $gridid,
                    self::SHARED_STATE_USERID,
                    (string)$legacy->statejson,
                    (string)$legacy->versionhash
                );
                $record = $this->repository->get_user_state($gridid, self::SHARED_STATE_USERID);
            }
        }
        if (!$record) {
            return ['state' => [], 'versionhash' => null];
        }

        $decoded = json_decode((string)$record->statejson, true);
        if (!is_array($decoded)) {
            $decoded = [];
        }

        // The read path re-encodes the decoded state for the client; keep
        // empty sequence maps as JSON objects here as well.
        if (isset($decoded[sequence_state::STATE_KEY]) && is_array($decoded[sequence_state::STATE_KEY])) {
            $decoded[sequence_state::STATE_KEY] = sequence_state::normalize_maps($decoded[sequence_state::STATE_KEY]);
        }

        return ['state' => $decoded, 'versionhash' => (string)$record->versionhash];
    }

    /**
     * Whether one user has seen the one-time sequence intro for a plan (D35).
     *
     * The flag lives in the per-user row of kgen_grid_user_state (the live
     * collaborative state uses userid 0, so real-user rows are free for
     * per-user markers as foreseen by D35).
     *
     * @param int $gridid Grid id.
     * @param int $userid Real user id.
     * @return bool
     */
    public function get_intro_seen(int $gridid, int $userid): bool {
        if ($gridid <= 0 || $userid <= 0) {
            throw new coding_exception('Invalid input for get_intro_seen');
        }
        $record = $this->repository->get_user_state($gridid, $userid);
        if (!$record) {
            return false;
        }
        $decoded = json_decode((string)$record->statejson, true);
        return is_array($decoded) && !empty($decoded['uebersetzunggesehen']);
    }

    /**
     * Mark the one-time sequence intro as seen for one plan and user (D35).
     *
     * @param int $gridid Grid id.
     * @param int $userid Real user id.
     * @return bool
     */
    public function mark_intro_seen(int $gridid, int $userid): bool {
        if ($gridid <= 0 || $userid <= 0) {
            throw new coding_exception('Invalid input for mark_intro_seen');
        }
        $record = $this->repository->get_user_state($gridid, $userid);
        $decoded = [];
        $hash = 'sequenz-intro';
        if ($record) {
            $decoded = json_decode((string)$record->statejson, true);
            if (!is_array($decoded)) {
                $decoded = [];
            }
            $hash = (string)$record->versionhash;
        }
        $decoded['uebersetzunggesehen'] = time();
        $json = json_encode($decoded, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($json === false) {
            throw new coding_exception('Failed to encode intro marker JSON');
        }
        $this->repository->upsert_user_state($gridid, $userid, $json, $hash);
        return true;
    }

    /**
     * Publish one grid state as Common Thread snapshot.
     *
     * @param int $cmid Course module id.
     * @param int $gridid Grid id.
     * @param array $state State payload.
     * @param int $userid Actor id.
     * @return bool
     */
    /**
     * Parse a "HH:MM" clock string to minutes, or null when invalid.
     */
    private static function parse_clock($value): ?int {
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
     * Derive morning/afternoon anchor times from a config (mirror of the JS
     * deriveAnkerzeiten): legacy configs without ankerzeiten fall back to
     * timeRange + longest break as the midday cut.
     *
     * @param array $config
     * @return array
     */
    private static function derive_ankerzeiten(array $config): array {
        $az = $config['ankerzeiten'] ?? null;
        if (is_array($az) && isset($az['vormittag']['start'], $az['nachmittag']['start'])
                && self::parse_clock($az['vormittag']['start']) !== null
                && self::parse_clock($az['nachmittag']['start']) !== null) {
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
        $vmend = $best ? $best['start'] : '12:30';
        $nmstart = $best ? sprintf('%02d:%02d', intdiv(self::parse_clock($best['start']) + $best['duration'], 60),
            (self::parse_clock($best['start']) + $best['duration']) % 60) : '12:30';
        return [
            'vormittag' => ['start' => $start, 'end' => $vmend],
            'nachmittag' => ['start' => $nmstart, 'end' => $end],
            'ersterTagNurNachmittag' => false,
            'letzterTagNurVormittag' => false,
        ];
    }

    /**
     * Project the sequence section into a day-based plan for the Common Thread
     * (Tag -> Vormittag/Nachmittag -> Baustein als Überschrift + Unterthemen,
     * lose Einheiten als reine Überschrift). The legacy plan.days is stale once
     * editing moved to the sequence, so the published snapshot must be built
     * from the sequence instead. Returns null when there is no sequence to
     * project (then the caller keeps the existing plan.days).
     *
     * @param array $state Saved shared grid state.
     * @return array|null Map day => entries, or null.
     */
    private static function project_sequence_to_days(array $state): ?array {
        $seq = $state['sequenz'] ?? null;
        if (!is_array($seq) || empty($seq['tage']) || !is_array($seq['tage'])) {
            return null;
        }
        $config = is_array($state['config'] ?? null) ? $state['config'] : [];
        $placements = is_array($seq['platzierungen'] ?? null) ? $seq['platzierungen'] : [];
        $bausteine = is_array($seq['bausteine'] ?? null) ? $seq['bausteine'] : [];
        $configdays = is_array($config['days'] ?? null) ? array_values($config['days']) : [];
        $az = self::derive_ankerzeiten($config);
        $vmstart = self::parse_clock($az['vormittag']['start']);
        $nmstart = self::parse_clock($az['nachmittag']['start']);

        $days = [];
        $tage = array_values($seq['tage']);
        $count = count($tage);
        foreach ($tage as $idx => $tag) {
            $bez = (string)($tag['bezeichnung'] ?? '');
            $dayname = ($bez !== '' && in_array($bez, $configdays, true)) ? $bez : ($configdays[$idx] ?? '');
            if ($dayname === '') {
                continue;
            }
            $anchorstarts = [
                'vormittag' => ($idx === 0 && !empty($az['ersterTagNurNachmittag'])) ? $nmstart : $vmstart,
                'nachmittag' => ($idx === $count - 1 && !empty($az['letzterTagNurVormittag'])) ? $vmstart : $nmstart,
            ];
            $items = [];
            foreach (['vormittag', 'nachmittag'] as $anker) {
                $clock = (int)($anchorstarts[$anker] ?? 0);
                $currentbaustein = null;
                $currentbausteinindex = null;
                $pids = $tag['anker'][$anker]['sequenz'] ?? [];
                foreach ((array)$pids as $pid) {
                    $p = $placements[$pid] ?? null;
                    if (!is_array($p)) {
                        continue;
                    }
                    $duration = max(0, (int)($p['dauer'] ?? 0));
                    if (($p['typ'] ?? '') === 'pause') {
                        $clock += $duration;
                        $currentbaustein = null;
                        $currentbausteinindex = null;
                        continue;
                    }
                    $bid = (string)($p['bausteinid'] ?? '');
                    if ($bid !== '' && isset($bausteine[$bid])) {
                        // Aufeinanderfolgende Einheiten desselben Bausteins zu EINER
                        // Überschrift zusammenfassen: die erste öffnet den Block, jede
                        // weitere verlängert ihn (sonst trüge der Block nur die Dauer
                        // seiner ersten Einheit).
                        if ($currentbaustein !== $bid) {
                            $b = $bausteine[$bid];
                            $items[] = [
                                'kind' => 'unit',
                                'startMin' => $clock,
                                'endMin' => $clock + $duration,
                                'title' => (string)($b['titel'] ?? $p['titel'] ?? 'Baustein'),
                                'topics' => (string)($b['unterthemen'] ?? ''),
                            ];
                            $currentbaustein = $bid;
                            $currentbausteinindex = array_key_last($items);
                        } else {
                            $items[$currentbausteinindex]['endMin'] += $duration;
                        }
                    } else {
                        $items[] = [
                            'kind' => 'method',
                            'startMin' => $clock,
                            'endMin' => $clock + $duration,
                            'title' => (string)($p['titel'] ?? 'Seminareinheit'),
                        ];
                        $currentbaustein = null;
                        $currentbausteinindex = null;
                    }
                    $clock += $duration;
                }
            }
            $days[$dayname] = $items;
        }
        return $days;
    }

    public function publish_roterfaden(int $cmid, int $gridid, array $state, int $userid): bool {
        if ($cmid <= 0 || $gridid <= 0 || $userid <= 0) {
            throw new coding_exception('Invalid input for publish_roterfaden');
        }
        $grid = $this->repository->get_grid($gridid);
        if (!$grid || (int)$grid->cmid !== $cmid || (int)$grid->isarchived === 1) {
            throw new \invalid_parameter_exception('Grid not found');
        }

        // Roten Faden aus dem aktuellen Sequenz-Stand projizieren statt aus dem
        // veralteten plan.days (Save läuft vor Publish, der geteilte State ist
        // also aktuell). Deckt beide Publish-Wege (Sequenz + Überblick) ab.
        $shared = $this->repository->get_user_state($gridid, self::SHARED_STATE_USERID);
        if ($shared && !empty($shared->statejson)) {
            $savedstate = json_decode((string)$shared->statejson, true);
            if (is_array($savedstate)) {
                $days = self::project_sequence_to_days($savedstate);
                if ($days !== null) {
                    if (!isset($state['plan']) || !is_array($state['plan'])) {
                        $state['plan'] = [];
                    }
                    $state['plan']['days'] = $days;
                }
            }
        }

        $json = json_encode($state, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($json === false) {
            throw new coding_exception('Failed to encode published Common Thread JSON');
        }
        $this->repository->upsert_roterfaden_state($cmid, $gridid, $json, $userid);
        return true;
    }

    /**
     * Set Common Thread visibility for an activity.
     *
     * @param int $cmid Course module id.
     * @param bool $visible Visibility flag.
     * @param int $userid Actor id.
     * @return bool
     */
    public function set_roterfaden_visibility(int $cmid, bool $visible, int $userid): bool {
        if ($cmid <= 0 || $userid <= 0) {
            throw new coding_exception('Invalid input for set_roterfaden_visibility');
        }
        return $this->repository->set_roterfaden_visibility($cmid, $visible, $userid);
    }

    /**
     * Get Common Thread state for one activity.
     *
     * @param int $cmid Course module id.
     * @return array{ispublished: bool, gridid: int, state: array}
     */
    public function get_roterfaden_state(int $cmid): array {
        if ($cmid <= 0) {
            throw new coding_exception('Invalid cmid for get_roterfaden_state');
        }
        $record = $this->repository->get_roterfaden_state($cmid);
        if (!$record) {
            return ['ispublished' => false, 'gridid' => 0, 'state' => []];
        }

        $decoded = json_decode((string)$record->statejson, true);
        if (!is_array($decoded)) {
            $decoded = [];
        }
        $hasunits = isset($decoded['units']) && is_array($decoded['units']) && count($decoded['units']) > 0;
        $hasplanningunits = isset($decoded['planningState']) && is_array($decoded['planningState'])
            && isset($decoded['planningState']['units']) && is_array($decoded['planningState']['units'])
            && count($decoded['planningState']['units']) > 0;
        if (!$hasunits && !$hasplanningunits) {
            $planningservice = new planning_state_service();
            $planningstate = $planningservice->get_state($cmid);
            $state = isset($planningstate['state']) && is_array($planningstate['state']) ? $planningstate['state'] : [];
            if (isset($state['units']) && is_array($state['units'])) {
                $decoded['planningState'] = $state;
                $decoded['units'] = $state['units'];
                if (isset($state['slotorder']) && is_array($state['slotorder'])) {
                    $decoded['slotorder'] = $state['slotorder'];
                }
            }
        }

        return [
            'ispublished' => (int)$record->ispublished === 1,
            'gridid' => (int)$record->gridid,
            'state' => $decoded,
        ];
    }
}
