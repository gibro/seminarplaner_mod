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
 * Backup and restore support: restore seminarplaner stepslib.
 *
 * @package    mod_seminarplaner
 * @copyright  2026 Guido Brombach <gibro@posteo.de>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

/**
 * Restore structure step for mod_seminarplaner.
 */
class restore_seminarplaner_activity_structure_step extends restore_activity_structure_step {
    /** @var int|null Cached new course module id for the restored activity. */
    private $restoredcmid = null;
    /** @var array<int, bool> Tracks already mapped file itemids. */
    private $mappedmethodfileitemids = [];

    /**
     * Define restore paths.
     *
     * @return array
     */
    protected function define_structure(): array {
        $paths = [];
        $paths[] = new restore_path_element('seminarplaner', '/activity/seminarplaner');
        $paths[] = new restore_path_element('methodcards_state', '/activity/seminarplaner/methodcards_state');
        $paths[] = new restore_path_element('activity_setlink', '/activity/seminarplaner/activity_setlinks/activity_setlink');
        $paths[] = new restore_path_element('activity_methodovr', '/activity/seminarplaner/activity_methodovrs/activity_methodovr');
        $paths[] = new restore_path_element('planning_state', '/activity/seminarplaner/planning_states/planning_state');
        $paths[] = new restore_path_element('grid', '/activity/seminarplaner/grids/grid');
        $paths[] = new restore_path_element('grid_user_state', '/activity/seminarplaner/grids/grid/grid_user_states/grid_user_state');
        $paths[] = new restore_path_element('roterfaden_state', '/activity/seminarplaner/roterfaden_states/roterfaden_state');
        $paths[] = new restore_path_element('method_filemap', '/activity/seminarplaner/method_filemaps/method_filemap');
        return $this->prepare_activity_structure($paths);
    }

    /**
     * Process main activity data.
     *
     * @param array $data Parsed data.
     * @return void
     */
    protected function process_seminarplaner(array $data): void {
        global $DB;

        $data = (object)$data;
        $data->course = $this->get_courseid();

        $newitemid = $DB->insert_record('seminarplaner', $data);
        $this->apply_activity_instance($newitemid);
    }

    /**
     * Process shared seminar units JSON payload.
     *
     * @param array $data Parsed data.
     * @return void
     */
    protected function process_methodcards_state(array $data): void {
        $methodsjson = (string)($data['methodsjson'] ?? '');
        set_config('methods_cmid_' . $this->resolve_restored_cmid(), $methodsjson, 'mod_seminarplaner');
    }

    /**
     * Process activity methodset link.
     *
     * @param array $data Parsed data.
     * @return void
     */
    protected function process_activity_setlink(array $data): void {
        global $DB;

        $data = (object)$data;
        unset($data->id);
        $data->cmid = $this->resolve_restored_cmid();
        $data->createdby = $this->map_userid_or_zero((int)($data->createdby ?? 0));
        $DB->insert_record('kgen_activity_setlink', $data);
    }

    /**
     * Process activity local method override.
     *
     * @param array $data Parsed data.
     * @return void
     */
    protected function process_activity_methodovr(array $data): void {
        global $DB;

        $data = (object)$data;
        unset($data->id);
        $data->cmid = $this->resolve_restored_cmid();
        $data->createdby = $this->map_userid_or_zero((int)($data->createdby ?? 0));
        $data->modifiedby = $this->map_userid_or_zero((int)($data->modifiedby ?? 0));
        $DB->insert_record('kgen_activity_methodovr', $data);
    }

    /**
     * Process planning mode state.
     *
     * @param array $data Parsed data.
     * @return void
     */
    protected function process_planning_state(array $data): void {
        global $DB;

        $data = (object)$data;
        unset($data->id);
        $data->cmid = $this->resolve_restored_cmid();
        $data->createdby = $this->map_userid_or_zero((int)($data->createdby ?? 0));
        $data->modifiedby = $this->map_userid_or_zero((int)($data->modifiedby ?? 0));
        $DB->insert_record('kgen_planning_state', $data);
    }

    /**
     * Process one seminar plan definition.
     *
     * @param array $data Parsed data.
     * @return void
     */
    protected function process_grid(array $data): void {
        global $DB;

        $data = (object)$data;
        $oldid = (int)$data->id;
        unset($data->id);
        $data->cmid = $this->resolve_restored_cmid();
        $data->createdby = $this->map_userid_or_zero((int)($data->createdby ?? 0));
        $data->modifiedby = $this->map_userid_or_zero((int)($data->modifiedby ?? 0));

        $newid = (int)$DB->insert_record('kgen_grid', $data);
        // "grid" mapping is used by child path resolution via get_new_parentid('grid').
        $this->set_mapping('grid', $oldid, $newid);
        // Keep explicit alias for direct lookup in map_gridid_or_zero().
        $this->set_mapping('kgen_grid', $oldid, $newid);
    }

    /**
     * Process one grid state snapshot.
     *
     * @param array $data Parsed data.
     * @return void
     */
    protected function process_grid_user_state(array $data): void {
        global $DB;

        $data = (object)$data;
        unset($data->id);
        $data->gridid = (int)$this->get_new_parentid('grid');
        if ($data->gridid <= 0) {
            return;
        }

        $data->userid = $this->map_userid_or_zero((int)($data->userid ?? 0));

        $existing = $DB->get_record('kgen_grid_user_state', ['gridid' => $data->gridid, 'userid' => $data->userid], 'id');
        if ($existing) {
            $data->id = (int)$existing->id;
            $DB->update_record('kgen_grid_user_state', $data);
            return;
        }
        $DB->insert_record('kgen_grid_user_state', $data);
    }

    /**
     * Process published "Roter Faden" snapshot.
     *
     * @param array $data Parsed data.
     * @return void
     */
    protected function process_roterfaden_state(array $data): void {
        global $DB;

        $data = (object)$data;
        unset($data->id);
        $data->cmid = $this->resolve_restored_cmid();
        $data->gridid = $this->map_gridid_or_zero((int)($data->gridid ?? 0));
        $data->publishedby = $this->map_userid_or_zero((int)($data->publishedby ?? 0));
        $DB->insert_record('kgen_roterfaden_state', $data);
    }

    /**
     * Process method-to-file item mapping.
     *
     * @param array $data Parsed data.
     * @return void
     */
    protected function process_method_filemap(array $data): void {
        global $DB;

        $data = (object)$data;
        unset($data->id);
        $data->cmid = $this->resolve_restored_cmid();
        $data->userid = $this->map_userid_or_zero((int)($data->userid ?? 0));
        $data->itemid = (int)($data->itemid ?? 0);

        $existing = $DB->get_record('kgen_method_filemap', [
            'cmid' => (int)$data->cmid,
            'userid' => (int)$data->userid,
            'methoduid' => (string)$data->methoduid,
        ], 'id');
        if ($existing) {
            $data->id = (int)$existing->id;
            $DB->update_record('kgen_method_filemap', $data);
        } else {
            $DB->insert_record('kgen_method_filemap', $data);
        }

        if ($data->itemid > 0 && empty($this->mappedmethodfileitemids[$data->itemid])) {
            $this->set_mapping('seminarplaner_method_itemid', $data->itemid, $data->itemid, true);
            $this->mappedmethodfileitemids[$data->itemid] = true;
        }
    }

    /**
     * Resolve new course module id of the restored activity instance.
     *
     * @return int
     */
    private function resolve_restored_cmid(): int {
        if ($this->restoredcmid !== null) {
            return $this->restoredcmid;
        }

        $instanceid = (int)$this->get_new_parentid('seminarplaner');
        $cm = get_coursemodule_from_instance('seminarplaner', $instanceid, $this->get_courseid(), false, MUST_EXIST);
        $this->restoredcmid = (int)$cm->id;
        return $this->restoredcmid;
    }

    /**
     * Map backup user id to restored user id with safe fallback.
     *
     * @param int $backupuserid
     * @return int
     */
    private function map_userid_or_zero(int $backupuserid): int {
        if ($backupuserid <= 0) {
            return 0;
        }
        $mapped = $this->get_mappingid('user', $backupuserid);
        return $mapped ? (int)$mapped : 0;
    }

    /**
     * Map old grid id to restored grid id.
     *
     * @param int $backupgridid
     * @return int
     */
    private function map_gridid_or_zero(int $backupgridid): int {
        if ($backupgridid <= 0) {
            return 0;
        }
        $mapped = $this->get_mappingid('grid', $backupgridid);
        if (!$mapped) {
            $mapped = $this->get_mappingid('kgen_grid', $backupgridid);
        }
        return $mapped ? (int)$mapped : 0;
    }

    /**
     * Restore files.
     *
     * @return void
     */
    protected function after_execute(): void {
        $this->add_related_files('mod_seminarplaner', 'intro', null);
        // D52: Gegenstelle zur annotate_files('logo') im Backup — ohne sie
        // liegt die Datei zwar im Backup, wird aber nie zurueckgespielt.
        $this->add_related_files('mod_seminarplaner', 'logo', null);
        $this->add_related_files('mod_seminarplaner', 'method_materialien', 'seminarplaner_method_itemid');
        $this->add_related_files('mod_seminarplaner', 'method_h5p', 'seminarplaner_method_itemid');
    }
}
