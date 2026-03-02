<?php
// This file is part of Moodle - http://moodle.org/

defined('MOODLE_INTERNAL') || die();

/**
 * Upgrade script for mod_konzeptgenerator.
 *
 * @param int $oldversion
 * @return bool
 */
function xmldb_konzeptgenerator_upgrade($oldversion) {
    global $DB;

    $dbman = $DB->get_manager();

    if ($oldversion < 2026022330) {
        $table = new xmldb_table('kgen_method_filemap');

        $table->add_field('id', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, XMLDB_SEQUENCE, null);
        $table->add_field('cmid', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
        $table->add_field('userid', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
        $table->add_field('methoduid', XMLDB_TYPE_CHAR, '255', null, XMLDB_NOTNULL, null, null);
        $table->add_field('itemid', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
        $table->add_field('timecreated', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
        $table->add_field('timemodified', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');

        $table->add_key('primary', XMLDB_KEY_PRIMARY, ['id']);

        $table->add_index('cm_user_method_uix', XMLDB_INDEX_UNIQUE, ['cmid', 'userid', 'methoduid']);
        $table->add_index('cm_user_item_uix', XMLDB_INDEX_UNIQUE, ['cmid', 'userid', 'itemid']);
        $table->add_index('cm_user_idx', XMLDB_INDEX_NOTUNIQUE, ['cmid', 'userid']);

        if (!$dbman->table_exists($table)) {
            $dbman->create_table($table);
        }

        upgrade_mod_savepoint(true, 2026022330, 'konzeptgenerator');
    }

    if ($oldversion < 2026022339) {
        $table = new xmldb_table('kgen_activity_setlink');

        $pendingversionid = new xmldb_field('pendingversionid', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0',
            'methodsetversionid');
        if (!$dbman->field_exists($table, $pendingversionid)) {
            $dbman->add_field($table, $pendingversionid);
        }

        $autosyncenabled = new xmldb_field('autosyncenabled', XMLDB_TYPE_INTEGER, '1', null, XMLDB_NOTNULL, null, '0',
            'pendingversionid');
        if (!$dbman->field_exists($table, $autosyncenabled)) {
            $dbman->add_field($table, $autosyncenabled);
        }

        upgrade_mod_savepoint(true, 2026022339, 'konzeptgenerator');
    }

    if ($oldversion < 2026022340) {
        $table = new xmldb_table('kgen_planning_state');

        $table->add_field('id', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, XMLDB_SEQUENCE, null);
        $table->add_field('cmid', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
        $table->add_field('statejson', XMLDB_TYPE_TEXT, 'big', null, null, null, null);
        $table->add_field('versionhash', XMLDB_TYPE_CHAR, '128', null, XMLDB_NOTNULL, null, null);
        $table->add_field('timecreated', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
        $table->add_field('timemodified', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
        $table->add_field('createdby', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
        $table->add_field('modifiedby', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');

        $table->add_key('primary', XMLDB_KEY_PRIMARY, ['id']);
        $table->add_index('cmid_uix', XMLDB_INDEX_UNIQUE, ['cmid']);

        if (!$dbman->table_exists($table)) {
            $dbman->create_table($table);
        }

        upgrade_mod_savepoint(true, 2026022340, 'konzeptgenerator');
    }

    return true;
}
