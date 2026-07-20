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
 * Provider.
 *
 * @package    mod_seminarplaner
 * @copyright  2026 Guido Brombach <gibro@posteo.de>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace mod_seminarplaner\privacy;

use context;
use context_module;
use core_privacy\local\metadata\collection;
use core_privacy\local\request\approved_contextlist;
use core_privacy\local\request\approved_userlist;
use core_privacy\local\request\contextlist;
use core_privacy\local\request\plugin\provider as request_provider;
use core_privacy\local\request\core_userlist_provider;
use core_privacy\local\request\userlist;
use core_privacy\local\request\writer;

/**
 * Privacy provider implementation for mod_seminarplaner.
 */
final class provider implements \core_privacy\local\metadata\provider, core_userlist_provider, request_provider {
    /**
     * Meldet, welche Daten dieses Plugin zu einer Person speichert.
     *
     * @param collection $items Sammlung, in die die Metadaten eingetragen werden.
     * @return collection Die um die Tabellen und Subsystem-Verweise ergaenzte Sammlung.
     */
    public static function get_metadata(collection $items): collection {
        $items->add_database_table('kgen_grid_user_state', [
            'gridid' => 'privacy:metadata:kgen_grid_user_state:gridid',
            'userid' => 'privacy:metadata:kgen_grid_user_state:userid',
            'statejson' => 'privacy:metadata:kgen_grid_user_state:statejson',
            'versionhash' => 'privacy:metadata:kgen_grid_user_state:versionhash',
            'timecreated' => 'privacy:metadata:kgen_grid_user_state:timecreated',
            'timemodified' => 'privacy:metadata:kgen_grid_user_state:timemodified',
        ], 'privacy:metadata:kgen_grid_user_state');

        $items->add_database_table('kgen_grid_lock', [
            'gridid' => 'privacy:metadata:kgen_grid_lock:gridid',
            'userid' => 'privacy:metadata:kgen_grid_lock:userid',
            'locktoken' => 'privacy:metadata:kgen_grid_lock:locktoken',
            'expiresat' => 'privacy:metadata:kgen_grid_lock:expiresat',
        ], 'privacy:metadata:kgen_grid_lock');

        $items->add_database_table('kgen_method_filemap', [
            'cmid' => 'privacy:metadata:kgen_method_filemap:cmid',
            'userid' => 'privacy:metadata:kgen_method_filemap:userid',
            'methoduid' => 'privacy:metadata:kgen_method_filemap:methoduid',
            'itemid' => 'privacy:metadata:kgen_method_filemap:itemid',
        ], 'privacy:metadata:kgen_method_filemap');

        $items->add_database_table('kgen_import_export_log', [
            'cmid' => 'privacy:metadata:kgen_import_export_log:cmid',
            'direction' => 'privacy:metadata:kgen_import_export_log:direction',
            'status' => 'privacy:metadata:kgen_import_export_log:status',
            'payloadmeta' => 'privacy:metadata:kgen_import_export_log:payloadmeta',
            'message' => 'privacy:metadata:kgen_import_export_log:message',
            'actorid' => 'privacy:metadata:kgen_import_export_log:actorid',
            'timecreated' => 'privacy:metadata:kgen_import_export_log:timecreated',
        ], 'privacy:metadata:kgen_import_export_log');

        $items->add_database_table('kgen_grid', [
            'cmid' => 'privacy:metadata:kgen_grid:cmid',
            'createdby' => 'privacy:metadata:kgen_grid:createdby',
            'modifiedby' => 'privacy:metadata:kgen_grid:modifiedby',
        ], 'privacy:metadata:kgen_grid');

        $items->add_database_table('kgen_planning_state', [
            'cmid' => 'privacy:metadata:kgen_planning_state:cmid',
            'createdby' => 'privacy:metadata:kgen_planning_state:createdby',
            'modifiedby' => 'privacy:metadata:kgen_planning_state:modifiedby',
        ], 'privacy:metadata:kgen_planning_state');

        $items->add_database_table('kgen_roterfaden_state', [
            'cmid' => 'privacy:metadata:kgen_roterfaden_state:cmid',
            'publishedby' => 'privacy:metadata:kgen_roterfaden_state:publishedby',
        ], 'privacy:metadata:kgen_roterfaden_state');

        $items->add_database_table('kgen_activity_setlink', [
            'cmid' => 'privacy:metadata:kgen_activity_setlink:cmid',
            'createdby' => 'privacy:metadata:kgen_activity_setlink:createdby',
        ], 'privacy:metadata:kgen_activity_setlink');

        $items->add_database_table('kgen_activity_methodovr', [
            'cmid' => 'privacy:metadata:kgen_activity_methodovr:cmid',
            'createdby' => 'privacy:metadata:kgen_activity_methodovr:createdby',
            'modifiedby' => 'privacy:metadata:kgen_activity_methodovr:modifiedby',
        ], 'privacy:metadata:kgen_activity_methodovr');

        $items->add_subsystem_link('core_files', [], 'privacy:metadata:core_files');
        return $items;
    }

    /**
     * Sammelt alle Modul-Kontexte, in denen zu dieser Person Daten liegen.
     *
     * @param int $userid Id der Person, deren Kontexte gesucht werden.
     * @return contextlist Liste der Kontexte mit Zustaenden, Dateizuordnungen, Protokollen oder Urheberschaft.
     */
    public static function get_contexts_for_userid(int $userid): contextlist {
        global $DB;

        $contextlist = new contextlist();
        $contextids = [];

        $gridids = $DB->get_fieldset_select('kgen_grid_user_state', 'DISTINCT gridid', 'userid = ?', [$userid]);
        $gridids = array_map('intval', $gridids);
        if (!empty($gridids)) {
            [$insql, $params] = $DB->get_in_or_equal($gridids, SQL_PARAMS_QM);
            $cmids = $DB->get_fieldset_select('kgen_grid', 'DISTINCT cmid', "id {$insql}", $params);
            $contextids = array_merge($contextids, self::contextids_from_cmids($cmids));
        }

        $cmids = $DB->get_fieldset_select('kgen_method_filemap', 'DISTINCT cmid', 'userid = ?', [$userid]);
        $contextids = array_merge($contextids, self::contextids_from_cmids($cmids));

        $cmids = $DB->get_fieldset_select('kgen_import_export_log', 'DISTINCT cmid', 'actorid = ?', [$userid]);
        $contextids = array_merge($contextids, self::contextids_from_cmids($cmids));

        $authortables = ['kgen_grid', 'kgen_planning_state', 'kgen_roterfaden_state',
            'kgen_activity_setlink', 'kgen_activity_methodovr'];
        foreach ($authortables as $table) {
            $field = 'createdby';
            if ($table === 'kgen_roterfaden_state') {
                $field = 'publishedby';
            }
            $cmids = $DB->get_fieldset_select($table, 'DISTINCT cmid', "{$field} = ?", [$userid]);
            $contextids = array_merge($contextids, self::contextids_from_cmids($cmids));
            if (in_array($table, ['kgen_grid', 'kgen_planning_state', 'kgen_activity_methodovr'], true)) {
                $cmids = $DB->get_fieldset_select($table, 'DISTINCT cmid', 'modifiedby = ?', [$userid]);
                $contextids = array_merge($contextids, self::contextids_from_cmids($cmids));
            }
        }

        $contextids = array_values(array_unique(array_map('intval', $contextids)));
        if (!empty($contextids)) {
            // Contextlist::add_contextids() gibt es in Moodle nicht - der
            // Aufruf endete in einem Fatal Error, sobald eine DSGVO-Anfrage
            // diesen Provider erreichte. Oeffentlich ist nur add_from_sql();
            // set_contextids() der Basisklasse ist protected.
            [$insql, $params] = $DB->get_in_or_equal($contextids, SQL_PARAMS_NAMED);
            $contextlist->add_from_sql("SELECT id FROM {context} WHERE id {$insql}", $params);
        }
        return $contextlist;
    }

    /**
     * Sammelt alle Personen, zu denen in diesem Modul-Kontext Daten liegen.
     *
     * @param userlist $userlist Nutzerliste des Kontexts, die ergaenzt wird.
     * @return void
     */
    public static function get_users_in_context(userlist $userlist): void {
        global $DB;

        $context = $userlist->get_context();
        if (!$context instanceof context_module) {
            return;
        }
        $cmid = (int)$context->instanceid;
        $gridids = $DB->get_fieldset_select('kgen_grid', 'id', 'cmid = ?', [$cmid]);
        $gridids = array_map('intval', $gridids);

        if (!empty($gridids)) {
            [$insql, $params] = $DB->get_in_or_equal($gridids, SQL_PARAMS_QM);
            $userlist->add_from_sql('userid', "SELECT userid FROM {kgen_grid_user_state} WHERE gridid {$insql}", $params);
            $userlist->add_from_sql('userid', "SELECT userid FROM {kgen_grid_lock} WHERE gridid {$insql}", $params);
        }

        $userlist->add_from_sql('userid', "SELECT userid FROM {kgen_method_filemap} WHERE cmid = ?", [$cmid]);
        $userlist->add_from_sql('actorid', "SELECT actorid FROM {kgen_import_export_log} WHERE cmid = ?", [$cmid]);
        $userlist->add_from_sql('createdby', "SELECT createdby FROM {kgen_grid} WHERE cmid = ?", [$cmid]);
        $userlist->add_from_sql('modifiedby', "SELECT modifiedby FROM {kgen_grid} WHERE cmid = ?", [$cmid]);
        $userlist->add_from_sql('createdby', "SELECT createdby FROM {kgen_planning_state} WHERE cmid = ?", [$cmid]);
        $userlist->add_from_sql('modifiedby', "SELECT modifiedby FROM {kgen_planning_state} WHERE cmid = ?", [$cmid]);
        $userlist->add_from_sql('publishedby', "SELECT publishedby FROM {kgen_roterfaden_state} WHERE cmid = ?", [$cmid]);
        $userlist->add_from_sql('createdby', "SELECT createdby FROM {kgen_activity_setlink} WHERE cmid = ?", [$cmid]);
        $userlist->add_from_sql('createdby', "SELECT createdby FROM {kgen_activity_methodovr} WHERE cmid = ?", [$cmid]);
        $userlist->add_from_sql('modifiedby', "SELECT modifiedby FROM {kgen_activity_methodovr} WHERE cmid = ?", [$cmid]);
    }

    /**
     * Exportiert alle Daten einer Person aus den freigegebenen Kontexten.
     *
     * @param approved_contextlist $contextlist Freigegebene Kontexte samt betroffener Person.
     * @return void
     */
    public static function export_user_data(approved_contextlist $contextlist): void {
        global $DB;

        $userid = $contextlist->get_user()->id;
        foreach ($contextlist->get_contexts() as $context) {
            if (!$context instanceof context_module) {
                continue;
            }
            $cmid = (int)$context->instanceid;
            $gridids = $DB->get_fieldset_select('kgen_grid', 'id', 'cmid = ?', [$cmid]);
            $gridids = array_map('intval', $gridids);

            if (!empty($gridids)) {
                [$insql, $params] = $DB->get_in_or_equal($gridids, SQL_PARAMS_QM);
                $state = $DB->get_records_select(
                    'kgen_grid_user_state',
                    "gridid {$insql} AND userid = ?",
                    array_merge($params, [$userid])
                );
                if (!empty($state)) {
                    // Export_data() verlangt ein \stdClass, kein Array (siehe
                    // moodle_content_writer::export_data). Alle vier Aufrufe in
                    // dieser Methode uebergaben frueher direkt das Ergebnis von
                    // array_values() und liefen damit in einen TypeError - der
                    // Export war also nie funktionsfaehig.
                    writer::with_context($context)->export_data(
                        ['grid_user_state'],
                        (object)['states' => array_values($state)]
                    );
                }
                $locks = $DB->get_records_select(
                    'kgen_grid_lock',
                    "gridid {$insql} AND userid = ?",
                    array_merge($params, [$userid])
                );
                if (!empty($locks)) {
                    writer::with_context($context)->export_data(
                        ['grid_locks'],
                        (object)['locks' => array_values($locks)]
                    );
                }
            }

            $filemaps = $DB->get_records('kgen_method_filemap', ['cmid' => $cmid, 'userid' => $userid]);
            if (!empty($filemaps)) {
                writer::with_context($context)->export_data(
                    ['method_filemap'],
                    (object)['maps' => array_values($filemaps)]
                );

                // Zu den oben exportierten Zuordnungen auch die Dateien selbst.
                // Frueher stand hier helper::export_context_files($context,
                // $userid, $component, $filearea) - diese Signatur gibt es in
                // Moodle nicht (der Helfer nimmt nur Kontext + User-Objekt und
                // exportiert ausschliesslich die intro-Dateien). Der Aufruf
                // brach den ganzen Export mit einem TypeError ab.
                //
                // Exportiert wird bewusst nur, was ueber kgen_method_filemap an
                // DIESEN Nutzer gebunden ist (cmid + userid, siehe get_metadata)
                // - nicht der gesamte Dateibereich der Aktivitaet, in dem auch
                // geteilte Materialien anderer liegen.
                foreach ($filemaps as $map) {
                    $itemid = (int)$map->itemid;
                    $uid = (string)$map->methoduid;
                    writer::with_context($context)
                        ->export_area_files(['method_materialien', $uid], 'mod_seminarplaner', 'method_materialien', $itemid);
                    writer::with_context($context)
                        ->export_area_files(['method_h5p', $uid], 'mod_seminarplaner', 'method_h5p', $itemid);
                }
            }

            $logs = $DB->get_records('kgen_import_export_log', ['cmid' => $cmid, 'actorid' => $userid]);
            if (!empty($logs)) {
                writer::with_context($context)->export_data(
                    ['import_export_log'],
                    (object)['entries' => array_values($logs)]
                );
            }

            // Urheberschaft: was der Nutzer angelegt oder zuletzt geaendert hat.
            //
            // Ohne diesen Block widersprach sich der Provider: get_contexts_for_userid
            // meldet einen Kontext bereits, wenn dort ein Plan von diesem Nutzer
            // stammt, und delete_data_for_user anonymisiert genau diese Felder —
            // die Auskunft lieferte dazu aber nichts. Der Nutzer bekam also eine
            // leere Auskunft zu einem Kurs, zu dem das Plugin sehr wohl etwas
            // ueber ihn weiss. Seit der Zustand geteilt unter
            // grid_service::SHARED_STATE_USERID (0) liegt statt pro Nutzer, ist
            // die Urheberschaft fuer die meisten sogar das EINZIGE, was es gibt.
            //
            // Exportiert wird nur, was get_metadata deklariert und was die
            // Loeschung anfasst — dieselben Tabellen, dieselben Felder.
            foreach (self::authorship_fields() as $table => $fields) {
                [$where, $params] = self::authorship_where($table, $fields, $cmid, (int)$userid);
                $records = $DB->get_records_select($table, $where, $params);
                if (!empty($records)) {
                    writer::with_context($context)->export_data(
                        [$table],
                        (object)['records' => array_values($records)]
                    );
                }
            }
        }
    }

    /**
     * Tables and fields that record who authored something, per context.
     *
     * Deckungsgleich mit dem, was get_contexts_for_userid abfragt und
     * delete_user_from_context anonymisiert bzw. loescht.
     *
     * @return array<string, string[]> Tabelle => Urheber-Felder.
     */
    private static function authorship_fields(): array {
        return [
            'kgen_grid' => ['createdby', 'modifiedby'],
            'kgen_planning_state' => ['createdby', 'modifiedby'],
            'kgen_roterfaden_state' => ['publishedby'],
            'kgen_activity_setlink' => ['createdby'],
            'kgen_activity_methodovr' => ['createdby', 'modifiedby'],
        ];
    }

    /**
     * Build the "this user authored it in this activity" condition.
     *
     * @param string $table Table name (unused, kept for call-site clarity).
     * @param string[] $fields Author fields to match.
     * @param int $cmid Course module id.
     * @param int $userid User id.
     * @return array [where, params]
     */
    private static function authorship_where(string $table, array $fields, int $cmid, int $userid): array {
        $clauses = [];
        $params = [$cmid];
        foreach ($fields as $field) {
            $clauses[] = "{$field} = ?";
            $params[] = $userid;
        }
        return ['cmid = ? AND (' . implode(' OR ', $clauses) . ')', $params];
    }

    /**
     * Loescht saemtliche Plugin-Daten eines Modul-Kontexts fuer alle Personen.
     *
     * @param context $context Kontext, dessen Daten vollstaendig geloescht werden.
     * @return void
     */
    public static function delete_data_for_all_users_in_context(context $context): void {
        global $DB;

        if (!$context instanceof context_module) {
            return;
        }
        $cmid = (int)$context->instanceid;
        $gridids = $DB->get_fieldset_select('kgen_grid', 'id', 'cmid = ?', [$cmid]);
        $gridids = array_map('intval', $gridids);

        if (!empty($gridids)) {
            [$insql, $params] = $DB->get_in_or_equal($gridids, SQL_PARAMS_QM);
            $DB->delete_records_select('kgen_grid_user_state', "gridid {$insql}", $params);
            $DB->delete_records_select('kgen_grid_lock', "gridid {$insql}", $params);
        }

        $DB->delete_records('kgen_method_filemap', ['cmid' => $cmid]);
        $DB->delete_records('kgen_import_export_log', ['cmid' => $cmid]);
        $DB->delete_records('kgen_activity_setlink', ['cmid' => $cmid]);
        $DB->delete_records('kgen_activity_methodovr', ['cmid' => $cmid]);
        $DB->delete_records('kgen_planning_state', ['cmid' => $cmid]);
        $DB->delete_records('kgen_roterfaden_state', ['cmid' => $cmid]);

        // Shared grid records are user-attributed and can be removed in full context deletion.
        $DB->delete_records('kgen_grid', ['cmid' => $cmid]);
    }

    /**
     * Loescht oder anonymisiert die Daten einer Person in den freigegebenen Kontexten.
     *
     * @param approved_contextlist $contextlist Freigegebene Kontexte samt betroffener Person.
     * @return void
     */
    public static function delete_data_for_user(approved_contextlist $contextlist): void {
        $userid = (int)$contextlist->get_user()->id;
        foreach ($contextlist->get_contexts() as $context) {
            self::delete_user_from_context($context, [$userid]);
        }
    }

    /**
     * Loescht oder anonymisiert die Daten mehrerer freigegebener Personen in einem Kontext.
     *
     * @param approved_userlist $userlist Freigegebene Personen samt Kontext.
     * @return void
     */
    public static function delete_data_for_users(approved_userlist $userlist): void {
        $context = $userlist->get_context();
        $userids = $userlist->get_userids();
        self::delete_user_from_context($context, $userids);
    }

    /**
     * Delete or anonymise user data in a specific module context.
     *
     * @param context $context The context to act on.
     * @param array $userids User ids.
     * @return void
     */
    private static function delete_user_from_context(context $context, array $userids): void {
        global $DB;

        if (!$context instanceof context_module || empty($userids)) {
            return;
        }
        $userids = array_values(array_unique(array_map('intval', $userids)));
        [$usersql, $userparams] = $DB->get_in_or_equal($userids, SQL_PARAMS_QM);
        $cmid = (int)$context->instanceid;

        $gridids = $DB->get_fieldset_select('kgen_grid', 'id', 'cmid = ?', [$cmid]);
        $gridids = array_map('intval', $gridids);
        if (!empty($gridids)) {
            [$gridsql, $gridparams] = $DB->get_in_or_equal($gridids, SQL_PARAMS_QM);
            $DB->delete_records_select(
                'kgen_grid_user_state',
                "gridid {$gridsql} AND userid {$usersql}",
                array_merge($gridparams, $userparams)
            );
            $DB->delete_records_select(
                'kgen_grid_lock',
                "gridid {$gridsql} AND userid {$usersql}",
                array_merge($gridparams, $userparams)
            );
        }

        $DB->delete_records_select('kgen_method_filemap', "cmid = ? AND userid {$usersql}", array_merge([$cmid], $userparams));
        $DB->delete_records_select('kgen_import_export_log', "cmid = ? AND actorid {$usersql}", array_merge([$cmid], $userparams));
        $DB->delete_records_select('kgen_activity_setlink', "cmid = ? AND createdby {$usersql}", array_merge([$cmid], $userparams));

        // Keep shared content, but anonymise author fields.
        $DB->execute(
            "UPDATE {kgen_grid} SET createdby = 0 WHERE cmid = ? AND createdby {$usersql}",
            array_merge([$cmid], $userparams)
        );
        $DB->execute(
            "UPDATE {kgen_grid} SET modifiedby = 0 WHERE cmid = ? AND modifiedby {$usersql}",
            array_merge([$cmid], $userparams)
        );
        $DB->execute(
            "UPDATE {kgen_planning_state} SET createdby = 0 WHERE cmid = ? AND createdby {$usersql}",
            array_merge([$cmid], $userparams)
        );
        $DB->execute(
            "UPDATE {kgen_planning_state} SET modifiedby = 0 WHERE cmid = ? AND modifiedby {$usersql}",
            array_merge([$cmid], $userparams)
        );
        $DB->execute(
            "UPDATE {kgen_roterfaden_state} SET publishedby = 0 WHERE cmid = ? AND publishedby {$usersql}",
            array_merge([$cmid], $userparams)
        );
        $DB->execute(
            "UPDATE {kgen_activity_methodovr} SET createdby = 0 WHERE cmid = ? AND createdby {$usersql}",
            array_merge([$cmid], $userparams)
        );
        $DB->execute(
            "UPDATE {kgen_activity_methodovr} SET modifiedby = 0 WHERE cmid = ? AND modifiedby {$usersql}",
            array_merge([$cmid], $userparams)
        );
    }

    /**
     * Resolve module context ids from course module ids.
     *
     * @param array $cmids Course module ids.
     * @return array
     */
    private static function contextids_from_cmids(array $cmids): array {
        global $DB;

        if (empty($cmids)) {
            return [];
        }
        $cmids = array_values(array_unique(array_map('intval', $cmids)));
        [$insql, $params] = $DB->get_in_or_equal($cmids, SQL_PARAMS_QM);
        return $DB->get_fieldset_select(
            'context',
            'id',
            "contextlevel = ? AND instanceid {$insql}",
            array_merge([CONTEXT_MODULE], $params)
        );
    }
}
