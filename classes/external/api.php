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

    private static function can_view_global_methodsets(context_module $modulecontext): bool {
        if (!self::global_plugin_available()) {
            return false;
        }
        // Checking the capability at the module context covers every assignment level that
        // inherits downward (system, course category, course, module). This way a
        // teacher/Referent who holds viewglobalsets via a role assigned at course level is
        // recognised, instead of only role assignments made at category or system level.
        return has_capability('local/seminarplaner:viewglobalsets', $modulecontext);
    }

    private static function normalize_phase(string $phase): string {
        $phase = trim(strip_tags($phase));
        if ($phase === '') {
            return '';
        }

        $aliases = [
            'warm-up' => 'Orientierung',
            'einstieg' => 'Orientierung',
            'erwartungsabfrage' => 'Erfahrungserhebung',
            'vorwissen aktivieren' => 'Erfahrungserhebung',
            'wissen vermitteln' => 'Analyse',
            'reflexion' => 'Handlungsteil',
            'evaluation/feedback' => 'Transfer',
            'evaluation / feedback' => 'Transfer',
            'abschluss' => 'Transfer',
        ];
        $key = \core_text::strtolower($phase);

        return $aliases[$key] ?? $phase;
    }

    private static function split_multi_text($value, bool $normalizephase = false): array {
        if ($value === null) {
            return [];
        }
        $parts = preg_split('/##|[\r\n,;]+/u', (string)$value) ?: [];
        $out = [];
        $seen = [];
        foreach ($parts as $part) {
            $part = trim(strip_tags((string)$part));
            if ($normalizephase) {
                $part = self::normalize_phase($part);
            }
            if ($part !== '') {
                $key = \core_text::strtolower($part);
                if (isset($seen[$key])) {
                    continue;
                }
                $seen[$key] = true;
                $out[] = $part;
            }
        }
        return $out;
    }

    private static function map_global_method_record(\stdClass $row, int $setid = 0, int $versionid = 0): array {
        $mapped = [
            'id' => 'global-' . (int)$row->id . '-' . time(),
            'titel' => (string)($row->title ?? ''),
            'seminarphase' => self::split_multi_text($row->seminarphase ?? '', true),
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
     * Copy material attachments of one submitted seminar unit into local_seminarplaner storage.
     *
     * Activity methods carry their files in the module context (mod_seminarplaner /
     * method_materialien); set methods carried over unchanged into the new version only
     * reference their previous global method row via _kgsync.sourcemethodid.
     *
     * @param array $method Seminar unit payload as stored in the version snapshot.
     * @param int $globalmethodid Newly inserted local_kgen_method id.
     * @param int $modulecontextid Activity module context id.
     * @param int $actorid Submitting user id.
     * @param bool $fromactivity True when the payload originates from the activity (not carried over).
     * @return void
     */
    private static function copy_method_material_files_to_global(array $method, int $globalmethodid,
        int $modulecontextid, int $actorid, bool $fromactivity): void {
        global $CFG, $DB;

        require_once($CFG->dirroot . '/local/seminarplaner/locallib.php');

        $fs = get_file_storage();
        $systemcontextid = \context_system::instance()->id;

        $sourceitemid = 0;
        foreach ((array)($method['materialien'] ?? []) as $entry) {
            if (is_array($entry) && !empty($entry['stored'])
                    && (string)($entry['filearea'] ?? '') === 'method_materialien') {
                $sourceitemid = (int)($entry['itemid'] ?? 0);
                break;
            }
        }

        $sourcefiles = [];
        if ($sourceitemid > 0) {
            $sourcefiles = array_values($fs->get_area_files($modulecontextid, 'mod_seminarplaner',
                'method_materialien', $sourceitemid, 'id ASC', false));
        }

        if (!$sourcefiles && !$fromactivity) {
            $sourcemethodid = (int)($method['_kgsync']['sourcemethodid'] ?? 0);
            if ($sourcemethodid > 0) {
                $links = $DB->get_records('local_kgen_method_file',
                    ['methodid' => $sourcemethodid, 'kind' => 'material'], 'id ASC');
                foreach ($links as $link) {
                    $areafiles = $fs->get_area_files($systemcontextid, 'local_seminarplaner',
                        'method_material', (int)$link->fileitemid, 'id ASC', false);
                    foreach ($areafiles as $areafile) {
                        $sourcefiles[] = $areafile;
                    }
                }
            }
        }

        if (!$sourcefiles) {
            return;
        }

        $newitemid = local_seminarplaner_next_file_itemid('method_material');
        $stored = 0;
        foreach ($sourcefiles as $file) {
            $filepath = (string)$file->get_filepath();
            $filename = (string)$file->get_filename();
            if ($filename === '' || $filename === '.') {
                continue;
            }
            if ($fs->get_file($systemcontextid, 'local_seminarplaner', 'method_material',
                    $newitemid, $filepath, $filename)) {
                continue;
            }
            $fs->create_file_from_storedfile((object)[
                'contextid' => $systemcontextid,
                'component' => 'local_seminarplaner',
                'filearea' => 'method_material',
                'itemid' => $newitemid,
                'filepath' => $filepath,
                'filename' => $filename,
                'userid' => $actorid,
            ], $file);
            $stored++;
        }
        if ($stored > 0) {
            $DB->insert_record('local_kgen_method_file', (object)[
                'methodid' => $globalmethodid,
                'kind' => 'material',
                'fileitemid' => $newitemid,
                'timecreated' => time(),
            ]);
        }
    }

    /**
     * Map an activity seminar unit to local global-set record format.
     *
     * @param array $method Seminar unit payload.
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
            'seminarphase' => $splitmulti(self::split_multi_text($splitmulti($method['seminarphase'] ?? []), true)),
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
            'methodsjson' => new external_value(PARAM_RAW, 'Seminar units as JSON'),
        ]);
    }

    public static function save_method_cards_parameters(): external_function_parameters {
        return new external_function_parameters([
            'cmid' => new external_value(PARAM_INT, 'Course module id'),
            'methodsjson' => new external_value(PARAM_RAW, 'Seminar units as JSON'),
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
        // Listing global method sets is read-only; the basic view capability is sufficient.
        // Importing a set into the activity is the write action and still requires
        // managemethods (see import_global_methodset).
        require_capability('mod/seminarplaner:view', $resolved['context']);

        if (!self::global_plugin_available()) {
            return ['available' => false, 'message' => 'local_seminarplaner ist nicht installiert.', 'methodsets' => []];
        }
        if (!self::can_view_global_methodsets($resolved['context'])) {
            return ['available' => true, 'message' => 'Keine Berechtigung für globale Konzepte.', 'methodsets' => []];
        }

        $repo = new \local_seminarplaner\local\repository\methodset_repository();
        $syscontext = context_system::instance();
        $catcontext = context_coursecat::instance((int)$resolved['course']->category);
        // The view gate passed: surface published sets from the system scope and from the
        // course's own category scope.
        $sets = [];
        foreach ($repo->list_methodsets((int)$syscontext->id, 'published') as $set) {
            $sets[(int)$set->id] = $set;
        }
        foreach ($repo->list_methodsets((int)$catcontext->id, 'published') as $set) {
            $sets[(int)$set->id] = $set;
        }

        $out = [];
        foreach ($sets as $set) {
            $count = (int)$DB->count_records('local_kgen_method', ['methodsetid' => (int)$set->id]);
            $out[] = [
                'id' => (int)$set->id,
                'displayname' => (string)$set->displayname,
                'shortname' => (string)$set->shortname,
                'status' => (string)$set->status,
                // D32: 'sammlung' oder 'seminarkonzept' (Altdaten ohne Spalte
                // zählen als Sammlung).
                'typ' => (string)($set->concepttype ?? 'sammlung'),
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
                'typ' => new external_value(PARAM_ALPHA, 'Object kind (D32): sammlung or seminarkonzept'),
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
        if (!self::can_view_global_methodsets($resolved['context'])) {
            throw new invalid_parameter_exception('Keine Berechtigung für globale Konzepte');
        }

        $repo = new \local_seminarplaner\local\repository\methodset_repository();
        $set = $repo->get_methodset((int)$params['methodsetid']);
        if (!$set) {
            throw new invalid_parameter_exception('Unbekanntes Konzept');
        }

        // D32: Seminarkonzepte tragen den Plan im Versions-Snapshot und
        // werden als kompletter neuer Plan samt Einheiten importiert.
        if ((string)($set->concepttype ?? 'sammlung') === 'seminarkonzept') {
            return self::import_global_seminarkonzept($resolved, $set, $repo);
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
            'plancreated' => false,
            'planname' => '',
        ];
    }

    public static function import_global_methodset_returns(): external_single_structure {
        return new external_single_structure([
            'success' => new external_value(PARAM_BOOL, 'Import result'),
            'importedcount' => new external_value(PARAM_INT, 'Imported methods'),
            'totalcount' => new external_value(PARAM_INT, 'Total methods after import'),
            'setname' => new external_value(PARAM_TEXT, 'Methodset display name'),
            'plancreated' => new external_value(PARAM_BOOL, 'Whether a new plan was created (D32 Seminarkonzept)'),
            'planname' => new external_value(PARAM_TEXT, 'Name of the created plan'),
        ]);
    }

    /**
     * D32: Import a global Seminarkonzept - creates a NEW plan (never
     * overwriting an existing one) from the snapshot's plan state and adds
     * the plan's units as independent local copies.
     *
     * The snapshot carries the units with their original ids; every card gets
     * a fresh id on import and all sequence references (Einheiten-Auswahlen)
     * are rewritten accordingly. `legacy:<uid>` references point into the
     * plan's own day entries and stay untouched.
     *
     * @param array $resolved Resolved cm/course/context.
     * @param \stdClass $set Global methodset record (concepttype seminarkonzept).
     * @param \local_seminarplaner\local\repository\methodset_repository $repo Repository.
     * @return array
     */
    private static function import_global_seminarkonzept(array $resolved, \stdClass $set,
        \local_seminarplaner\local\repository\methodset_repository $repo): array {
        global $DB;

        if (empty($set->currentversion)) {
            throw new invalid_parameter_exception('Dieses Seminarkonzept hat keine veröffentlichte Version');
        }
        $version = $repo->get_version((int)$set->currentversion);
        $payload = $version ? json_decode((string)$version->snapshotjson, true) : null;
        if (!is_array($payload) || (string)($payload['typ'] ?? '') !== 'seminarkonzept'
                || !is_array($payload['plan'] ?? null)) {
            throw new invalid_parameter_exception('Seminarkonzept-Daten konnten nicht gelesen werden');
        }
        $snapshotmethods = is_array($payload['methods'] ?? null) ? $payload['methods'] : [];
        $plan = $payload['plan'];
        $state = is_array($plan['state'] ?? null) ? $plan['state'] : [];
        $actorid = (int)$GLOBALS['USER']->id;

        // Attachments live at the global set's method rows; match them back
        // to the snapshot units by normalized title.
        $rows = $DB->get_records('local_kgen_method', [
            'methodsetid' => (int)$set->id,
            'methodsetversionid' => (int)$set->currentversion,
        ]);
        $attachmentsbymethod = self::load_global_method_material_attachments(array_map(static function($row) {
            return (int)$row->id;
        }, array_values($rows)));
        $attachmentsbytitle = [];
        foreach ($rows as $row) {
            $key = self::normalize_method_title((string)($row->title ?? ''));
            if ($key !== '') {
                $attachmentsbytitle[$key] = $attachmentsbymethod[(int)$row->id] ?? [];
            }
        }

        // Fresh ids for every unit; the map drives the reference rewrite.
        $idmap = [];
        $imported = [];
        $counter = 0;
        foreach ($snapshotmethods as $method) {
            if (!is_array($method)) {
                continue;
            }
            $oldid = trim((string)($method['id'] ?? ''));
            $title = trim((string)($method['titel'] ?? ''));
            if ($oldid === '' || $title === '') {
                continue;
            }
            $counter++;
            $newid = 'konzept-' . time() . '-' . $counter . '-' . random_int(100, 999);
            $idmap[$oldid] = $newid;
            $copy = $method;
            $copy['id'] = $newid;
            // Independent copy (same principle as D33 adopt): no live link to
            // the global original, no stale sync metadata or draft pointers.
            unset($copy['_kgsync'], $copy['materialiendraftitemid'], $copy['h5pdraftitemid']);
            $copy['materialien'] = $attachmentsbytitle[self::normalize_method_title($title)] ?? [];
            $imported[] = $copy;
        }

        // Rewrite the sequence's card references onto the fresh ids.
        $statekey = \mod_seminarplaner\local\sequence\sequence_state::STATE_KEY;
        if (isset($state[$statekey]) && is_array($state[$statekey])
                && isset($state[$statekey]['einheitenauswahlen']) && is_array($state[$statekey]['einheitenauswahlen'])) {
            foreach ($state[$statekey]['einheitenauswahlen'] as $eaid => $auswahl) {
                if (!is_array($auswahl)) {
                    continue;
                }
                $kandidaten = [];
                foreach ((array)($auswahl['kandidaten'] ?? []) as $ref) {
                    $ref = (string)$ref;
                    $kandidaten[] = $idmap[$ref] ?? $ref;
                }
                $auswahl['kandidaten'] = $kandidaten;
                if (isset($auswahl['aktiv']) && $auswahl['aktiv'] !== null && $auswahl['aktiv'] !== '') {
                    $aktiv = (string)$auswahl['aktiv'];
                    $auswahl['aktiv'] = $idmap[$aktiv] ?? $aktiv;
                }
                $state[$statekey]['einheitenauswahlen'][$eaid] = $auswahl;
            }
        }

        // Units become part of the activity library.
        $service = new method_card_service();
        $existing = $service->get_methods((int)$resolved['cm']->id, $actorid, (int)$resolved['context']->id);
        if (!is_array($existing)) {
            $existing = [];
        }
        $merged = array_merge($existing, $imported);
        $service->save_methods((int)$resolved['cm']->id, $actorid, (int)$resolved['context']->id, $merged);

        // New plan, never overwriting: unique name within the activity.
        $gridservice = new grid_service();
        $existingnames = [];
        foreach ($gridservice->list_grids((int)$resolved['cm']->id) as $grid) {
            $existingnames[trim((string)$grid->name)] = true;
        }
        $planname = trim((string)($plan['name'] ?? '')) !== '' ? trim((string)$plan['name']) : (string)$set->displayname;
        $uniquename = $planname;
        $suffix = 2;
        while (isset($existingnames[$uniquename])) {
            $uniquename = $planname . ' (' . $suffix . ')';
            $suffix++;
        }
        $newgridid = $gridservice->create_grid((int)$resolved['cm']->id, $uniquename, $actorid,
            trim((string)($plan['description'] ?? '')) !== '' ? (string)$plan['description'] : null);
        $gridservice->save_user_state($newgridid, $actorid, $state);

        return [
            'success' => true,
            'importedcount' => count($imported),
            'totalcount' => count($merged),
            'setname' => (string)$set->displayname,
            'plancreated' => true,
            'planname' => $uniquename,
        ];
    }

    /**
     * Collect the method rows of all published global collections visible
     * from this activity (system scope + own course category scope).
     *
     * @param \stdClass $course Course record.
     * @return array{sets: array<int, \stdClass>, rows: array<int, \stdClass>}
     */
    private static function collect_published_global_methods(\stdClass $course): array {
        global $DB;

        $repo = new \local_seminarplaner\local\repository\methodset_repository();
        $syscontext = context_system::instance();
        $catcontext = context_coursecat::instance((int)$course->category);
        $sets = [];
        foreach ($repo->list_methodsets((int)$syscontext->id, 'published') as $set) {
            $sets[(int)$set->id] = $set;
        }
        foreach ($repo->list_methodsets((int)$catcontext->id, 'published') as $set) {
            $sets[(int)$set->id] = $set;
        }
        if (!$sets) {
            return ['sets' => [], 'rows' => []];
        }

        $rows = [];
        foreach ($sets as $set) {
            $setrows = [];
            if (!empty($set->currentversion)) {
                $setrows = $DB->get_records('local_kgen_method', [
                    'methodsetid' => (int)$set->id,
                    'methodsetversionid' => (int)$set->currentversion,
                ]);
            }
            if (!$setrows) {
                $setrows = $DB->get_records('local_kgen_method', ['methodsetid' => (int)$set->id]);
            }
            foreach ($setrows as $row) {
                $rows[(int)$row->id] = $row;
            }
        }
        return ['sets' => $sets, 'rows' => $rows];
    }

    public static function browse_global_library_parameters(): external_function_parameters {
        return new external_function_parameters([
            'cmid' => new external_value(PARAM_INT, 'Course module id'),
        ]);
    }

    /**
     * D29/D33: the global library is always browsable while planning -
     * individual methods of every published collection, no prior set
     * import required. Filtering/facets happen client-side on the tags.
     */
    public static function browse_global_library(int $cmid): array {
        $params = self::validate_parameters(self::browse_global_library_parameters(), ['cmid' => $cmid]);
        $resolved = self::resolve_cm_context((int)$params['cmid']);
        require_capability('mod/seminarplaner:view', $resolved['context']);

        if (!self::global_plugin_available()) {
            return ['available' => false, 'message' => 'local_seminarplaner ist nicht installiert.', 'methods' => []];
        }
        if (!self::can_view_global_methodsets($resolved['context'])) {
            return ['available' => true, 'message' => 'Keine Berechtigung für die globale Bibliothek.', 'methods' => []];
        }

        $collected = self::collect_published_global_methods($resolved['course']);
        $out = [];
        foreach ($collected['rows'] as $row) {
            $title = trim(strip_tags((string)($row->title ?? '')));
            if ($title === '') {
                continue;
            }
            $set = $collected['sets'][(int)$row->methodsetid] ?? null;
            $summary = trim(strip_tags((string)($row->kurzbeschreibung ?? '')));
            if (\core_text::strlen($summary) > 280) {
                $summary = \core_text::substr($summary, 0, 279) . '…';
            }
            $out[] = [
                'methodid' => (int)$row->id,
                'setid' => (int)$row->methodsetid,
                'setname' => $set ? (string)$set->displayname : '',
                'titel' => $title,
                'seminarphase' => self::split_multi_text($row->seminarphase ?? '', true),
                'zeitbedarf' => trim((string)($row->zeitbedarf ?? '')),
                'gruppengroesse' => trim((string)($row->gruppengroesse ?? '')),
                'sozialform' => self::split_multi_text($row->sozialform ?? ''),
                'vorbereitung' => trim((string)($row->vorbereitung ?? '')),
                'kurzbeschreibung' => $summary,
                'tags' => self::split_multi_text($row->tags ?? ''),
            ];
        }
        \core_collator::asort_array_of_arrays_by_key($out, 'titel');

        return ['available' => true, 'message' => '', 'methods' => array_values($out)];
    }

    public static function browse_global_library_returns(): external_single_structure {
        return new external_single_structure([
            'available' => new external_value(PARAM_BOOL, 'Local plugin available'),
            'message' => new external_value(PARAM_TEXT, 'Status message'),
            'methods' => new external_multiple_structure(new external_single_structure([
                'methodid' => new external_value(PARAM_INT, 'Global method id'),
                'setid' => new external_value(PARAM_INT, 'Method set id'),
                'setname' => new external_value(PARAM_TEXT, 'Method set display name'),
                'titel' => new external_value(PARAM_TEXT, 'Title'),
                'seminarphase' => new external_multiple_structure(new external_value(PARAM_TEXT, 'Phase')),
                'zeitbedarf' => new external_value(PARAM_RAW, 'Duration'),
                'gruppengroesse' => new external_value(PARAM_RAW, 'Group size'),
                'sozialform' => new external_multiple_structure(new external_value(PARAM_RAW, 'Social form')),
                // PARAM_RAW: Werte wie "<10 Min" wuerden von PARAM_TEXT als
                // Tag-Anfang verworfen; der Client escaped beim Rendern.
                'vorbereitung' => new external_value(PARAM_RAW, 'Preparation'),
                'kurzbeschreibung' => new external_value(PARAM_TEXT, 'Short description (plain text)'),
                'tags' => new external_multiple_structure(new external_value(PARAM_TEXT, 'Tag')),
            ])),
        ]);
    }

    public static function adopt_global_method_parameters(): external_function_parameters {
        return new external_function_parameters([
            'cmid' => new external_value(PARAM_INT, 'Course module id'),
            'methodid' => new external_value(PARAM_INT, 'Global method id'),
        ]);
    }

    /**
     * D33: adopting a single global method creates an independent local
     * copy right away - deliberately WITHOUT the _kgsync link that whole-set
     * imports get: later changes to the global original must not touch
     * adopted copies.
     */
    public static function adopt_global_method(int $cmid, int $methodid): array {
        global $DB;

        $params = self::validate_parameters(self::adopt_global_method_parameters(), [
            'cmid' => $cmid,
            'methodid' => $methodid,
        ]);
        $resolved = self::resolve_cm_context((int)$params['cmid']);
        require_capability('mod/seminarplaner:managemethods', $resolved['context']);
        self::enforce_write_rate_limit('adopt_global_method', 30, 60);

        if (!self::global_plugin_available()) {
            throw new invalid_parameter_exception('local_seminarplaner ist nicht installiert');
        }
        if (!self::can_view_global_methodsets($resolved['context'])) {
            throw new invalid_parameter_exception('Keine Berechtigung für die globale Bibliothek');
        }

        $row = $DB->get_record('local_kgen_method', ['id' => (int)$params['methodid']]);
        if (!$row) {
            throw new invalid_parameter_exception('Unbekannte Methode');
        }
        $repo = new \local_seminarplaner\local\repository\methodset_repository();
        $set = $repo->get_methodset((int)$row->methodsetid);
        if (!$set || (string)$set->status !== 'published') {
            throw new invalid_parameter_exception('Die Methode gehört zu keiner veröffentlichten Sammlung');
        }
        // Only methods visible through the activity's scopes may be adopted.
        $collected = self::collect_published_global_methods($resolved['course']);
        if (!isset($collected['sets'][(int)$set->id])) {
            throw new invalid_parameter_exception('Keine Berechtigung für die gewählte Sammlung');
        }

        $mapped = self::map_global_method_record($row);
        $attachments = self::load_global_method_material_attachments([(int)$row->id]);
        $mapped['materialien'] = $attachments[(int)$row->id] ?? [];

        $service = new method_card_service();
        $existing = $service->get_methods((int)$resolved['cm']->id, (int)$GLOBALS['USER']->id, (int)$resolved['context']->id);
        if (!is_array($existing)) {
            $existing = [];
        }
        $existing[] = $mapped;
        $service->save_methods((int)$resolved['cm']->id, (int)$GLOBALS['USER']->id, (int)$resolved['context']->id, $existing);

        return [
            'success' => true,
            'localid' => (string)$mapped['id'],
            'titel' => (string)$mapped['titel'],
            'totalcount' => count($existing),
        ];
    }

    public static function adopt_global_method_returns(): external_single_structure {
        return new external_single_structure([
            'success' => new external_value(PARAM_BOOL, 'Adoption result'),
            'localid' => new external_value(PARAM_RAW, 'New local method card id'),
            'titel' => new external_value(PARAM_RAW, 'Adopted title'),
            'totalcount' => new external_value(PARAM_INT, 'Total local methods after adoption'),
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
                // D32: 'sammlung' oder 'seminarkonzept' (Altdaten ohne Spalte
                // zählen als Sammlung).
                'typ' => (string)($set->concepttype ?? 'sammlung'),
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
                'typ' => new external_value(PARAM_ALPHA, 'Object kind (D32): sammlung or seminarkonzept'),
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

    public static function list_public_reviewers_parameters(): external_function_parameters {
        return new external_function_parameters([
            'cmid' => new external_value(PARAM_INT, 'Course module id'),
        ]);
    }

    /**
     * D58: Öffentliche Übersichtsliste der Konzeptverantwortlichen.
     *
     * Zeigt nur Personen, die sich per Opt-in selbst sichtbar gemacht haben -
     * reines Vertrauens-/Orientierungssignal (nur Name, kein Kontaktweg).
     * Anders als list_reviewer_candidates für alle Betrachtenden der Seite
     * lesbar und nicht an die eigene Einreich-Berechtigung gebunden.
     */
    public static function list_public_reviewers(int $cmid): array {
        global $USER;
        $params = self::validate_parameters(self::list_public_reviewers_parameters(), ['cmid' => $cmid]);
        $resolved = self::resolve_cm_context((int)$params['cmid']);
        require_capability('mod/seminarplaner:view', $resolved['context']);

        $optinname = 'mod_seminarplaner_konzeptverantwortliche_public';
        if (!self::global_plugin_available()) {
            return [
                'available' => false,
                'message' => 'local_seminarplaner ist nicht installiert.',
                'reviewers' => [],
                'caniopt' => false,
                'optedin' => false,
            ];
        }

        // Konzeptverantwortliche = Nutzer mit Review-Capability im Kategorie-
        // oder Systemkontext, unabhängig von der eigenen Einreich-Berechtigung.
        $scopecontexts = [
            context_coursecat::instance((int)$resolved['course']->category),
            context_system::instance(),
        ];

        $users = [];
        $caniopt = false;
        foreach ($scopecontexts as $scopectx) {
            $candidates = get_users_by_capability($scopectx, 'local/seminarplaner:reviewset',
                'u.id,u.firstname,u.lastname,u.deleted,u.suspended', 'u.lastname ASC, u.firstname ASC');
            foreach ($candidates as $candidate) {
                if (!empty($candidate->deleted) || !empty($candidate->suspended)) {
                    continue;
                }
                $uid = (int)$candidate->id;
                if ($uid === (int)$USER->id) {
                    $caniopt = true;
                }
                if (!get_user_preferences($optinname, 0, $uid)) {
                    continue;
                }
                $users[$uid] = [
                    'id' => $uid,
                    'fullname' => fullname($candidate),
                ];
            }
        }

        $reviewers = array_values($users);
        usort($reviewers, function($a, $b) {
            return strcasecmp($a['fullname'], $b['fullname']);
        });

        return [
            'available' => true,
            'message' => '',
            'reviewers' => $reviewers,
            'caniopt' => $caniopt,
            'optedin' => (bool)get_user_preferences($optinname, 0, (int)$USER->id),
        ];
    }

    public static function list_public_reviewers_returns(): external_single_structure {
        return new external_single_structure([
            'available' => new external_value(PARAM_BOOL, 'Local plugin available'),
            'message' => new external_value(PARAM_TEXT, 'Status message'),
            'reviewers' => new external_multiple_structure(new external_single_structure([
                'id' => new external_value(PARAM_INT, 'User id'),
                'fullname' => new external_value(PARAM_TEXT, 'Display name'),
            ])),
            'caniopt' => new external_value(PARAM_BOOL, 'Current user may opt into the list'),
            'optedin' => new external_value(PARAM_BOOL, 'Current user is currently opted in'),
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
        $selectedtitles = [];
        foreach ($selectedmethods as $method) {
            $selectedtitles[self::normalize_method_title((string)($method['titel'] ?? ''))] = true;
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
            $newmethodid = (int)$DB->insert_record('local_kgen_method', $record);
            $savedcount++;
            $fromactivity = !empty($selectedtitles[self::normalize_method_title((string)$mapped['title'])]);
            self::copy_method_material_files_to_global($method, $newmethodid,
                (int)$resolved['context']->id, $actorid, $fromactivity);
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
            'savedcount' => new external_value(PARAM_INT, 'Saved seminar units into set version'),
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
            $newmethodid = (int)$DB->insert_record('local_kgen_method', $record);
            $savedcount++;
            self::copy_method_material_files_to_global($method, $newmethodid,
                (int)$resolved['context']->id, $actorid, true);
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
            'savedcount' => new external_value(PARAM_INT, 'Saved seminar units into set version'),
            'reviewercount' => new external_value(PARAM_INT, 'Assigned reviewers'),
        ]);
    }

    /**
     * Collect the method-card references a plan's sequence section uses (D20).
     *
     * Both candidate lists and the active pick of every Einheiten-Auswahl are
     * card references; `legacy:<uid>` fallbacks point into the plan's own
     * legacy day entries and are skipped.
     *
     * @param mixed $sequenz Decoded sequence section (arrays and/or stdClass).
     * @return string[] Unique card ids.
     */
    private static function collect_plan_card_refs($sequenz): array {
        $refs = [];
        $auswahlen = is_object($sequenz) ? ($sequenz->einheitenauswahlen ?? []) : ($sequenz['einheitenauswahlen'] ?? []);
        foreach ((array)$auswahlen as $auswahl) {
            $auswahl = (array)$auswahl;
            $kandidaten = (array)($auswahl['kandidaten'] ?? []);
            if (isset($auswahl['aktiv']) && $auswahl['aktiv'] !== null && $auswahl['aktiv'] !== '') {
                $kandidaten[] = $auswahl['aktiv'];
            }
            foreach ($kandidaten as $ref) {
                $ref = trim((string)$ref);
                if ($ref === '' || strpos($ref, 'legacy:') === 0) {
                    continue;
                }
                $refs[$ref] = true;
            }
        }
        return array_keys($refs);
    }

    public static function submit_seminarkonzept_for_review_parameters(): external_function_parameters {
        return new external_function_parameters([
            'cmid' => new external_value(PARAM_INT, 'Course module id'),
            'gridid' => new external_value(PARAM_INT, 'Seminarplan id'),
            'methodsetid' => new external_value(PARAM_INT, 'Existing Seminarkonzept set id (0 = create new)',
                VALUE_DEFAULT, 0),
            'shortname' => new external_value(PARAM_ALPHANUMEXT, 'New set shortname (only for new sets)',
                VALUE_DEFAULT, ''),
            'displayname' => new external_value(PARAM_TEXT, 'New set displayname (only for new sets)',
                VALUE_DEFAULT, ''),
            'description' => new external_value(PARAM_RAW, 'New set description', VALUE_DEFAULT, ''),
            'changelog' => new external_value(PARAM_TEXT, 'Update note', VALUE_DEFAULT, ''),
        ]);
    }

    /**
     * D32: Submit a complete Seminarkonzept (plan incl. sequence) for review.
     *
     * Runs over the exact same methodset/review/workflow mechanism as the
     * Methoden-Sammlungen: the set carries concepttype 'seminarkonzept' and
     * its version snapshot holds an object payload with the plan state plus
     * the method cards the plan references (ids intact, so a reimport can
     * rebuild the plan 1:1). The referenced units are also written as
     * local_kgen_method rows, so they stay browsable in the global library.
     */
    public static function submit_seminarkonzept_for_review(int $cmid, int $gridid, int $methodsetid = 0,
        string $shortname = '', string $displayname = '', string $description = '', string $changelog = ''): array {
        global $DB;

        $params = self::validate_parameters(self::submit_seminarkonzept_for_review_parameters(), [
            'cmid' => $cmid,
            'gridid' => $gridid,
            'methodsetid' => $methodsetid,
            'shortname' => $shortname,
            'displayname' => $displayname,
            'description' => $description,
            'changelog' => $changelog,
        ]);
        $resolved = self::resolve_cm_context((int)$params['cmid']);
        require_capability('mod/seminarplaner:managemethods', $resolved['context']);
        require_capability('mod/seminarplaner:managegrids', $resolved['context']);
        self::enforce_write_rate_limit('submit_seminarkonzept_for_review', 20, 60);
        if (\core_text::strlen((string)$params['description']) > self::MAX_METHODSET_DESCRIPTION_CHARS) {
            throw new invalid_parameter_exception('description exceeds allowed length');
        }
        if (\core_text::strlen((string)$params['changelog']) > self::MAX_CHANGELOG_CHARS) {
            throw new invalid_parameter_exception('changelog exceeds allowed length');
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

        // Load the plan: master data plus the shared collaborative state.
        $gridrepository = new \mod_seminarplaner\local\repository\grid_repository();
        $grid = $gridrepository->get_grid((int)$params['gridid']);
        if (!$grid || (int)$grid->cmid !== (int)$resolved['cm']->id || (int)($grid->isarchived ?? 0) === 1) {
            throw new invalid_parameter_exception('Unbekannter Seminarplan');
        }
        $gridservice = new grid_service();
        $stateresult = $gridservice->get_user_state((int)$grid->id, $actorid);
        $state = is_array($stateresult['state'] ?? null) ? $stateresult['state'] : [];
        $sequenz = $state[\mod_seminarplaner\local\sequence\sequence_state::STATE_KEY] ?? null;
        if (!$sequenz) {
            throw new invalid_parameter_exception(
                'Dieser Seminarplan hat noch keine Sequenz – bitte einmal in der Sequenzansicht öffnen.');
        }

        // The plan's units travel inside the snapshot with their original ids,
        // so the sequence references survive the roundtrip (table rows below
        // get new ids on import and could not be re-linked).
        $methodservice = new method_card_service();
        $allactivitymethods = $methodservice->get_methods((int)$resolved['cm']->id, $actorid, (int)$resolved['context']->id);
        if (!is_array($allactivitymethods)) {
            $allactivitymethods = [];
        }
        $refs = array_fill_keys(self::collect_plan_card_refs($sequenz), true);
        $planmethods = [];
        foreach ($allactivitymethods as $method) {
            if (!is_array($method)) {
                continue;
            }
            $mid = trim((string)($method['id'] ?? ''));
            if ($mid === '' || empty($refs[$mid])) {
                continue;
            }
            if (trim((string)($method['titel'] ?? '')) === '') {
                continue;
            }
            $planmethods[] = $method;
        }

        $repo = new \local_seminarplaner\local\repository\methodset_repository();
        $reviewerrepo = new \local_seminarplaner\local\repository\reviewer_repository();
        $workflow = new \local_seminarplaner\local\service\workflow_service();

        if ((int)$params['methodsetid'] > 0) {
            // Resubmit an existing Seminarkonzept as a new version.
            $set = $repo->get_methodset((int)$params['methodsetid']);
            if (!$set) {
                throw new invalid_parameter_exception('Unbekanntes Seminarkonzept');
            }
            if ((string)($set->concepttype ?? 'sammlung') !== 'seminarkonzept') {
                throw new invalid_parameter_exception('Das gewählte Ziel ist keine Seminarkonzept-Einreichung');
            }
            if (!in_array((int)$set->scopecontextid, $allowedscopeids, true)) {
                throw new invalid_parameter_exception('Keine Berechtigung für das gewählte Seminarkonzept');
            }
            if ((string)$set->status !== 'draft') {
                $repo->update_methodset_status((int)$set->id, 'draft', $actorid);
            }
            $setid = (int)$set->id;
            $versionnum = (int)$DB->get_field_sql(
                'SELECT COALESCE(MAX(versionnum), 0) + 1 FROM {local_kgen_methodset_ver} WHERE methodsetid = :methodsetid',
                ['methodsetid' => $setid]
            );
        } else {
            $newshortname = trim((string)$params['shortname']);
            $newdisplayname = trim((string)$params['displayname']);
            if ($newshortname === '' || $newdisplayname === '') {
                throw new invalid_parameter_exception('Bitte Name und Kurzbezeichnung angeben');
            }
            $targetscope = $scopecontexts[0];
            $setid = $repo->create_methodset_draft($newshortname, $newdisplayname,
                (string)$params['description'], (int)$targetscope->id, $actorid, 'seminarkonzept');
            $versionnum = 1;
        }

        // Snapshot payload (D32): object instead of the plain method array a
        // Methoden-Sammlung uses - plan state 1:1 plus the referenced units.
        $snapshotpayload = [
            'typ' => 'seminarkonzept',
            'methods' => $planmethods,
            'plan' => [
                'name' => (string)$grid->name,
                'description' => (string)($grid->description ?? ''),
                'state' => $state,
            ],
        ];
        $snapshotjson = json_encode($snapshotpayload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($snapshotjson === false) {
            throw new invalid_parameter_exception('Seminarkonzept konnte nicht serialisiert werden');
        }
        $versionid = $repo->create_version($setid, (int)$versionnum, 'draft', $snapshotjson, $actorid);

        // Reviewer handling mirrors the Sammlung flows: keep assigned
        // reviewers, otherwise auto-assign everyone with review capability.
        $set = $repo->get_methodset($setid);
        $scopecontext = \context::instance_by_id((int)$set->scopecontextid, MUST_EXIST);
        $assignedreviewers = $reviewerrepo->get_reviewer_userids($setid);
        if (!$assignedreviewers) {
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
            $reviewerrepo->replace_reviewers($setid, $autorreviewerids, $actorid);
            $assignedreviewers = $autorreviewerids;
        }

        // Write the referenced units as global method rows so the plan's
        // units are browsable/adoptable in the global library (D29/D33).
        $now = time();
        $DB->delete_records('local_kgen_method', ['methodsetversionid' => (int)$versionid]);
        $savedcount = 0;
        foreach ($planmethods as $method) {
            $mapped = self::map_activity_method_to_global_record($method);
            if (trim((string)$mapped['title']) === '') {
                continue;
            }
            $record = (object)array_merge($mapped, [
                'methodsetid' => $setid,
                'methodsetversionid' => (int)$versionid,
                'timecreated' => $now,
                'timemodified' => $now,
                'createdby' => $actorid,
                'modifiedby' => $actorid,
            ]);
            $newmethodid = (int)$DB->insert_record('local_kgen_method', $record);
            $savedcount++;
            self::copy_method_material_files_to_global($method, $newmethodid,
                (int)$resolved['context']->id, $actorid, true);
        }

        $comment = trim((string)$params['changelog']) !== ''
            ? trim((string)$params['changelog'])
            : 'Seminarkonzept submitted from mod_seminarplaner';
        $workflow->transition($setid, (int)$versionid, 'review', $actorid, $comment);

        return [
            'success' => true,
            'methodsetid' => $setid,
            'versionid' => (int)$versionid,
            'savedcount' => $savedcount,
            'reviewercount' => count($assignedreviewers),
            'planname' => (string)$grid->name,
        ];
    }

    public static function submit_seminarkonzept_for_review_returns(): external_single_structure {
        return new external_single_structure([
            'success' => new external_value(PARAM_BOOL, 'Submit status'),
            'methodsetid' => new external_value(PARAM_INT, 'Method set id'),
            'versionid' => new external_value(PARAM_INT, 'Version id'),
            'savedcount' => new external_value(PARAM_INT, 'Saved seminar units into set version'),
            'reviewercount' => new external_value(PARAM_INT, 'Assigned reviewers'),
            'planname' => new external_value(PARAM_TEXT, 'Submitted plan name'),
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

    public static function get_sequenz_intro_parameters(): external_function_parameters {
        return new external_function_parameters([
            'cmid' => new external_value(PARAM_INT, 'Course module id'),
            'gridid' => new external_value(PARAM_INT, 'Seminarplan id'),
        ]);
    }

    public static function get_sequenz_intro(int $cmid, int $gridid): array {
        $params = self::validate_parameters(self::get_sequenz_intro_parameters(), ['cmid' => $cmid, 'gridid' => $gridid]);
        $resolved = self::resolve_cm_context((int)$params['cmid']);
        require_capability('mod/seminarplaner:managegrids', $resolved['context']);

        $service = new grid_service();
        return ['seen' => $service->get_intro_seen((int)$params['gridid'], (int)$GLOBALS['USER']->id)];
    }

    public static function get_sequenz_intro_returns(): external_single_structure {
        return new external_single_structure([
            'seen' => new external_value(PARAM_BOOL, 'Whether the one-time sequence intro was already seen'),
        ]);
    }

    public static function mark_sequenz_intro_seen_parameters(): external_function_parameters {
        return new external_function_parameters([
            'cmid' => new external_value(PARAM_INT, 'Course module id'),
            'gridid' => new external_value(PARAM_INT, 'Seminarplan id'),
        ]);
    }

    public static function mark_sequenz_intro_seen(int $cmid, int $gridid): array {
        $params = self::validate_parameters(self::mark_sequenz_intro_seen_parameters(), ['cmid' => $cmid, 'gridid' => $gridid]);
        $resolved = self::resolve_cm_context((int)$params['cmid']);
        require_capability('mod/seminarplaner:managegrids', $resolved['context']);
        self::enforce_write_rate_limit('mark_sequenz_intro_seen', 30, 60);

        $service = new grid_service();
        return ['success' => $service->mark_intro_seen((int)$params['gridid'], (int)$GLOBALS['USER']->id)];
    }

    public static function mark_sequenz_intro_seen_returns(): external_single_structure {
        return new external_single_structure([
            'success' => new external_value(PARAM_BOOL, 'Marker result'),
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
