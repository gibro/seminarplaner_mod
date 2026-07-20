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
 * Test data generator for mod_seminarplaner.
 *
 * @package    mod_seminarplaner
 * @category   test
 */

/**
 * Seminarplaner activity generator.
 *
 * @package    mod_seminarplaner
 * @category   test
 */
class mod_seminarplaner_generator extends testing_module_generator {
    /**
     * Create a Seminarplaner activity instance.
     *
     * @param stdClass|array|null $record Instance data.
     * @param array|null $options Generator options.
     * @return stdClass
     */
    public function create_instance($record = null, ?array $options = null): stdClass {
        $record = (object)(array)$record;

        if (!isset($record->name)) {
            $record->name = 'Seminarplaner';
        }
        if (!isset($record->intro)) {
            $record->intro = '';
        }
        if (!isset($record->introformat)) {
            $record->introformat = FORMAT_MOODLE;
        }

        return parent::create_instance($record, (array)$options);
    }
}
