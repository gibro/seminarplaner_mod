<?php
// This file is part of Moodle - http://moodle.org/

namespace mod_seminarplaner\local\service;

use coding_exception;
use mod_seminarplaner\local\repository\grid_repository;

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

        foreach ($currententries as $entry) {
            if (!is_array($entry)) {
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

        return ['state' => $decoded, 'versionhash' => (string)$record->versionhash];
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
    public function publish_roterfaden(int $cmid, int $gridid, array $state, int $userid): bool {
        if ($cmid <= 0 || $gridid <= 0 || $userid <= 0) {
            throw new coding_exception('Invalid input for publish_roterfaden');
        }
        $grid = $this->repository->get_grid($gridid);
        if (!$grid || (int)$grid->cmid !== $cmid || (int)$grid->isarchived === 1) {
            throw new \invalid_parameter_exception('Grid not found');
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

        return [
            'ispublished' => (int)$record->ispublished === 1,
            'gridid' => (int)$record->gridid,
            'state' => $decoded,
        ];
    }
}
