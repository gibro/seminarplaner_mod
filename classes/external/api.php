<?php
// This file is part of Moodle - http://moodle.org/

namespace mod_seminarplaner\external;

use context_coursecat;
use context_module;
use context_system;
use core_external\external_api;
use core_external\external_function_parameters;
use core_external\external_multiple_structure;
use core_external\external_single_structure;
use core_external\external_value;
use invalid_parameter_exception;
use mod_seminarplaner\local\service\grid_service;
use mod_seminarplaner\local\service\import_export_service;
use mod_seminarplaner\local\service\method_card_service;
use mod_seminarplaner\local\service\planning_state_service;
use mod_seminarplaner\local\service\soft_lock_service;

defined('MOODLE_INTERNAL') || die();

/**
 * External API endpoints for Seminarplaner.
 */
class api extends external_api {
    /** @var int Max allowed size for methodsjson payload. */
    private const MAX_METHODS_JSON_BYTES = 26214400; // 25 MB.
    /** @var int Max allowed size for state JSON payloads. */
    private const MAX_STATE_JSON_BYTES = 2097152; // 2 MB.
    /** @var int Max allowed size for import/export validation payloads. */
    private const MAX_VALIDATION_PAYLOAD_JSON_BYTES = 3145728; // 3 MB.
    /** @var int Max allowed length for changelog text. */
    private const MAX_CHANGELOG_CHARS = 4000;
    /** @var int Max allowed length for method set description. */
    private const MAX_METHODSET_DESCRIPTION_CHARS = 12000;
    /** @var int Max number of method ids accepted in one review submit/create request. */
    private const MAX_REVIEW_METHODIDS = 500;
    /** @var string[] Method fields tracked for local-change protection during sync. */
    private const SYNC_TRACKED_FIELDS = [
        'titel', 'seminarphase', 'zeitbedarf', 'gruppengroesse', 'kurzbeschreibung', 'autor',
        'lernziele', 'komplexitaet', 'vorbereitung', 'raum', 'sozialform', 'risiken', 'debrief',
        'materialtechnik', 'ablauf', 'tags', 'kognitive',
    ];
    private static function resolve_cm_context(int $cmid): array {
        global $DB;

        $cm = get_coursemodule_from_id('seminarplaner', $cmid, 0, false, MUST_EXIST);
        $course = $DB->get_record('course', ['id' => $cm->course], '*', MUST_EXIST);
        require_login($course, true, $cm);

        $context = context_module::instance($cm->id);
        self::validate_context($context);

        return ['cm' => $cm, 'course' => $course, 'context' => $context];
    }

    private static function global_plugin_available(): bool {
        return class_exists('\\local_seminarplaner\\local\\repository\\methodset_repository');
    }

    private static function can_view_global_methodsets(\stdClass $course): bool {
        if (!self::global_plugin_available()) {
            return false;
        }
        $syscontext = context_system::instance();
        $catcontext = context_coursecat::instance((int)$course->category);
        return has_capability('local/seminarplaner:viewglobalsets', $syscontext)
            || has_capability('local/seminarplaner:viewglobalsets', $catcontext);
    }

    private static function split_multi_text($value): array {
        if ($value === null) {
            return [];
        }
        $parts = preg_split('/##|[\r\n,;]+/u', (string)$value) ?: [];
        $out = [];
        foreach ($parts as $part) {
            $part = trim(strip_tags((string)$part));
            if ($part !== '') {
                $out[] = $part;
            }
        }
        return $out;
    }

    private static function map_global_method_record(\stdClass $row, int $setid = 0, int $versionid = 0): array {
        $mapped = [
            'id' => 'global-' . (int)$row->id . '-' . time(),
            'titel' => (string)($row->title ?? ''),
            'seminarphase' => self::split_multi_text($row->seminarphase ?? ''),
            'zeitbedarf' => trim((string)($row->zeitbedarf ?? '')),
            'gruppengroesse' => trim((string)($row->gruppengroesse ?? '')),
            'kurzbeschreibung' => trim((string)($row->kurzbeschreibung ?? '')),
            'autor' => trim((string)($row->autor_kontakt ?? '')),
            'lernziele' => trim((string)($row->lernziele ?? '')),
            'komplexitaet' => trim((string)($row->komplexitaetsgrad ?? '')),
            'vorbereitung' => trim((string)($row->vorbereitung ?? '')),
            'raum' => self::split_multi_text($row->raumanforderungen ?? ''),
            'sozialform' => self::split_multi_text($row->sozialform ?? ''),
            'risiken' => trim((string)($row->risiken_tipps ?? '')),
            'debrief' => trim((string)($row->debrief ?? '')),
            'materialien' => [],
            'h5p' => [],
            'materialtechnik' => trim((string)($row->material_technik ?? '')),
            'ablauf' => trim((string)($row->ablauf ?? '')),
            'tags' => trim((string)($row->tags ?? '')),
            'kognitive' => self::split_multi_text($row->kognitive_dimension ?? ''),
        ];
        if ($setid > 0 && $versionid > 0) {
            $mapped['_kgsync'] = [
                'setid' => $setid,
                'sourceversionid' => $versionid,
                'sourcemethodid' => (int)$row->id,
                'frozen' => 0,
                'pendingversionid' => 0,
                'sourcehashes' => self::build_sync_source_hashes($mapped),
            ];
        }
        return $mapped;
    }

    /**
     * Build source hashes for sync-protected fields.
     *
     * @param array $method
     * @return array<string, string>
     */
    private static function build_sync_source_hashes(array $method): array {
        $out = [];
        foreach (self::SYNC_TRACKED_FIELDS as $field) {
            $out[$field] = self::hash_sync_value($method[$field] ?? '');
        }
        return $out;
    }

    /**
     * Hash one sync field value.
     *
     * @param mixed $value
     * @return string
     */
    private static function hash_sync_value($value): string {
        if (is_array($value)) {
            $parts = [];
            foreach ($value as $entry) {
                $parts[] = trim((string)$entry);
            }
            sort($parts);
            return sha1(implode('||', $parts));
        }
        return sha1(trim((string)$value));
    }

    /**
     * Load material attachments for global methods from local_seminarplaner storage.
     *
     * @param int[] $methodids Global method ids.
     * @return array<int, array<int, array<string, mixed>>> methodid => attachment descriptors
     */
    private static function load_global_method_material_attachments(array $methodids): array {
        global $DB;

        $methodids = array_values(array_unique(array_map('intval', $methodids)));
        if (!$methodids) {
            return [];
        }

        list($insql, $params) = $DB->get_in_or_equal($methodids, SQL_PARAMS_NAMED);
        $links = $DB->get_records_select('local_kgen_method_file',
            "methodid {$insql} AND kind = :kind",
            $params + ['kind' => 'material']);
        if (!$links) {
            return [];
        }

        $itemids = [];
        foreach ($links as $link) {
            $itemids[] = (int)$link->fileitemid;
        }
        $itemids = array_values(array_unique(array_filter($itemids)));
        if (!$itemids) {
            return [];
        }

        list($iteminsql, $itemparams) = $DB->get_in_or_equal($itemids, SQL_PARAMS_NAMED);
        $records = $DB->get_records_select('files',
            "itemid {$iteminsql}
                 AND component = :component
                 AND filearea = :filearea
                 AND filename <> :dot
                 AND filesize > 0",
            $itemparams + [
                'component' => 'local_seminarplaner',
                'filearea' => 'method_material',
                'dot' => '.',
            ]);
        if (!$records) {
            return [];
        }

        $storedbyitem = [];
        foreach ($records as $record) {
            $storedbyitem[(int)$record->itemid][] = $record;
        }

        $fs = get_file_storage();
        $out = [];
        foreach ($links as $link) {
            $methodid = (int)$link->methodid;
            $itemid = (int)$link->fileitemid;
            if (empty($storedbyitem[$itemid])) {
                continue;
            }
            foreach ($storedbyitem[$itemid] as $stored) {
                $file = $fs->get_file_by_id((int)$stored->id);
                if (!$file || $file->is_directory()) {
                    continue;
                }
                $name = (string)$file->get_filename();
                if ($name === '' || $name === '.') {
                    continue;
                }
                $out[$methodid][] = [
                    'name' => $name,
                    'mimetype' => (string)$file->get_mimetype(),
                    'size' => (int)$file->get_filesize(),
                    'contentbase64' => base64_encode((string)$file->get_content()),
                ];
            }
        }
        return $out;
    }

    /**
     * Map an activity method card to local global-set record format.
     *
     * @param array $method Method card payload.
     * @return array<string, mixed>
     */
    private static function map_activity_method_to_global_record(array $method): array {
        $splitmulti = static function($value): string {
            if (is_array($value)) {
                $parts = [];
                foreach ($value as $entry) {
                    $entry = trim(strip_tags((string)$entry));
                    if ($entry !== '') {
                        $parts[] = $entry;
                    }
                }
                return implode('##', $parts);
            }
            $trimmed = trim(strip_tags((string)$value));
            return $trimmed;
        };

        return [
            'externalref' => null,
            'title' => trim((string)($method['titel'] ?? '')),
            'seminarphase' => $splitmulti($method['seminarphase'] ?? []),
            'zeitbedarf' => trim((string)($method['zeitbedarf'] ?? '')),
            'gruppengroesse' => trim((string)($method['gruppengroesse'] ?? '')),
            'kurzbeschreibung' => trim((string)($method['kurzbeschreibung'] ?? '')),
            'ablauf' => trim((string)($method['ablauf'] ?? '')),
            'lernziele' => trim((string)($method['lernziele'] ?? '')),
            'komplexitaetsgrad' => trim((string)($method['komplexitaet'] ?? '')),
            'vorbereitung' => trim((string)($method['vorbereitung'] ?? '')),
            'raumanforderungen' => $splitmulti($method['raum'] ?? []),
            'sozialform' => $splitmulti($method['sozialform'] ?? []),
            'risiken_tipps' => trim((string)($method['risiken'] ?? '')),
            'debrief' => trim((string)($method['debrief'] ?? '')),
            'material_technik' => trim((string)($method['materialtechnik'] ?? '')),
            'tags' => trim((string)($method['tags'] ?? '')),
            'kognitive_dimension' => $splitmulti($method['kognitive'] ?? []),
            'autor_kontakt' => trim((string)($method['autor'] ?? '')),
            'metadatakeyvaluesjson' => null,
            'h5pcontentid' => null,
        ];
    }

    /**
     * Normalize method title as matching key.
     *
     * @param string $title Title.
     * @return string
     */
    private static function normalize_method_title(string $title): string {
        return \core_text::strtolower(trim($title));
    }

    /**
     * Load current methods of a global method set as title-indexed records.
     *
     * @param int $methodsetid Method set id.
     * @return array<string, array<string, mixed>>
     */
    private static function load_set_methods_by_title(int $methodsetid): array {
        global $DB;

        $repo = new \local_seminarplaner\local\repository\methodset_repository();
        $set = $repo->get_methodset($methodsetid);
        if (!$set) {
            return [];
        }

        $rows = [];
        if (!empty($set->currentversion)) {
            $rows = $DB->get_records('local_kgen_method', [
                'methodsetid' => (int)$set->id,
                'methodsetversionid' => (int)$set->currentversion,
            ]);
        }
        if (!$rows) {
            $rows = $DB->get_records('local_kgen_method', ['methodsetid' => (int)$set->id]);
        }

        $out = [];
        foreach ($rows as $row) {
            $title = trim((string)($row->title ?? ''));
            if ($title === '') {
                continue;
            }
            $out[self::normalize_method_title($title)] = self::map_global_method_record($row,
                (int)$set->id, (int)($row->methodsetversionid ?? $set->currentversion ?? 0));
        }
        return $out;
    }

    /**
     * Compare two method-card payloads and return changed field labels.
     *
     * @param array $base Base method.
     * @param array $candidate Candidate method.
     * @return string[]
     */
    private static function diff_method_fields(array $base, array $candidate): array {
        $fieldmap = [
            'titel' => 'Titel',
            'seminarphase' => 'Seminarphase',
            'zeitbedarf' => 'Zeitbedarf',
            'gruppengroesse' => 'Gruppengröße',
            'kurzbeschreibung' => 'Kurzbeschreibung',
            'autor' => 'Autor*in / Kontakt',
            'lernziele' => 'Lernziele',
            'komplexitaet' => 'Komplexitätsgrad',
            'vorbereitung' => 'Vorbereitung',
            'raum' => 'Raumanforderungen',
            'sozialform' => 'Sozialform',
            'risiken' => 'Risiken/Tipps',
            'debrief' => 'Debrief/Reflexionsfragen',
            'materialtechnik' => 'Material/Technik',
            'ablauf' => 'Ablauf',
            'tags' => 'Tags',
            'kognitive' => 'Kognitive Dimension',
        ];
        $normalize = static function($value): string {
            if (is_array($value)) {
                $parts = [];
                foreach ($value as $entry) {
                    $parts[] = trim(strip_tags((string)$entry));
                }
                sort($parts);
                return implode('||', array_filter($parts, static function($entry) {
                    return $entry !== '';
                }));
            }
            return trim(strip_tags((string)$value));
        };

        $changed = [];
        foreach ($fieldmap as $field => $label) {
            if ($normalize($base[$field] ?? '') !== $normalize($candidate[$field] ?? '')) {
                $changed[] = $label;
            }
        }
        return $changed;
    }

    /**
     * Resolve scope contexts where current user can submit method sets for review.
     *
     * @param \stdClass $course Course record.
     * @return context_coursecat[]|context_system[]
     */
    private static function resolve_submit_scope_contexts(\stdClass $course): array {
        $contexts = [];
        $catcontext = context_coursecat::instance((int)$course->category);
        if (has_capability('local/seminarplaner:submitforreview', $catcontext)) {
            $contexts[] = $catcontext;
        }
        $syscontext = context_system::instance();
        if (has_capability('local/seminarplaner:submitforreview', $syscontext)) {
            $contexts[] = $syscontext;
        }
        return $contexts;
    }

    /**
     * Require at least one of the given capabilities in module context.
     *
     * @param context_module $context
     * @param string[] $capabilities
     * @return void
     */
    private static function require_any_module_capability(context_module $context, array $capabilities): void {
        foreach ($capabilities as $capability) {
            if (has_capability($capability, $context)) {
                return;
            }
        }
        require_capability($capabilities[0], $context);
    }

    /**
     * Lightweight in-session write throttling for expensive endpoints.
     *
     * @param string $action Action key.
     * @param int $maxrequests Max requests in window.
     * @param int $windowseconds Time window in seconds.
     * @return void
     */
    private static function enforce_write_rate_limit(string $action, int $maxrequests, int $windowseconds): void {
        global $SESSION;

        if ($maxrequests <= 0 || $windowseconds <= 0) {
            return;
        }
        if (!isset($SESSION->mod_seminarplaner_ratelimit) || !is_array($SESSION->mod_seminarplaner_ratelimit)) {
            $SESSION->mod_seminarplaner_ratelimit = [];
        }

        $now = time();
        $windowstart = $now - $windowseconds;
        $entries = $SESSION->mod_seminarplaner_ratelimit[$action] ?? [];
        if (!is_array($entries)) {
            $entries = [];
        }

        $entries = array_values(array_filter($entries, static function($ts) use ($windowstart) {
            return is_int($ts) && $ts >= $windowstart;
        }));

        if (count($entries) >= $maxrequests) {
            throw new invalid_parameter_exception('Zu viele Schreibanfragen in kurzer Zeit. Bitte kurz warten und erneut versuchen.');
        }

        $entries[] = $now;
        $SESSION->mod_seminarplaner_ratelimit[$action] = $entries;
    }

    public static function get_method_cards_parameters(): external_function_parameters {
        return new external_function_parameters([
            'cmid' => new external_value(PARAM_INT, 'Course module id'),
        ]);
    }

    public static function get_method_cards(int $cmid): array {
        $params = self::validate_parameters(self::get_method_cards_parameters(), ['cmid' => $cmid]);
        $resolved = self::resolve_cm_context((int)$params['cmid']);
        self::require_any_module_capability($resolved['context'], [
            'mod/seminarplaner:managemethods',
            'mod/seminarplaner:managegrids',
        ]);

        $service = new method_card_service();
        $methods = $service->get_methods((int)$resolved['cm']->id, (int)$GLOBALS['USER']->id, (int)$resolved['context']->id);

        return ['methodsjson' => json_encode($methods, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)];
    }

    public static function get_method_cards_returns(): external_single_structure {
        return new external_single_structure([
            'methodsjson' => new external_value(PARAM_RAW, 'Method cards as JSON'),
        ]);
    }

    public static function save_method_cards_parameters(): external_function_parameters {
        return new external_function_parameters([
            'cmid' => new external_value(PARAM_INT, 'Course module id'),
            'methodsjson' => new external_value(PARAM_RAW, 'Method cards as JSON'),
        ]);
    }

    public static function save_method_cards(int $cmid, string $methodsjson): array {
        $params = self::validate_parameters(self::save_method_cards_parameters(), [
            'cmid' => $cmid,
            'methodsjson' => $methodsjson,
        ]);

        $resolved = self::resolve_cm_context((int)$params['cmid']);
        require_capability('mod/seminarplaner:managemethods', $resolved['context']);
        self::enforce_write_rate_limit('save_method_cards', 120, 60);
        if (strlen($methodsjson) > self::MAX_METHODS_JSON_BYTES) {
            throw new invalid_parameter_exception('methodsjson exceeds allowed size');
        }

        $decoded = json_decode((string)$params['methodsjson'], true);
        if (!is_array($decoded)) {
            throw new invalid_parameter_exception('methodsjson must decode to an array');
        }

        $service = new method_card_service();
        $service->save_methods((int)$resolved['cm']->id, (int)$GLOBALS['USER']->id, (int)$resolved['context']->id, $decoded);

        return ['success' => true, 'count' => count($decoded)];
    }

    public static function save_method_cards_returns(): external_single_structure {
        return new external_single_structure([
            'success' => new external_value(PARAM_BOOL, 'Save result'),
            'count' => new external_value(PARAM_INT, 'Saved method count'),
        ]);
    }

    public static function list_global_methodsets_parameters(): external_function_parameters {
        return new external_function_parameters([
            'cmid' => new external_value(PARAM_INT, 'Course module id'),
        ]);
    }

    public static function list_global_methodsets(int $cmid): array {
        global $DB;

        $params = self::validate_parameters(self::list_global_methodsets_parameters(), ['cmid' => $cmid]);
        $resolved = self::resolve_cm_context((int)$params['cmid']);
        require_capability('mod/seminarplaner:managemethods', $resolved['context']);

        if (!self::global_plugin_available()) {
            return ['available' => false, 'message' => 'local_seminarplaner ist nicht installiert.', 'methodsets' => []];
        }
        if (!self::can_view_global_methodsets($resolved['course'])) {
            return ['available' => true, 'message' => 'Keine Berechtigung für globale Konzepte.', 'methodsets' => []];
        }

        $repo = new \local_seminarplaner\local\repository\methodset_repository();
        $syscontext = context_system::instance();
        $catcontext = context_coursecat::instance((int)$resolved['course']->category);
        $sets = [];
        if (has_capability('local/seminarplaner:viewglobalsets', $syscontext)) {
            foreach ($repo->list_methodsets((int)$syscontext->id, 'published') as $set) {
                $sets[(int)$set->id] = $set;
            }
        }
        if (has_capability('local/seminarplaner:viewglobalsets', $catcontext)) {
            foreach ($repo->list_methodsets((int)$catcontext->id, 'published') as $set) {
                $sets[(int)$set->id] = $set;
            }
        }

        $out = [];
        foreach ($sets as $set) {
            $count = (int)$DB->count_records('local_kgen_method', ['methodsetid' => (int)$set->id]);
            $out[] = [
                'id' => (int)$set->id,
                'displayname' => (string)$set->displayname,
                'shortname' => (string)$set->shortname,
                'status' => (string)$set->status,
                'methodcount' => $count,
            ];
        }

        return ['available' => true, 'message' => '', 'methodsets' => array_values($out)];
    }

    public static function list_global_methodsets_returns(): external_single_structure {
        return new external_single_structure([
            'available' => new external_value(PARAM_BOOL, 'Local plugin available'),
            'message' => new external_value(PARAM_TEXT, 'Status message'),
            'methodsets' => new external_multiple_structure(new external_single_structure([
                'id' => new external_value(PARAM_INT, 'Method set id'),
                'displayname' => new external_value(PARAM_TEXT, 'Display name'),
                'shortname' => new external_value(PARAM_ALPHANUMEXT, 'Short name'),
                'status' => new external_value(PARAM_ALPHA, 'Status'),
                'methodcount' => new external_value(PARAM_INT, 'Method count'),
            ])),
        ]);
    }

    public static function import_global_methodset_parameters(): external_function_parameters {
        return new external_function_parameters([
            'cmid' => new external_value(PARAM_INT, 'Course module id'),
            'methodsetid' => new external_value(PARAM_INT, 'Global methodset id'),
        ]);
    }

    public static function import_global_methodset(int $cmid, int $methodsetid): array {
        global $DB;

        $params = self::validate_parameters(self::import_global_methodset_parameters(), [
            'cmid' => $cmid,
            'methodsetid' => $methodsetid,
        ]);
        $resolved = self::resolve_cm_context((int)$params['cmid']);
        require_capability('mod/seminarplaner:managemethods', $resolved['context']);
        self::enforce_write_rate_limit('import_global_methodset', 20, 60);

        if (!self::global_plugin_available()) {
            throw new invalid_parameter_exception('local_seminarplaner ist nicht installiert');
        }
        if (!self::can_view_global_methodsets($resolved['course'])) {
            throw new invalid_parameter_exception('Keine Berechtigung für globale Konzepte');
        }

        $repo = new \local_seminarplaner\local\repository\methodset_repository();
        $set = $repo->get_methodset((int)$params['methodsetid']);
        if (!$set) {
            throw new invalid_parameter_exception('Unbekanntes Konzept');
        }

        $rows = [];
        if (!empty($set->currentversion)) {
            $rows = $DB->get_records('local_kgen_method', [
                'methodsetid' => (int)$set->id,
                'methodsetversionid' => (int)$set->currentversion,
            ]);
        }
        if (!$rows) {
            $rows = $DB->get_records('local_kgen_method', ['methodsetid' => (int)$set->id]);
        }

        $attachmentsbymethod = self::load_global_method_material_attachments(array_map(static function($row) {
            return (int)$row->id;
        }, array_values($rows)));

        $imported = [];
        foreach ($rows as $row) {
            $mapped = self::map_global_method_record($row, (int)$set->id,
                (int)($row->methodsetversionid ?? $set->currentversion ?? 0));
            $mapped['materialien'] = $attachmentsbymethod[(int)$row->id] ?? [];
            if (trim((string)$mapped['titel']) !== '') {
                $imported[] = $mapped;
            }
        }

        $service = new method_card_service();
        $existing = $service->get_methods((int)$resolved['cm']->id, (int)$GLOBALS['USER']->id, (int)$resolved['context']->id);
        if (!is_array($existing)) {
            $existing = [];
        }
        $merged = array_merge($existing, $imported);
        $service->save_methods((int)$resolved['cm']->id, (int)$GLOBALS['USER']->id, (int)$resolved['context']->id, $merged);
        if (!empty($set->currentversion)) {
            $syncservice = new \mod_seminarplaner\local\service\methodset_sync_service();
            $syncservice->upsert_activity_set_link((int)$resolved['cm']->id, (int)$set->id, (int)$set->currentversion,
                (int)$GLOBALS['USER']->id, false);
        }

        return [
            'success' => true,
            'importedcount' => count($imported),
            'totalcount' => count($merged),
            'setname' => (string)$set->displayname,
        ];
    }

    public static function import_global_methodset_returns(): external_single_structure {
        return new external_single_structure([
            'success' => new external_value(PARAM_BOOL, 'Import result'),
            'importedcount' => new external_value(PARAM_INT, 'Imported methods'),
            'totalcount' => new external_value(PARAM_INT, 'Total methods after import'),
            'setname' => new external_value(PARAM_TEXT, 'Methodset display name'),
        ]);
    }

    public static function get_methodset_sync_status_parameters(): external_function_parameters {
        return new external_function_parameters([
            'cmid' => new external_value(PARAM_INT, 'Course module id'),
        ]);
    }

    public static function get_methodset_sync_status(int $cmid): array {
        $params = self::validate_parameters(self::get_methodset_sync_status_parameters(), ['cmid' => $cmid]);
        $resolved = self::resolve_cm_context((int)$params['cmid']);
        require_capability('mod/seminarplaner:managemethods', $resolved['context']);

        $syncservice = new \mod_seminarplaner\local\service\methodset_sync_service();
        return ['links' => $syncservice->list_activity_links((int)$resolved['cm']->id)];
    }

    public static function get_methodset_sync_status_returns(): external_single_structure {
        return new external_single_structure([
            'links' => new external_multiple_structure(new external_single_structure([
                'methodsetid' => new external_value(PARAM_INT, 'Method set id'),
                'methodsetname' => new external_value(PARAM_TEXT, 'Method set name'),
                'methodsetshortname' => new external_value(PARAM_ALPHANUMEXT, 'Method set shortname'),
                'status' => new external_value(PARAM_ALPHA, 'Global set status'),
                'linkedversionid' => new external_value(PARAM_INT, 'Version currently applied in activity'),
                'currentversionid' => new external_value(PARAM_INT, 'Current global version id'),
                'pendingversionid' => new external_value(PARAM_INT, 'Pending version id'),
                'autosyncenabled' => new external_value(PARAM_BOOL, 'Auto-update flag'),
                'haspending' => new external_value(PARAM_BOOL, 'Pending update exists'),
            ])),
        ]);
    }

    public static function set_methodset_sync_policy_parameters(): external_function_parameters {
        return new external_function_parameters([
            'cmid' => new external_value(PARAM_INT, 'Course module id'),
            'methodsetid' => new external_value(PARAM_INT, 'Method set id'),
            'autosyncenabled' => new external_value(PARAM_BOOL, 'Enable auto updates'),
        ]);
    }

    public static function set_methodset_sync_policy(int $cmid, int $methodsetid, bool $autosyncenabled): array {
        $params = self::validate_parameters(self::set_methodset_sync_policy_parameters(), [
            'cmid' => $cmid,
            'methodsetid' => $methodsetid,
            'autosyncenabled' => $autosyncenabled,
        ]);
        $resolved = self::resolve_cm_context((int)$params['cmid']);
        require_capability('mod/seminarplaner:managemethods', $resolved['context']);
        self::enforce_write_rate_limit('set_methodset_sync_policy', 60, 60);

        $syncservice = new \mod_seminarplaner\local\service\methodset_sync_service();
        $updated = $syncservice->set_autosync((int)$resolved['cm']->id, (int)$params['methodsetid'],
            !empty($params['autosyncenabled']));
        return ['updated' => (bool)$updated];
    }

    public static function set_methodset_sync_policy_returns(): external_single_structure {
        return new external_single_structure([
            'updated' => new external_value(PARAM_BOOL, 'Update status'),
        ]);
    }

    public static function apply_methodset_updates_parameters(): external_function_parameters {
        return new external_function_parameters([
            'cmid' => new external_value(PARAM_INT, 'Course module id'),
            'methodsetid' => new external_value(PARAM_INT, 'Method set id'),
        ]);
    }

    public static function apply_methodset_updates(int $cmid, int $methodsetid): array {
        $params = self::validate_parameters(self::apply_methodset_updates_parameters(), [
            'cmid' => $cmid,
            'methodsetid' => $methodsetid,
        ]);
        $resolved = self::resolve_cm_context((int)$params['cmid']);
        require_capability('mod/seminarplaner:managemethods', $resolved['context']);
        self::enforce_write_rate_limit('apply_methodset_updates', 30, 60);

        $syncservice = new \mod_seminarplaner\local\service\methodset_sync_service();
        $updated = $syncservice->apply_pending_update_for_activity((int)$resolved['cm']->id, (int)$params['methodsetid'],
            (int)$GLOBALS['USER']->id);
        return ['updated' => (bool)$updated];
    }

    public static function apply_methodset_updates_returns(): external_single_structure {
        return new external_single_structure([
            'updated' => new external_value(PARAM_BOOL, 'Update status'),
        ]);
    }

    public static function list_review_targets_parameters(): external_function_parameters {
        return new external_function_parameters([
            'cmid' => new external_value(PARAM_INT, 'Course module id'),
        ]);
    }

    public static function list_review_targets(int $cmid): array {
        global $DB;

        $params = self::validate_parameters(self::list_review_targets_parameters(), ['cmid' => $cmid]);
        $resolved = self::resolve_cm_context((int)$params['cmid']);
        require_capability('mod/seminarplaner:managemethods', $resolved['context']);

        if (!self::global_plugin_available()) {
            return ['available' => false, 'message' => 'local_seminarplaner ist nicht installiert.', 'methodsets' => []];
        }

        $scopecontexts = self::resolve_submit_scope_contexts($resolved['course']);
        if (!$scopecontexts) {
            return ['available' => true, 'message' => 'Keine Berechtigung zum Einreichen für Review.', 'methodsets' => []];
        }

        $repo = new \local_seminarplaner\local\repository\methodset_repository();
        $sets = [];
        foreach ($scopecontexts as $scopectx) {
            foreach ($repo->list_methodsets((int)$scopectx->id) as $set) {
                $sets[(int)$set->id] = $set;
            }
        }

        $out = [];
        foreach ($sets as $set) {
            $reviewercount = (int)$DB->count_records('local_kgen_set_reviewer', ['methodsetid' => (int)$set->id]);
            $out[] = [
                'id' => (int)$set->id,
                'shortname' => (string)$set->shortname,
                'displayname' => (string)$set->displayname,
                'description' => (string)($set->description ?? ''),
                'status' => (string)$set->status,
                'scopecontextid' => (int)$set->scopecontextid,
                'reviewercount' => $reviewercount,
            ];
        }

        return ['available' => true, 'message' => '', 'methodsets' => array_values($out)];
    }

    public static function list_review_targets_returns(): external_single_structure {
        return new external_single_structure([
            'available' => new external_value(PARAM_BOOL, 'Local plugin available'),
            'message' => new external_value(PARAM_TEXT, 'Status message'),
            'methodsets' => new external_multiple_structure(new external_single_structure([
                'id' => new external_value(PARAM_INT, 'Method set id'),
                'shortname' => new external_value(PARAM_ALPHANUMEXT, 'Shortname'),
                'displayname' => new external_value(PARAM_TEXT, 'Display name'),
                'description' => new external_value(PARAM_RAW, 'Description'),
                'status' => new external_value(PARAM_ALPHA, 'Status'),
                'scopecontextid' => new external_value(PARAM_INT, 'Scope context id'),
                'reviewercount' => new external_value(PARAM_INT, 'Assigned reviewer count'),
            ])),
        ]);
    }

    public static function list_reviewer_candidates_parameters(): external_function_parameters {
        return new external_function_parameters([
            'cmid' => new external_value(PARAM_INT, 'Course module id'),
        ]);
    }

    public static function list_reviewer_candidates(int $cmid): array {
        $params = self::validate_parameters(self::list_reviewer_candidates_parameters(), ['cmid' => $cmid]);
        $resolved = self::resolve_cm_context((int)$params['cmid']);
        require_capability('mod/seminarplaner:managemethods', $resolved['context']);

        if (!self::global_plugin_available()) {
            return ['available' => false, 'message' => 'local_seminarplaner ist nicht installiert.', 'reviewers' => []];
        }

        $scopecontexts = self::resolve_submit_scope_contexts($resolved['course']);
        if (!$scopecontexts) {
            return ['available' => true, 'message' => 'Keine Berechtigung zum Einreichen für Review.', 'reviewers' => []];
        }

        $users = [];
        foreach ($scopecontexts as $scopectx) {
            $candidates = get_users_by_capability($scopectx, 'local/seminarplaner:reviewset',
                'u.id,u.firstname,u.lastname,u.email,u.deleted,u.suspended', 'u.lastname ASC, u.firstname ASC');
            foreach ($candidates as $candidate) {
                if (!empty($candidate->deleted) || !empty($candidate->suspended)) {
                    continue;
                }
                $users[(int)$candidate->id] = [
                    'id' => (int)$candidate->id,
                    'fullname' => fullname($candidate),
                    'email' => (string)($candidate->email ?? ''),
                ];
            }
        }

        return ['available' => true, 'message' => '', 'reviewers' => array_values($users)];
    }

    public static function list_reviewer_candidates_returns(): external_single_structure {
        return new external_single_structure([
            'available' => new external_value(PARAM_BOOL, 'Local plugin available'),
            'message' => new external_value(PARAM_TEXT, 'Status message'),
            'reviewers' => new external_multiple_structure(new external_single_structure([
                'id' => new external_value(PARAM_INT, 'User id'),
                'fullname' => new external_value(PARAM_TEXT, 'Display name'),
                'email' => new external_value(PARAM_RAW, 'E-mail'),
            ])),
        ]);
    }

    public static function get_review_method_candidates_parameters(): external_function_parameters {
        return new external_function_parameters([
            'cmid' => new external_value(PARAM_INT, 'Course module id'),
            'methodsetid' => new external_value(PARAM_INT, 'Existing method set id'),
        ]);
    }

    public static function get_review_method_candidates(int $cmid, int $methodsetid): array {
        $params = self::validate_parameters(self::get_review_method_candidates_parameters(), [
            'cmid' => $cmid,
            'methodsetid' => $methodsetid,
        ]);
        $resolved = self::resolve_cm_context((int)$params['cmid']);
        require_capability('mod/seminarplaner:managemethods', $resolved['context']);

        if (!self::global_plugin_available()) {
            throw new invalid_parameter_exception('local_seminarplaner ist nicht installiert');
        }

        $repo = new \local_seminarplaner\local\repository\methodset_repository();
        $set = $repo->get_methodset((int)$params['methodsetid']);
        if (!$set) {
            throw new invalid_parameter_exception('Unbekanntes Konzept');
        }

        $scopecontexts = self::resolve_submit_scope_contexts($resolved['course']);
        $allowedscopeids = array_map(static function($ctx) {
            return (int)$ctx->id;
        }, $scopecontexts);
        if (!in_array((int)$set->scopecontextid, $allowedscopeids, true)) {
            throw new invalid_parameter_exception('Keine Berechtigung für das gewählte Konzept');
        }

        $activitymethods = (new method_card_service())->get_methods((int)$resolved['cm']->id, (int)$GLOBALS['USER']->id,
            (int)$resolved['context']->id);
        $setmethods = self::load_set_methods_by_title((int)$set->id);

        $candidates = [];
        foreach ($activitymethods as $method) {
            if (!is_array($method)) {
                continue;
            }
            $title = trim((string)($method['titel'] ?? ''));
            if ($title === '') {
                continue;
            }
            $key = self::normalize_method_title($title);
            if (!isset($setmethods[$key])) {
                $candidates[] = [
                    'methodid' => (string)($method['id'] ?? ''),
                    'title' => $title,
                    'status' => 'new',
                    'changedfields' => [],
                ];
                continue;
            }
            $changed = self::diff_method_fields($setmethods[$key], $method);
            if ($changed) {
                $candidates[] = [
                    'methodid' => (string)($method['id'] ?? ''),
                    'title' => $title,
                    'status' => 'changed',
                    'changedfields' => $changed,
                ];
            }
        }

        return ['candidates' => $candidates];
    }

    public static function get_review_method_candidates_returns(): external_single_structure {
        return new external_single_structure([
            'candidates' => new external_multiple_structure(new external_single_structure([
                'methodid' => new external_value(PARAM_RAW, 'Method uid from activity'),
                'title' => new external_value(PARAM_TEXT, 'Method title'),
                'status' => new external_value(PARAM_ALPHA, 'new|changed'),
                'changedfields' => new external_multiple_structure(new external_value(PARAM_TEXT, 'Changed field label')),
            ])),
        ]);
    }

    public static function submit_methodset_for_review_parameters(): external_function_parameters {
        return new external_function_parameters([
            'cmid' => new external_value(PARAM_INT, 'Course module id'),
            'methodsetid' => new external_value(PARAM_INT, 'Existing method set id'),
            'changelog' => new external_value(PARAM_TEXT, 'Update note', VALUE_DEFAULT, ''),
            'methodids' => new external_multiple_structure(new external_value(PARAM_RAW, 'Method ids from activity'),
                'Methods to submit', VALUE_DEFAULT, []),
        ]);
    }

    public static function submit_methodset_for_review(int $cmid, int $methodsetid, string $changelog = '',
        array $methodids = []): array {
        global $DB;

        $params = self::validate_parameters(self::submit_methodset_for_review_parameters(), [
            'cmid' => $cmid,
            'methodsetid' => $methodsetid,
            'changelog' => $changelog,
            'methodids' => $methodids,
        ]);
        $resolved = self::resolve_cm_context((int)$params['cmid']);
        require_capability('mod/seminarplaner:managemethods', $resolved['context']);
        self::enforce_write_rate_limit('submit_methodset_for_review', 20, 60);
        if (\core_text::strlen((string)$params['changelog']) > self::MAX_CHANGELOG_CHARS) {
            throw new invalid_parameter_exception('changelog exceeds allowed length');
        }
        if (count((array)$params['methodids']) > self::MAX_REVIEW_METHODIDS) {
            throw new invalid_parameter_exception('Too many method ids submitted at once');
        }

        if (!self::global_plugin_available()) {
            throw new invalid_parameter_exception('local_seminarplaner ist nicht installiert');
        }

        $scopecontexts = self::resolve_submit_scope_contexts($resolved['course']);
        if (!$scopecontexts) {
            throw new invalid_parameter_exception('Keine Berechtigung zum Einreichen für Review');
        }
        $allowedscopeids = array_map(static function($ctx) {
            return (int)$ctx->id;
        }, $scopecontexts);

        $actorid = (int)$GLOBALS['USER']->id;
        $repo = new \local_seminarplaner\local\repository\methodset_repository();
        $reviewerrepo = new \local_seminarplaner\local\repository\reviewer_repository();
        $workflow = new \local_seminarplaner\local\service\workflow_service();

        if ((int)$params['methodsetid'] <= 0) {
            throw new invalid_parameter_exception('Bitte ein bestehendes Konzept auswählen');
        }
        $set = $repo->get_methodset((int)$params['methodsetid']);
        if (!$set) {
            throw new invalid_parameter_exception('Unbekanntes Konzept');
        }
        if (!in_array((int)$set->scopecontextid, $allowedscopeids, true)) {
            throw new invalid_parameter_exception('Keine Berechtigung für das gewählte Konzept');
        }
        if ((string)$set->status !== 'draft') {
            $repo->update_methodset_status((int)$set->id, 'draft', $actorid);
        }
        $versionnum = (int)$DB->get_field_sql(
            'SELECT COALESCE(MAX(versionnum), 0) + 1 FROM {local_kgen_methodset_ver} WHERE methodsetid = :methodsetid',
            ['methodsetid' => (int)$set->id]
        );
        if (!$set) {
            throw new invalid_parameter_exception('Konzept konnte nicht erstellt/geladen werden');
        }

        $methodservice = new method_card_service();
        $allactivitymethods = $methodservice->get_methods((int)$resolved['cm']->id, $actorid, (int)$resolved['context']->id);
        if (!is_array($allactivitymethods)) {
            $allactivitymethods = [];
        }

        $selectedids = [];
        foreach ((array)$params['methodids'] as $id) {
            $id = trim((string)$id);
            if ($id !== '') {
                $selectedids[$id] = true;
            }
        }
        $selectedmethods = [];
        foreach ($allactivitymethods as $method) {
            if (!is_array($method)) {
                continue;
            }
            $mid = trim((string)($method['id'] ?? ''));
            if ($mid === '') {
                continue;
            }
            if ($selectedids && empty($selectedids[$mid])) {
                continue;
            }
            $title = trim((string)($method['titel'] ?? ''));
            if ($title === '') {
                continue;
            }
            $selectedmethods[] = $method;
        }
        if (!$selectedmethods) {
            throw new invalid_parameter_exception('Keine Seminareinheiten für Einreichung ausgewählt');
        }

        $existingbymethod = self::load_set_methods_by_title((int)$set->id);
        foreach ($selectedmethods as $method) {
            $title = trim((string)($method['titel'] ?? ''));
            $existingbymethod[self::normalize_method_title($title)] = $method;
        }
        $resultingmethods = array_values($existingbymethod);

        $snapshotjson = json_encode($resultingmethods, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($snapshotjson === false) {
            $snapshotjson = '[]';
        }

        $versionid = $repo->create_version((int)$set->id, (int)$versionnum, 'draft', $snapshotjson, $actorid);

        $scopecontext = \context::instance_by_id((int)$set->scopecontextid, MUST_EXIST);
        $assignedreviewers = $reviewerrepo->get_reviewer_userids((int)$set->id);
        if (!$assignedreviewers) {
            // Fallback for legacy sets without explicit reviewer assignment:
            // auto-assign active users that currently hold review capability in scope.
            $autocandidates = get_users_by_capability($scopecontext, 'local/seminarplaner:reviewset',
                'u.id,u.deleted,u.suspended', 'u.id ASC');
            $autorreviewerids = [];
            foreach ($autocandidates as $candidate) {
                if (!empty($candidate->deleted) || !empty($candidate->suspended)) {
                    continue;
                }
                $autorreviewerids[] = (int)$candidate->id;
            }
            $autorreviewerids = array_values(array_unique(array_filter($autorreviewerids)));
            if (!$autorreviewerids) {
                throw new invalid_parameter_exception('Keine Konzeptverantwortliche mit Review-Berechtigung gefunden');
            }
            $reviewerrepo->replace_reviewers((int)$set->id, $autorreviewerids, $actorid);
            $assignedreviewers = $autorreviewerids;
        }
        $reviewerswithcap = get_users_by_capability($scopecontext, 'local/seminarplaner:reviewset',
            'u.id,u.deleted,u.suspended', 'u.id ASC');
        $allowedreviewers = [];
        foreach ($reviewerswithcap as $capuser) {
            if (!empty($capuser->deleted) || !empty($capuser->suspended)) {
                continue;
            }
            $allowedreviewers[(int)$capuser->id] = true;
        }
        foreach ($assignedreviewers as $reviewerid) {
            if (empty($allowedreviewers[(int)$reviewerid])) {
                throw new invalid_parameter_exception('Mindestens ein zugeordneter Konzeptverantwortliche hat keine Review-Berechtigung mehr');
            }
        }

        $now = time();
        $DB->delete_records('local_kgen_method', ['methodsetversionid' => (int)$versionid]);
        $savedcount = 0;
        foreach ($resultingmethods as $method) {
            if (!is_array($method)) {
                continue;
            }
            $mapped = self::map_activity_method_to_global_record($method);
            if (trim((string)$mapped['title']) === '') {
                continue;
            }
            $record = (object)array_merge($mapped, [
                'methodsetid' => (int)$set->id,
                'methodsetversionid' => (int)$versionid,
                'timecreated' => $now,
                'timemodified' => $now,
                'createdby' => $actorid,
                'modifiedby' => $actorid,
            ]);
            $DB->insert_record('local_kgen_method', $record);
            $savedcount++;
        }

        $comment = trim((string)$params['changelog']) !== '' ? trim((string)$params['changelog']) : 'Submitted from mod_seminarplaner';
        $workflow->transition((int)$set->id, (int)$versionid, 'review', $actorid, $comment);

        return [
            'success' => true,
            'methodsetid' => (int)$set->id,
            'versionid' => (int)$versionid,
            'savedcount' => $savedcount,
            'reviewercount' => count($assignedreviewers),
        ];
    }

    public static function submit_methodset_for_review_returns(): external_single_structure {
        return new external_single_structure([
            'success' => new external_value(PARAM_BOOL, 'Submit status'),
            'methodsetid' => new external_value(PARAM_INT, 'Method set id'),
            'versionid' => new external_value(PARAM_INT, 'Version id'),
            'savedcount' => new external_value(PARAM_INT, 'Saved method cards into set version'),
            'reviewercount' => new external_value(PARAM_INT, 'Assigned reviewers'),
        ]);
    }

    public static function create_methodset_for_review_parameters(): external_function_parameters {
        return new external_function_parameters([
            'cmid' => new external_value(PARAM_INT, 'Course module id'),
            'shortname' => new external_value(PARAM_ALPHANUMEXT, 'New method set shortname'),
            'displayname' => new external_value(PARAM_TEXT, 'New method set displayname'),
            'description' => new external_value(PARAM_RAW, 'New method set description', VALUE_DEFAULT, ''),
            'changelog' => new external_value(PARAM_TEXT, 'Update note', VALUE_DEFAULT, ''),
            'methodids' => new external_multiple_structure(new external_value(PARAM_RAW, 'Method ids from activity'),
                'Methods for new set', VALUE_DEFAULT, []),
        ]);
    }

    public static function create_methodset_for_review(int $cmid, string $shortname, string $displayname, string $description = '',
        string $changelog = '', array $methodids = []): array {
        global $DB;

        $params = self::validate_parameters(self::create_methodset_for_review_parameters(), [
            'cmid' => $cmid,
            'shortname' => $shortname,
            'displayname' => $displayname,
            'description' => $description,
            'changelog' => $changelog,
            'methodids' => $methodids,
        ]);
        $resolved = self::resolve_cm_context((int)$params['cmid']);
        require_capability('mod/seminarplaner:managemethods', $resolved['context']);
        self::enforce_write_rate_limit('create_methodset_for_review', 20, 60);
        if (\core_text::strlen((string)$params['description']) > self::MAX_METHODSET_DESCRIPTION_CHARS) {
            throw new invalid_parameter_exception('description exceeds allowed length');
        }
        if (\core_text::strlen((string)$params['changelog']) > self::MAX_CHANGELOG_CHARS) {
            throw new invalid_parameter_exception('changelog exceeds allowed length');
        }
        if (count((array)$params['methodids']) > self::MAX_REVIEW_METHODIDS) {
            throw new invalid_parameter_exception('Too many method ids submitted at once');
        }

        if (!self::global_plugin_available()) {
            throw new invalid_parameter_exception('local_seminarplaner ist nicht installiert');
        }

        $scopecontexts = self::resolve_submit_scope_contexts($resolved['course']);
        if (!$scopecontexts) {
            throw new invalid_parameter_exception('Keine Berechtigung zum Einreichen für Review');
        }
        $targetscope = $scopecontexts[0];
        $actorid = (int)$GLOBALS['USER']->id;

        $methodservice = new method_card_service();
        $allactivitymethods = $methodservice->get_methods((int)$resolved['cm']->id, $actorid, (int)$resolved['context']->id);
        if (!is_array($allactivitymethods)) {
            $allactivitymethods = [];
        }

        $selectedids = [];
        foreach ((array)$params['methodids'] as $id) {
            $id = trim((string)$id);
            if ($id !== '') {
                $selectedids[$id] = true;
            }
        }
        $selectedmethods = [];
        foreach ($allactivitymethods as $method) {
            if (!is_array($method)) {
                continue;
            }
            $mid = trim((string)($method['id'] ?? ''));
            if ($mid === '' || ($selectedids && empty($selectedids[$mid]))) {
                continue;
            }
            $title = trim((string)($method['titel'] ?? ''));
            if ($title === '') {
                continue;
            }
            $selectedmethods[] = $method;
        }
        if (!$selectedmethods) {
            throw new invalid_parameter_exception('Keine Seminareinheiten für Einreichung ausgewählt');
        }

        $repo = new \local_seminarplaner\local\repository\methodset_repository();
        $reviewerrepo = new \local_seminarplaner\local\repository\reviewer_repository();
        $workflow = new \local_seminarplaner\local\service\workflow_service();

        $newsetid = $repo->create_methodset_draft((string)$params['shortname'], (string)$params['displayname'],
            (string)$params['description'], (int)$targetscope->id, $actorid);

        $snapshotjson = json_encode($selectedmethods, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($snapshotjson === false) {
            $snapshotjson = '[]';
        }
        $versionid = $repo->create_version((int)$newsetid, 1, 'draft', $snapshotjson, $actorid);

        $reviewers = get_users_by_capability($targetscope, 'local/seminarplaner:reviewset', 'u.id,u.deleted,u.suspended');
        $reviewerids = [];
        foreach ($reviewers as $reviewer) {
            if (!empty($reviewer->deleted) || !empty($reviewer->suspended)) {
                continue;
            }
            $reviewerids[] = (int)$reviewer->id;
        }
        $reviewerids = array_values(array_unique(array_filter($reviewerids)));
        if (!$reviewerids) {
            throw new invalid_parameter_exception('Keine Konzeptverantwortliche mit Review-Capability gefunden');
        }
        $reviewerrepo->replace_reviewers((int)$newsetid, $reviewerids, $actorid);

        $now = time();
        $savedcount = 0;
        foreach ($selectedmethods as $method) {
            $mapped = self::map_activity_method_to_global_record($method);
            if (trim((string)$mapped['title']) === '') {
                continue;
            }
            $record = (object)array_merge($mapped, [
                'methodsetid' => (int)$newsetid,
                'methodsetversionid' => (int)$versionid,
                'timecreated' => $now,
                'timemodified' => $now,
                'createdby' => $actorid,
                'modifiedby' => $actorid,
            ]);
            $DB->insert_record('local_kgen_method', $record);
            $savedcount++;
        }

        $comment = trim((string)$params['changelog']) !== '' ? trim((string)$params['changelog']) : 'Submitted from mod_seminarplaner';
        $workflow->transition((int)$newsetid, (int)$versionid, 'review', $actorid, $comment);

        return [
            'success' => true,
            'methodsetid' => (int)$newsetid,
            'versionid' => (int)$versionid,
            'savedcount' => $savedcount,
            'reviewercount' => count($reviewerids),
        ];
    }

    public static function create_methodset_for_review_returns(): external_single_structure {
        return new external_single_structure([
            'success' => new external_value(PARAM_BOOL, 'Submit status'),
            'methodsetid' => new external_value(PARAM_INT, 'Method set id'),
            'versionid' => new external_value(PARAM_INT, 'Version id'),
            'savedcount' => new external_value(PARAM_INT, 'Saved method cards into set version'),
            'reviewercount' => new external_value(PARAM_INT, 'Assigned reviewers'),
        ]);
    }

    public static function create_grid_parameters(): external_function_parameters {
        return new external_function_parameters([
            'cmid' => new external_value(PARAM_INT, 'Course module id'),
            'name' => new external_value(PARAM_TEXT, 'Seminarplan name'),
            'description' => new external_value(PARAM_RAW, 'Seminarplan description', VALUE_DEFAULT, ''),
        ]);
    }

    public static function create_grid(int $cmid, string $name, string $description = ''): array {
        $params = self::validate_parameters(self::create_grid_parameters(), [
            'cmid' => $cmid,
            'name' => $name,
            'description' => $description,
        ]);

        $resolved = self::resolve_cm_context((int)$params['cmid']);
        require_capability('mod/seminarplaner:managegrids', $resolved['context']);
        self::enforce_write_rate_limit('create_grid', 40, 60);

        $service = new grid_service();
        $gridid = $service->create_grid((int)$resolved['cm']->id, (string)$params['name'], (int)$GLOBALS['USER']->id,
            (string)$params['description']);

        return ['gridid' => $gridid, 'name' => (string)$params['name']];
    }

    public static function create_grid_returns(): external_single_structure {
        return new external_single_structure([
            'gridid' => new external_value(PARAM_INT, 'New grid id'),
            'name' => new external_value(PARAM_TEXT, 'Seminarplan name'),
        ]);
    }

    public static function delete_grid_parameters(): external_function_parameters {
        return new external_function_parameters([
            'cmid' => new external_value(PARAM_INT, 'Course module id'),
            'gridid' => new external_value(PARAM_INT, 'Seminarplan id'),
        ]);
    }

    public static function delete_grid(int $cmid, int $gridid): array {
        $params = self::validate_parameters(self::delete_grid_parameters(), [
            'cmid' => $cmid,
            'gridid' => $gridid,
        ]);
        $resolved = self::resolve_cm_context((int)$params['cmid']);
        require_capability('mod/seminarplaner:managegrids', $resolved['context']);
        self::enforce_write_rate_limit('delete_grid', 40, 60);

        $service = new grid_service();
        $deleted = $service->delete_grid((int)$resolved['cm']->id, (int)$params['gridid'], (int)$GLOBALS['USER']->id);

        return ['deleted' => (bool)$deleted];
    }

    public static function delete_grid_returns(): external_single_structure {
        return new external_single_structure([
            'deleted' => new external_value(PARAM_BOOL, 'Delete status'),
        ]);
    }

    public static function list_grids_parameters(): external_function_parameters {
        return new external_function_parameters([
            'cmid' => new external_value(PARAM_INT, 'Course module id'),
        ]);
    }

    public static function list_grids(int $cmid): array {
        $params = self::validate_parameters(self::list_grids_parameters(), ['cmid' => $cmid]);
        $resolved = self::resolve_cm_context((int)$params['cmid']);
        require_capability('mod/seminarplaner:managegrids', $resolved['context']);

        $service = new grid_service();
        $grids = $service->list_grids((int)$resolved['cm']->id);

        $out = [];
        foreach ($grids as $grid) {
            $out[] = [
                'id' => (int)$grid->id,
                'name' => (string)$grid->name,
                'description' => (string)($grid->description ?? ''),
                'isarchived' => (int)$grid->isarchived,
                'timemodified' => (int)$grid->timemodified,
            ];
        }

        return ['grids' => $out];
    }

    public static function list_grids_returns(): external_single_structure {
        return new external_single_structure([
            'grids' => new external_multiple_structure(new external_single_structure([
                'id' => new external_value(PARAM_INT, 'Seminarplan id'),
                'name' => new external_value(PARAM_TEXT, 'Seminarplan name'),
                'description' => new external_value(PARAM_RAW, 'Seminarplan description'),
                'isarchived' => new external_value(PARAM_INT, 'Archived flag'),
                'timemodified' => new external_value(PARAM_INT, 'Last modified'),
            ])),
        ]);
    }

    public static function get_roterfaden_state_parameters(): external_function_parameters {
        return new external_function_parameters([
            'cmid' => new external_value(PARAM_INT, 'Course module id'),
        ]);
    }

    public static function get_roterfaden_state(int $cmid): array {
        $params = self::validate_parameters(self::get_roterfaden_state_parameters(), ['cmid' => $cmid]);
        $resolved = self::resolve_cm_context((int)$params['cmid']);
        require_capability('mod/seminarplaner:viewroterfaden', $resolved['context']);

        $service = new grid_service();
        $result = $service->get_roterfaden_state((int)$resolved['cm']->id);
        return [
            'ispublished' => !empty($result['ispublished']),
            'gridid' => (int)($result['gridid'] ?? 0),
            'statejson' => json_encode($result['state'] ?? [], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ];
    }

    public static function get_roterfaden_state_returns(): external_single_structure {
        return new external_single_structure([
            'ispublished' => new external_value(PARAM_BOOL, 'Whether Common Thread is visible'),
            'gridid' => new external_value(PARAM_INT, 'Published grid id'),
            'statejson' => new external_value(PARAM_RAW, 'Published Common Thread state as JSON'),
        ]);
    }

    public static function publish_roterfaden_parameters(): external_function_parameters {
        return new external_function_parameters([
            'cmid' => new external_value(PARAM_INT, 'Course module id'),
            'gridid' => new external_value(PARAM_INT, 'Grid id to publish'),
            'statejson' => new external_value(PARAM_RAW, 'Grid state payload'),
        ]);
    }

    public static function publish_roterfaden(int $cmid, int $gridid, string $statejson): array {
        $params = self::validate_parameters(self::publish_roterfaden_parameters(), [
            'cmid' => $cmid,
            'gridid' => $gridid,
            'statejson' => $statejson,
        ]);
        $resolved = self::resolve_cm_context((int)$params['cmid']);
        require_capability('mod/seminarplaner:managegrids', $resolved['context']);
        self::enforce_write_rate_limit('publish_roterfaden', 30, 60);
        if (strlen((string)$params['statejson']) > self::MAX_STATE_JSON_BYTES) {
            throw new invalid_parameter_exception('statejson exceeds allowed size');
        }

        $decoded = json_decode((string)$params['statejson'], true);
        if (!is_array($decoded)) {
            throw new invalid_parameter_exception('statejson must decode to an object/array');
        }

        $service = new grid_service();
        $ok = $service->publish_roterfaden((int)$resolved['cm']->id, (int)$params['gridid'], $decoded, (int)$GLOBALS['USER']->id);
        return ['success' => $ok];
    }

    public static function publish_roterfaden_returns(): external_single_structure {
        return new external_single_structure([
            'success' => new external_value(PARAM_BOOL, 'Publish result'),
        ]);
    }

    public static function unpublish_roterfaden_parameters(): external_function_parameters {
        return new external_function_parameters([
            'cmid' => new external_value(PARAM_INT, 'Course module id'),
        ]);
    }

    public static function unpublish_roterfaden(int $cmid): array {
        $params = self::validate_parameters(self::unpublish_roterfaden_parameters(), ['cmid' => $cmid]);
        $resolved = self::resolve_cm_context((int)$params['cmid']);
        require_capability('mod/seminarplaner:managegrids', $resolved['context']);
        self::enforce_write_rate_limit('unpublish_roterfaden', 30, 60);

        $service = new grid_service();
        $ok = $service->set_roterfaden_visibility((int)$resolved['cm']->id, false, (int)$GLOBALS['USER']->id);
        return ['success' => $ok];
    }

    public static function unpublish_roterfaden_returns(): external_single_structure {
        return new external_single_structure([
            'success' => new external_value(PARAM_BOOL, 'Unpublish result'),
        ]);
    }

    public static function get_user_state_parameters(): external_function_parameters {
        return new external_function_parameters([
            'cmid' => new external_value(PARAM_INT, 'Course module id'),
            'gridid' => new external_value(PARAM_INT, 'Seminarplan id'),
        ]);
    }

    public static function get_user_state(int $cmid, int $gridid): array {
        $params = self::validate_parameters(self::get_user_state_parameters(), ['cmid' => $cmid, 'gridid' => $gridid]);
        $resolved = self::resolve_cm_context((int)$params['cmid']);
        require_capability('mod/seminarplaner:managegrids', $resolved['context']);

        $service = new grid_service();
        $result = $service->get_user_state((int)$params['gridid'], (int)$GLOBALS['USER']->id);

        return [
            'statejson' => json_encode($result['state'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'versionhash' => (string)($result['versionhash'] ?? ''),
        ];
    }

    public static function get_user_state_returns(): external_single_structure {
        return new external_single_structure([
            'statejson' => new external_value(PARAM_RAW, 'State JSON'),
            'versionhash' => new external_value(PARAM_RAW, 'Version hash'),
        ]);
    }

    public static function save_user_state_parameters(): external_function_parameters {
        return new external_function_parameters([
            'cmid' => new external_value(PARAM_INT, 'Course module id'),
            'gridid' => new external_value(PARAM_INT, 'Seminarplan id'),
            'statejson' => new external_value(PARAM_RAW, 'State JSON payload'),
            'expectedhash' => new external_value(PARAM_RAW, 'Expected version hash', VALUE_DEFAULT, ''),
        ]);
    }

    public static function save_user_state(int $cmid, int $gridid, string $statejson, string $expectedhash = ''): array {
        $params = self::validate_parameters(self::save_user_state_parameters(), [
            'cmid' => $cmid,
            'gridid' => $gridid,
            'statejson' => $statejson,
            'expectedhash' => $expectedhash,
        ]);

        $resolved = self::resolve_cm_context((int)$params['cmid']);
        require_capability('mod/seminarplaner:managegrids', $resolved['context']);
        self::enforce_write_rate_limit('save_user_state', 240, 60);
        if (strlen((string)$params['statejson']) > self::MAX_STATE_JSON_BYTES) {
            throw new invalid_parameter_exception('statejson exceeds allowed size');
        }

        $decoded = json_decode((string)$params['statejson'], true);
        if (!is_array($decoded)) {
            throw new invalid_parameter_exception('statejson must decode to an object/array');
        }

        $service = new grid_service();
        $newhash = $service->save_user_state((int)$params['gridid'], (int)$GLOBALS['USER']->id, $decoded,
            (string)$params['expectedhash']);

        return ['versionhash' => $newhash];
    }

    public static function save_user_state_returns(): external_single_structure {
        return new external_single_structure([
            'versionhash' => new external_value(PARAM_RAW, 'New version hash'),
        ]);
    }

    public static function get_planning_state_parameters(): external_function_parameters {
        return new external_function_parameters([
            'cmid' => new external_value(PARAM_INT, 'Course module id'),
        ]);
    }

    public static function get_planning_state(int $cmid): array {
        $params = self::validate_parameters(self::get_planning_state_parameters(), ['cmid' => $cmid]);
        $resolved = self::resolve_cm_context((int)$params['cmid']);
        require_capability('mod/seminarplaner:managegrids', $resolved['context']);

        $service = new planning_state_service();
        $result = $service->get_state((int)$resolved['cm']->id);
        return [
            'statejson' => json_encode($result['state'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'versionhash' => (string)($result['versionhash'] ?? ''),
        ];
    }

    public static function get_planning_state_returns(): external_single_structure {
        return new external_single_structure([
            'statejson' => new external_value(PARAM_RAW, 'Planning state JSON'),
            'versionhash' => new external_value(PARAM_RAW, 'Version hash'),
        ]);
    }

    public static function save_planning_state_parameters(): external_function_parameters {
        return new external_function_parameters([
            'cmid' => new external_value(PARAM_INT, 'Course module id'),
            'statejson' => new external_value(PARAM_RAW, 'Planning state JSON payload'),
            'expectedhash' => new external_value(PARAM_RAW, 'Expected version hash', VALUE_DEFAULT, ''),
        ]);
    }

    public static function save_planning_state(int $cmid, string $statejson, string $expectedhash = ''): array {
        $params = self::validate_parameters(self::save_planning_state_parameters(), [
            'cmid' => $cmid,
            'statejson' => $statejson,
            'expectedhash' => $expectedhash,
        ]);
        $resolved = self::resolve_cm_context((int)$params['cmid']);
        require_capability('mod/seminarplaner:managegrids', $resolved['context']);
        self::enforce_write_rate_limit('save_planning_state', 180, 60);
        if (strlen((string)$params['statejson']) > self::MAX_STATE_JSON_BYTES) {
            throw new invalid_parameter_exception('statejson exceeds allowed size');
        }

        $decoded = json_decode((string)$params['statejson'], true);
        if (!is_array($decoded)) {
            throw new invalid_parameter_exception('statejson must decode to an object/array');
        }
        $service = new planning_state_service();
        $newhash = $service->save_state((int)$resolved['cm']->id, $decoded, (int)$GLOBALS['USER']->id, (string)$params['expectedhash']);
        return ['versionhash' => $newhash];
    }

    public static function save_planning_state_returns(): external_single_structure {
        return new external_single_structure([
            'versionhash' => new external_value(PARAM_RAW, 'New version hash'),
        ]);
    }

    public static function validate_import_payload_parameters(): external_function_parameters {
        return new external_function_parameters([
            'cmid' => new external_value(PARAM_INT, 'Course module id'),
            'payloadjson' => new external_value(PARAM_RAW, 'JSON array of legacy rows'),
            'strict' => new external_value(PARAM_BOOL, 'Strict mode', VALUE_DEFAULT, false),
        ]);
    }

    public static function validate_import_payload(int $cmid, string $payloadjson, bool $strict = false): array {
        $params = self::validate_parameters(self::validate_import_payload_parameters(), [
            'cmid' => $cmid,
            'payloadjson' => $payloadjson,
            'strict' => $strict,
        ]);

        $resolved = self::resolve_cm_context((int)$params['cmid']);
        require_capability('mod/seminarplaner:importfrommoddata', $resolved['context']);
        self::enforce_write_rate_limit('validate_import_payload', 60, 60);
        if (strlen((string)$params['payloadjson']) > self::MAX_VALIDATION_PAYLOAD_JSON_BYTES) {
            throw new invalid_parameter_exception('payloadjson exceeds allowed size');
        }

        $payload = json_decode((string)$params['payloadjson'], true);
        if (!is_array($payload)) {
            throw new invalid_parameter_exception('payloadjson must decode to an array');
        }

        $service = new import_export_service();
        $result = $service->validate_import_rows((int)$resolved['cm']->id, (int)$resolved['context']->id,
            (int)$GLOBALS['USER']->id, $payload, (bool)$params['strict']);

        return [
            'errors' => $result['errors'],
            'warnings' => $result['warnings'],
            'rowcount' => count($result['mappedrows']),
            'mappedjson' => json_encode($result['mappedrows'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ];
    }

    public static function validate_import_payload_returns(): external_single_structure {
        return new external_single_structure([
            'errors' => new external_multiple_structure(new external_value(PARAM_TEXT, 'Error')),
            'warnings' => new external_multiple_structure(new external_value(PARAM_TEXT, 'Warning')),
            'rowcount' => new external_value(PARAM_INT, 'Mapped row count'),
            'mappedjson' => new external_value(PARAM_RAW, 'Mapped rows as JSON'),
        ]);
    }

    public static function validate_export_payload_parameters(): external_function_parameters {
        return new external_function_parameters([
            'cmid' => new external_value(PARAM_INT, 'Course module id'),
            'payloadjson' => new external_value(PARAM_RAW, 'JSON array of internal rows'),
            'strictlegacy' => new external_value(PARAM_BOOL, 'Strict legacy mode', VALUE_DEFAULT, false),
        ]);
    }

    public static function validate_export_payload(int $cmid, string $payloadjson, bool $strictlegacy = false): array {
        $params = self::validate_parameters(self::validate_export_payload_parameters(), [
            'cmid' => $cmid,
            'payloadjson' => $payloadjson,
            'strictlegacy' => $strictlegacy,
        ]);

        $resolved = self::resolve_cm_context((int)$params['cmid']);
        require_capability('mod/seminarplaner:exporttomoddata', $resolved['context']);
        self::enforce_write_rate_limit('validate_export_payload', 60, 60);
        if (strlen((string)$params['payloadjson']) > self::MAX_VALIDATION_PAYLOAD_JSON_BYTES) {
            throw new invalid_parameter_exception('payloadjson exceeds allowed size');
        }

        $payload = json_decode((string)$params['payloadjson'], true);
        if (!is_array($payload)) {
            throw new invalid_parameter_exception('payloadjson must decode to an array');
        }

        $service = new import_export_service();
        $result = $service->validate_export_rows((int)$resolved['cm']->id, (int)$resolved['context']->id,
            (int)$GLOBALS['USER']->id, $payload, (bool)$params['strictlegacy']);

        return [
            'errors' => $result['errors'],
            'warnings' => $result['warnings'],
            'rowcount' => count($result['legacyrows']),
            'legacyjson' => json_encode($result['legacyrows'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ];
    }

    public static function validate_export_payload_returns(): external_single_structure {
        return new external_single_structure([
            'errors' => new external_multiple_structure(new external_value(PARAM_TEXT, 'Error')),
            'warnings' => new external_multiple_structure(new external_value(PARAM_TEXT, 'Warning')),
            'rowcount' => new external_value(PARAM_INT, 'Legacy row count'),
            'legacyjson' => new external_value(PARAM_RAW, 'Legacy rows as JSON'),
        ]);
    }

    // Lock endpoints kept for backward compatibility with previous UI.
    public static function acquire_lock_parameters(): external_function_parameters {
        return new external_function_parameters([
            'cmid' => new external_value(PARAM_INT, 'Course module id'),
            'gridid' => new external_value(PARAM_INT, 'Seminarplan id'),
            'ttlseconds' => new external_value(PARAM_INT, 'TTL seconds', VALUE_DEFAULT, 300),
        ]);
    }

    public static function acquire_lock(int $cmid, int $gridid, int $ttlseconds = 300): array {
        $params = self::validate_parameters(self::acquire_lock_parameters(), [
            'cmid' => $cmid,
            'gridid' => $gridid,
            'ttlseconds' => $ttlseconds,
        ]);

        $resolved = self::resolve_cm_context((int)$params['cmid']);
        require_capability('mod/seminarplaner:managegrids', $resolved['context']);
        self::enforce_write_rate_limit('acquire_lock', 120, 60);

        $service = new soft_lock_service();
        $result = $service->acquire((int)$params['gridid'], (int)$GLOBALS['USER']->id, (int)$params['ttlseconds']);

        return [
            'acquired' => (bool)$result['acquired'],
            'token' => (string)($result['token'] ?? ''),
            'holder' => (int)($result['holder'] ?? 0),
            'expiresat' => (int)($result['expiresat'] ?? 0),
        ];
    }

    public static function acquire_lock_returns(): external_single_structure {
        return new external_single_structure([
            'acquired' => new external_value(PARAM_BOOL, 'Whether lock was acquired'),
            'token' => new external_value(PARAM_RAW, 'Lock token'),
            'holder' => new external_value(PARAM_INT, 'Current lock owner id'),
            'expiresat' => new external_value(PARAM_INT, 'Lock expiry timestamp'),
        ]);
    }

    public static function refresh_lock_parameters(): external_function_parameters {
        return new external_function_parameters([
            'cmid' => new external_value(PARAM_INT, 'Course module id'),
            'gridid' => new external_value(PARAM_INT, 'Seminarplan id'),
            'token' => new external_value(PARAM_RAW, 'Lock token'),
            'ttlseconds' => new external_value(PARAM_INT, 'TTL seconds', VALUE_DEFAULT, 300),
        ]);
    }

    public static function refresh_lock(int $cmid, int $gridid, string $token, int $ttlseconds = 300): array {
        $params = self::validate_parameters(self::refresh_lock_parameters(), [
            'cmid' => $cmid,
            'gridid' => $gridid,
            'token' => $token,
            'ttlseconds' => $ttlseconds,
        ]);

        $resolved = self::resolve_cm_context((int)$params['cmid']);
        require_capability('mod/seminarplaner:managegrids', $resolved['context']);
        self::enforce_write_rate_limit('refresh_lock', 240, 60);

        $service = new soft_lock_service();
        $ok = $service->refresh((int)$params['gridid'], (int)$GLOBALS['USER']->id, (string)$params['token'],
            (int)$params['ttlseconds']);
        return ['success' => $ok];
    }

    public static function refresh_lock_returns(): external_single_structure {
        return new external_single_structure([
            'success' => new external_value(PARAM_BOOL, 'Refresh result'),
        ]);
    }

    public static function release_lock_parameters(): external_function_parameters {
        return new external_function_parameters([
            'cmid' => new external_value(PARAM_INT, 'Course module id'),
            'gridid' => new external_value(PARAM_INT, 'Seminarplan id'),
            'token' => new external_value(PARAM_RAW, 'Lock token'),
        ]);
    }

    public static function release_lock(int $cmid, int $gridid, string $token): array {
        $params = self::validate_parameters(self::release_lock_parameters(), [
            'cmid' => $cmid,
            'gridid' => $gridid,
            'token' => $token,
        ]);

        $resolved = self::resolve_cm_context((int)$params['cmid']);
        require_capability('mod/seminarplaner:managegrids', $resolved['context']);
        self::enforce_write_rate_limit('release_lock', 120, 60);

        $service = new soft_lock_service();
        $ok = $service->release((int)$params['gridid'], (int)$GLOBALS['USER']->id, (string)$params['token']);
        return ['success' => $ok];
    }

    public static function release_lock_returns(): external_single_structure {
        return new external_single_structure([
            'success' => new external_value(PARAM_BOOL, 'Release result'),
        ]);
    }

    public static function lock_status_parameters(): external_function_parameters {
        return new external_function_parameters([
            'cmid' => new external_value(PARAM_INT, 'Course module id'),
            'gridid' => new external_value(PARAM_INT, 'Seminarplan id'),
        ]);
    }

    public static function lock_status(int $cmid, int $gridid): array {
        $params = self::validate_parameters(self::lock_status_parameters(), ['cmid' => $cmid, 'gridid' => $gridid]);
        $resolved = self::resolve_cm_context((int)$params['cmid']);
        require_capability('mod/seminarplaner:managegrids', $resolved['context']);

        $service = new soft_lock_service();
        $status = $service->status((int)$params['gridid']);

        return [
            'locked' => (bool)$status['locked'],
            'holder' => (int)($status['holder'] ?? 0),
            'expiresat' => (int)($status['expiresat'] ?? 0),
        ];
    }

    public static function lock_status_returns(): external_single_structure {
        return new external_single_structure([
            'locked' => new external_value(PARAM_BOOL, 'Lock status'),
            'holder' => new external_value(PARAM_INT, 'Holder id'),
            'expiresat' => new external_value(PARAM_INT, 'Expiry timestamp'),
        ]);
    }
}
