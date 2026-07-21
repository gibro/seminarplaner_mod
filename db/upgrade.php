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
 * Database upgrade steps.
 *
 * @package    mod_seminarplaner
 * @copyright  2026 Guido Brombach <gibro@posteo.de>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

/**
 * Upgrade script for mod_seminarplaner.
 *
 * @param int $oldversion
 * @return bool
 */
function xmldb_seminarplaner_upgrade($oldversion) {
    global $DB;

    $dbman = $DB->get_manager();

    if ($oldversion < 2026022330) {
        $table = new xmldb_table('kgen_method_filemap');

        $table->add_field('id', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, XMLDB_SEQUENCE, null);
        $table->add_field('cmid', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
        $table->add_field('userid', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
        $table->add_field('methoduid', XMLDB_TYPE_CHAR, '255', null, XMLDB_NOTNULL, null, null);
        $table->add_field('itemid', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
        $table->add_field('timecreated', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
        $table->add_field('timemodified', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');

        $table->add_key('primary', XMLDB_KEY_PRIMARY, ['id']);

        $table->add_index('cm_user_method_uix', XMLDB_INDEX_UNIQUE, ['cmid', 'userid', 'methoduid']);
        $table->add_index('cm_user_item_uix', XMLDB_INDEX_UNIQUE, ['cmid', 'userid', 'itemid']);
        $table->add_index('cm_user_idx', XMLDB_INDEX_NOTUNIQUE, ['cmid', 'userid']);

        if (!$dbman->table_exists($table)) {
            $dbman->create_table($table);
        }

        upgrade_mod_savepoint(true, 2026022330, 'seminarplaner');
    }

    if ($oldversion < 2026022339) {
        $table = new xmldb_table('kgen_activity_setlink');

        $pendingversionid = new xmldb_field(
            'pendingversionid',
            XMLDB_TYPE_INTEGER,
            '10',
            null,
            XMLDB_NOTNULL,
            null,
            '0',
            'methodsetversionid'
        );
        if (!$dbman->field_exists($table, $pendingversionid)) {
            $dbman->add_field($table, $pendingversionid);
        }

        $autosyncenabled = new xmldb_field(
            'autosyncenabled',
            XMLDB_TYPE_INTEGER,
            '1',
            null,
            XMLDB_NOTNULL,
            null,
            '0',
            'pendingversionid'
        );
        if (!$dbman->field_exists($table, $autosyncenabled)) {
            $dbman->add_field($table, $autosyncenabled);
        }

        upgrade_mod_savepoint(true, 2026022339, 'seminarplaner');
    }

    if ($oldversion < 2026022340) {
        $table = new xmldb_table('kgen_planning_state');

        $table->add_field('id', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, XMLDB_SEQUENCE, null);
        $table->add_field('cmid', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
        $table->add_field('statejson', XMLDB_TYPE_TEXT, 'big', null, null, null, null);
        $table->add_field('versionhash', XMLDB_TYPE_CHAR, '128', null, XMLDB_NOTNULL, null, null);
        $table->add_field('timecreated', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
        $table->add_field('timemodified', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
        $table->add_field('createdby', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
        $table->add_field('modifiedby', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');

        $table->add_key('primary', XMLDB_KEY_PRIMARY, ['id']);
        $table->add_index('cmid_uix', XMLDB_INDEX_UNIQUE, ['cmid']);

        if (!$dbman->table_exists($table)) {
            $dbman->create_table($table);
        }

        upgrade_mod_savepoint(true, 2026022340, 'seminarplaner');
    }

    if ($oldversion < 2026030511) {
        $table = new xmldb_table('kgen_roterfaden_state');

        $table->add_field('id', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, XMLDB_SEQUENCE, null);
        $table->add_field('cmid', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
        $table->add_field('gridid', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
        $table->add_field('statejson', XMLDB_TYPE_TEXT, 'big', null, null, null, null);
        $table->add_field('ispublished', XMLDB_TYPE_INTEGER, '1', null, XMLDB_NOTNULL, null, '0');
        $table->add_field('publishedby', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
        $table->add_field('timecreated', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
        $table->add_field('timemodified', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');

        $table->add_key('primary', XMLDB_KEY_PRIMARY, ['id']);
        $table->add_index('cmid_uix', XMLDB_INDEX_UNIQUE, ['cmid']);
        $table->add_index('grid_idx', XMLDB_INDEX_NOTUNIQUE, ['gridid']);

        if (!$dbman->table_exists($table)) {
            $dbman->create_table($table);
        }

        upgrade_mod_savepoint(true, 2026030511, 'seminarplaner');
    }

    if ($oldversion < 2026070800) {
        // D20/D43: derive the sequence section once for every stored grid
        // state during upgrade (not lazily on first open). The legacy
        // "plan" section stays untouched as read-only overview data (D34).
        $converter = new \mod_seminarplaner\local\sequence\grid_to_sequence_converter();
        $rs = $DB->get_recordset('kgen_grid_user_state');
        foreach ($rs as $record) {
            $state = json_decode((string)$record->statejson, true);
            if (!is_array($state) || !$state) {
                continue;
            }
            if (\mod_seminarplaner\local\sequence\sequence_state::has_sequence($state)) {
                continue;
            }
            $state[\mod_seminarplaner\local\sequence\sequence_state::STATE_KEY] = $converter->convert($state);
            $json = json_encode($state, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            if ($json === false) {
                continue;
            }
            $record->statejson = $json;
            // New hash forces stale clients into the merge path instead of
            // silently overwriting the freshly added sequence section.
            $record->versionhash = sha1($json . '|sequenz-upgrade');
            $record->timemodified = time();
            $DB->update_record('kgen_grid_user_state', $record);
        }
        $rs->close();

        upgrade_mod_savepoint(true, 2026070800, 'seminarplaner');
    }

    if ($oldversion < 2026070908) {
        // Fill module master data (Unterthemen, Themenplan-Referenz D6) from
        // the planning state into the sequence section, so the sequence view
        // owns the Baustein data and the transitional Bausteine tab can go.
        $converter = new \mod_seminarplaner\local\sequence\grid_to_sequence_converter();
        $sql = "SELECT s.*, g.cmid
                  FROM {kgen_grid_user_state} s
                  JOIN {kgen_grid} g ON g.id = s.gridid
                 WHERE s.userid = 0";
        $planningcache = [];
        $rs = $DB->get_recordset_sql($sql);
        foreach ($rs as $record) {
            $state = json_decode((string)$record->statejson, true);
            if (
                !is_array($state)
                || !\mod_seminarplaner\local\sequence\sequence_state::has_sequence($state)
            ) {
                continue;
            }
            $cmid = (int)$record->cmid;
            if (!array_key_exists($cmid, $planningcache)) {
                $planningrow = $DB->get_record('kgen_planning_state', ['cmid' => $cmid]);
                $planning = $planningrow ? json_decode((string)$planningrow->statejson, true) : null;
                $planningcache[$cmid] = is_array($planning) && is_array($planning['units'] ?? null)
                    ? $planning['units'] : [];
            }
            if (!$planningcache[$cmid]) {
                continue;
            }
            $enriched = $converter->enrich_bausteine(
                $state[\mod_seminarplaner\local\sequence\sequence_state::STATE_KEY],
                $planningcache[$cmid]
            );
            if ($enriched === $state[\mod_seminarplaner\local\sequence\sequence_state::STATE_KEY]) {
                continue;
            }
            $state[\mod_seminarplaner\local\sequence\sequence_state::STATE_KEY] = $enriched;
            $json = json_encode($state, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            if ($json === false) {
                continue;
            }
            $record->statejson = $json;
            $record->versionhash = sha1($json . '|baustein-enrich');
            $record->timemodified = time();
            unset($record->cmid);
            $DB->update_record('kgen_grid_user_state', $record);
        }
        $rs->close();

        upgrade_mod_savepoint(true, 2026070908, 'seminarplaner');
    }

    if ($oldversion < 2026071400) {
        // Gruppengröße von der alten 7-Werte-Skala (1 / 2-3 / 3–5 / 6–12 /
        // 13–24 / 25+ / beliebig) auf drei Cluster umstellen und die
        // Bestandsdaten in den Method-Cards umrechnen. Die Cards liegen als
        // JSON-Array je Aktivität in config_plugins (methods_cmid_<cmid>).
        // Mapping (Nutzer-Entscheidung): 2–5 → Gruppenarbeit, 6+ → Plenum,
        // Einzelarbeit/unbekannt → beliebig. Inline gehalten, damit der
        // Upgrade-Schritt unabhängig von späteren Codeänderungen bleibt.
        // Bildet einen Alt-Wert auf den neuen Cluster ab oder gibt null zurück,
        // wenn nichts zu tun ist (leer oder bereits ein Cluster). Reine
        // Zahlenwerte (auch Streuwerte wie "25") werden nach Größe eingeordnet;
        // 1–3-stellig optional mit '+', damit lange Hash-Strings (korrupte
        // Altdaten im Feld) NICHT als Zahl durchgehen, sondern auf "beliebig"
        // fallen.
        $tocluster = static function (string $old): ?string {
            static $explicit = [
                '1' => 'beliebig',
                '2-3' => 'Gruppenarbeit (2-5)',
                '3–5' => 'Gruppenarbeit (2-5)',
                '6–12' => 'Plenum (10-20)',
                '13–24' => 'Plenum (10-20)',
                '25+' => 'Plenum (10-20)',
            ];
            static $isnew = ['Gruppenarbeit (2-5)' => true, 'Plenum (10-20)' => true, 'beliebig' => true];
            $old = trim($old);
            if ($old === '' || isset($isnew[$old])) {
                return null;
            }
            if (isset($explicit[$old])) {
                return $explicit[$old];
            }
            if (preg_match('/^(\d{1,3})\+?$/', $old, $m)) {
                $n = (int)$m[1];
                return $n <= 1 ? 'beliebig' : ($n <= 5 ? 'Gruppenarbeit (2-5)' : 'Plenum (10-20)');
            }
            return 'beliebig';
        };
        $rows = $DB->get_records_select(
            'config_plugins',
            'plugin = :plugin AND ' . $DB->sql_like('name', ':namelike'),
            ['plugin' => 'mod_seminarplaner', 'namelike' => 'methods_cmid_%']
        );
        foreach ($rows as $row) {
            $cards = json_decode((string)$row->value, true);
            if (!is_array($cards)) {
                continue;
            }
            $changed = false;
            foreach ($cards as $i => $card) {
                if (!is_array($card) || !array_key_exists('gruppengroesse', $card)) {
                    continue;
                }
                $raw = $card['gruppengroesse'];
                if (is_array($raw)) {
                    // Fehlerhafter Array-Typ aus einem älteren Schnellanlage-
                    // Scaffold: auf String normalisieren ([] → '', sonst erstes
                    // Element) und dabei gleich auf den Cluster abbilden.
                    $rawstr = ($raw === []) ? '' : (string)reset($raw);
                    $new = $tocluster($rawstr);
                    $cards[$i]['gruppengroesse'] = $new ?? $rawstr;
                    $changed = true;
                    continue;
                }
                $new = $tocluster((string)$raw);
                if ($new !== null && $new !== (string)$raw) {
                    $cards[$i]['gruppengroesse'] = $new;
                    $changed = true;
                }
            }
            if ($changed) {
                $json = json_encode($cards, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                if ($json !== false) {
                    set_config($row->name, $json, 'mod_seminarplaner');
                }
            }
        }

        upgrade_mod_savepoint(true, 2026071400, 'seminarplaner');
    }

    if ($oldversion < 2026071503) {
        // D52: dauerhaftes PDF-Logo pro Aktivität – Positions-Spalte ergänzen.
        $table = new xmldb_table('seminarplaner');
        $field = new xmldb_field('logoposition', XMLDB_TYPE_CHAR, '10', null, null, null, null, 'defaultmethodsetid');
        if (!$dbman->field_exists($table, $field)) {
            $dbman->add_field($table, $field);
        }

        upgrade_mod_savepoint(true, 2026071503, 'seminarplaner');
    }

    if ($oldversion < 2026071552) {
        // Nutzungszweck pro Aktivität (Referent*innen) – steuert die sichtbaren
        // Tabs (konzipieren / durchfuehren / verwalten). Bestandsaktivitäten
        // bekommen den Standard "durchfuehren".
        $table = new xmldb_table('seminarplaner');
        $field = new xmldb_field('usecase', XMLDB_TYPE_CHAR, '20', null, null, null, 'durchfuehren', 'logoposition');
        if (!$dbman->field_exists($table, $field)) {
            $dbman->add_field($table, $field);
        }

        upgrade_mod_savepoint(true, 2026071552, 'seminarplaner');
    }

    if ($oldversion < 2026072101) {
        // D9/D19: Die Baustein-Stammdaten (Unterthemen, ehemalige Lernziele)
        // wanderten bisher NUR im einmaligen Schritt 2026070908 aus dem
        // Planungszustand in die Sequenz. Jeder Plan, dessen Sequenz danach
        // entstand (Import, auf dem Lesepfad geheilter Altzustand, spaeter
        // angelegt), blieb ohne sie - im Bestand nachweislich mehrere
        // Bausteine mit gepflegten Lernzielen und Unterthemen, die in der
        // Sequenz leer ankamen. Kuenftig erledigt das der Service an seinen
        // Choke-Points; dieser Schritt holt den Rueckstand einmal nach und
        // setzt an ALLEN Plaenen den Marker, damit der Service spaeter nichts
        // wieder auffuellt, was jemand bewusst geleert hat.
        $converter = new \mod_seminarplaner\local\sequence\grid_to_sequence_converter();
        $statekey = \mod_seminarplaner\local\sequence\sequence_state::STATE_KEY;
        $marker = \mod_seminarplaner\local\service\grid_service::ENRICHED_MARKER;
        $sql = "SELECT s.*, g.cmid
                  FROM {kgen_grid_user_state} s
                  JOIN {kgen_grid} g ON g.id = s.gridid
                 WHERE s.userid = 0";
        $planningcache = [];
        $rs = $DB->get_recordset_sql($sql);
        foreach ($rs as $record) {
            $state = json_decode((string)$record->statejson, true);
            if (
                !is_array($state)
                || !\mod_seminarplaner\local\sequence\sequence_state::has_sequence($state)
                || !is_array($state[$statekey])
            ) {
                continue;
            }
            $sequenz = $state[$statekey];
            $cmid = (int)$record->cmid;
            if (!array_key_exists($cmid, $planningcache)) {
                $planningrow = $DB->get_record('kgen_planning_state', ['cmid' => $cmid]);
                $planning = $planningrow ? json_decode((string)$planningrow->statejson, true) : null;
                $planningcache[$cmid] = is_array($planning) && is_array($planning['units'] ?? null)
                    ? $planning['units'] : [];
            }
            if ($planningcache[$cmid]) {
                $sequenz = $converter->enrich_bausteine($sequenz, $planningcache[$cmid]);
            }
            $sequenz[$marker] = true;
            $state[$statekey] = $sequenz;
            $json = json_encode($state, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            if ($json === false) {
                continue;
            }
            $record->statejson = $json;
            $record->versionhash = sha1($json . '|baustein-enrich-2');
            $record->timemodified = time();
            unset($record->cmid);
            $DB->update_record('kgen_grid_user_state', $record);
        }
        $rs->close();

        upgrade_mod_savepoint(true, 2026072101, 'seminarplaner');
    }

    return true;
}
