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
 * Unit tests for backup restore.
 *
 * @package    mod_seminarplaner
 * @copyright  2026 Guido Brombach <gibro@posteo.de>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

global $CFG;
require_once($CFG->dirroot . '/backup/util/includes/backup_includes.php');
require_once($CFG->dirroot . '/backup/util/includes/restore_includes.php');

use mod_seminarplaner\local\service\grid_service;

/**
 * Backup and restore roundtrip tests for mod_seminarplaner.
 *
 * Covers the deploy-critical guarantee that grids and the published Common Thread
 * survive a course backup/restore (also triggered by activity duplication and
 * course import). See Workflow 21/22 in TEST_WORKFLOWS.md.
 */
final class mod_seminarplaner_backup_restore_test extends advanced_testcase {
    public function test_backup_restore_preserves_grid_and_roterfaden(): void {
        global $USER;

        $this->resetAfterTest(true);
        $this->setAdminUser();

        $generator = $this->getDataGenerator();
        $sourcecourse = $generator->create_course();
        $module = $generator->create_module('seminarplaner', ['course' => $sourcecourse->id, 'name' => 'Source']);
        $cm = get_coursemodule_from_instance('seminarplaner', $module->id);
        $sourcecmid = (int)$cm->id;

        // Seed a grid and a published Common Thread on the source activity.
        $service = new grid_service();
        $gridid = $service->create_grid($sourcecmid, 'Plan A', (int)$USER->id);
        $service->publish_roterfaden($sourcecmid, $gridid, ['units' => [['uid' => 'u1']]], (int)$USER->id);
        $this->assertTrue($service->get_roterfaden_state($sourcecmid)['ispublished']);

        // Backup the single activity.
        //
        // Frueher setzte dieser Test hier das 'users'-Setting auf true. In
        // MODE_IMPORT ist es aber per Berechtigung gesperrt, das Setzen warf
        // eine base_setting_exception und der Test war rot. Wirkungslos war es
        // ohnehin: backup_seminarplaner_stepslib sichert Grids und Roten Faden
        // ohne userinfo-Bedingung, also unabhaengig von diesem Setting.
        $bc = new backup_controller(
            backup::TYPE_1ACTIVITY,
            $sourcecmid,
            backup::FORMAT_MOODLE,
            backup::INTERACTIVE_NO,
            backup::MODE_IMPORT,
            (int)$USER->id
        );
        $backupid = $bc->get_backupid();
        $bc->execute_plan();
        $bc->destroy();

        // Restore into a fresh course as a new activity.
        $targetcourse = $generator->create_course();
        $rc = new restore_controller(
            $backupid,
            $targetcourse->id,
            backup::INTERACTIVE_NO,
            backup::MODE_IMPORT,
            (int)$USER->id,
            backup::TARGET_NEW_COURSE
        );
        $this->assertTrue($rc->execute_precheck());
        $rc->execute_plan();
        $rc->destroy();

        // Locate the restored activity and assert its data survived under the new cmid.
        $restoredmodules = get_coursemodules_in_course('seminarplaner', $targetcourse->id);
        $this->assertCount(1, $restoredmodules);
        $restoredcm = reset($restoredmodules);
        $restoredcmid = (int)$restoredcm->id;
        $this->assertNotSame($sourcecmid, $restoredcmid);

        $restoredgrids = $service->list_grids($restoredcmid);
        $this->assertCount(1, $restoredgrids);
        $restoredgrid = reset($restoredgrids);
        $this->assertSame('Plan A', $restoredgrid->name);

        $this->assertTrue($service->get_roterfaden_state($restoredcmid)['ispublished']);
    }

    /**
     * Every column of the activity table must be listed in the backup element.
     *
     * Die Backup-Definition zaehlt die zu sichernden Spalten einzeln auf. Was
     * dort fehlt, geht bei Backup/Restore still verloren – der Restore legt die
     * Aktivitaet trotzdem an, nur eben mit dem Default. Genau so sind
     * logoposition (D52) und usecase (Tab-Nutzungszweck) unbemerkt
     * durchgerutscht: beide standen in install.xml und im Upgrade-Pfad, aber
     * nicht im Backup.
     *
     * Dieser Test vergleicht deshalb nicht einzelne Felder, sondern die ganze
     * Tabelle gegen das erzeugte Backup-XML: Wer kuenftig eine Spalte
     * hinzufuegt und das Backup vergisst, faellt hier auf – auch fuer Spalten,
     * die es heute noch nicht gibt.
     */
    public function test_backup_contains_every_activity_column(): void {
        global $DB, $USER;

        $this->resetAfterTest(true);
        $this->setAdminUser();

        $generator = $this->getDataGenerator();
        $course = $generator->create_course();
        $module = $generator->create_module('seminarplaner', ['course' => $course->id, 'name' => 'Spaltenprobe']);
        $cm = get_coursemodule_from_instance('seminarplaner', $module->id);

        $xml = $this->backup_activity_xml((int)$cm->id, (int)$USER->id);
        $element = $xml->seminarplaner;
        $this->assertNotNull($element, 'Das Backup enthaelt kein <seminarplaner>-Element.');

        // 'id' ist der Schluessel des Elements und steht als Attribut, nicht als
        // Kindelement - alle uebrigen Spalten muessen als Kindelement auftauchen.
        $exempt = ['id'];
        $missing = [];
        foreach (array_keys($DB->get_columns('seminarplaner')) as $column) {
            if (in_array($column, $exempt, true)) {
                continue;
            }
            if (!isset($element->{$column})) {
                $missing[] = $column;
            }
        }

        $this->assertSame([], $missing, 'Diese Spalten der Tabelle seminarplaner fehlen in '
            . 'backup_seminarplaner_stepslib.php und gingen bei einem Restore verloren: '
            . implode(', ', $missing));
    }

    /**
     * D52: the PDF logo, its position and the use case survive a roundtrip.
     *
     * Ergaenzt den generischen Spalten-Waechter um die Datei-Seite: Spalten
     * allein genuegen nicht, der Dateibereich 'logo' braucht ein eigenes
     * annotate_files() im Backup und ein add_related_files() im Restore.
     * Ohne die beiden wanderte die hochgeladene Datei nie ins Backup.
     */
    public function test_backup_restore_preserves_pdf_logo_and_usecase(): void {
        global $DB, $USER;

        $this->resetAfterTest(true);
        $this->setAdminUser();

        $generator = $this->getDataGenerator();
        $sourcecourse = $generator->create_course();
        $module = $generator->create_module('seminarplaner', ['course' => $sourcecourse->id, 'name' => 'Mit Logo']);
        $cm = get_coursemodule_from_instance('seminarplaner', $module->id);
        $sourcecmid = (int)$cm->id;

        $DB->update_record('seminarplaner', (object)[
            'id' => $module->id,
            'logoposition' => 'left',
            'usecase' => 'verwalten',
        ]);

        // Das Logo haengt mit fester itemid 0 an der Aktivitaet (wie intro).
        $fs = get_file_storage();
        $fs->create_file_from_string([
            'contextid' => context_module::instance($sourcecmid)->id,
            'component' => 'mod_seminarplaner',
            'filearea' => 'logo',
            'itemid' => 0,
            'filepath' => '/',
            'filename' => 'logo.png',
        ], 'nicht-echtes-png');

        $restoredcmid = $this->roundtrip_activity($sourcecmid, (int)$generator->create_course()->id, (int)$USER->id);
        $this->assertNotSame($sourcecmid, $restoredcmid);

        $restored = $DB->get_record('seminarplaner',
            ['id' => get_coursemodule_from_id('seminarplaner', $restoredcmid)->instance]);
        $this->assertSame('left', $restored->logoposition, 'Die Logo-Position hat den Restore nicht ueberlebt.');
        $this->assertSame('verwalten', $restored->usecase, 'Der Nutzungszweck hat den Restore nicht ueberlebt.');

        $restoredfiles = $fs->get_area_files(
            context_module::instance($restoredcmid)->id,
            'mod_seminarplaner',
            'logo',
            0,
            'filename',
            false
        );
        $this->assertCount(1, $restoredfiles, 'Die Logo-Datei hat den Restore nicht ueberlebt.');
        $restoredfile = reset($restoredfiles);
        $this->assertSame('logo.png', $restoredfile->get_filename());
        $this->assertSame('nicht-echtes-png', $restoredfile->get_content());
    }

    /**
     * Back up one activity and return its parsed activity XML.
     *
     * @param int $cmid Course module id.
     * @param int $userid User running the backup.
     * @return SimpleXMLElement
     */
    private function backup_activity_xml(int $cmid, int $userid): SimpleXMLElement {
        $bc = new backup_controller(
            backup::TYPE_1ACTIVITY,
            $cmid,
            backup::FORMAT_MOODLE,
            backup::INTERACTIVE_NO,
            backup::MODE_IMPORT,
            $userid
        );
        $backupid = $bc->get_backupid();
        $bc->execute_plan();
        $bc->destroy();

        $path = make_backup_temp_directory($backupid) . '/activities/seminarplaner_' . $cmid . '/seminarplaner.xml';
        $this->assertFileExists($path);
        return simplexml_load_file($path);
    }

    /**
     * Back up one activity and restore it into another course.
     *
     * @param int $cmid Source course module id.
     * @param int $targetcourseid Course to restore into.
     * @param int $userid User running backup and restore.
     * @return int The restored course module id.
     */
    private function roundtrip_activity(int $cmid, int $targetcourseid, int $userid): int {
        $bc = new backup_controller(
            backup::TYPE_1ACTIVITY,
            $cmid,
            backup::FORMAT_MOODLE,
            backup::INTERACTIVE_NO,
            backup::MODE_IMPORT,
            $userid
        );
        $backupid = $bc->get_backupid();
        $bc->execute_plan();
        $bc->destroy();

        $rc = new restore_controller(
            $backupid,
            $targetcourseid,
            backup::INTERACTIVE_NO,
            backup::MODE_IMPORT,
            $userid,
            backup::TARGET_NEW_COURSE
        );
        $this->assertTrue($rc->execute_precheck());
        $rc->execute_plan();
        $rc->destroy();

        $restoredmodules = get_coursemodules_in_course('seminarplaner', $targetcourseid);
        $this->assertCount(1, $restoredmodules);
        return (int)reset($restoredmodules)->id;
    }
}
