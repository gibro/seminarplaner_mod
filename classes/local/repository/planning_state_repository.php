<?php
// This file is part of Moodle - http://moodle.org/

namespace mod_konzeptgenerator\local\repository;

defined('MOODLE_INTERNAL') || die();

/**
 * Repository for shared planning mode state.
 */
class planning_state_repository {
    /**
     * Get planning state for activity.
     *
     * @param int $cmid
     * @return \stdClass|false
     */
    public function get_state(int $cmid) {
        global $DB;
        return $DB->get_record('kgen_planning_state', ['cmid' => $cmid]);
    }

    /**
     * Upsert planning state.
     *
     * @param int $cmid
     * @param string $statejson
     * @param string $versionhash
     * @param int $userid
     * @return int record id
     */
    public function upsert_state(int $cmid, string $statejson, string $versionhash, int $userid): int {
        global $DB;

        $now = time();
        $existing = $this->get_state($cmid);
        if ($existing) {
            $existing->statejson = $statejson;
            $existing->versionhash = $versionhash;
            $existing->timemodified = $now;
            $existing->modifiedby = $userid;
            $DB->update_record('kgen_planning_state', $existing);
            return (int)$existing->id;
        }

        $record = (object)[
            'cmid' => $cmid,
            'statejson' => $statejson,
            'versionhash' => $versionhash,
            'timecreated' => $now,
            'timemodified' => $now,
            'createdby' => $userid,
            'modifiedby' => $userid,
        ];
        return (int)$DB->insert_record('kgen_planning_state', $record);
    }
}

