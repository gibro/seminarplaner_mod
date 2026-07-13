<?php
// This file is part of Moodle - http://moodle.org/

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
