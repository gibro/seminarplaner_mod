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
 * Language strings (en).
 *
 * @package    mod_seminarplaner
 * @copyright  2026 Guido Brombach <gibro@posteo.de>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

$string['pluginname'] = 'Concept Generator';
$string['modulename'] = 'Concept Generator';
$string['modulenameplural'] = 'Concept Generators';
$string['pluginadministration'] = 'Concept generator administration';
$string['seminarplaner:addinstance'] = 'Add a new concept generator activity';
$string['seminarplaner:view'] = 'View concept generator';
$string['seminarplaner:viewroterfaden'] = 'View Common Thread';
$string['seminarplaner:viewlive'] = 'View the live presenter view';
$string['seminarplaner:managemethods'] = 'Manage methods';
$string['seminarplaner:managegrids'] = 'Manage seminar plans';
$string['seminarplaner:overrideglobalset'] = 'Override global method sets locally';
$string['seminarplaner:importfrommoddata'] = 'Import from database activity';
$string['seminarplaner:exporttomoddata'] = 'Export to database-compatible format';
$string['seminarplaner:breaklock'] = 'Break seminar plan lock';
$string['viewplaceholder'] = 'MVP: Full method form + drag-and-drop seminar plan with server-side per-user persistence.';
$string['statsmethodsets'] = 'Linked method sets: {$a}';
$string['statsgrids'] = 'Active seminar plans: {$a}';
$string['statsoverrides'] = 'Local method overrides: {$a}';
$string['readonlynotice'] = 'You have read-only access. Editing is not enabled for your role.';
$string['gridname'] = 'Seminar plan name';
$string['creategrid'] = 'Create seminar plan';
$string['refreshgrids'] = 'Refresh seminar plans';
$string['availablegrids'] = 'Available seminar plans';
$string['loadgrid'] = 'Load seminar plan';
$string['savestate'] = 'Save';
$string['methodcards'] = 'Seminar units';
$string['addmethodcardmenu'] = 'Add seminar unit';
$string['managemethodlibrarymenu'] = 'Manage method library';
$string['addmethodcard'] = 'Add method';
$string['clearform'] = 'Clear form';
$string['methodlibrary'] = 'Method library';
$string['gridplanning'] = 'Seminar plan';
$string['sequenzmenu'] = 'Sequence';
$string['ueberblickmenu'] = 'Overview';
$string['einreichenmenu'] = 'Submit';
$string['bibliothekmenu'] = 'Library';
$string['bibliothek_create'] = '＋ Create new seminar unit';
$string['ueberblick_subline'] = 'The complete seminar plan at a glance - read-only.';
$string['ueberblick_readonlynote'] = 'This overview shows your complete plan. Editing happens in the "Sequence" tab.';
$string['ueberblick_tosequenz'] = 'Go there';
$string['sequenz_dramatoggle'] = 'Didactic recommendations';
$string['sequenz_dramatoggle_info'] = 'Checks the plan against didactic rules of thumb - morning opening, activation after lunch, varied social forms, breaks, closing, time frame and goal coverage - and shows hints below the day plan. Recommendations only: nothing in the plan changes automatically.';
$string['sequenz_publishlabel'] = 'Publish seminar plan';
$string['sequenz_publishlabel_info'] = 'Shows this seminar plan to all participants in the "Common Thread" tab. Only one plan per activity can be published - switching on replaces an existing publication, switching off withdraws it.';
$string['sequenz_previewnote'] = 'The day at a glance - reorder units via drag & drop or the arrows, pick alternatives, add headings.';
$string['sequenz_planlabel'] = 'Seminar plan';
$string['sequenz_prevday'] = 'Previous day';
$string['sequenz_nextday'] = 'Next day';
$string['reviewmenu'] = 'Review';
$string['importexport'] = 'Import/Export';
$string['pdflogoheader'] = 'PDF logo';
$string['pdflogo'] = 'Logo for PDF exports';
$string['pdflogo_help'] = 'Upload a logo (PNG, JPG or GIF) that is placed in the header of every PDF export of this activity (ZIM, concept collection and material list). The logo is stored once per activity and does not need to be uploaded again for each export.';
$string['pdflogoposition'] = 'Logo position';
$string['pdflogoposition_right'] = 'Top right';
$string['pdflogoposition_left'] = 'Top left';
$string['usecaseheader'] = 'Seminar planner use case';
$string['usecase'] = 'What do you need the seminar planner for?';
$string['usecase_help'] = 'This choice controls which tabs are shown in this activity:

* **Design a seminar:** Overview, Sequence, Library, Import/Export
* **Run a designed seminar:** Overview, Sequence, Library, Live, Common Thread, Import/Export
* **Manage a global seminar concept:** Overview, Sequence, Library, Import/Export, Submit

The Live and Common Thread tabs only appear with the matching capability.';
$string['usecase_konzipieren'] = 'Design a seminar';
$string['usecase_durchfuehren'] = 'Run a designed seminar';
$string['usecase_verwalten'] = 'Manage a global seminar concept';
$string['roterfadenmenu'] = 'Common Thread';
$string['livemenu'] = 'Live';
$string['live_intro'] = 'The prompter for running the seminar: you start it yourself and move on manually, like the presenter mode of a slide deck. The view is read-only and never changes the seminar plan.';
$string['live_planlabel'] = 'Seminar plan';
$string['live_startatlabel'] = 'Start at';
$string['live_startbutton'] = 'Start the session';
$string['live_empty'] = 'Nothing has been placed in this seminar plan yet.';
$string['live_now'] = 'Running now';
$string['live_next'] = 'Next';
$string['live_prev'] = 'Back';
$string['live_showclock'] = 'Show clock';
$string['live_fullscreen'] = 'Full screen';
$string['live_quit'] = 'Quit';
$string['live_keyhint'] = 'Keyboard: ← and → or the space bar move through the steps.';
$string['roterfaden_empty'] = 'No Common Thread has been published yet';
$string['roterfaden_publishlabel'] = 'Publish seminar plan as Common Thread';
$string['roterfaden_theme_label'] = 'Timeline style';
$string['roterfaden_theme_modern'] = 'Modern';
$string['roterfaden_theme_kompakt'] = 'Compact';
$string['timespan'] = 'Time range';
$string['stepsize'] = 'Step (minutes)';
$string['applygrid'] = 'Apply seminar plan';
$string['advancedtools'] = 'Advanced tools';
$string['statejson'] = 'State JSON';

$string['privacy:metadata:core_files'] = 'Method attachments are stored in Moodle file areas.';
$string['privacy:metadata:kgen_grid_user_state'] = 'Stores user-specific saved seminar plan state.';
$string['privacy:metadata:kgen_grid_user_state:gridid'] = 'Grid reference.';
$string['privacy:metadata:kgen_grid_user_state:userid'] = 'User id.';
$string['privacy:metadata:kgen_grid_user_state:statejson'] = 'Serialized user state; also holds the user ids assigned as Referent*in of a seminar unit.';
$string['privacy:metadata:kgen_grid_user_state:versionhash'] = 'Conflict hash of saved state.';
$string['privacy:metadata:kgen_grid_user_state:timecreated'] = 'Creation timestamp.';
$string['privacy:metadata:kgen_grid_user_state:timemodified'] = 'Last modification timestamp.';
$string['privacy:metadata:kgen_grid_lock'] = 'Stores temporary edit locks for seminar plans.';
$string['privacy:metadata:kgen_grid_lock:gridid'] = 'Grid reference.';
$string['privacy:metadata:kgen_grid_lock:userid'] = 'User holding the lock.';
$string['privacy:metadata:kgen_grid_lock:locktoken'] = 'Lock token.';
$string['privacy:metadata:kgen_grid_lock:expiresat'] = 'Lock expiry timestamp.';
$string['privacy:metadata:kgen_method_filemap'] = 'Maps user seminar units to Moodle file item ids.';
$string['privacy:metadata:kgen_method_filemap:cmid'] = 'Course module id.';
$string['privacy:metadata:kgen_method_filemap:userid'] = 'User id.';
$string['privacy:metadata:kgen_method_filemap:methoduid'] = 'Method uid.';
$string['privacy:metadata:kgen_method_filemap:itemid'] = 'Moodle file item id.';
$string['privacy:metadata:kgen_import_export_log'] = 'Audit data for import and export actions.';
$string['privacy:metadata:kgen_import_export_log:cmid'] = 'Course module id.';
$string['privacy:metadata:kgen_import_export_log:direction'] = 'Import/export direction.';
$string['privacy:metadata:kgen_import_export_log:status'] = 'Operation status.';
$string['privacy:metadata:kgen_import_export_log:payloadmeta'] = 'Payload metadata.';
$string['privacy:metadata:kgen_import_export_log:message'] = 'Operation message.';
$string['privacy:metadata:kgen_import_export_log:actorid'] = 'User id of actor.';
$string['privacy:metadata:kgen_import_export_log:timecreated'] = 'Creation timestamp.';
$string['privacy:metadata:kgen_grid'] = 'Shared seminar plan definitions with author references.';
$string['privacy:metadata:kgen_grid:cmid'] = 'Course module id.';
$string['privacy:metadata:kgen_grid:createdby'] = 'Creating user id.';
$string['privacy:metadata:kgen_grid:modifiedby'] = 'Last modifying user id.';
$string['privacy:metadata:kgen_planning_state'] = 'Shared planning mode state with author references.';
$string['privacy:metadata:kgen_planning_state:cmid'] = 'Course module id.';
$string['privacy:metadata:kgen_planning_state:createdby'] = 'Creating user id.';
$string['privacy:metadata:kgen_planning_state:modifiedby'] = 'Last modifying user id.';
$string['privacy:metadata:kgen_roterfaden_state'] = 'Published common-thread state with publisher reference.';
$string['privacy:metadata:kgen_roterfaden_state:cmid'] = 'Course module id.';
$string['privacy:metadata:kgen_roterfaden_state:publishedby'] = 'Publishing user id.';
$string['privacy:metadata:kgen_activity_setlink'] = 'Links to imported global method sets.';
$string['privacy:metadata:kgen_activity_setlink:cmid'] = 'Course module id.';
$string['privacy:metadata:kgen_activity_setlink:createdby'] = 'Importing user id.';
$string['privacy:metadata:kgen_activity_methodovr'] = 'Local method overrides with author references.';
$string['privacy:metadata:kgen_activity_methodovr:cmid'] = 'Course module id.';
$string['privacy:metadata:kgen_activity_methodovr:createdby'] = 'Creating user id.';
$string['privacy:metadata:kgen_activity_methodovr:modifiedby'] = 'Last modifying user id.';
