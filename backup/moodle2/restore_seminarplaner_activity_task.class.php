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
 * Backup and restore support: restore seminarplaner activity task.class.
 *
 * @package    mod_seminarplaner
 * @copyright  2026 Guido Brombach <gibro@posteo.de>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

require_once($CFG->dirroot . '/mod/seminarplaner/backup/moodle2/restore_seminarplaner_stepslib.php');

/**
 * Restore task for mod_seminarplaner.
 */
class restore_seminarplaner_activity_task extends restore_activity_task {
    /**
     * No specific settings for this activity restore.
     *
     * @return void
     */
    protected function define_my_settings(): void {
    }

    /**
     * Define restore steps.
     *
     * @return void
     */
    protected function define_my_steps(): void {
        $this->add_step(new restore_seminarplaner_activity_structure_step(
            'seminarplaner_structure',
            'seminarplaner.xml'
        ));
    }

    /**
     * Decode rules for links in content.
     *
     * @return array
     */
    public static function define_decode_contents(): array {
        return [
            new restore_decode_content('seminarplaner', ['intro'], 'seminarplaner'),
        ];
    }

    /**
     * Decode rules for links.
     *
     * @return array
     */
    public static function define_decode_rules(): array {
        return [
            new restore_decode_rule('SEMINARPLANERVIEWBYID', '/mod/seminarplaner/view.php?id=$1', 'course_module'),
            new restore_decode_rule('SEMINARPLANERINDEX', '/mod/seminarplaner/index.php?id=$1', 'course'),
        ];
    }

    /**
     * No restore log rules.
     *
     * @return array
     */
    public static function define_restore_log_rules(): array {
        return [];
    }

    /**
     * No course level restore log rules.
     *
     * @return array
     */
    public static function define_restore_log_rules_for_course(): array {
        return [];
    }
}
