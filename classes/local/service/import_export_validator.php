<?php
// This file is part of Moodle - http://moodle.org/

namespace mod_konzeptgenerator\local\service;

use mod_konzeptgenerator\local\compat\legacy_field_map;

defined('MOODLE_INTERNAL') || die();

/**
 * Validates import/export payloads for legacy compatibility.
 */
class import_export_validator {
    /** @var array<string, string[]> */
    private const STRICT_ENUMS = [
        'Zeitbedarf' => ['5', '10', '20', '30', '45', '60', '90', '120', '150', '180', 'mehr als 180 Minuten'],
        'Gruppengröße' => ['1', '2-3', '3–5', '6–12', '13–24', '25+', 'beliebig'],
        'Komplexitätsgrad' => ['sehr niedrig', 'niedrig', 'mittel', 'hoch'],
    ];

    /**
     * Validate a legacy import row.
     *
     * @param array $legacyrow Legacy row keyed by legacy field names.
     * @param bool $strict Validate enum values strictly.
     * @return array{errors: string[], warnings: string[], mapped: array}
     */
    public function validate_legacy_row(array $legacyrow, bool $strict = false): array {
        $errors = [];
        $warnings = [];
        $mapped = [];

        foreach (legacy_field_map::required_legacy_fields() as $required) {
            if (!array_key_exists($required, $legacyrow) || trim((string)$legacyrow[$required]) === '') {
                $errors[] = "Missing required field: {$required}";
            }
        }

        foreach (legacy_field_map::legacy_to_internal() as $legacyfield => $internalfield) {
            if (!array_key_exists($legacyfield, $legacyrow)) {
                continue;
            }

            $value = is_scalar($legacyrow[$legacyfield]) ? trim((string)$legacyrow[$legacyfield]) : '';
            $mapped[$internalfield] = $value;

            if ($strict && isset(self::STRICT_ENUMS[$legacyfield]) && $value !== '' && !in_array($value, self::STRICT_ENUMS[$legacyfield], true)) {
                $warnings[] = "Unexpected value for {$legacyfield}: {$value}";
            }
        }

        foreach (array_keys($legacyrow) as $legacyfield) {
            if (!array_key_exists($legacyfield, legacy_field_map::legacy_to_internal()) && !in_array($legacyfield, ['Materialien', 'H5P-Inhalt'], true)) {
                $warnings[] = "Unmapped legacy field retained as custom metadata: {$legacyfield}";
            }
        }

        return ['errors' => $errors, 'warnings' => $warnings, 'mapped' => $mapped];
    }

    /**
     * Validate plugin export payload prior to legacy output.
     *
     * @param array $internalrow Internal payload.
     * @param bool $strictlegacy If true, enforce strict legacy compatibility warnings.
     * @return array{errors: string[], warnings: string[], legacy: array}
     */
    public function validate_export_row(array $internalrow, bool $strictlegacy = false): array {
        $errors = [];
        $warnings = [];
        $legacy = [];

        foreach (legacy_field_map::internal_to_legacy() as $internalfield => $legacyfield) {
            $value = array_key_exists($internalfield, $internalrow) ? (string)$internalrow[$internalfield] : '';
            $legacy[$legacyfield] = $value;

            if ($strictlegacy && $value === '' && $legacyfield === 'Titel') {
                $errors[] = 'Missing required export field: Titel';
            }
        }

        if (!$strictlegacy && ($legacy['Titel'] ?? '') === '') {
            $warnings[] = 'Titel is empty; export may not be importable in strict legacy mode';
        }

        return ['errors' => $errors, 'warnings' => $warnings, 'legacy' => $legacy];
    }
}
