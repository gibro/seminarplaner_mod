<?php
// This file is part of Moodle - http://moodle.org/

/**
 * Symlink-safe Moodle bootstrap for the Seminarplaner activity.
 *
 * __DIR__ points to the real plugin source when the plugin is installed via a
 * symlink, so walking up to ../../config.php would leave the Moodle dirroot.
 */
if (!isset($CFG)) {
    global $CFG;

    $configfile = '';
    if (!empty($_SERVER['DOCUMENT_ROOT'])) {
        $configfile = rtrim($_SERVER['DOCUMENT_ROOT'], DIRECTORY_SEPARATOR) . '/config.php';
    }

    if (!$configfile || !is_readable($configfile)) {
        $scriptfile = $_SERVER['SCRIPT_FILENAME'] ?? '';
        if ($scriptfile) {
            $configfile = dirname($scriptfile, 2) . '/config.php';
        }
    }

    require_once($configfile);
}
