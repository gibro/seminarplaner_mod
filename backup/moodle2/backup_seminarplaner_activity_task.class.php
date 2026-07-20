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
 * Backup and restore support: backup seminarplaner activity task.class.
 *
 * @package    mod_seminarplaner
 * @copyright  2026 Guido Brombach <gibro@posteo.de>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

require_once($CFG->dirroot . '/mod/seminarplaner/backup/moodle2/backup_seminarplaner_stepslib.php');

/**
 * Backup task for mod_seminarplaner.
 */
class backup_seminarplaner_activity_task extends backup_activity_task {
    /**
     * No specific settings for this activity backup.
     *
     * @return void
     */
    protected function define_my_settings(): void {
    }

    /**
     * Define backup steps.
     *
     * @return void
     */
    protected function define_my_steps(): void {
        $this->add_step(new backup_seminarplaner_activity_structure_step(
            'seminarplaner_structure',
            'seminarplaner.xml'
        ));
    }

    /**
     * Encode content links.
     *
     * @param string $content HTML content.
     * @return string
     */
    public static function encode_content_links($content): string {
        global $CFG;

        $base = preg_quote($CFG->wwwroot, '/');
        $content = preg_replace("/{$base}\/mod\/seminarplaner\/index.php\?id\=([0-9]+)/",
            '$@SEMINARPLANERINDEX*$1@$', $content);
        $content = preg_replace("/{$base}\/mod\/seminarplaner\/view.php\?id\=([0-9]+)/",
            '$@SEMINARPLANERVIEWBYID*$1@$', $content);
        return $content;
    }
}
