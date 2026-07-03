<?php
// This file is part of Moodle - http://moodle.org/

namespace mod_seminarplaner\local\repository;

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

    /**
     * Get the newest existing state for a grid (legacy per-user fallback).
     *
     * @param int $gridid Grid id.
     * @return \stdClass|false
     */
    public function get_latest_state_for_grid(int $gridid) {
        global $DB;
        $records = $DB->get_records('kgen_grid_user_state', ['gridid' => $gridid], 'timemodified DESC, id DESC', '*', 0, 1);
        if (!$records) {
            return false;
        }
        return reset($records);
    }

    /**
     * Get published Common Thread snapshot for one activity.
     *
     * @param int $cmid Course module id.
     * @return \stdClass|false
     */
    public function get_roterfaden_state(int $cmid) {
        global $DB;
        return $DB->get_record('kgen_roterfaden_state', ['cmid' => $cmid]);
    }

    /**
     * Publish one grid snapshot as Common Thread for the activity.
     *
     * @param int $cmid Course module id.
     * @param int $gridid Grid id.
     * @param string $statejson Serialized state payload.
     * @param int $userid Actor id.
     * @return int Record id.
     */
    public function upsert_roterfaden_state(int $cmid, int $gridid, string $statejson, int $userid): int {
        global $DB;

        $now = time();
        $existing = $DB->get_record('kgen_roterfaden_state', ['cmid' => $cmid]);
        if ($existing) {
            $existing->gridid = $gridid;
            $existing->statejson = $statejson;
            $existing->ispublished = 1;
            $existing->publishedby = $userid;
            $existing->timemodified = $now;
            $DB->update_record('kgen_roterfaden_state', $existing);
            return (int)$existing->id;
        }

        $record = (object)[
            'cmid' => $cmid,
            'gridid' => $gridid,
            'statejson' => $statejson,
            'ispublished' => 1,
            'publishedby' => $userid,
            'timecreated' => $now,
            'timemodified' => $now,
        ];
        return (int)$DB->insert_record('kgen_roterfaden_state', $record);
    }

    /**
     * Set visibility flag for an existing Common Thread snapshot.
     *
     * @param int $cmid Course module id.
     * @param bool $visible Visibility flag.
     * @param int $userid Actor id.
     * @return bool
     */
    public function set_roterfaden_visibility(int $cmid, bool $visible, int $userid): bool {
        global $DB;

        $existing = $DB->get_record('kgen_roterfaden_state', ['cmid' => $cmid]);
        if (!$existing) {
            if ($visible) {
                return false;
            }
            $record = (object)[
                'cmid' => $cmid,
                'gridid' => 0,
                'statejson' => null,
                'ispublished' => 0,
                'publishedby' => $userid,
                'timecreated' => time(),
                'timemodified' => time(),
            ];
            $DB->insert_record('kgen_roterfaden_state', $record);
            return true;
        }

        $existing->ispublished = $visible ? 1 : 0;
        $existing->publishedby = $userid;
        $existing->timemodified = time();
        return $DB->update_record('kgen_roterfaden_state', $existing);
    }
}
