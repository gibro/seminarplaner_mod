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
 * Import export log repository.
 *
 * @package    mod_seminarplaner
 * @copyright  2026 Guido Brombach <gibro@posteo.de>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace mod_seminarplaner\local\repository;

/**
 * Repository for import/export audit logs.
 */
class import_export_log_repository {
    /**
     * Insert an import/export audit record.
     *
     * @param int|null $cmid Course module id.
     * @param int $contextid Context id.
     * @param string $direction import_moddata|export_moddata.
     * @param string $status ok|warning|error.
     * @param string|null $payloadmeta JSON metadata.
     * @param string|null $message Summary message.
     * @param int $actorid Actor user id.
     * @return int New record id.
     */
    public function create(
        ?int $cmid,
        int $contextid,
        string $direction,
        string $status,
        ?string $payloadmeta,
        ?string $message,
        int $actorid
    ): int {
        global $DB;

        $record = (object)[
            'cmid' => $cmid,
            'contextid' => $contextid,
            'direction' => $direction,
            'status' => $status,
            'payloadmeta' => $payloadmeta,
            'message' => $message,
            'actorid' => $actorid,
            'timecreated' => time(),
        ];

        return (int)$DB->insert_record('kgen_import_export_log', $record);
    }
}
