<?php
// This file is part of Moodle - http://moodle.org/

namespace mod_seminarplaner\local\service;

use coding_exception;
use moodle_url;

defined('MOODLE_INTERNAL') || die();

/**
 * Persists method cards shared per activity.
 */
class method_card_service {
    /** @var string */
    private const FILEAREA_MATERIALIEN = 'method_materialien';
    /** @var string */
    private const FILEAREA_H5P = 'method_h5p';
    /** @var int Max attachment size in bytes per file upload (0 = Moodle/context default). */
    private const MAX_ATTACHMENT_BYTES = 0;
    /** @var int Max attachments per method/filearea. */
    private const MAX_ATTACHMENTS_PER_AREA = 25;
    /** @var int Shared owner id used for file map rows. */
    private const SHARED_FILEMAP_USERID = 0;

    /**
     * Normalize method alternatives as reciprocal links across valid method ids.
     *
     * @param array $methods
     * @return array
     */
    private function normalize_method_alternatives(array $methods): array {
        $order = [];
        $byid = [];
        foreach ($methods as $method) {
            if (!is_array($method)) {
                continue;
            }
            $id = clean_param((string)($method['id'] ?? ''), PARAM_ALPHANUMEXT);
            if ($id === '') {
                continue;
            }
            $method['id'] = $id;
            $byid[$id] = $method;
            $order[] = $id;
        }

        $links = [];
        foreach ($order as $id) {
            $links[$id] = [];
        }

        foreach ($order as $id) {
            $method = $byid[$id];
            $rawalts = $method['alternativen'] ?? [];
            $values = [];
            if (is_array($rawalts)) {
                $values = $rawalts;
            } else if (is_string($rawalts)) {
                $values = preg_split('/##|[\r\n,;]+/u', $rawalts) ?: [];
            }
            foreach ($values as $value) {
                $altid = clean_param((string)$value, PARAM_ALPHANUMEXT);
                if ($altid === '' || $altid === $id || !isset($byid[$altid])) {
                    continue;
                }
                $links[$id][$altid] = true;
                $links[$altid][$id] = true;
            }
        }

        $normalized = [];
        foreach ($order as $id) {
            $method = $byid[$id];
            $method['alternativen'] = [];
            foreach ($order as $otherid) {
                if ($otherid === $id) {
                    continue;
                }
                if (!empty($links[$id][$otherid])) {
                    $method['alternativen'][] = $otherid;
                }
            }
            $normalized[] = $method;
        }
        return $normalized;
    }

    /**
     * Build legacy preference key.
     *
     * @param int $cmid Course module id.
     * @return string
     */
    private function legacyprefkey(int $cmid): string {
        return 'mod_kgen_methods_' . $cmid;
    }

    /**
     * Build shared config key.
     *
     * @param int $cmid Course module id.
     * @return string
     */
    private function configkey(int $cmid): string {
        return 'methods_cmid_' . $cmid;
    }

    /**
     * Read shared methods JSON from plugin config.
     *
     * @param int $cmid Course module id.
     * @return string
     */
    private function read_shared_json(int $cmid): string {
        $value = get_config('mod_seminarplaner', $this->configkey($cmid));
        return is_string($value) ? $value : '';
    }

    /**
     * Persist shared methods JSON to plugin config.
     *
     * @param int $cmid Course module id.
     * @param string $json JSON payload.
     * @return void
     */
    private function write_shared_json(int $cmid, string $json): void {
        set_config($this->configkey($cmid), $json, 'mod_seminarplaner');
    }

    /**
     * Load and merge legacy per-user method sets for one activity.
     *
     * @param int $cmid Course module id.
     * @return array
     */
    private function load_legacy_methods(int $cmid): array {
        global $DB;

        $records = $DB->get_records('user_preferences', ['name' => $this->legacyprefkey($cmid)], 'userid ASC', 'userid, value');
        if (!$records) {
            return [];
        }

        $merged = [];
        $seen = [];
        foreach ($records as $record) {
            $decoded = json_decode((string)$record->value, true);
            if (!is_array($decoded)) {
                continue;
            }
            foreach ($decoded as $method) {
                if (!is_array($method)) {
                    continue;
                }
                $methoduid = clean_param((string)($method['id'] ?? ''), PARAM_ALPHANUMEXT);
                if ($methoduid === '') {
                    $methoduid = bin2hex(random_bytes(8));
                    $method['id'] = $methoduid;
                }
                if (isset($seen[$methoduid])) {
                    continue;
                }
                $seen[$methoduid] = true;
                $merged[] = $method;
            }
        }
        return $merged;
    }

    /**
     * Get method cards for an activity.
     *
     * @param int $cmid Course module id.
     * @param int $userid User id.
     * @param int $contextid Module context id.
     * @return array
     */
    public function get_methods(int $cmid, int $userid, int $contextid): array {
        if ($cmid <= 0) {
            throw new coding_exception('Invalid input for get_methods');
        }

        $raw = $this->read_shared_json($cmid);
        if ($raw === '') {
            $legacy = $this->load_legacy_methods($cmid);
            if ($legacy) {
                $raw = json_encode($legacy, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                if ($raw !== false) {
                    $this->write_shared_json($cmid, $raw);
                } else {
                    $raw = '';
                }
            }
        }
        if ($raw === '') {
            return [];
        }

        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            return [];
        }

        $jsonchanged = false;
        $seenmethoduids = [];
        foreach ($decoded as &$method) {
            if (!is_array($method)) {
                continue;
            }
            $methoduid = clean_param((string)($method['id'] ?? ''), PARAM_ALPHANUMEXT);
            if ($methoduid === '' || isset($seenmethoduids[$methoduid])) {
                $methoduid = $this->generate_method_uid();
            }
            $seenmethoduids[$methoduid] = true;
            if (!isset($method['id']) || (string)$method['id'] !== $methoduid) {
                $method['id'] = $methoduid;
                $jsonchanged = true;
            }
        }
        unset($method);

        $normalizedalts = $this->normalize_method_alternatives($decoded);
        if (json_encode($normalizedalts, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
            !== json_encode($decoded, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)) {
            $decoded = $normalizedalts;
            $jsonchanged = true;
        }

        if ($jsonchanged) {
            $patchedjson = json_encode($decoded, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            if ($patchedjson !== false) {
                $this->write_shared_json($cmid, $patchedjson);
            }
        }

        foreach ($decoded as &$method) {
            if (!is_array($method)) {
                continue;
            }
            $methoduid = clean_param((string)($method['id'] ?? ''), PARAM_ALPHANUMEXT);
            $itemid = $this->resolve_effective_itemid($cmid, $userid, $methoduid, false, $contextid);
            if ($itemid === null) {
                $method['materialien'] = [];
                $method['h5p'] = [];
                continue;
            }
            $method['materialien'] = $this->list_file_descriptors($contextid, self::FILEAREA_MATERIALIEN, $itemid);
            $method['h5p'] = $this->list_file_descriptors($contextid, self::FILEAREA_H5P, $itemid);
        }
        unset($method);

        return $decoded;
    }

    /**
     * Save method cards for a user/activity.
     *
     * @param int $cmid Course module id.
     * @param int $userid User id.
     * @param int $contextid Module context id.
     * @param array $methods Method card array.
     * @return void
     */
    public function save_methods(int $cmid, int $userid, int $contextid, array $methods): void {
        global $DB;

        if ($cmid <= 0 || $userid <= 0) {
            throw new coding_exception('Invalid input for save_methods');
        }

        $normalized = [];
        $activeuids = [];
        $seenmethoduids = [];
        foreach (array_values($methods) as $method) {
            if (!is_array($method)) {
                continue;
            }
            $methoduid = (string)($method['id'] ?? '');
            $methoduid = clean_param($methoduid, PARAM_ALPHANUMEXT);
            if ($methoduid === '' || isset($seenmethoduids[$methoduid])) {
                $methoduid = $this->generate_method_uid();
            }
            $methoduid = substr($methoduid, 0, 255);
            $seenmethoduids[$methoduid] = true;
            $method['id'] = $methoduid;
            $activeuids[] = $methoduid;
            $itemid = $this->resolve_effective_itemid($cmid, $userid, $methoduid, true, $contextid);
            if ($itemid === null) {
                throw new coding_exception('Unable to resolve file itemid');
            }

            $materialentries = (array)($method['materialien'] ?? []);
            $materialdraftitemid = 0;
            if (isset($method['materialiendraftitemid'])) {
                $materialdraftitemid = (int)$method['materialiendraftitemid'];
            }
            if ($materialdraftitemid > 0) {
                $materialentries = [['draftitemid' => $materialdraftitemid]];
            }

            $h5pentries = (array)($method['h5p'] ?? []);
            $h5pdraftitemid = 0;
            if (isset($method['h5pdraftitemid'])) {
                $h5pdraftitemid = (int)$method['h5pdraftitemid'];
            }
            if ($h5pdraftitemid > 0) {
                $h5pentries = [['draftitemid' => $h5pdraftitemid]];
            }

            $method['materialien'] = $this->sync_file_area(
                $contextid,
                $itemid,
                self::FILEAREA_MATERIALIEN,
                $materialentries,
                $userid
            );
            $method['h5p'] = $this->sync_file_area(
                $contextid,
                $itemid,
                self::FILEAREA_H5P,
                $h5pentries,
                $userid
            );
            unset($method['materialiendraftitemid'], $method['h5pdraftitemid']);
            $normalized[] = $method;
        }

        $normalized = $this->normalize_method_alternatives($normalized);
        $json = json_encode($normalized, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($json === false) {
            throw new coding_exception('Failed to encode methods JSON');
        }

        $this->write_shared_json($cmid, $json);

        // Clean up file maps (and files) for deleted methods.
        [$insql, $params] = $DB->get_in_or_equal($activeuids ?: ['__none__'], SQL_PARAMS_QM, '', false);
        $orphanmaps = $DB->get_records_select(
            'kgen_method_filemap',
            "cmid = ? AND userid = ? AND methoduid $insql",
            array_merge([$cmid, self::SHARED_FILEMAP_USERID], $params)
        );
        $fs = get_file_storage();
        foreach ($orphanmaps as $map) {
            $fs->delete_area_files($contextid, 'mod_seminarplaner', self::FILEAREA_MATERIALIEN, (int)$map->itemid);
            $fs->delete_area_files($contextid, 'mod_seminarplaner', self::FILEAREA_H5P, (int)$map->itemid);
            $DB->delete_records('kgen_method_filemap', ['id' => (int)$map->id]);
        }
    }

    /**
     * Prepare a Moodle draft area with existing material files for one method.
     *
     * @param int $cmid Course module id.
     * @param int $contextid Module context id.
     * @param string $methoduid Method uid.
     * @param int $draftitemid Existing or new draft item id.
     * @param int $preferreditemid Optional direct itemid hint from UI.
     * @return int Draft item id.
     */
    public function prepare_material_draft_itemid(
        int $cmid,
        int $contextid,
        string $methoduid,
        int $draftitemid = 0,
        int $preferreditemid = 0
    ): int {
        global $USER;

        $methoduid = clean_param($methoduid, PARAM_ALPHANUMEXT);
        if ($draftitemid <= 0) {
            $draftitemid = file_get_unused_draft_itemid();
        }
        if ($cmid <= 0 || $contextid <= 0) {
            return $draftitemid;
        }

        $itemid = null;
        if ($preferreditemid > 0) {
            $files = get_file_storage()->get_area_files(
                $contextid,
                'mod_seminarplaner',
                self::FILEAREA_MATERIALIEN,
                $preferreditemid,
                'filename',
                false
            );
            if (!empty($files)) {
                $itemid = $preferreditemid;
                if ($methoduid !== '') {
                    $this->ensure_shared_mapping_for_itemid($cmid, $methoduid, $itemid);
                }
            }
        }

        if ($itemid === null && $methoduid !== '') {
            $itemid = $this->resolve_effective_itemid($cmid, (int)$USER->id, $methoduid, false, $contextid);
        }
        if ($itemid === null) {
            return $draftitemid;
        }

        $this->populate_material_draft_area($draftitemid, $contextid, $itemid, (int)$USER->id);

        return $draftitemid;
    }

    /**
     * Populate user draft area from persisted material file area.
     *
     * Copies only valid files to avoid broken draft entries.
     *
     * @param int $draftitemid
     * @param int $contextid
     * @param int $sourceitemid
     * @param int $userid
     * @return void
     */
    private function populate_material_draft_area(int $draftitemid, int $contextid, int $sourceitemid, int $userid): void {
        $fs = get_file_storage();
        $usercontext = \context_user::instance($userid);
        $draftcontextid = (int)$usercontext->id;

        $fs->delete_area_files($draftcontextid, 'user', 'draft', $draftitemid);

        $sourcefiles = $fs->get_area_files(
            $contextid,
            'mod_seminarplaner',
            self::FILEAREA_MATERIALIEN,
            $sourceitemid,
            'id ASC',
            false
        );
        if (!$sourcefiles) {
            return;
        }

        $copied = 0;
        foreach ($sourcefiles as $file) {
            if ($copied >= self::MAX_ATTACHMENTS_PER_AREA) {
                break;
            }
            if ($file->is_directory()) {
                continue;
            }
            $filename = (string)$file->get_filename();
            if ($filename === '' || $filename === '.') {
                continue;
            }
            $filepath = (string)$file->get_filepath();
            if ($filepath === '' || $filepath[0] !== '/') {
                $filepath = '/';
            }
            $record = (object)[
                'contextid' => $draftcontextid,
                'component' => 'user',
                'filearea' => 'draft',
                'itemid' => $draftitemid,
                'filepath' => $filepath,
                'filename' => $filename,
                'userid' => $userid,
            ];
            try {
                $fs->create_file_from_storedfile($record, $file);
                $copied++;
            } catch (\Exception $e) {
                // Skip broken file records and continue with valid files.
                continue;
            }
        }
    }

    /**
     * Resolve item id with shared mapping fallback to legacy per-user mapping.
     *
     * @param int $cmid
     * @param int $userid
     * @param string $methoduid
     * @param bool $create
     * @return int|null
     */
    private function resolve_effective_itemid(int $cmid, int $userid, string $methoduid, bool $create, int $contextid = 0): ?int {
        $shareditemid = $this->resolve_itemid($cmid, self::SHARED_FILEMAP_USERID, $methoduid, false);
        if ($shareditemid !== null) {
            return $shareditemid;
        }

        if ($userid > 0) {
            $legacyitemid = $this->resolve_itemid($cmid, $userid, $methoduid, false);
            if ($legacyitemid !== null) {
                $this->ensure_shared_mapping_for_itemid($cmid, $methoduid, $legacyitemid);
                return $legacyitemid;
            }
        }

        // Cross-user fallback: pick an existing mapping from any course user and promote it to shared.
        $anyuseritemid = $this->find_itemid_from_any_user_mapping($cmid, $methoduid);
        if ($anyuseritemid !== null) {
            $this->ensure_shared_mapping_for_itemid($cmid, $methoduid, $anyuseritemid);
            return $anyuseritemid;
        }

        // Recovery path: use itemid persisted in legacy method JSON if filemap rows were lost.
        if ($contextid > 0) {
            $payloaditemid = $this->find_itemid_from_method_payload($cmid, $contextid, $methoduid, self::FILEAREA_MATERIALIEN);
            if ($payloaditemid !== null) {
                $this->ensure_shared_mapping_for_itemid($cmid, $methoduid, $payloaditemid);
                return $payloaditemid;
            }
            $payloadh5pitemid = $this->find_itemid_from_method_payload($cmid, $contextid, $methoduid, self::FILEAREA_H5P);
            if ($payloadh5pitemid !== null) {
                $this->ensure_shared_mapping_for_itemid($cmid, $methoduid, $payloadh5pitemid);
                return $payloadh5pitemid;
            }
        }

        if (!$create) {
            return null;
        }
        return $this->resolve_itemid($cmid, self::SHARED_FILEMAP_USERID, $methoduid, true);
    }

    /**
     * Find method itemid from any user-specific mapping row for this activity/method uid.
     *
     * @param int $cmid
     * @param string $methoduid
     * @return int|null
     */
    private function find_itemid_from_any_user_mapping(int $cmid, string $methoduid): ?int {
        global $DB;

        $records = $DB->get_records_select(
            'kgen_method_filemap',
            'cmid = :cmid AND methoduid = :methoduid AND userid <> :shareduserid',
            [
                'cmid' => $cmid,
                'methoduid' => $methoduid,
                'shareduserid' => self::SHARED_FILEMAP_USERID,
            ],
            'timemodified DESC, timecreated DESC, id DESC',
            'itemid'
        );
        if (!$records) {
            return null;
        }
        foreach ($records as $record) {
            $itemid = (int)$record->itemid;
            if ($itemid > 0) {
                return $itemid;
            }
        }
        return null;
    }

    /**
     * Try to recover itemid from persisted method JSON payload.
     *
     * @param int $cmid
     * @param int $contextid
     * @param string $methoduid
     * @param string $filearea
     * @return int|null
     */
    private function find_itemid_from_method_payload(int $cmid, int $contextid, string $methoduid, string $filearea): ?int {
        global $DB;

        $raw = $this->read_shared_json($cmid);
        if ($raw === '') {
            return null;
        }
        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            return null;
        }

        $candidates = [];
        $filenames = [];
        foreach ($decoded as $method) {
            if (!is_array($method) || (string)($method['id'] ?? '') !== $methoduid) {
                continue;
            }
            $entries = (array)($filearea === self::FILEAREA_H5P ? ($method['h5p'] ?? []) : ($method['materialien'] ?? []));
            foreach ($entries as $entry) {
                if (!is_array($entry)) {
                    $name = trim((string)$entry);
                    if ($name !== '' && !in_array($name, $filenames, true)) {
                        $filenames[] = $name;
                    }
                    continue;
                }
                $itemid = (int)($entry['itemid'] ?? 0);
                if ($itemid > 0 && !in_array($itemid, $candidates, true)) {
                    $candidates[] = $itemid;
                }
                $name = trim((string)($entry['name'] ?? ''));
                if ($name !== '' && !in_array($name, $filenames, true)) {
                    $filenames[] = $name;
                }
            }
        }
        $fs = get_file_storage();
        if ($candidates) {
            foreach ($candidates as $itemid) {
                $files = $fs->get_area_files($contextid, 'mod_seminarplaner', $filearea, $itemid, 'filename', false);
                if (!empty($files)) {
                    return $itemid;
                }
            }
        }

        // Legacy fallback: detect itemid by matching persisted filenames in this filearea/context.
        if (!$filenames) {
            return null;
        }
        [$insql, $inparams] = $DB->get_in_or_equal($filenames, SQL_PARAMS_NAMED, 'fn');
        $params = array_merge([
            'contextid' => $contextid,
            'component' => 'mod_seminarplaner',
            'filearea' => $filearea,
        ], $inparams);
        $records = $DB->get_records_select('files',
            'contextid = :contextid
             AND component = :component
             AND filearea = :filearea
             AND filesize > 0
             AND filename ' . $insql,
            $params,
            '',
            'itemid, filename');
        if (!$records) {
            return null;
        }

        $matches = [];
        foreach ($records as $record) {
            $itemid = (int)$record->itemid;
            $name = (string)$record->filename;
            if (!isset($matches[$itemid])) {
                $matches[$itemid] = [];
            }
            $matches[$itemid][$name] = true;
        }

        // Prefer a full filename match for all expected files.
        $expected = array_fill_keys($filenames, true);
        foreach ($matches as $itemid => $found) {
            $allpresent = true;
            foreach ($expected as $name => $_) {
                if (!isset($found[$name])) {
                    $allpresent = false;
                    break;
                }
            }
            if ($allpresent) {
                return (int)$itemid;
            }
        }

        // If no full match exists, use the itemid with the highest overlap.
        $bestitemid = 0;
        $bestcount = 0;
        foreach ($matches as $itemid => $found) {
            $count = 0;
            foreach ($expected as $name => $_) {
                if (isset($found[$name])) {
                    $count++;
                }
            }
            if ($count > $bestcount) {
                $bestcount = $count;
                $bestitemid = (int)$itemid;
            }
        }
        if ($bestitemid > 0) {
            return $bestitemid;
        }
        return null;
    }

    /**
     * Generate a unique method uid.
     *
     * @return string
     */
    private function generate_method_uid(): string {
        try {
            return bin2hex(random_bytes(8));
        } catch (\Exception $e) {
            return str_replace('.', '', uniqid('m', true));
        }
    }

    /**
     * Ensure shared mapping exists for an already known item id.
     *
     * @param int $cmid
     * @param string $methoduid
     * @param int $itemid
     * @return void
     */
    private function ensure_shared_mapping_for_itemid(int $cmid, string $methoduid, int $itemid): void {
        global $DB;

        $existing = $DB->get_record('kgen_method_filemap', [
            'cmid' => $cmid,
            'userid' => self::SHARED_FILEMAP_USERID,
            'methoduid' => $methoduid,
        ]);
        if ($existing) {
            return;
        }

        $conflict = $DB->get_record('kgen_method_filemap', [
            'cmid' => $cmid,
            'userid' => self::SHARED_FILEMAP_USERID,
            'itemid' => $itemid,
        ]);
        if ($conflict) {
            return;
        }

        $now = time();
        $DB->insert_record('kgen_method_filemap', (object)[
            'cmid' => $cmid,
            'userid' => self::SHARED_FILEMAP_USERID,
            'methoduid' => $methoduid,
            'itemid' => $itemid,
            'timecreated' => $now,
            'timemodified' => $now,
        ]);
    }

    /**
     * Resolve numeric item id for a method uid.
     *
     * @param int $cmid
     * @param int $userid
     * @param string $methoduid
     * @param bool $create
     * @return int|null
     */
    private function resolve_itemid(int $cmid, int $userid, string $methoduid, bool $create): ?int {
        global $DB;

        $existing = $DB->get_record('kgen_method_filemap', [
            'cmid' => $cmid,
            'userid' => $userid,
            'methoduid' => $methoduid,
        ]);
        if ($existing) {
            return (int)$existing->itemid;
        }
        if (!$create) {
            return null;
        }

        $maxitemid = (int)$DB->get_field_sql(
            'SELECT MAX(itemid) FROM {kgen_method_filemap} WHERE cmid = ?',
            [$cmid]
        );
        $itemid = $maxitemid + 1;
        $now = time();
        $DB->insert_record('kgen_method_filemap', (object)[
            'cmid' => $cmid,
            'userid' => $userid,
            'methoduid' => $methoduid,
            'itemid' => $itemid,
            'timecreated' => $now,
            'timemodified' => $now,
        ]);
        return $itemid;
    }

    /**
     * Store file area content based on incoming attachment descriptors.
     *
     * @param int $contextid
     * @param int $itemid
     * @param string $filearea
     * @param array $entries
     * @param int $userid
     * @return array
     */
    private function sync_file_area(int $contextid, int $itemid, string $filearea, array $entries, int $userid): array {
        $fs = get_file_storage();
        $existing = $fs->get_area_files($contextid, 'mod_seminarplaner', $filearea, $itemid, 'filename', false);
        $byname = [];
        foreach ($existing as $file) {
            $byname[$file->get_filename()] = $file;
        }

        if (count($entries) > self::MAX_ATTACHMENTS_PER_AREA) {
            throw new coding_exception('Too many attachments in one method');
        }

        $keep = [];
        foreach ($entries as $entry) {
            if (is_string($entry)) {
                $name = $this->sanitize_filename($entry);
                if ($name !== '') {
                    $keep[$name] = true;
                }
                continue;
            }
            if (!is_array($entry)) {
                continue;
            }
            if (isset($entry['draftitemid'])) {
                $draftitemid = (int)$entry['draftitemid'];
                if ($draftitemid > 0) {
                    $this->replace_file_area_from_draft($draftitemid, $contextid, $filearea, $itemid, $userid);
                    return $this->list_file_descriptors($contextid, $filearea, $itemid);
                }
                continue;
            }
            $name = $this->sanitize_filename((string)($entry['name'] ?? ''));
            if ($name === '') {
                continue;
            }
            $keep[$name] = true;

            $base64 = (string)($entry['contentbase64'] ?? '');
            if ($base64 === '') {
                continue;
            }
            if (self::MAX_ATTACHMENT_BYTES > 0 && strlen($base64) > (self::MAX_ATTACHMENT_BYTES * 2)) {
                throw new coding_exception('Attachment payload too large');
            }

            $content = base64_decode($base64, true);
            if ($content === false) {
                continue;
            }
            if (self::MAX_ATTACHMENT_BYTES > 0 && strlen($content) > self::MAX_ATTACHMENT_BYTES) {
                throw new coding_exception('Attachment exceeds max size');
            }
            if (isset($byname[$name])) {
                $byname[$name]->delete();
            }
            $record = (object)[
                'contextid' => $contextid,
                'component' => 'mod_seminarplaner',
                'filearea' => $filearea,
                'itemid' => $itemid,
                'filepath' => '/',
                'filename' => $name,
                'userid' => $userid,
            ];
            $fs->create_file_from_string($record, $content);
        }

        foreach ($byname as $name => $file) {
            if (!isset($keep[$name])) {
                $file->delete();
            }
        }

        return $this->list_file_descriptors($contextid, $filearea, $itemid);
    }

    /**
     * Replace persistent file area contents with files from user draft area.
     *
     * @param int $draftitemid
     * @param int $contextid
     * @param string $filearea
     * @param int $itemid
     * @param int $userid
     * @return void
     */
    private function replace_file_area_from_draft(
        int $draftitemid,
        int $contextid,
        string $filearea,
        int $itemid,
        int $userid
    ): void {
        $fs = get_file_storage();
        $usercontext = \context_user::instance($userid);
        $draftcontextid = (int)$usercontext->id;

        $draftfiles = $fs->get_area_files($draftcontextid, 'user', 'draft', $draftitemid, 'id ASC', false);
        if (count($draftfiles) > self::MAX_ATTACHMENTS_PER_AREA) {
            throw new coding_exception('Too many attachments in one method');
        }

        $fs->delete_area_files($contextid, 'mod_seminarplaner', $filearea, $itemid);

        foreach ($draftfiles as $draftfile) {
            if (!$draftfile || $draftfile->is_directory()) {
                continue;
            }
            if (self::MAX_ATTACHMENT_BYTES > 0 && (int)$draftfile->get_filesize() > self::MAX_ATTACHMENT_BYTES) {
                throw new coding_exception('Attachment exceeds max size');
            }
            $filename = $this->sanitize_filename((string)$draftfile->get_filename());
            if ($filename === '') {
                continue;
            }
            $filepath = (string)$draftfile->get_filepath();
            if ($filepath === '' || $filepath[0] !== '/') {
                $filepath = '/';
            }
            $record = (object)[
                'contextid' => $contextid,
                'component' => 'mod_seminarplaner',
                'filearea' => $filearea,
                'itemid' => $itemid,
                'filepath' => $filepath,
                'filename' => $filename,
                'userid' => $userid,
            ];
            try {
                $fs->create_file_from_storedfile($record, $draftfile);
            } catch (\Throwable $e) {
                // Fallback for edge cases (e.g. alias/reference draft entries).
                try {
                    $content = $draftfile->get_content();
                    if ($content === false) {
                        continue;
                    }
                    $fs->create_file_from_string($record, $content);
                } catch (\Throwable $e2) {
                    // Ignore broken draft entries and continue with remaining valid files.
                    continue;
                }
            }
        }
    }

    /**
     * Normalize and validate attachment filename.
     *
     * @param string $filename
     * @return string
     */
    private function sanitize_filename(string $filename): string {
        $clean = clean_param(trim($filename), PARAM_FILE);
        if ($clean === '' || $clean === '.') {
            return '';
        }
        return substr($clean, 0, 255);
    }

    /**
     * Build attachment descriptors for frontend/export.
     *
     * @param int $contextid
     * @param string $filearea
     * @param int $itemid
     * @return array
     */
    private function list_file_descriptors(int $contextid, string $filearea, int $itemid): array {
        $fs = get_file_storage();
        $files = $fs->get_area_files($contextid, 'mod_seminarplaner', $filearea, $itemid, 'filename', false);
        $out = [];
        foreach ($files as $file) {
            $url = moodle_url::make_pluginfile_url(
                $contextid,
                'mod_seminarplaner',
                $filearea,
                $itemid,
                '/',
                $file->get_filename()
            );
            $out[] = [
                'name' => $file->get_filename(),
                'stored' => true,
                'filearea' => $filearea,
                'itemid' => $itemid,
                'mimetype' => $file->get_mimetype(),
                'filesize' => $file->get_filesize(),
                'fileurl' => $url->out(false),
            ];
        }
        return $out;
    }
}
