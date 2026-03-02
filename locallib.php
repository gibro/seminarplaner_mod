<?php
// This file is part of Moodle - http://moodle.org/

/**
 * Resolve activity context and core records for Seminarplaner pages.
 *
 * @param int $id Course module id.
 * @param string $capability Required capability in module context.
 * @return array{cm: stdClass, course: stdClass, konzeptgenerator: stdClass, context: context_module}
 */
function konzeptgenerator_require_activity_context(int $id, string $capability): array {
    global $DB;

    $cm = get_coursemodule_from_id('konzeptgenerator', $id, 0, false, MUST_EXIST);
    $course = $DB->get_record('course', ['id' => $cm->course], '*', MUST_EXIST);
    $konzeptgenerator = $DB->get_record('konzeptgenerator', ['id' => $cm->instance], '*', MUST_EXIST);

    require_login($course, true, $cm);
    $context = context_module::instance($cm->id);
    require_capability($capability, $context);

    return [
        'cm' => $cm,
        'course' => $course,
        'konzeptgenerator' => $konzeptgenerator,
        'context' => $context,
    ];
}

/**
 * Configure shared page properties for Seminarplaner sub-pages.
 *
 * @param string $script Script path.
 * @param stdClass $cm Course module.
 * @param stdClass $course Course record.
 * @param stdClass $konzeptgenerator Module instance.
 * @param string|null $amdmodule Optional AMD module suffix.
 * @return void
 */
function konzeptgenerator_prepare_page(string $script, stdClass $cm, stdClass $course, stdClass $konzeptgenerator,
    ?string $amdmodule = null): void {
    global $PAGE;

    $PAGE->set_url($script, ['id' => (int)$cm->id]);
    $PAGE->set_title(format_string($konzeptgenerator->name));
    $PAGE->set_heading(format_string($course->fullname));
    $PAGE->set_activity_record($konzeptgenerator);
    $PAGE->requires->css('/mod/konzeptgenerator/styles.css');

    if ($amdmodule !== null && $amdmodule !== '') {
        $PAGE->requires->js_call_amd('mod_konzeptgenerator/' . $amdmodule, 'init', [(int)$cm->id]);
    }
}

/**
 * Render navigation tabs used across Seminarplaner pages.
 *
 * @param int $cmid Course module id.
 * @param string $active Active tab key.
 * @return string
 */
function konzeptgenerator_render_tabs(int $cmid, string $active): string {
    $tabs = [
        'grid' => ['label' => 'Seminarplan', 'path' => '/mod/konzeptgenerator/grid.php'],
        'methods' => ['label' => 'Methodenkarten', 'path' => '/mod/konzeptgenerator/methods.php'],
        'methodlibrary' => ['label' => 'Methodenbibliothek', 'path' => '/mod/konzeptgenerator/methodlibrary.php'],
        'planningmode' => ['label' => 'Bausteine', 'path' => '/mod/konzeptgenerator/planningmode.php'],
        'importexport' => ['label' => 'Import/Export', 'path' => '/mod/konzeptgenerator/importexport.php'],
        'review' => ['label' => 'Review', 'path' => '/mod/konzeptgenerator/review.php'],
    ];

    $out = html_writer::start_div('kg-tabs');
    foreach ($tabs as $key => $tab) {
        $classes = 'kg-tab' . ($key === $active ? ' kg-tab-active' : '');
        $out .= html_writer::link(new moodle_url($tab['path'], ['id' => $cmid]), $tab['label'], ['class' => $classes]);
    }
    $out .= html_writer::end_div();

    return $out;
}

/**
 * Render reusable checkbox multi-select dropdown form control.
 *
 * @param string $fieldid Base field id.
 * @param array<string, string> $options Value=>label map.
 * @param string $placeholder Toggle placeholder.
 * @param string $labelprefix Prefix used by JS label updates.
 * @return string
 */
function konzeptgenerator_render_multi_dropdown(string $fieldid, array $options, string $placeholder, string $labelprefix): string {
    $out = html_writer::start_div('kg-tag-dropdown', [
        'id' => $fieldid . '-dropdown',
        'data-kg-form-multi-dropdown' => '1',
        'data-kg-field' => '#' . $fieldid,
        'data-kg-label-prefix' => $labelprefix,
        'data-kg-placeholder' => $placeholder,
    ]);
    $out .= html_writer::tag('button', $placeholder, [
        'type' => 'button',
        'class' => 'kg-input kg-tag-dropdown-toggle',
        'id' => $fieldid . '-toggle',
        'data-kg-form-multi-toggle' => '1',
    ]);
    $out .= html_writer::start_div('kg-tag-dropdown-panel kg-hidden', [
        'id' => $fieldid . '-panel',
        'data-kg-form-multi-panel' => '1',
    ]);
    foreach ($options as $value => $label) {
        $out .= html_writer::start_tag('label', ['class' => 'kg-tag-option']);
        $out .= html_writer::empty_tag('input', [
            'type' => 'checkbox',
            'value' => (string)$value,
            'data-kg-form-multi-option' => '1',
        ]);
        $out .= html_writer::tag('span', s((string)$label));
        $out .= html_writer::end_tag('label');
    }
    $out .= html_writer::end_div();
    $out .= html_writer::end_div();
    $out .= html_writer::empty_tag('input', [
        'type' => 'hidden',
        'id' => $fieldid,
        'value' => '',
    ]);

    return $out;
}
