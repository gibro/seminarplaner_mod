<?php
// This file is part of Moodle - http://moodle.org/

/**
 * Test data generator for mod_seminarplaner.
 *
 * @package    mod_seminarplaner
 * @category   test
 */

defined('MOODLE_INTERNAL') || die();

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
