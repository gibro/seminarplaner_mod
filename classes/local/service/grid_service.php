<?php
// This file is part of Moodle - http://moodle.org/

namespace mod_konzeptgenerator\local\service;

use coding_exception;
use mod_konzeptgenerator\local\repository\grid_repository;

defined('MOODLE_INTERNAL') || die();

/**
 * Grid domain service.
 */
class grid_service {
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
     * Save per-user grid state and return new version hash.
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

        $existing = $this->repository->get_user_state($gridid, $userid);
        if ($existing && $expectedhash !== null && $expectedhash !== '' && $existing->versionhash !== $expectedhash) {
            throw new \invalid_parameter_exception('Grid state conflict: version hash mismatch');
        }

        $json = json_encode($state, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($json === false) {
            throw new coding_exception('Failed to encode grid state JSON');
        }

        $newhash = sha1($json . '|' . microtime(true));
        $this->repository->upsert_user_state($gridid, $userid, $json, $newhash);
        return $newhash;
    }

    /**
     * Get per-user grid state.
     *
     * @param int $gridid Grid id.
     * @param int $userid User id.
     * @return array{state: array, versionhash: string|null}
     */
    public function get_user_state(int $gridid, int $userid): array {
        if ($gridid <= 0 || $userid <= 0) {
            throw new coding_exception('Invalid input for get_user_state');
        }

        $record = $this->repository->get_user_state($gridid, $userid);
        if (!$record) {
            return ['state' => [], 'versionhash' => null];
        }

        $decoded = json_decode((string)$record->statejson, true);
        if (!is_array($decoded)) {
            $decoded = [];
        }

        return ['state' => $decoded, 'versionhash' => (string)$record->versionhash];
    }
}
