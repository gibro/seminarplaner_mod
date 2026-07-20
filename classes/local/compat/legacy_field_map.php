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
 * Legacy field map.
 *
 * @package    mod_seminarplaner
 * @copyright  2026 Guido Brombach <gibro@posteo.de>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

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
