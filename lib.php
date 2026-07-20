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
 * Library functions.
 *
 * @package    mod_seminarplaner
 * @copyright  2026 Guido Brombach <gibro@posteo.de>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

/**
 * Moodle core feature support declaration.
 *
 * @param string $feature Feature name.
 * @return bool|null
 */
function seminarplaner_supports($feature) {
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
 * @param mod_seminarplaner_mod_form|null $mform Form object.
 * @return int New instance id.
 */
function seminarplaner_add_instance($data, $mform = null) {
    global $DB;

    $now = time();
    $data->timecreated = $now;
    $data->timemodified = $now;

    if (!isset($data->defaultmethodsetid) || $data->defaultmethodsetid === '') {
        $data->defaultmethodsetid = null;
    }

    $instanceid = $DB->insert_record('seminarplaner', $data);

    seminarplaner_save_logo_file($data);

    return $instanceid;
}

/**
 * Update an existing activity instance.
 *
 * @param stdClass $data Form data.
 * @param mod_seminarplaner_mod_form|null $mform Form object.
 * @return bool
 */
function seminarplaner_update_instance($data, $mform = null) {
    global $DB;

    $data->id = $data->instance;
    $data->timemodified = time();

    if (!isset($data->defaultmethodsetid) || $data->defaultmethodsetid === '') {
        $data->defaultmethodsetid = null;
    }

    $result = $DB->update_record('seminarplaner', $data);

    seminarplaner_save_logo_file($data);

    return $result;
}

/**
 * Persist the uploaded PDF logo (D52) from the activity settings form.
 *
 * @param stdClass $data Form data with the logofile draft area id and coursemodule.
 * @return void
 */
function seminarplaner_save_logo_file($data) {
    if (empty($data->coursemodule) || !isset($data->logofile)) {
        return;
    }
    $context = context_module::instance($data->coursemodule);
    file_save_draft_area_files(
        $data->logofile,
        $context->id,
        'mod_seminarplaner',
        'logo',
        0,
        ['subdirs' => 0, 'maxfiles' => 1]
    );
}

/**
 * Delete an activity instance and related data.
 *
 * @param int $id Instance id.
 * @return bool
 */
function seminarplaner_delete_instance($id) {
    global $DB;

    if (!$DB->record_exists('seminarplaner', ['id' => $id])) {
        return false;
    }

    $cmid = seminarplaner_get_cmid_from_instance($id);
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

    $DB->delete_records('seminarplaner', ['id' => $id]);
    return true;
}

/**
 * Resolve course module id from an instance id.
 *
 * @param int $instanceid Activity instance id.
 * @return int|null
 */
function seminarplaner_get_cmid_from_instance(int $instanceid): ?int {
    global $DB;

    $sql = "SELECT cm.id
              FROM {course_modules} cm
              JOIN {modules} m ON m.id = cm.module
             WHERE m.name = :modname
               AND cm.instance = :instanceid";

    $cmid = $DB->get_field_sql($sql, ['modname' => 'seminarplaner', 'instanceid' => $instanceid]);
    return $cmid ? (int)$cmid : null;
}

/**
 * Extend activity navigation with direct links for Seminarplaner subpages.
 *
 * @param settings_navigation $settingsnav Settings navigation.
 * @param navigation_node $modulenode Module node.
 * @return void
 */
function seminarplaner_extend_settings_navigation(settings_navigation $settingsnav, navigation_node $modulenode): void {
    global $PAGE;

    if (empty($PAGE->cm) || empty($PAGE->cm->id)) {
        return;
    }

    $cmid = (int)$PAGE->cm->id;
    $context = context_module::instance($cmid);
    if (has_capability('mod/seminarplaner:view', $context)) {
        $modulenode->add(
            get_string('managemethodlibrarymenu', 'mod_seminarplaner'),
            new moodle_url('/mod/seminarplaner/methodlibrary.php', ['id' => $cmid]),
            navigation_node::TYPE_SETTING,
            null,
            'seminarplaner_methodlibrary'
        );
        $modulenode->add(
            get_string('addmethodcardmenu', 'mod_seminarplaner'),
            // D50: Anlegen öffnet den Editor direkt in der Bibliothek.
            new moodle_url('/mod/seminarplaner/methodlibrary.php', ['id' => $cmid, 'create' => 1]),
            navigation_node::TYPE_SETTING,
            null,
            'seminarplaner_addmethodcard'
        );
        $modulenode->add(
            get_string('reviewmenu', 'mod_seminarplaner'),
            new moodle_url('/mod/seminarplaner/review.php', ['id' => $cmid]),
            navigation_node::TYPE_SETTING,
            null,
            'seminarplaner_review'
        );
    }
    if (has_capability('mod/seminarplaner:view', $context)) {
        $modulenode->add(
            get_string('importexport', 'mod_seminarplaner'),
            new moodle_url('/mod/seminarplaner/importexport.php', ['id' => $cmid]),
            navigation_node::TYPE_SETTING,
            null,
            'seminarplaner_importexport'
        );
    }
}

/**
 * Serve stored files for seminar unit attachments.
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
function seminarplaner_pluginfile($course, $cm, $context, $filearea, $args, $forcedownload, array $options = []) {
    global $DB;

    require_login($course, true, $cm);
    if ($context->contextlevel !== CONTEXT_MODULE) {
        return false;
    }
    if (!in_array($filearea, ['method_materialien', 'method_h5p', 'logo'], true)) {
        return false;
    }
    require_capability('mod/seminarplaner:view', $context);

    // D52: PDF-Logo liegt als einzelne Datei unter itemid 0.
    if ($filearea === 'logo') {
        $filename = array_pop($args);
        $filepath = empty($args) ? '/' : '/' . implode('/', $args) . '/';
        $fs = get_file_storage();
        $file = $fs->get_file($context->id, 'mod_seminarplaner', 'logo', 0, $filepath, $filename);
        if (!$file || $file->is_directory()) {
            return false;
        }
        send_stored_file($file, 0, 0, $forcedownload, $options);
        return;
    }

    if (count($args) < 2) {
        return false;
    }

    $itemid = (int)array_shift($args);
    $map = $DB->get_record('kgen_method_filemap', [
        'cmid' => (int)$cm->id,
        'itemid' => $itemid,
    ], 'id');
    if (!$map) {
        return false;
    }

    $filename = array_pop($args);
    $filepath = '/';
    if (!empty($args)) {
        $filepath .= implode('/', $args) . '/';
    }

    $fs = get_file_storage();
    $file = $fs->get_file($context->id, 'mod_seminarplaner', $filearea, $itemid, $filepath, $filename);
    if (!$file || $file->is_directory()) {
        return false;
    }

    send_stored_file($file, 0, 0, $forcedownload, $options);
}

/**
 * Returns file areas for Moodle file browser support.
 *
 * @param stdClass $course
 * @param stdClass $cm
 * @param context_module $context
 * @return array
 */
function seminarplaner_get_file_areas($course, $cm, $context): array {
    return [
        'method_materialien' => 'Materialien',
        'method_h5p' => 'H5P-Inhalte',
        'logo' => get_string('pdflogo', 'mod_seminarplaner'),
    ];
}

/**
 * Optional file browser support.
 *
 * @param file_browser $browser
 * @param array $areas
 * @param stdClass $course
 * @param stdClass $cm
 * @param context_module $context
 * @param string $filearea
 * @param int|null $itemid
 * @param string|null $filepath
 * @param string|null $filename
 * @return file_info|null
 */
function seminarplaner_get_file_info(
    $browser,
    $areas,
    $course,
    $cm,
    $context,
    $filearea,
    $itemid,
    $filepath,
    $filename
) {
    if (!has_capability('mod/seminarplaner:view', $context)) {
        return null;
    }
    if (!isset($areas[$filearea])) {
        return null;
    }
    if (!in_array($filearea, ['method_materialien', 'method_h5p', 'logo'], true)) {
        return null;
    }

    $resolveditemid = $itemid === null ? 0 : (int)$itemid;
    $resolvedfilepath = $filepath === null ? '/' : (string)$filepath;
    $resolvedfilename = $filename === null ? '.' : (string)$filename;

    return $browser->get_file_info(
        $context,
        'mod_seminarplaner',
        $filearea,
        $resolveditemid,
        $resolvedfilepath,
        $resolvedfilename
    );
}

/**
 * Declare user preferences writable via the core AJAX preference API.
 *
 * @return array
 */
function mod_seminarplaner_user_preferences(): array {
    return [
        // D27: Dramaturgie-Blick per user across all plans.
        'mod_seminarplaner_dramaturgie' => [
            'type' => PARAM_BOOL,
            'null' => NULL_NOT_ALLOWED,
            'default' => true,
            'permissioncallback' => [core_user::class, 'is_current_user'],
        ],
        // D58: Opt-in einer Konzeptverantwortlichen, in der öffentlichen
        // Übersichtsliste zu erscheinen (reines Vertrauenssignal, kein
        // Kontaktweg). Default aus - die Liste ist opt-in.
        'mod_seminarplaner_konzeptverantwortliche_public' => [
            'type' => PARAM_BOOL,
            'null' => NULL_NOT_ALLOWED,
            'default' => false,
            'permissioncallback' => [core_user::class, 'is_current_user'],
        ],
    ];
}

/**
 * Fragment: Materialien-Filemanager für den Einheiten-Editor der Sequenz.
 *
 * Der Datei-Upload braucht einen serverseitig vorbereiteten Entwurfsbereich
 * je Seminareinheit; das Sequenz-Modal lädt dieses Formular deshalb bei
 * jedem Öffnen über die Fragment-API nach (D17: alle Editor-Einstiege
 * bieten dieselben Felder wie der Bibliotheks-Editor).
 *
 * @param array $args Fragment arguments: context plus 'methodid'
 *                    (leer = Anlegen-Modus, Entwurfsbereich ohne Dateien).
 * @return string Rendered form HTML.
 */
function mod_seminarplaner_output_fragment_unitmaterials($args) {
    global $CFG;
    require_once($CFG->libdir . '/formslib.php');

    $args = (array)$args;
    $context = $args['context'];
    if (!($context instanceof context_module)) {
        throw new invalid_parameter_exception('Module context required');
    }
    require_capability('mod/seminarplaner:managemethods', $context);

    $cmid = (int)$context->instanceid;
    $methodid = clean_param((string)($args['methodid'] ?? ''), PARAM_ALPHANUMEXT);
    $maxuploadbytes = get_user_max_upload_file_size($context, $CFG->maxbytes);

    if ($methodid !== '') {
        $service = new \mod_seminarplaner\local\service\method_card_service();
        $draftitemid = $service->prepare_material_draft_itemid($cmid, (int)$context->id, $methodid, 0, 0);
    } else {
        // Anlegen-Modus: leerer Entwurfsbereich (wie methodlibrary.php ohne editmethodid).
        $draftitemid = file_get_unused_draft_itemid();
        file_prepare_draft_area($draftitemid, $context->id, 'mod_seminarplaner', 'method_materialien', 0, [
            'subdirs' => 0,
            'maxfiles' => 25,
            'maxbytes' => $maxuploadbytes,
            'areamaxbytes' => $maxuploadbytes,
            'accepted_types' => '*',
        ]);
    }

    $form = new \mod_seminarplaner\form\material_filemanager_form(null, [
        'fieldname' => 'sq_materialiendraftitemid',
        'maxbytes' => $maxuploadbytes,
        'context' => $context,
    ]);
    if (method_exists($form, 'disable_form_change_checker')) {
        $form->disable_form_change_checker();
    }
    $form->set_data((object)['sq_materialiendraftitemid' => $draftitemid]);

    return $form->render();
}
