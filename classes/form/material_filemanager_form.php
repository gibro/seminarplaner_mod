<?php
// This file is part of Moodle - http://moodle.org/

namespace mod_seminarplaner\form;

use context;
use moodleform;

defined('MOODLE_INTERNAL') || die();

/**
 * Lightweight form wrapper to render a Moodle file manager element.
 */
class material_filemanager_form extends moodleform {
    /**
     * Form definition.
     *
     * @return void
     */
    public function definition(): void {
        $mform = $this->_form;
        $fieldname = (string)($this->_customdata['fieldname'] ?? 'materialiendraftitemid');
        $maxbytes = (int)($this->_customdata['maxbytes'] ?? 0);
        $context = $this->_customdata['context'] ?? null;
        if (!$context instanceof context) {
            $context = null;
        }
        $options = [
            'subdirs' => 0,
            'maxfiles' => 25,
            'accepted_types' => '*',
            'maxbytes' => $maxbytes,
            'areamaxbytes' => $maxbytes,
        ];
        if ($context !== null) {
            $options['context'] = $context;
        }

        $mform->addElement('filemanager', $fieldname, '', null, $options);
    }
}
