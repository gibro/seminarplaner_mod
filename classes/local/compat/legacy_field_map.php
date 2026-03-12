<?php
// This file is part of Moodle - http://moodle.org/

namespace mod_seminarplaner\local\compat;

defined('MOODLE_INTERNAL') || die();

/**
 * Legacy mod_data to plugin field mapping helpers.
 */
class legacy_field_map {
    /** @var array<string, string> */
    private const LEGACY_TO_INTERNAL = [
        'Titel' => 'title',
        'Seminarphase' => 'seminarphase',
        'Zeitbedarf' => 'zeitbedarf',
        'Gruppengröße' => 'gruppengroesse',
        'Kurzbeschreibung' => 'kurzbeschreibung',
        'Ablauf' => 'ablauf',
        'Lernziele (Ich-kann ...)' => 'lernziele',
        'Komplexitätsgrad' => 'komplexitaetsgrad',
        'Vorbereitung nötig' => 'vorbereitung',
        'Raumanforderungen' => 'raumanforderungen',
        'Sozialform' => 'sozialform',
        'Risiken/Tipps' => 'risiken_tipps',
        'Debrief/Reflexionsfragen' => 'debrief',
        'Material/Technik' => 'material_technik',
        'Tags / Schlüsselworte' => 'tags',
        'Kognitive Dimension' => 'kognitive_dimension',
        'Autor*in / Kontakt' => 'autor_kontakt',
    ];

    /**
     * Get legacy to internal mapping.
     *
     * @return array<string, string>
     */
    public static function legacy_to_internal(): array {
        return self::LEGACY_TO_INTERNAL;
    }

    /**
     * Get internal to legacy mapping.
     *
     * @return array<string, string>
     */
    public static function internal_to_legacy(): array {
        return array_flip(self::LEGACY_TO_INTERNAL);
    }

    /**
     * List internal compatibility fields.
     *
     * @return string[]
     */
    public static function internal_fields(): array {
        return array_values(self::LEGACY_TO_INTERNAL);
    }

    /**
     * List required legacy fields.
     *
     * @return string[]
     */
    public static function required_legacy_fields(): array {
        return ['Titel'];
    }
}
