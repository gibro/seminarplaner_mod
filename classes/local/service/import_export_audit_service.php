<?php
// This file is part of Moodle - http://moodle.org/

namespace mod_konzeptgenerator\local\service;

use mod_konzeptgenerator\local\repository\import_export_log_repository;

defined('MOODLE_INTERNAL') || die();

/**
 * Audit helper for manual import/export operations.
 */
class import_export_audit_service {
    /** @var import_export_log_repository */
    private $repository;

    /**
     * Constructor.
     *
     * @param import_export_log_repository|null $repository Repository dependency.
     */
    public function __construct(?import_export_log_repository $repository = null) {
        $this->repository = $repository ?? new import_export_log_repository();
    }

    /**
     * Write audit record.
     *
     * @param int|null $cmid Course module id.
     * @param int $contextid Context id.
     * @param string $direction import_moddata|export_moddata.
     * @param string $status ok|warning|error.
     * @param array $meta Structured metadata.
     * @param string $message Summary message.
     * @param int $actorid User id.
     * @return int Audit record id.
     */
    public function log(?int $cmid, int $contextid, string $direction, string $status, array $meta, string $message,
        int $actorid): int {
        $payloadmeta = json_encode($meta, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($payloadmeta === false) {
            $payloadmeta = '{}';
        }

        return $this->repository->create($cmid, $contextid, $direction, $status, $payloadmeta, $message, $actorid);
    }
}
