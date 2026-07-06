<?php
// This file is part of Moodle - http://moodle.org/

namespace mod_seminarplaner\local\repository;

defined('MOODLE_INTERNAL') || die();

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
    public function create(?int $cmid, int $contextid, string $direction, string $status, ?string $payloadmeta, ?string $message,
        int $actorid): int {
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
