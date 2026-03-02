<?php
// This file is part of Moodle - http://moodle.org/

namespace mod_konzeptgenerator\local\repository;

defined('MOODLE_INTERNAL') || die();

/**
 * Repository for grid data and user state.
 */
class grid_repository {
    /**
     * Create a new grid for a course module.
     *
     * @param int $cmid Course module id.
     * @param string $name Grid name.
     * @param int $userid Creator id.
     * @param string|null $description Optional description.
     * @return int New grid id.
     */
    public function create_grid(int $cmid, string $name, int $userid, ?string $description = null): int {
        global $DB;

        $now = time();
        $record = (object)[
            'cmid' => $cmid,
            'name' => trim($name),
            'description' => $description,
            'isarchived' => 0,
            'timecreated' => $now,
            'timemodified' => $now,
            'createdby' => $userid,
            'modifiedby' => $userid,
        ];

        return (int)$DB->insert_record('kgen_grid', $record);
    }

    /**
     * Get active grids for a course module.
     *
     * @param int $cmid Course module id.
     * @return array
     */
    public function get_active_grids(int $cmid): array {
        global $DB;

        return $DB->get_records('kgen_grid', ['cmid' => $cmid, 'isarchived' => 0], 'timemodified DESC');
    }

    /**
     * Get a grid by id.
     *
     * @param int $gridid Grid id.
     * @return \stdClass|false
     */
    public function get_grid(int $gridid) {
        global $DB;
        return $DB->get_record('kgen_grid', ['id' => $gridid]);
    }

    /**
     * Rename or update grid metadata.
     *
     * @param int $gridid Grid id.
     * @param string $name New name.
     * @param int $userid Modifier id.
     * @param string|null $description Optional description.
     * @return bool
     */
    public function update_grid(int $gridid, string $name, int $userid, ?string $description = null): bool {
        global $DB;

        $record = (object)[
            'id' => $gridid,
            'name' => trim($name),
            'description' => $description,
            'timemodified' => time(),
            'modifiedby' => $userid,
        ];

        return $DB->update_record('kgen_grid', $record);
    }

    /**
     * Archive a grid.
     *
     * @param int $gridid Grid id.
     * @param int $userid Modifier id.
     * @return bool
     */
    public function archive_grid(int $gridid, int $userid): bool {
        global $DB;

        $record = (object)[
            'id' => $gridid,
            'isarchived' => 1,
            'timemodified' => time(),
            'modifiedby' => $userid,
        ];

        return $DB->update_record('kgen_grid', $record);
    }

    /**
     * Save per-user state for a grid.
     *
     * @param int $gridid Grid id.
     * @param int $userid User id.
     * @param string $statejson JSON payload.
     * @param string $versionhash Optimistic version hash.
     * @return int State record id.
     */
    public function upsert_user_state(int $gridid, int $userid, string $statejson, string $versionhash): int {
        global $DB;

        $now = time();
        $existing = $DB->get_record('kgen_grid_user_state', ['gridid' => $gridid, 'userid' => $userid]);

        if ($existing) {
            $existing->statejson = $statejson;
            $existing->versionhash = $versionhash;
            $existing->timemodified = $now;
            $DB->update_record('kgen_grid_user_state', $existing);
            return (int)$existing->id;
        }

        $record = (object)[
            'gridid' => $gridid,
            'userid' => $userid,
            'statejson' => $statejson,
            'versionhash' => $versionhash,
            'timecreated' => $now,
            'timemodified' => $now,
        ];

        return (int)$DB->insert_record('kgen_grid_user_state', $record);
    }

    /**
     * Get user state for a grid.
     *
     * @param int $gridid Grid id.
     * @param int $userid User id.
     * @return \stdClass|false
     */
    public function get_user_state(int $gridid, int $userid) {
        global $DB;
        return $DB->get_record('kgen_grid_user_state', ['gridid' => $gridid, 'userid' => $userid]);
    }
}
