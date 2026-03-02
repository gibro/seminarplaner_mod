<?php
// This file is part of Moodle - http://moodle.org/

namespace mod_konzeptgenerator\local\service;

use coding_exception;
use mod_konzeptgenerator\local\repository\planning_state_repository;

defined('MOODLE_INTERNAL') || die();

/**
 * Shared planning mode state service.
 */
class planning_state_service {
    /** @var planning_state_repository */
    private $repository;

    /**
     * Constructor.
     *
     * @param planning_state_repository|null $repository
     */
    public function __construct(?planning_state_repository $repository = null) {
        $this->repository = $repository ?? new planning_state_repository();
    }

    /**
     * Get shared planning state.
     *
     * @param int $cmid
     * @return array{state: array, versionhash: string|null}
     */
    public function get_state(int $cmid): array {
        if ($cmid <= 0) {
            throw new coding_exception('Invalid cmid for get_state');
        }
        $record = $this->repository->get_state($cmid);
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
     * Save shared planning state.
     *
     * @param int $cmid
     * @param array $state
     * @param int $userid
     * @param string|null $expectedhash
     * @return string
     */
    public function save_state(int $cmid, array $state, int $userid, ?string $expectedhash = null): string {
        if ($cmid <= 0 || $userid <= 0) {
            throw new coding_exception('Invalid input for save_state');
        }
        $existing = $this->repository->get_state($cmid);
        if ($existing && $expectedhash !== null && $expectedhash !== '' && (string)$existing->versionhash !== $expectedhash) {
            throw new \invalid_parameter_exception('Planning state conflict: version hash mismatch');
        }
        $json = json_encode($state, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($json === false) {
            throw new coding_exception('Failed to encode planning state');
        }
        $newhash = sha1($json . '|' . microtime(true));
        $this->repository->upsert_state($cmid, $json, $newhash, $userid);
        return $newhash;
    }
}

