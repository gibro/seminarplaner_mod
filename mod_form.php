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
 * Instance settings form.
 *
 * @package    mod_seminarplaner
 * @copyright  2026 Guido Brombach <gibro@posteo.de>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

require_once(__DIR__ . '/bootstrap.php');
require_once($CFG->dirroot . '/course/moodleform_mod.php');

/**
 * Activity settings form for Seminarplaner.
 */
class mod_seminarplaner_mod_form extends moodleform_mod {
    /**
     * Form definition.
     */
    public function definition() {
        global $CFG;

        $mform = $this->_form;

        $mform->addElement('text', 'name', get_string('name'), ['size' => '64']);
        $mform->setType('name', PARAM_TEXT);
        $mform->addRule('name', null, 'required', null, 'client');

        if ($CFG->branch >= 404) {
            $this->standard_intro_elements();
        } else {
            $this->add_intro_editor();
        }

        // Nutzungszweck (Referent*innen): steuert, welche Tabs sichtbar sind.
        $mform->addElement('header', 'usecaseheader', get_string('usecaseheader', 'mod_seminarplaner'));
        $mform->setExpanded('usecaseheader', true);
        $mform->addElement('select', 'usecase', get_string('usecase', 'mod_seminarplaner'), [
            'konzipieren' => get_string('usecase_konzipieren', 'mod_seminarplaner'),
            'durchfuehren' => get_string('usecase_durchfuehren', 'mod_seminarplaner'),
            'verwalten' => get_string('usecase_verwalten', 'mod_seminarplaner'),
        ]);
        $mform->setDefault('usecase', 'durchfuehren');
        $mform->addHelpButton('usecase', 'usecase', 'mod_seminarplaner');

        // D52: Dauerhaftes Logo für den Seitenkopf aller PDF-Exporte.
        $mform->addElement('header', 'pdflogoheader', get_string('pdflogoheader', 'mod_seminarplaner'));
        $mform->addElement(
            'filemanager',
            'logofile',
            get_string('pdflogo', 'mod_seminarplaner'),
            null,
            [
                'subdirs' => 0,
                'maxfiles' => 1,
                'accepted_types' => ['.png', '.jpg', '.jpeg', '.gif'],
            ]
        );
        $mform->addHelpButton('logofile', 'pdflogo', 'mod_seminarplaner');
        $mform->addElement('select', 'logoposition', get_string('pdflogoposition', 'mod_seminarplaner'), [
            'right' => get_string('pdflogoposition_right', 'mod_seminarplaner'),
            'left' => get_string('pdflogoposition_left', 'mod_seminarplaner'),
        ]);
        $mform->setDefault('logoposition', 'right');

        $this->standard_coursemodule_elements();
        $this->add_action_buttons();
    }

    /**
     * Prepare the logo file area for editing.
     *
     * @param array $defaultvalues
     * @return void
     */
    public function data_preprocessing(&$defaultvalues) {
        if (!empty($this->current->coursemodule)) {
            $context = context_module::instance($this->current->coursemodule);
            $draftitemid = file_get_submitted_draft_itemid('logofile');
            file_prepare_draft_area(
                $draftitemid,
                $context->id,
                'mod_seminarplaner',
                'logo',
                0,
                ['subdirs' => 0, 'maxfiles' => 1]
            );
            $defaultvalues['logofile'] = $draftitemid;
        }
    }
}
