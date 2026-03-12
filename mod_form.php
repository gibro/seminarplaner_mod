<?php
// This file is part of Moodle - http://moodle.org/

require_once(__DIR__ . '/../../config.php');
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

        $this->standard_coursemodule_elements();
        $this->add_action_buttons();
    }
}
