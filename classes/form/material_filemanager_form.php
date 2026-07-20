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
 * Material filemanager form.
 *
 * @package    mod_seminarplaner
 * @copyright  2026 Guido Brombach <gibro@posteo.de>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

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
