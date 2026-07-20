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
 * Import export audit service.
 *
 * @package    mod_seminarplaner
 * @copyright  2026 Guido Brombach <gibro@posteo.de>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace mod_seminarplaner\local\service;

use mod_seminarplaner\local\repository\import_export_log_repository;

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
    public function log(
        ?int $cmid,
        int $contextid,
        string $direction,
        string $status,
        array $meta,
        string $message,
        int $actorid
    ): int {
        $payloadmeta = json_encode($meta, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($payloadmeta === false) {
            $payloadmeta = '{}';
        }

        return $this->repository->create($cmid, $contextid, $direction, $status, $payloadmeta, $message, $actorid);
    }
}
