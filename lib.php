<?php
// This file is part of Moodle - http://moodle.org/

defined('MOODLE_INTERNAL') || die();

/**
 * Moodle core feature support declaration.
 *
 * @param string $feature Feature name.
 * @return bool|null
 */
function konzeptgenerator_supports($feature) {
    switch ($feature) {
        case FEATURE_MOD_ARCHETYPE:
            return MOD_ARCHETYPE_OTHER;
        case FEATURE_MOD_INTRO:
            return true;
        case FEATURE_SHOW_DESCRIPTION:
            return true;
        case FEATURE_BACKUP_MOODLE2:
            return true;
        case FEATURE_GROUPS:
            return true;
        case FEATURE_GROUPINGS:
            return true;
        case FEATURE_GRADE_HAS_GRADE:
            return false;
        case FEATURE_COMPLETION_HAS_RULES:
            return false;
        default:
            return null;
    }
}

/**
 * Create a new activity instance.
 *
 * @param stdClass $data Form data.
 * @param mod_konzeptgenerator_mod_form|null $mform Form object.
 * @return int New instance id.
 */
function konzeptgenerator_add_instance($data, $mform = null) {
    global $DB;

    $now = time();
    $data->timecreated = $now;
    $data->timemodified = $now;

    if (!isset($data->defaultmethodsetid) || $data->defaultmethodsetid === '') {
        $data->defaultmethodsetid = null;
    }

    return $DB->insert_record('konzeptgenerator', $data);
}

/**
 * Update an existing activity instance.
 *
 * @param stdClass $data Form data.
 * @param mod_konzeptgenerator_mod_form|null $mform Form object.
 * @return bool
 */
function konzeptgenerator_update_instance($data, $mform = null) {
    global $DB;

    $data->id = $data->instance;
    $data->timemodified = time();

    if (!isset($data->defaultmethodsetid) || $data->defaultmethodsetid === '') {
        $data->defaultmethodsetid = null;
    }

    return $DB->update_record('konzeptgenerator', $data);
}

/**
 * Delete an activity instance and related data.
 *
 * @param int $id Instance id.
 * @return bool
 */
function konzeptgenerator_delete_instance($id) {
    global $DB;

    if (!$DB->record_exists('konzeptgenerator', ['id' => $id])) {
        return false;
    }

    $cmid = konzeptgenerator_get_cmid_from_instance($id);
    if (!empty($cmid)) {
        $gridids = $DB->get_fieldset_select('kgen_grid', 'id', 'cmid = ?', [$cmid]);
        if (!empty($gridids)) {
            list($insql, $inparams) = $DB->get_in_or_equal($gridids, SQL_PARAMS_QM);
            $DB->delete_records_select('kgen_grid_user_state', "gridid $insql", $inparams);
            $DB->delete_records_select('kgen_grid_lock', "gridid $insql", $inparams);
        }

        $DB->delete_records('kgen_grid', ['cmid' => $cmid]);
        $DB->delete_records('kgen_activity_setlink', ['cmid' => $cmid]);
        $DB->delete_records('kgen_activity_methodovr', ['cmid' => $cmid]);
        $DB->delete_records('kgen_import_export_log', ['cmid' => $cmid]);
    }

    $DB->delete_records('konzeptgenerator', ['id' => $id]);
    return true;
}

/**
 * Resolve course module id from an instance id.
 *
 * @param int $instanceid Activity instance id.
 * @return int|null
 */
function konzeptgenerator_get_cmid_from_instance(int $instanceid): ?int {
    global $DB;

    $sql = "SELECT cm.id
              FROM {course_modules} cm
              JOIN {modules} m ON m.id = cm.module
             WHERE m.name = :modname
               AND cm.instance = :instanceid";

    $cmid = $DB->get_field_sql($sql, ['modname' => 'konzeptgenerator', 'instanceid' => $instanceid]);
    return $cmid ? (int)$cmid : null;
}

/**
 * Extend activity navigation with direct links for Seminarplaner subpages.
 *
 * @param settings_navigation $settingsnav Settings navigation.
 * @param navigation_node $modulenode Module node.
 * @return void
 */
function konzeptgenerator_extend_settings_navigation(settings_navigation $settingsnav, navigation_node $modulenode): void {
    global $PAGE;

    if (empty($PAGE->cm) || empty($PAGE->cm->id)) {
        return;
    }

    $cmid = (int)$PAGE->cm->id;
    $modulenode->add(
        get_string('gridplanning', 'mod_konzeptgenerator'),
        new moodle_url('/mod/konzeptgenerator/grid.php', ['id' => $cmid]),
        navigation_node::TYPE_SETTING,
        null,
        'konzeptgenerator_grid'
    );
    $modulenode->add(
        get_string('managemethodlibrarymenu', 'mod_konzeptgenerator'),
        new moodle_url('/mod/konzeptgenerator/methodlibrary.php', ['id' => $cmid]),
        navigation_node::TYPE_SETTING,
        null,
        'konzeptgenerator_methodlibrary'
    );
    $modulenode->add(
        get_string('addmethodcardmenu', 'mod_konzeptgenerator'),
        new moodle_url('/mod/konzeptgenerator/methods.php', ['id' => $cmid], 'kg-add-method-section'),
        navigation_node::TYPE_SETTING,
        null,
        'konzeptgenerator_addmethodcard'
    );
    $modulenode->add(
        get_string('reviewmenu', 'mod_konzeptgenerator'),
        new moodle_url('/mod/konzeptgenerator/review.php', ['id' => $cmid]),
        navigation_node::TYPE_SETTING,
        null,
        'konzeptgenerator_review'
    );
    $modulenode->add(
        get_string('importexport', 'mod_konzeptgenerator'),
        new moodle_url('/mod/konzeptgenerator/importexport.php', ['id' => $cmid]),
        navigation_node::TYPE_SETTING,
        null,
        'konzeptgenerator_importexport'
    );
}

/**
 * Serve stored files for method card attachments.
 *
 * @param stdClass $course
 * @param stdClass $cm
 * @param context_module $context
 * @param string $filearea
 * @param array $args
 * @param bool $forcedownload
 * @param array $options
 * @return void|false
 */
function konzeptgenerator_pluginfile($course, $cm, $context, $filearea, $args, $forcedownload, array $options = []) {
    global $DB, $USER;

    require_login($course, true, $cm);
    if ($context->contextlevel !== CONTEXT_MODULE) {
        return false;
    }
    if (!in_array($filearea, ['method_materialien', 'method_h5p'], true)) {
        return false;
    }
    require_capability('mod/konzeptgenerator:managemethods', $context);
    if (count($args) < 2) {
        return false;
    }

    $itemid = (int)array_shift($args);
    $map = $DB->get_record('kgen_method_filemap', [
        'cmid' => (int)$cm->id,
        'itemid' => $itemid,
    ], 'id, userid');
    if (!$map || (int)$map->userid !== (int)$USER->id) {
        return false;
    }

    $filename = array_pop($args);
    $filepath = '/';
    if (!empty($args)) {
        $filepath .= implode('/', $args) . '/';
    }

    $fs = get_file_storage();
    $file = $fs->get_file($context->id, 'mod_konzeptgenerator', $filearea, $itemid, $filepath, $filename);
    if (!$file || $file->is_directory()) {
        return false;
    }

    send_stored_file($file, 0, 0, true, $options);
}
