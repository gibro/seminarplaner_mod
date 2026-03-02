<?php
// This file is part of Moodle - http://moodle.org/

require_once(__DIR__ . '/../../config.php');
require_once($CFG->dirroot . '/course/moodleform_mod.php');

/**
 * Activity settings form for Seminarplaner.
 */
class mod_konzeptgenerator_mod_form extends moodleform_mod {
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

        $mform->addElement('header', 'konzeptgeneratorfieldset', get_string('pluginname', 'mod_konzeptgenerator'));

        $mform->addElement(
            'text',
            'defaultmethodsetid',
            get_string('defaultmethodsetid', 'mod_konzeptgenerator'),
            ['size' => '20']
        );
        $mform->setType('defaultmethodsetid', PARAM_INT);
        $mform->addHelpButton('defaultmethodsetid', 'defaultmethodsetid', 'mod_konzeptgenerator');

        $this->standard_coursemodule_elements();
        $this->add_action_buttons();
    }

    /**
     * Extra validation.
     *
     * @param array $data Submitted data.
     * @param array $files Uploaded files.
     * @return array Validation errors.
     */
    public function validation($data, $files) {
        $errors = parent::validation($data, $files);

        if ($data['defaultmethodsetid'] !== '' && (int)$data['defaultmethodsetid'] < 0) {
            $errors['defaultmethodsetid'] = get_string('err_numeric', 'form');
        }

        return $errors;
    }
}
