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
 * Web service and external function definitions.
 *
 * @package    mod_seminarplaner
 * @copyright  2026 Guido Brombach <gibro@posteo.de>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

$functions = [
    'mod_seminarplaner_get_method_cards' => [
        'classname' => 'mod_seminarplaner\\external\\api',
        'methodname' => 'get_method_cards',
        'description' => 'Get seminar units for current user/activity.',
        'type' => 'read',
        'ajax' => true,
    ],
    'mod_seminarplaner_save_method_cards' => [
        'classname' => 'mod_seminarplaner\\external\\api',
        'methodname' => 'save_method_cards',
        'description' => 'Save seminar units for current user/activity.',
        'type' => 'write',
        'ajax' => true,
    ],
    'mod_seminarplaner_list_global_methodsets' => [
        'classname' => 'mod_seminarplaner\\external\\api',
        'methodname' => 'list_global_methodsets',
        'description' => 'List published global method sets from local_seminarplaner.',
        'type' => 'read',
        'ajax' => true,
    ],
    'mod_seminarplaner_import_global_methodset' => [
        'classname' => 'mod_seminarplaner\\external\\api',
        'methodname' => 'import_global_methodset',
        'description' => 'Import a global method set into the current activity seminar units.',
        'type' => 'write',
        'ajax' => true,
    ],
    'mod_seminarplaner_browse_global_library' => [
        'classname' => 'mod_seminarplaner\\external\\api',
        'methodname' => 'browse_global_library',
        'description' => 'Browse individual methods of all published global collections (D29/D33, no prior import).',
        'type' => 'read',
        'ajax' => true,
    ],
    'mod_seminarplaner_list_imported_konzepte' => [
        'classname' => 'mod_seminarplaner\\external\\api',
        'methodname' => 'list_imported_konzepte',
        'description' => 'List global seminar concepts already imported into this activity (D55 library tab).',
        'type' => 'read',
        'ajax' => true,
    ],
    'mod_seminarplaner_delete_imported_konzept' => [
        'classname' => 'mod_seminarplaner\\external\\api',
        'methodname' => 'delete_imported_konzept',
        'description' => 'Remove an imported global seminar concept and its units from this activity.',
        'type' => 'write',
        'ajax' => true,
    ],
    'mod_seminarplaner_adopt_global_method' => [
        'classname' => 'mod_seminarplaner\\external\\api',
        'methodname' => 'adopt_global_method',
        'description' => 'Adopt one global method as an independent local copy (D33).',
        'type' => 'write',
        'ajax' => true,
    ],
    'mod_seminarplaner_get_methodset_sync_status' => [
        'classname' => 'mod_seminarplaner\\external\\api',
        'methodname' => 'get_methodset_sync_status',
        'description' => 'Get method-set sync status for the activity.',
        'type' => 'read',
        'ajax' => true,
    ],
    'mod_seminarplaner_apply_methodset_updates' => [
        'classname' => 'mod_seminarplaner\\external\\api',
        'methodname' => 'apply_methodset_updates',
        'description' => 'Apply pending/global updates for one linked method set in the activity.',
        'type' => 'write',
        'ajax' => true,
    ],
    'mod_seminarplaner_list_review_targets' => [
        'classname' => 'mod_seminarplaner\\external\\api',
        'methodname' => 'list_review_targets',
        'description' => 'List global method sets that can be updated and resubmitted for review.',
        'type' => 'read',
        'ajax' => true,
    ],
    'mod_seminarplaner_list_reviewer_candidates' => [
        'classname' => 'mod_seminarplaner\\external\\api',
        'methodname' => 'list_reviewer_candidates',
        'description' => 'List users that can review global method sets in the current scope.',
        'type' => 'read',
        'ajax' => true,
    ],
    'mod_seminarplaner_list_public_reviewers' => [
        'classname' => 'mod_seminarplaner\\external\\api',
        'methodname' => 'list_public_reviewers',
        'description' => 'List opted-in Konzeptverantwortliche as a public trust signal (name only).',
        'type' => 'read',
        'ajax' => true,
    ],
    'mod_seminarplaner_get_review_method_candidates' => [
        'classname' => 'mod_seminarplaner\\external\\api',
        'methodname' => 'get_review_method_candidates',
        'description' => 'List new/changed activity methods against a selected global method set.',
        'type' => 'read',
        'ajax' => true,
    ],
    'mod_seminarplaner_submit_methodset_for_review' => [
        'classname' => 'mod_seminarplaner\\external\\api',
        'methodname' => 'submit_methodset_for_review',
        'description' => 'Create/update a global method set from the activity and submit it for review.',
        'type' => 'write',
        'ajax' => true,
    ],
    'mod_seminarplaner_create_methodset_for_review' => [
        'classname' => 'mod_seminarplaner\\external\\api',
        'methodname' => 'create_methodset_for_review',
        'description' => 'Create a new global method set from selected activity methods and submit it for review.',
        'type' => 'write',
        'ajax' => true,
    ],
    'mod_seminarplaner_submit_seminarkonzept_for_review' => [
        'classname' => 'mod_seminarplaner\\external\\api',
        'methodname' => 'submit_seminarkonzept_for_review',
        'description' => 'D32: Submit a complete Seminarkonzept (plan incl. sequence) for review.',
        'type' => 'write',
        'ajax' => true,
    ],
    'mod_seminarplaner_create_grid' => [
        'classname' => 'mod_seminarplaner\\external\\api',
        'methodname' => 'create_grid',
        'description' => 'Create a seminar plan in a Seminarplaner activity.',
        'type' => 'write',
        'ajax' => true,
    ],
    'mod_seminarplaner_list_grids' => [
        'classname' => 'mod_seminarplaner\\external\\api',
        'methodname' => 'list_grids',
        'description' => 'List seminar plans in a Seminarplaner activity.',
        'type' => 'read',
        'ajax' => true,
    ],
    'mod_seminarplaner_get_roterfaden_state' => [
        'classname' => 'mod_seminarplaner\\external\\api',
        'methodname' => 'get_roterfaden_state',
        'description' => 'Read published Common Thread state for an activity.',
        'type' => 'read',
        'ajax' => true,
    ],
    'mod_seminarplaner_publish_roterfaden' => [
        'classname' => 'mod_seminarplaner\\external\\api',
        'methodname' => 'publish_roterfaden',
        'description' => 'Publish one seminar plan snapshot as Common Thread.',
        'type' => 'write',
        'ajax' => true,
    ],
    'mod_seminarplaner_unpublish_roterfaden' => [
        'classname' => 'mod_seminarplaner\\external\\api',
        'methodname' => 'unpublish_roterfaden',
        'description' => 'Set Common Thread snapshot to not visible.',
        'type' => 'write',
        'ajax' => true,
    ],
    'mod_seminarplaner_delete_grid' => [
        'classname' => 'mod_seminarplaner\\external\\api',
        'methodname' => 'delete_grid',
        'description' => 'Archive (delete) a seminar plan in a Seminarplaner activity.',
        'type' => 'write',
        'ajax' => true,
    ],
    'mod_seminarplaner_get_user_state' => [
        'classname' => 'mod_seminarplaner\\external\\api',
        'methodname' => 'get_user_state',
        'description' => 'Get user state for a seminar plan.',
        'type' => 'read',
        'ajax' => true,
    ],
    'mod_seminarplaner_get_sequenz_intro' => [
        'classname' => 'mod_seminarplaner\\external\\api',
        'methodname' => 'get_sequenz_intro',
        'description' => 'Whether the one-time sequence intro was seen (D35).',
        'type' => 'read',
        'ajax' => true,
    ],
    'mod_seminarplaner_mark_sequenz_intro_seen' => [
        'classname' => 'mod_seminarplaner\\external\\api',
        'methodname' => 'mark_sequenz_intro_seen',
        'description' => 'Mark the one-time sequence intro as seen (D35).',
        'type' => 'write',
        'ajax' => true,
    ],
    'mod_seminarplaner_save_user_state' => [
        'classname' => 'mod_seminarplaner\\external\\api',
        'methodname' => 'save_user_state',
        'description' => 'Save user state for a seminar plan.',
        'type' => 'write',
        'ajax' => true,
    ],
    'mod_seminarplaner_get_planning_state' => [
        'classname' => 'mod_seminarplaner\\external\\api',
        'methodname' => 'get_planning_state',
        'description' => 'Get shared planning mode state for activity.',
        'type' => 'read',
        'ajax' => true,
    ],
    'mod_seminarplaner_save_planning_state' => [
        'classname' => 'mod_seminarplaner\\external\\api',
        'methodname' => 'save_planning_state',
        'description' => 'Save shared planning mode state for activity.',
        'type' => 'write',
        'ajax' => true,
    ],
    'mod_seminarplaner_validate_import_payload' => [
        'classname' => 'mod_seminarplaner\\external\\api',
        'methodname' => 'validate_import_payload',
        'description' => 'Validate a legacy import payload.',
        'type' => 'write',
        'ajax' => true,
    ],
    'mod_seminarplaner_validate_export_payload' => [
        'classname' => 'mod_seminarplaner\\external\\api',
        'methodname' => 'validate_export_payload',
        'description' => 'Validate a legacy export payload.',
        'type' => 'write',
        'ajax' => true,
    ],
    'mod_seminarplaner_acquire_lock' => [
        'classname' => 'mod_seminarplaner\\external\\api',
        'methodname' => 'acquire_lock',
        'description' => 'Acquire a soft lock for a seminar plan.',
        'type' => 'write',
        'ajax' => true,
    ],
    'mod_seminarplaner_refresh_lock' => [
        'classname' => 'mod_seminarplaner\\external\\api',
        'methodname' => 'refresh_lock',
        'description' => 'Refresh a soft lock for a seminar plan.',
        'type' => 'write',
        'ajax' => true,
    ],
    'mod_seminarplaner_release_lock' => [
        'classname' => 'mod_seminarplaner\\external\\api',
        'methodname' => 'release_lock',
        'description' => 'Release a soft lock for a seminar plan.',
        'type' => 'write',
        'ajax' => true,
    ],
    'mod_seminarplaner_lock_status' => [
        'classname' => 'mod_seminarplaner\\external\\api',
        'methodname' => 'lock_status',
        'description' => 'Get lock status for a seminar plan.',
        'type' => 'read',
        'ajax' => true,
    ],
    'mod_seminarplaner_set_pdf_columns' => [
        'classname' => 'mod_seminarplaner\\external\\api',
        'methodname' => 'set_pdf_columns',
        'description' => 'Persist ZIM-PDF column selection and order per activity (D63).',
        'type' => 'write',
        'ajax' => true,
    ],
];
