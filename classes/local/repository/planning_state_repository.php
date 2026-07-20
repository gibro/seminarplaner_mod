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
 * Planning state repository.
 *
 * @package    mod_seminarplaner
 * @copyright  2026 Guido Brombach <gibro@posteo.de>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace mod_seminarplaner\local\repository;

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
