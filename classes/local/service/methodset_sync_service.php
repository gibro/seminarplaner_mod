<?php
// This file is part of Moodle - http://moodle.org/

namespace mod_seminarplaner\local\service;

use coding_exception;
use context_module;

defined('MOODLE_INTERNAL') || die();

/**
 * Synchronizes linked activity method cards with published global method set versions.
 */
class methodset_sync_service {
    /** @var string[] Method-card fields managed by sync hashes. */
    private const TRACKED_FIELDS = [
        'titel', 'seminarphase', 'zeitbedarf', 'gruppengroesse', 'kurzbeschreibung', 'autor',
        'lernziele', 'komplexitaet', 'vorbereitung', 'raum', 'sozialform', 'risiken', 'debrief',
        'materialtechnik', 'ablauf', 'tags', 'kognitive',
    ];

    /**
     * Link or relink an activity to a global method set version.
     *
     * @param int $cmid
     * @param int $methodsetid
     * @param int $methodsetversionid
     * @param int $userid
     * @param bool $isdefault
     * @return void
     */
    public function upsert_activity_set_link(int $cmid, int $methodsetid, int $methodsetversionid, int $userid,
        bool $isdefault = false): void {
        global $DB;

        if ($cmid <= 0 || $methodsetid <= 0 || $methodsetversionid <= 0 || $userid <= 0) {
            throw new coding_exception('Invalid link data');
        }

        $existing = $DB->get_records('kgen_activity_setlink', [
            'cmid' => $cmid,
            'methodsetid' => $methodsetid,
        ], 'id ASC');

        if ($existing) {
            $first = array_shift($existing);
            $first->methodsetversionid = $methodsetversionid;
            $first->pendingversionid = 0;
            $first->isdefault = $isdefault ? 1 : 0;
            $DB->update_record('kgen_activity_setlink', $first);
            foreach ($existing as $row) {
                $DB->delete_records('kgen_activity_setlink', ['id' => (int)$row->id]);
            }
            return;
        }

        $DB->insert_record('kgen_activity_setlink', (object)[
            'cmid' => $cmid,
            'methodsetid' => $methodsetid,
            'methodsetversionid' => $methodsetversionid,
            'pendingversionid' => 0,
            'autosyncenabled' => 0,
            'isdefault' => $isdefault ? 1 : 0,
            'timecreated' => time(),
            'createdby' => $userid,
        ]);
    }

    /**
     * Returns link status for one activity.
     *
     * @param int $cmid
     * @return array<int,array<string,mixed>>
     */
    public function list_activity_links(int $cmid): array {
        global $DB;

        if ($cmid <= 0) {
            throw new coding_exception('Invalid cmid');
        }

        $links = $DB->get_records('kgen_activity_setlink', ['cmid' => $cmid], 'id ASC');
        $out = [];
        foreach ($links as $link) {
            $set = $DB->get_record('local_kgen_methodset', ['id' => (int)$link->methodsetid],
                'id,shortname,displayname,status,currentversion', IGNORE_MISSING);
            if (!$set) {
                continue;
            }
            $pendingversionid = (int)($link->pendingversionid ?? 0);
            $haspending = $pendingversionid > 0;
            $out[] = [
                'methodsetid' => (int)$link->methodsetid,
                'methodsetname' => (string)($set->displayname ?? ''),
                'methodsetshortname' => (string)($set->shortname ?? ''),
                'status' => (string)($set->status ?? ''),
                'linkedversionid' => (int)$link->methodsetversionid,
                'currentversionid' => (int)($set->currentversion ?? 0),
                'pendingversionid' => $pendingversionid,
                'autosyncenabled' => !empty($link->autosyncenabled),
                'haspending' => $haspending,
            ];
        }
        return $out;
    }

    /**
     * Set auto-sync policy for one activity+set link.
     *
     * @param int $cmid
     * @param int $methodsetid
     * @param bool $enabled
     * @return bool
     */
    public function set_autosync(int $cmid, int $methodsetid, bool $enabled): bool {
        global $DB;

        if ($cmid <= 0 || $methodsetid <= 0) {
            throw new coding_exception('Invalid autosync input');
        }

        $link = $DB->get_record('kgen_activity_setlink', ['cmid' => $cmid, 'methodsetid' => $methodsetid], '*', IGNORE_MISSING);
        if (!$link) {
            return false;
        }
        $link->autosyncenabled = $enabled ? 1 : 0;
        $DB->update_record('kgen_activity_setlink', $link);
        return true;
    }

    /**
     * Apply pending/latest update for one linked activity+methodset.
     *
     * @param int $cmid
     * @param int $methodsetid
     * @param int $actorid
     * @return bool
     */
    public function apply_pending_update_for_activity(int $cmid, int $methodsetid, int $actorid): bool {
        global $DB;

        if ($cmid <= 0 || $methodsetid <= 0 || $actorid <= 0) {
            throw new coding_exception('Invalid apply input');
        }

        $link = $DB->get_record('kgen_activity_setlink', ['cmid' => $cmid, 'methodsetid' => $methodsetid], '*', IGNORE_MISSING);
        if (!$link) {
            return false;
        }

        $targetversionid = (int)($link->pendingversionid ?? 0);
        if ($targetversionid <= 0) {
            $set = $DB->get_record('local_kgen_methodset', ['id' => $methodsetid], 'id,status,currentversion', IGNORE_MISSING);
            if (!$set || (string)$set->status !== 'published' || (int)$set->currentversion <= 0) {
                return false;
            }
            $targetversionid = (int)$set->currentversion;
            if ($targetversionid === (int)$link->methodsetversionid) {
                return false;
            }
        }

        return $this->apply_link_update($link, $targetversionid, $actorid);
    }

    /**
     * Sync all linked activities for a newly published method set version.
     *
     * @param int $methodsetid
     * @param int $newversionid
     * @param int $actorid
     * @return int Number of updated activity links.
     */
    public function sync_published_methodset(int $methodsetid, int $newversionid, int $actorid): int {
        global $DB;

        if ($methodsetid <= 0 || $newversionid <= 0 || $actorid <= 0) {
            throw new coding_exception('Invalid sync input');
        }

        $links = $DB->get_records('kgen_activity_setlink', ['methodsetid' => $methodsetid], 'id ASC');
        $this->backfill_links_from_activity_defaults($methodsetid, $newversionid, $actorid, $links);
        $links = $DB->get_records('kgen_activity_setlink', ['methodsetid' => $methodsetid], 'id ASC');
        if (!$links) {
            return 0;
        }

        $updatedlinks = 0;
        foreach ($links as $link) {
            if ((int)$link->methodsetversionid === $newversionid && (int)($link->pendingversionid ?? 0) === 0) {
                continue;
            }
            if (empty($link->autosyncenabled)) {
                $link->pendingversionid = $newversionid;
                $DB->update_record('kgen_activity_setlink', $link);
                continue;
            }
            if ($this->apply_link_update($link, $newversionid, $actorid)) {
                $updatedlinks++;
            }
        }

        return $updatedlinks;
    }

    /**
     * Apply one version update to one link.
     *
     * @param \stdClass $link
     * @param int $newversionid
     * @param int $actorid
     * @return bool
     */
    private function apply_link_update(\stdClass $link, int $newversionid, int $actorid): bool {
        global $DB;

        $methodsetid = (int)$link->methodsetid;
        $oldversionid = (int)$link->methodsetversionid;
        if ($methodsetid <= 0 || $newversionid <= 0) {
            return false;
        }

        $newmethods = $this->load_set_methods_by_title($methodsetid, $newversionid);
        if (!$newmethods) {
            return false;
        }

        $oldmethods = $oldversionid > 0 ? $this->load_set_methods_by_title($methodsetid, $oldversionid) : [];

        $context = context_module::instance((int)$link->cmid, IGNORE_MISSING);
        if (!$context) {
            return false;
        }

        $service = new method_card_service();
        $userids = $this->resolve_activity_method_userids((int)$link->cmid, (int)$link->createdby);
        foreach ($userids as $userid) {
            $currentmethods = $service->get_methods((int)$link->cmid, $userid, (int)$context->id);
            $merged = $this->merge_methods_for_sync($currentmethods, $methodsetid, $oldmethods, $newmethods, $newversionid);
            $service->save_methods((int)$link->cmid, $userid, (int)$context->id, $merged);
        }

        $link->methodsetversionid = $newversionid;
        $link->pendingversionid = 0;
        $DB->update_record('kgen_activity_setlink', $link);
        return true;
    }

    /**
     * Backfill missing set links from activity default method set references.
     *
     * @param int $methodsetid
     * @param int $newversionid
     * @param int $actorid
     * @param array $existinglinks
     * @return void
     */
    private function backfill_links_from_activity_defaults(int $methodsetid, int $newversionid, int $actorid,
        array $existinglinks): void {
        global $DB;

        $linkedcmids = [];
        foreach ($existinglinks as $link) {
            $linkedcmids[(int)$link->cmid] = true;
        }

        $moduleid = (int)$DB->get_field('modules', 'id', ['name' => 'seminarplaner'], IGNORE_MISSING);
        if ($moduleid <= 0) {
            return;
        }

        $newversion = $DB->get_record('local_kgen_methodset_ver', ['id' => $newversionid], 'id,methodsetid,versionnum', IGNORE_MISSING);
        $fallbackoldversion = 0;
        if ($newversion && (int)$newversion->methodsetid === $methodsetid) {
            $previous = $DB->get_record_sql(
                "SELECT id
                   FROM {local_kgen_methodset_ver}
                  WHERE methodsetid = :methodsetid
                    AND versionnum < :versionnum
               ORDER BY versionnum DESC",
                ['methodsetid' => $methodsetid, 'versionnum' => (int)$newversion->versionnum],
                IGNORE_MULTIPLE
            );
            $fallbackoldversion = (int)($previous->id ?? 0);
        }

        $cms = $DB->get_records_sql(
            "SELECT cm.id AS cmid
               FROM {course_modules} cm
               JOIN {seminarplaner} kg ON kg.id = cm.instance
              WHERE cm.module = :moduleid
                AND kg.defaultmethodsetid = :methodsetid",
            ['moduleid' => $moduleid, 'methodsetid' => $methodsetid]
        );

        foreach ($cms as $cm) {
            $cmid = (int)$cm->cmid;
            if ($cmid <= 0 || !empty($linkedcmids[$cmid])) {
                continue;
            }
            $this->upsert_activity_set_link($cmid, $methodsetid,
                $fallbackoldversion > 0 ? $fallbackoldversion : $newversionid, $actorid, true);
        }
    }

    /**
     * Resolve users that currently hold method cards for an activity.
     *
     * @param int $cmid
     * @param int $fallbackuserid
     * @return int[]
     */
    private function resolve_activity_method_userids(int $cmid, int $fallbackuserid): array {
        global $DB;

        $prefname = 'mod_kgen_methods_' . $cmid;
        $userids = $DB->get_fieldset_select('user_preferences', 'userid', 'name = ?', [$prefname]);
        $clean = [];
        foreach ((array)$userids as $userid) {
            $userid = (int)$userid;
            if ($userid > 0) {
                $clean[$userid] = $userid;
            }
        }
        if (!$clean && $fallbackuserid > 0) {
            $clean[$fallbackuserid] = $fallbackuserid;
        }
        return array_values($clean);
    }

    /**
     * Merge methods with local-protection behavior.
     *
     * @param array $existing
     * @param int $methodsetid
     * @param array $oldsetmethods
     * @param array $newsetmethods
     * @param int $newversionid
     * @return array
     */
    private function merge_methods_for_sync(array $existing, int $methodsetid, array $oldsetmethods, array $newsetmethods,
        int $newversionid): array {
        $updated = [];
        $usednew = [];

        foreach ($existing as $method) {
            if (!is_array($method)) {
                continue;
            }

            $syncmeta = isset($method['_kgsync']) && is_array($method['_kgsync']) ? $method['_kgsync'] : [];
            $linkedsetid = (int)($syncmeta['setid'] ?? 0);
            $titlekey = $this->normalize_title((string)($method['titel'] ?? ''));
            $islinkedmethod = $linkedsetid === $methodsetid && $titlekey !== '' && isset($oldsetmethods[$titlekey]);
            if (!$islinkedmethod) {
                $updated[] = $method;
                continue;
            }

            $isfrozen = !empty($syncmeta['frozen']);
            $sourcehashes = isset($syncmeta['sourcehashes']) && is_array($syncmeta['sourcehashes']) ? $syncmeta['sourcehashes'] : [];
            $haslocalchanges = $this->has_local_changes($method, $sourcehashes);

            if (!isset($newsetmethods[$titlekey])) {
                if ($isfrozen || $haslocalchanges) {
                    $method['_kgsync']['pendingversionid'] = $newversionid;
                    $updated[] = $method;
                }
                continue;
            }

            $incoming = $newsetmethods[$titlekey];
            $merged = $isfrozen ? $method : $this->merge_single_method($method, $incoming, $sourcehashes);
            $mergedsync = isset($merged['_kgsync']) && is_array($merged['_kgsync']) ? $merged['_kgsync'] : [];
            $mergedsync['setid'] = $methodsetid;
            $mergedsync['sourcemethodid'] = (int)($incoming['_kgsync']['sourcemethodid'] ?? 0);
            $mergedsync['frozen'] = $isfrozen ? 1 : 0;

            $remaininglocalchanges = $isfrozen ? true : $this->has_local_changes($merged, $mergedsync['sourcehashes'] ?? []);
            if ($remaininglocalchanges) {
                $mergedsync['pendingversionid'] = $newversionid;
            } else {
                $mergedsync['sourceversionid'] = $newversionid;
                $mergedsync['pendingversionid'] = 0;
            }

            $merged['_kgsync'] = $mergedsync;
            $updated[] = $merged;
            $usednew[$titlekey] = true;
        }

        $updatedtitles = [];
        foreach ($updated as $method) {
            $titlekey = $this->normalize_title((string)($method['titel'] ?? ''));
            if ($titlekey !== '') {
                $updatedtitles[$titlekey] = true;
            }
        }

        foreach ($newsetmethods as $titlekey => $method) {
            if (!empty($usednew[$titlekey]) || !empty($updatedtitles[$titlekey])) {
                continue;
            }
            $updated[] = $method;
        }

        return $updated;
    }

    /**
     * Merge one existing method with one incoming source method.
     *
     * @param array $existing
     * @param array $incoming
     * @param array $sourcehashes
     * @return array
     */
    private function merge_single_method(array $existing, array $incoming, array $sourcehashes): array {
        $merged = $existing;
        $newhashes = isset($incoming['_kgsync']['sourcehashes']) && is_array($incoming['_kgsync']['sourcehashes'])
            ? $incoming['_kgsync']['sourcehashes']
            : [];

        foreach (self::TRACKED_FIELDS as $field) {
            $currenthash = $this->value_hash($existing[$field] ?? '');
            $oldsourcehash = (string)($sourcehashes[$field] ?? '');
            $haslocalchange = $oldsourcehash !== '' && $currenthash !== $oldsourcehash;
            if ($haslocalchange) {
                continue;
            }
            $merged[$field] = $incoming[$field] ?? '';
        }

        $mergedsync = isset($merged['_kgsync']) && is_array($merged['_kgsync']) ? $merged['_kgsync'] : [];
        $mergedsync['sourcehashes'] = $newhashes;
        $merged['_kgsync'] = $mergedsync;

        return $merged;
    }

    /**
     * Checks whether method differs from last source-hash baseline.
     *
     * @param array $method
     * @param array $sourcehashes
     * @return bool
     */
    private function has_local_changes(array $method, array $sourcehashes): bool {
        foreach (self::TRACKED_FIELDS as $field) {
            $oldsourcehash = (string)($sourcehashes[$field] ?? '');
            if ($oldsourcehash === '') {
                continue;
            }
            if ($this->value_hash($method[$field] ?? '') !== $oldsourcehash) {
                return true;
            }
        }
        return false;
    }

    /**
     * Load global method rows (with attachments) keyed by normalized title.
     *
     * @param int $methodsetid
     * @param int $versionid
     * @return array<string, array<string,mixed>>
     */
    private function load_set_methods_by_title(int $methodsetid, int $versionid): array {
        global $DB;

        $rows = $DB->get_records('local_kgen_method', [
            'methodsetid' => $methodsetid,
            'methodsetversionid' => $versionid,
        ]);
        if (!$rows) {
            return [];
        }

        $attachmentsbymethod = $this->load_global_method_material_attachments(array_map(static function($row) {
            return (int)$row->id;
        }, array_values($rows)));

        $out = [];
        foreach ($rows as $row) {
            $mapped = $this->map_global_method_record($row, $methodsetid, $versionid);
            $mapped['materialien'] = $attachmentsbymethod[(int)$row->id] ?? [];
            $mapped['_kgsync']['sourcehashes'] = $this->build_source_hashes($mapped);
            $titlekey = $this->normalize_title((string)($mapped['titel'] ?? ''));
            if ($titlekey === '') {
                continue;
            }
            $out[$titlekey] = $mapped;
        }
        return $out;
    }

    /**
     * Map global method db row to activity method card payload.
     *
     * @param \stdClass $row
     * @param int $setid
     * @param int $versionid
     * @return array<string,mixed>
     */
    private function map_global_method_record(\stdClass $row, int $setid, int $versionid): array {
        return [
            'id' => 'global-' . (int)$row->id . '-' . time(),
            'titel' => (string)($row->title ?? ''),
            'seminarphase' => $this->split_multi_text($row->seminarphase ?? ''),
            'zeitbedarf' => trim((string)($row->zeitbedarf ?? '')),
            'gruppengroesse' => trim((string)($row->gruppengroesse ?? '')),
            'kurzbeschreibung' => trim((string)($row->kurzbeschreibung ?? '')),
            'autor' => trim((string)($row->autor_kontakt ?? '')),
            'lernziele' => trim((string)($row->lernziele ?? '')),
            'komplexitaet' => trim((string)($row->komplexitaetsgrad ?? '')),
            'vorbereitung' => trim((string)($row->vorbereitung ?? '')),
            'raum' => $this->split_multi_text($row->raumanforderungen ?? ''),
            'sozialform' => $this->split_multi_text($row->sozialform ?? ''),
            'risiken' => trim((string)($row->risiken_tipps ?? '')),
            'debrief' => trim((string)($row->debrief ?? '')),
            'materialien' => [],
            'h5p' => [],
            'materialtechnik' => trim((string)($row->material_technik ?? '')),
            'ablauf' => trim((string)($row->ablauf ?? '')),
            'tags' => trim((string)($row->tags ?? '')),
            'kognitive' => $this->split_multi_text($row->kognitive_dimension ?? ''),
            '_kgsync' => [
                'setid' => $setid,
                'sourceversionid' => $versionid,
                'sourcemethodid' => (int)$row->id,
                'frozen' => 0,
                'pendingversionid' => 0,
                'sourcehashes' => [],
            ],
        ];
    }

    /**
     * Build field hashes from method values.
     *
     * @param array $method
     * @return array<string,string>
     */
    private function build_source_hashes(array $method): array {
        $hashes = [];
        foreach (self::TRACKED_FIELDS as $field) {
            $hashes[$field] = $this->value_hash($method[$field] ?? '');
        }
        return $hashes;
    }

    /**
     * Build stable hash for arbitrary method field value.
     *
     * @param mixed $value
     * @return string
     */
    private function value_hash($value): string {
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
     * Split multi-value string into trimmed parts.
     *
     * @param string|null $value
     * @return string[]
     */
    private function split_multi_text(?string $value): array {
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

    /**
     * Normalize title key.
     *
     * @param string $title
     * @return string
     */
    private function normalize_title(string $title): string {
        return \core_text::strtolower(trim($title));
    }

    /**
     * Load material attachments for global methods from local plugin file storage.
     *
     * @param int[] $methodids
     * @return array<int, array<int, array<string,mixed>>>
     */
    private function load_global_method_material_attachments(array $methodids): array {
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
}
