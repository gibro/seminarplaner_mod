<?php
// This file is part of Moodle - http://moodle.org/

namespace mod_konzeptgenerator\local\service;

use coding_exception;
use moodle_url;

defined('MOODLE_INTERNAL') || die();

/**
 * Persists method cards per user and activity using user preferences.
 */
class method_card_service {
    /** @var string */
    private const FILEAREA_MATERIALIEN = 'method_materialien';
    /** @var string */
    private const FILEAREA_H5P = 'method_h5p';
    /** @var int Max attachment size in bytes per file upload. */
    private const MAX_ATTACHMENT_BYTES = 10485760; // 10 MB.
    /** @var int Max attachments per method/filearea. */
    private const MAX_ATTACHMENTS_PER_AREA = 25;

    /**
     * Build preference key.
     *
     * @param int $cmid Course module id.
     * @return string
     */
    private function prefkey(int $cmid): string {
        return 'mod_kgen_methods_' . $cmid;
    }

    /**
     * Get method cards for a user/activity.
     *
     * @param int $cmid Course module id.
     * @param int $userid User id.
     * @param int $contextid Module context id.
     * @return array
     */
    public function get_methods(int $cmid, int $userid, int $contextid): array {
        if ($cmid <= 0 || $userid <= 0) {
            throw new coding_exception('Invalid input for get_methods');
        }

        $raw = get_user_preferences($this->prefkey($cmid), '', $userid);
        if ($raw === '') {
            return [];
        }

        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            return [];
        }

        foreach ($decoded as &$method) {
            if (!is_array($method)) {
                continue;
            }
            $methoduid = (string)($method['id'] ?? '');
            if ($methoduid === '') {
                continue;
            }
            $itemid = $this->resolve_itemid($cmid, $userid, $methoduid, false);
            if ($itemid === null) {
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
        foreach (array_values($methods) as $method) {
            if (!is_array($method)) {
                continue;
            }
            $methoduid = (string)($method['id'] ?? '');
            $methoduid = clean_param($methoduid, PARAM_ALPHANUMEXT);
            if ($methoduid === '') {
                $methoduid = bin2hex(random_bytes(8));
                $method['id'] = $methoduid;
            }
            $methoduid = substr($methoduid, 0, 255);
            $method['id'] = $methoduid;
            $activeuids[] = $methoduid;
            $itemid = $this->resolve_itemid($cmid, $userid, $methoduid, true);
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

        $json = json_encode($normalized, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($json === false) {
            throw new coding_exception('Failed to encode methods JSON');
        }

        set_user_preference($this->prefkey($cmid), $json, $userid);

        // Clean up file maps (and files) for deleted methods.
        [$insql, $params] = $DB->get_in_or_equal($activeuids ?: ['__none__'], SQL_PARAMS_QM, '', false);
        $orphanmaps = $DB->get_records_select('kgen_method_filemap', "cmid = ? AND userid = ? AND methoduid $insql", array_merge([$cmid, $userid], $params));
        $fs = get_file_storage();
        foreach ($orphanmaps as $map) {
            $fs->delete_area_files($contextid, 'mod_konzeptgenerator', self::FILEAREA_MATERIALIEN, (int)$map->itemid);
            $fs->delete_area_files($contextid, 'mod_konzeptgenerator', self::FILEAREA_H5P, (int)$map->itemid);
            $DB->delete_records('kgen_method_filemap', ['id' => (int)$map->id]);
        }
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
            'SELECT MAX(itemid) FROM {kgen_method_filemap} WHERE cmid = ? AND userid = ?',
            [$cmid, $userid]
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
        $existing = $fs->get_area_files($contextid, 'mod_konzeptgenerator', $filearea, $itemid, 'filename', false);
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
                    $options = [
                        'subdirs' => 0,
                        'maxfiles' => self::MAX_ATTACHMENTS_PER_AREA,
                        'maxbytes' => self::MAX_ATTACHMENT_BYTES,
                        'accepted_types' => '*',
                    ];
                    file_save_draft_area_files($draftitemid, $contextid, 'mod_konzeptgenerator', $filearea, $itemid, $options);
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
            if (strlen($base64) > (self::MAX_ATTACHMENT_BYTES * 2)) {
                throw new coding_exception('Attachment payload too large');
            }

            $content = base64_decode($base64, true);
            if ($content === false) {
                continue;
            }
            if (strlen($content) > self::MAX_ATTACHMENT_BYTES) {
                throw new coding_exception('Attachment exceeds max size');
            }
            if (isset($byname[$name])) {
                $byname[$name]->delete();
            }
            $record = (object)[
                'contextid' => $contextid,
                'component' => 'mod_konzeptgenerator',
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
        $files = $fs->get_area_files($contextid, 'mod_konzeptgenerator', $filearea, $itemid, 'filename', false);
        $out = [];
        foreach ($files as $file) {
            $url = moodle_url::make_pluginfile_url(
                $contextid,
                'mod_konzeptgenerator',
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
