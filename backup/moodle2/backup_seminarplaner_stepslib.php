<?php
// This file is part of Moodle - http://moodle.org/

defined('MOODLE_INTERNAL') || die();

/**
 * Backup structure step for mod_seminarplaner.
 */
class backup_seminarplaner_activity_structure_step extends backup_activity_structure_step {
    /**
     * Define backup structure.
     *
     * @return backup_nested_element
     */
    protected function define_structure(): backup_nested_element {
        global $DB;
        $dbman = $DB->get_manager();
        $tableexists = static function(string $tablename) use ($dbman): bool {
            return $dbman->table_exists(new xmldb_table($tablename));
        };

        $seminarplaner = new backup_nested_element('seminarplaner', ['id'], [
            'course',
            'name',
            'intro',
            'introformat',
            'defaultmethodsetid',
            'timecreated',
            'timemodified',
        ]);

        $methodcardsstate = new backup_nested_element('methodcards_state', ['id'], [
            'methodsjson',
        ]);

        $activitysetlinks = new backup_nested_element('activity_setlinks');
        $activitysetlink = new backup_nested_element('activity_setlink', ['id'], [
            'methodsetid',
            'methodsetversionid',
            'pendingversionid',
            'autosyncenabled',
            'isdefault',
            'timecreated',
            'createdby',
        ]);

        $activitymethodovrs = new backup_nested_element('activity_methodovrs');
        $activitymethodovr = new backup_nested_element('activity_methodovr', ['id'], [
            'source_methodid',
            'source_setversionid',
            'title',
            'seminarphase',
            'zeitbedarf',
            'gruppengroesse',
            'kurzbeschreibung',
            'ablauf',
            'lernziele',
            'komplexitaetsgrad',
            'vorbereitung',
            'raumanforderungen',
            'sozialform',
            'risiken_tipps',
            'debrief',
            'material_technik',
            'tags',
            'kognitive_dimension',
            'autor_kontakt',
            'custommetajson',
            'h5pcontentid',
            'timecreated',
            'timemodified',
            'createdby',
            'modifiedby',
        ]);

        $planningstates = new backup_nested_element('planning_states');
        $planningstate = new backup_nested_element('planning_state', ['id'], [
            'statejson',
            'versionhash',
            'timecreated',
            'timemodified',
            'createdby',
            'modifiedby',
        ]);

        $grids = new backup_nested_element('grids');
        $grid = new backup_nested_element('grid', ['id'], [
            'name',
            'description',
            'isarchived',
            'timecreated',
            'timemodified',
            'createdby',
            'modifiedby',
        ]);
        $griduserstates = new backup_nested_element('grid_user_states');
        $griduserstate = new backup_nested_element('grid_user_state', ['id'], [
            'userid',
            'statejson',
            'versionhash',
            'timecreated',
            'timemodified',
        ]);

        $roterfadenstates = new backup_nested_element('roterfaden_states');
        $roterfadenstate = new backup_nested_element('roterfaden_state', ['id'], [
            'gridid',
            'statejson',
            'ispublished',
            'publishedby',
            'timecreated',
            'timemodified',
        ]);

        $methodfilemaps = new backup_nested_element('method_filemaps');
        $methodfilemap = new backup_nested_element('method_filemap', ['id'], [
            'userid',
            'methoduid',
            'itemid',
            'timecreated',
            'timemodified',
        ]);

        $seminarplaner->add_child($methodcardsstate);
        if ($tableexists('kgen_activity_setlink')) {
            $seminarplaner->add_child($activitysetlinks);
            $activitysetlinks->add_child($activitysetlink);
        }
        if ($tableexists('kgen_activity_methodovr')) {
            $seminarplaner->add_child($activitymethodovrs);
            $activitymethodovrs->add_child($activitymethodovr);
        }
        if ($tableexists('kgen_planning_state')) {
            $seminarplaner->add_child($planningstates);
            $planningstates->add_child($planningstate);
        }
        if ($tableexists('kgen_grid')) {
            $seminarplaner->add_child($grids);
            $grids->add_child($grid);
            if ($tableexists('kgen_grid_user_state')) {
                $grid->add_child($griduserstates);
                $griduserstates->add_child($griduserstate);
            }
        }
        if ($tableexists('kgen_roterfaden_state')) {
            $seminarplaner->add_child($roterfadenstates);
            $roterfadenstates->add_child($roterfadenstate);
        }
        if ($tableexists('kgen_method_filemap')) {
            $seminarplaner->add_child($methodfilemaps);
            $methodfilemaps->add_child($methodfilemap);
        }

        $seminarplaner->set_source_table('seminarplaner', ['id' => backup::VAR_ACTIVITYID]);

        $methodcardsstatekeysql = $DB->sql_concat("'methods_cmid_'", 'cm.id');
        $methodcardsstate->set_source_sql(
            "SELECT cp.id, cp.value AS methodsjson
               FROM {config_plugins} cp
               JOIN {course_modules} cm ON cm.instance = :instanceid
               JOIN {modules} mo ON mo.id = cm.module
              WHERE cp.plugin = 'mod_seminarplaner'
                AND mo.name = 'seminarplaner'
                AND cp.name = {$methodcardsstatekeysql}",
            [
                'instanceid' => backup::VAR_PARENTID,
            ]
        );

        if ($tableexists('kgen_activity_setlink')) {
            $activitysetlink->set_source_sql(
                    "SELECT asl.id, asl.methodsetid, asl.methodsetversionid, asl.pendingversionid,
                        asl.autosyncenabled, asl.isdefault, asl.timecreated, asl.createdby
                   FROM {kgen_activity_setlink} asl
                   JOIN {course_modules} cm ON cm.id = asl.cmid
                   JOIN {modules} mo ON mo.id = cm.module
                  WHERE cm.instance = :instanceid
                    AND mo.name = 'seminarplaner'",
                [
                    'instanceid' => backup::VAR_PARENTID,
                ]
            );
            $activitysetlink->annotate_ids('user', 'createdby');
        }
        if ($tableexists('kgen_activity_methodovr')) {
            $activitymethodovr->set_source_sql(
                    "SELECT am.id, am.source_methodid, am.source_setversionid, am.title, am.seminarphase, am.zeitbedarf,
                        am.gruppengroesse, am.kurzbeschreibung, am.ablauf, am.lernziele, am.komplexitaetsgrad,
                        am.vorbereitung, am.raumanforderungen, am.sozialform, am.risiken_tipps, am.debrief,
                        am.material_technik, am.tags, am.kognitive_dimension, am.autor_kontakt, am.custommetajson,
                        am.h5pcontentid, am.timecreated, am.timemodified, am.createdby, am.modifiedby
                   FROM {kgen_activity_methodovr} am
                   JOIN {course_modules} cm ON cm.id = am.cmid
                   JOIN {modules} mo ON mo.id = cm.module
                  WHERE cm.instance = :instanceid
                    AND mo.name = 'seminarplaner'",
                [
                    'instanceid' => backup::VAR_PARENTID,
                ]
            );
            $activitymethodovr->annotate_ids('user', 'createdby');
            $activitymethodovr->annotate_ids('user', 'modifiedby');
        }
        if ($tableexists('kgen_planning_state')) {
            $planningstate->set_source_sql(
                    "SELECT ps.id, ps.statejson, ps.versionhash, ps.timecreated, ps.timemodified, ps.createdby, ps.modifiedby
                   FROM {kgen_planning_state} ps
                   JOIN {course_modules} cm ON cm.id = ps.cmid
                   JOIN {modules} mo ON mo.id = cm.module
                  WHERE cm.instance = :instanceid
                    AND mo.name = 'seminarplaner'",
                [
                    'instanceid' => backup::VAR_PARENTID,
                ]
            );
            $planningstate->annotate_ids('user', 'createdby');
            $planningstate->annotate_ids('user', 'modifiedby');
        }
        if ($tableexists('kgen_grid')) {
            $grid->set_source_sql(
                    "SELECT g.id, g.name, g.description, g.isarchived, g.timecreated, g.timemodified, g.createdby, g.modifiedby
                   FROM {kgen_grid} g
                   JOIN {course_modules} cm ON cm.id = g.cmid
                   JOIN {modules} mo ON mo.id = cm.module
                  WHERE cm.instance = :instanceid
                    AND mo.name = 'seminarplaner'",
                [
                    'instanceid' => backup::VAR_PARENTID,
                ]
            );
            $grid->annotate_ids('user', 'createdby');
            $grid->annotate_ids('user', 'modifiedby');
            if ($tableexists('kgen_grid_user_state')) {
                $griduserstate->set_source_table('kgen_grid_user_state', ['gridid' => backup::VAR_PARENTID]);
            }
        }
        if ($tableexists('kgen_roterfaden_state')) {
            $roterfadenstate->set_source_sql(
                    "SELECT rf.id, rf.gridid, rf.statejson, rf.ispublished, rf.publishedby, rf.timecreated, rf.timemodified
                   FROM {kgen_roterfaden_state} rf
                   JOIN {course_modules} cm ON cm.id = rf.cmid
                   JOIN {modules} mo ON mo.id = cm.module
                  WHERE cm.instance = :instanceid
                    AND mo.name = 'seminarplaner'",
                [
                    'instanceid' => backup::VAR_PARENTID,
                ]
            );
            $roterfadenstate->annotate_ids('user', 'publishedby');
        }
        if ($tableexists('kgen_method_filemap')) {
            $methodfilemap->set_source_sql(
                    "SELECT mf.id, mf.userid, mf.methoduid, mf.itemid, mf.timecreated, mf.timemodified
                   FROM {kgen_method_filemap} mf
                   JOIN {course_modules} cm ON cm.id = mf.cmid
                   JOIN {modules} mo ON mo.id = cm.module
                  WHERE cm.instance = :instanceid
                    AND mo.name = 'seminarplaner'",
                [
                    'instanceid' => backup::VAR_PARENTID,
                ]
            );
            $methodfilemap->annotate_files('mod_seminarplaner', 'method_materialien', 'itemid');
            $methodfilemap->annotate_files('mod_seminarplaner', 'method_h5p', 'itemid');
        }

        $seminarplaner->annotate_files('mod_seminarplaner', 'intro', null);

        return $this->prepare_activity_structure($seminarplaner);
    }
}
