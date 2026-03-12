<?php
// This file is part of Moodle - http://moodle.org/

namespace mod_seminarplaner\local\service;

use coding_exception;

defined('MOODLE_INTERNAL') || die();

/**
 * Orchestrates manual import/export validation and audit logging.
 */
class import_export_service {
    /** @var import_export_validator */
    private $validator;

    /** @var import_export_audit_service */
    private $auditservice;

    /**
     * Constructor.
     *
     * @param import_export_validator|null $validator Validator dependency.
     * @param import_export_audit_service|null $auditservice Audit dependency.
     */
    public function __construct(?import_export_validator $validator = null, ?import_export_audit_service $auditservice = null) {
        $this->validator = $validator ?? new import_export_validator();
        $this->auditservice = $auditservice ?? new import_export_audit_service();
    }

    /**
     * Validate a set of legacy rows for import.
     *
     * @param int|null $cmid Course module id.
     * @param int $contextid Context id.
     * @param int $actorid Actor user id.
     * @param array $legacyrows Rows to validate.
     * @param bool $strict Strict value checks.
     * @return array{errors: string[], warnings: string[], mappedrows: array}
     */
    public function validate_import_rows(?int $cmid, int $contextid, int $actorid, array $legacyrows, bool $strict = false): array {
        if ($contextid <= 0 || $actorid <= 0) {
            throw new coding_exception('Invalid context or actor for validate_import_rows');
        }

        $errors = [];
        $warnings = [];
        $mappedrows = [];

        foreach ($legacyrows as $idx => $row) {
            if (!is_array($row)) {
                $errors[] = "Row {$idx} is not a valid object/array payload";
                continue;
            }

            $result = $this->validator->validate_legacy_row($row, $strict);
            foreach ($result['errors'] as $error) {
                $errors[] = "Row {$idx}: {$error}";
            }
            foreach ($result['warnings'] as $warning) {
                $warnings[] = "Row {$idx}: {$warning}";
            }
            $mappedrows[] = $result['mapped'];
        }

        $status = 'ok';
        if (!empty($errors)) {
            $status = 'error';
        } else if (!empty($warnings)) {
            $status = 'warning';
        }

        $this->auditservice->log(
            $cmid,
            $contextid,
            'import_moddata',
            $status,
            [
                'rows' => count($legacyrows),
                'strict' => $strict,
                'errors' => count($errors),
                'warnings' => count($warnings),
            ],
            'Manual import validation executed',
            $actorid
        );

        return ['errors' => $errors, 'warnings' => $warnings, 'mappedrows' => $mappedrows];
    }

    /**
     * Validate internal rows for legacy export.
     *
     * @param int|null $cmid Course module id.
     * @param int $contextid Context id.
     * @param int $actorid Actor user id.
     * @param array $internalrows Internal rows.
     * @param bool $strictlegacy Strict legacy mode.
     * @return array{errors: string[], warnings: string[], legacyrows: array}
     */
    public function validate_export_rows(?int $cmid, int $contextid, int $actorid, array $internalrows,
        bool $strictlegacy = false): array {
        if ($contextid <= 0 || $actorid <= 0) {
            throw new coding_exception('Invalid context or actor for validate_export_rows');
        }

        $errors = [];
        $warnings = [];
        $legacyrows = [];

        foreach ($internalrows as $idx => $row) {
            if (!is_array($row)) {
                $errors[] = "Row {$idx} is not a valid object/array payload";
                continue;
            }

            $result = $this->validator->validate_export_row($row, $strictlegacy);
            foreach ($result['errors'] as $error) {
                $errors[] = "Row {$idx}: {$error}";
            }
            foreach ($result['warnings'] as $warning) {
                $warnings[] = "Row {$idx}: {$warning}";
            }
            $legacyrows[] = $result['legacy'];
        }

        $status = 'ok';
        if (!empty($errors)) {
            $status = 'error';
        } else if (!empty($warnings)) {
            $status = 'warning';
        }

        $this->auditservice->log(
            $cmid,
            $contextid,
            'export_moddata',
            $status,
            [
                'rows' => count($internalrows),
                'strictlegacy' => $strictlegacy,
                'errors' => count($errors),
                'warnings' => count($warnings),
            ],
            'Manual export validation executed',
            $actorid
        );

        return ['errors' => $errors, 'warnings' => $warnings, 'legacyrows' => $legacyrows];
    }
}
