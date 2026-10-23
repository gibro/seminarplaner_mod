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
 * Presence of people working in a seminar plan at the same time.
 *
 * @package    mod_seminarplaner
 * @copyright  2026 Guido Brombach <gibro@posteo.de>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace mod_seminarplaner\local\service;

/**
 * Live-Mitbearbeiten: wer hat den Plan gerade offen, an welchem Tag, an welcher Einheit.
 *
 * Jeder offene Sequenz-Tab meldet sich alle paar Sekunden (ping). Eine
 * Zeile je Person und Plan; was laenger als {@see self::ACTIVE_SECONDS} nicht
 * gemeldet wurde, gilt als weg, und was laenger als
 * {@see self::PURGE_SECONDS} liegt, wird beim naechsten Ping geloescht. Die
 * Tabelle haelt also nur Momentaufnahmen, keine Historie.
 */
class presence_service {
    /** @var int Seconds after which a person no longer counts as present. */
    public const ACTIVE_SECONDS = 20;

    /** @var int Seconds after which presence rows are deleted. */
    public const PURGE_SECONDS = 120;

    /**
     * Record that a person is working in a plan and return the others.
     *
     * @param int $gridid Grid id.
     * @param int $userid User id.
     * @param int $tag One-based day number shown, 0 if unknown.
     * @param string $pid Placement being edited, empty if none.
     * @param int|null $now Current time (for tests).
     * @return array<int, array{userid: int, tag: int, pid: string}>
     */
    public function ping(int $gridid, int $userid, int $tag, string $pid, ?int $now = null): array {
        global $DB;

        $now = $now ?? time();
        $pid = \core_text::substr(trim($pid), 0, 64);
        $tag = max(0, min(9999, $tag));

        $existing = $DB->get_record('kgen_grid_presence', ['gridid' => $gridid, 'userid' => $userid], 'id');
        $record = (object)[
            'gridid' => $gridid,
            'userid' => $userid,
            'tag' => $tag,
            'pid' => $pid === '' ? null : $pid,
            'timemodified' => $now,
        ];
        if ($existing) {
            $record->id = $existing->id;
            $DB->update_record('kgen_grid_presence', $record);
        } else {
            try {
                $DB->insert_record('kgen_grid_presence', $record);
            } catch (\dml_write_exception $e) {
                // Zwei Tabs derselben Person haben gleichzeitig angelegt -
                // die Zeile existiert, das reicht.
                unset($e);
            }
        }

        $DB->delete_records_select('kgen_grid_presence', 'timemodified < ?', [$now - self::PURGE_SECONDS]);

        return $this->others($gridid, $userid, $now);
    }

    /**
     * Other people currently present in a plan.
     *
     * @param int $gridid Grid id.
     * @param int $userid Asking user, left out.
     * @param int $now Current time.
     * @return array<int, array{userid: int, tag: int, pid: string}>
     */
    public function others(int $gridid, int $userid, int $now): array {
        global $DB;

        $records = $DB->get_records_select(
            'kgen_grid_presence',
            'gridid = ? AND userid <> ? AND timemodified >= ?',
            [$gridid, $userid, $now - self::ACTIVE_SECONDS],
            'timemodified DESC'
        );
        $result = [];
        foreach ($records as $record) {
            $result[] = [
                'userid' => (int)$record->userid,
                'tag' => (int)$record->tag,
                'pid' => (string)($record->pid ?? ''),
            ];
        }
        return $result;
    }
}
