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

namespace mod_seminarplaner\local\service;

/**
 * Shared cleanup of activity-scoped plugin records.
 *
 * @package    mod_seminarplaner
 * @copyright  2026 Guido Brombach <gibro@posteo.de>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
final class activity_data_service {
    /**
     * Remove the records common to activity deletion and full-context privacy deletion.
     *
     * @param int $cmid Course module ID.
     */
    public static function delete_records(int $cmid): void {
        global $DB;

        $transaction = $DB->start_delegated_transaction();
        $gridids = $DB->get_fieldset_select('kgen_grid', 'id', 'cmid = ?', [$cmid]);
        if ($gridids) {
            [$insql, $params] = $DB->get_in_or_equal($gridids);
            foreach (['kgen_grid_user_state', 'kgen_grid_lock', 'kgen_grid_presence'] as $table) {
                $DB->delete_records_select($table, "gridid $insql", $params);
            }
        }

        // These records belong to the course module, even if it has no remaining grids.
        foreach ([
            'kgen_method_filemap',
            'kgen_import_export_log',
            'kgen_activity_setlink',
            'kgen_activity_methodovr',
            'kgen_planning_state',
            'kgen_roterfaden_state',
            'kgen_grid',
        ] as $table) {
            $DB->delete_records($table, ['cmid' => $cmid]);
        }
        $transaction->allow_commit();
    }
}
