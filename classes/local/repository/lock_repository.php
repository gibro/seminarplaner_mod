<?php
// This file is part of Moodle - http://moodle.org/

namespace mod_konzeptgenerator\local\repository;

defined('MOODLE_INTERNAL') || die();

/**
 * Repository for grid soft locks.
 */
class lock_repository {
    /**
     * Get lock for grid.
     *
     * @param int $gridid Grid id.
     * @return \stdClass|false
     */
    public function get_lock(int $gridid) {
        global $DB;
        return $DB->get_record('kgen_grid_lock', ['gridid' => $gridid]);
    }

    /**
     * Create or replace lock.
     *
     * @param int $gridid Grid id.
     * @param int $userid User id.
     * @param string $token Lock token.
     * @param int $expiresat Expiry timestamp.
     * @return int Lock id.
     */
    public function upsert_lock(int $gridid, int $userid, string $token, int $expiresat): int {
        global $DB;

        $now = time();
        $existing = $this->get_lock($gridid);

        if ($existing) {
            $existing->userid = $userid;
            $existing->locktoken = $token;
            $existing->expiresat = $expiresat;
            $existing->timemodified = $now;
            $DB->update_record('kgen_grid_lock', $existing);
            return (int)$existing->id;
        }

        $record = (object)[
            'gridid' => $gridid,
            'userid' => $userid,
            'locktoken' => $token,
            'expiresat' => $expiresat,
            'timecreated' => $now,
            'timemodified' => $now,
        ];

        return (int)$DB->insert_record('kgen_grid_lock', $record);
    }

    /**
     * Delete lock for a grid.
     *
     * @param int $gridid Grid id.
     * @return void
     */
    public function delete_lock(int $gridid): void {
        global $DB;
        $DB->delete_records('kgen_grid_lock', ['gridid' => $gridid]);
    }

    /**
     * Delete expired locks.
     *
     * @param int|null $now Current timestamp override.
     * @return void
     */
    public function delete_expired_locks(?int $now = null): void {
        global $DB;

        $now = $now ?? time();
        $DB->delete_records_select('kgen_grid_lock', 'expiresat <= ?', [$now]);
    }
}
