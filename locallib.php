<?php
// This file is part of Moodle - http://moodle.org/

/**
 * Resolve activity context and core records for Seminarplaner pages.
 *
 * @param int $id Course module id.
 * @param string $capability Required capability in module context.
 * @return array{cm: stdClass, course: stdClass, seminarplaner: stdClass, context: context_module}
 */
function seminarplaner_require_activity_context(int $id, string $capability): array {
    global $DB;

    $cm = get_coursemodule_from_id('seminarplaner', $id, 0, false, MUST_EXIST);
    $course = $DB->get_record('course', ['id' => $cm->course], '*', MUST_EXIST);
    $seminarplaner = $DB->get_record('seminarplaner', ['id' => $cm->instance], '*', MUST_EXIST);

    seminarplaner_install_unserialize_notice_guard(0);
    require_login($course, true, $cm);
    seminarplaner_cleanup_invalid_fileprefs((int)$GLOBALS['USER']->id);
    $context = context_module::instance($cm->id);
    require_capability($capability, $context);

    return [
        'cm' => $cm,
        'course' => $course,
        'seminarplaner' => $seminarplaner,
        'context' => $context,
    ];
}

/**
 * Install a runtime guard for malformed unserialize() notices in user preferences.
 *
 * The handler targets only the known unserialize offset notice and tries to
 * identify the preference name via backtrace (`get_user_preferences($name, ...)`),
 * then removes the broken preference entry for the current user.
 *
 * @param int $userid Optional user id (0 = resolve from global $USER at runtime).
 * @return void
 */
function seminarplaner_install_unserialize_notice_guard(int $userid = 0): void {
    static $installed = false;
    if ($installed) {
        return;
    }
    $installed = true;

    set_error_handler(static function($errno, $errstr) use ($userid) {
        global $DB, $USER;

        $message = (string)$errstr;
        if ($message === '' || strpos($message, 'unserialize(): Error at offset') === false) {
            return false;
        }

        $prefname = '';
        $frames = debug_backtrace(DEBUG_BACKTRACE_PROVIDE_OBJECT);
        foreach ($frames as $frame) {
            if (($frame['function'] ?? '') !== 'get_user_preferences') {
                continue;
            }
            if (!isset($frame['args'][0]) || !is_string($frame['args'][0])) {
                continue;
            }
            $prefname = (string)$frame['args'][0];
            if ($prefname !== '') {
                break;
            }
        }

        $targetuserid = $userid > 0 ? $userid : (int)($USER->id ?? 0);
        if ($targetuserid > 0 && $prefname !== '') {
            $DB->delete_records('user_preferences', ['userid' => $targetuserid, 'name' => $prefname]);
        }

        // Suppress this specific notice for this request.
        return true;
    });
}

/**
 * Configure shared page properties for Seminarplaner sub-pages.
 *
 * @param string $script Script path.
 * @param stdClass $cm Course module.
 * @param stdClass $course Course record.
 * @param stdClass $seminarplaner Module instance.
 * @param string|null $amdmodule Optional AMD module suffix.
 * @return void
 */
function seminarplaner_prepare_page(string $script, stdClass $cm, stdClass $course, stdClass $seminarplaner,
    ?string $amdmodule = null): void {
    global $PAGE;

    $PAGE->set_url($script, ['id' => (int)$cm->id]);
    $PAGE->set_title(format_string($seminarplaner->name));
    $PAGE->set_heading(format_string($course->fullname));
    $PAGE->set_activity_record($seminarplaner);
    $PAGE->requires->css('/mod/seminarplaner/styles.css');

    if ($amdmodule !== null && $amdmodule !== '') {
        $PAGE->requires->js_call_amd('mod_seminarplaner/' . $amdmodule, 'init', [(int)$cm->id]);
    }
}

/**
 * Clean malformed serialized user preferences.
 *
 * Broken serialized values in preferences can trigger unserialize notices
 * inside Moodle core while rendering or saving filemanager widgets.
 *
 * @param int $userid
 * @return void
 */
function seminarplaner_cleanup_invalid_fileprefs(int $userid): void {
    global $DB;
    static $processed = [];

    if ($userid <= 0) {
        return;
    }
    if (!empty($processed[$userid])) {
        return;
    }
    $processed[$userid] = true;

    $records = $DB->get_records_select(
        'user_preferences',
        'userid = :userid',
        [
            'userid' => $userid,
        ],
        '',
        'id, name, value'
    );
    if (!$records) {
        return;
    }

    foreach ($records as $record) {
        $raw = (string)$record->value;
        // Only inspect values that look like serialized payloads.
        if ($raw === '' || !preg_match('/^(a|O|s|i|d|b|C|N):/', $raw)) {
            continue;
        }
        $notice = false;
        set_error_handler(static function($errno, $errstr) use (&$notice) {
            $notice = true;
            return true;
        });
        try {
            $decoded = unserialize($raw);
        } catch (\Throwable $e) {
            $decoded = false;
            $notice = true;
        }
        restore_error_handler();
        if ($notice || ($decoded === false && $raw !== 'b:0;')) {
            $DB->delete_records('user_preferences', ['id' => (int)$record->id]);
        }
    }
}

/**
 * Render navigation tabs used across Seminarplaner pages.
 *
 * @param int $cmid Course module id.
 * @param string $active Active tab key.
 * @param context_module|null $context Optional module context.
 * @return string
 */
function seminarplaner_render_tabs(int $cmid, string $active, ?context_module $context = null): string {
    if ($context === null) {
        $context = context_module::instance($cmid);
    }

    $canmanageseminarplaner = has_capability('mod/seminarplaner:managemethods', $context)
        || has_capability('mod/seminarplaner:managegrids', $context)
        || has_capability('mod/seminarplaner:importfrommoddata', $context)
        || has_capability('mod/seminarplaner:exporttomoddata', $context);

    $rendericon = static function(string $name): string {
        if ($name === '') {
            return '';
        }
        return html_writer::empty_tag('img', [
            'src' => (new moodle_url('/mod/seminarplaner/pix/lucide/' . $name . '.svg'))->out(false),
            'class' => 'kg-tab-icon',
            'alt' => '',
            'aria-hidden' => 'true',
            'loading' => 'lazy',
            'decoding' => 'async',
        ]);
    };

    $tabs = [];
    if ($canmanageseminarplaner) {
        $tabs = [
            'grid' => ['label' => get_string('gridplanning', 'mod_seminarplaner'), 'path' => '/mod/seminarplaner/grid.php', 'icon' => 'calendar-range'],
            'methods' => ['label' => get_string('methodcards', 'mod_seminarplaner'), 'path' => '/mod/seminarplaner/methods.php', 'icon' => 'layout-grid'],
            'methodlibrary' => ['label' => get_string('methodlibrary', 'mod_seminarplaner'), 'path' => '/mod/seminarplaner/methodlibrary.php', 'icon' => 'library'],
            'planningmode' => ['label' => 'Bausteine', 'path' => '/mod/seminarplaner/planningmode.php', 'icon' => 'blocks'],
            'importexport' => ['label' => get_string('importexport', 'mod_seminarplaner'), 'path' => '/mod/seminarplaner/importexport.php', 'icon' => 'arrow-left-right'],
            'review' => ['label' => get_string('reviewmenu', 'mod_seminarplaner'), 'path' => '/mod/seminarplaner/review.php', 'icon' => 'clipboard-check'],
        ];
        if (has_capability('mod/seminarplaner:viewroterfaden', $context)) {
            $tabs = ['grid' => $tabs['grid'], 'roterfaden' => [
                'label' => get_string('roterfadenmenu', 'mod_seminarplaner'),
                'path' => '/mod/seminarplaner/roterfaden.php',
                'icon' => 'route',
            ]] + array_diff_key($tabs, ['grid' => true]);
        }
    } else if (has_capability('mod/seminarplaner:viewroterfaden', $context)) {
        $tabs = [
            'roterfaden' => ['label' => get_string('roterfadenmenu', 'mod_seminarplaner'), 'path' => '/mod/seminarplaner/roterfaden.php', 'icon' => 'route'],
        ];
    }

    $out = html_writer::start_div('kg-tabs');
    foreach ($tabs as $key => $tab) {
        $classes = 'kg-tab' . ($key === $active ? ' kg-tab-active' : '');
        $content = html_writer::tag('span',
            $rendericon((string)($tab['icon'] ?? ''))
            . html_writer::tag('span', s((string)$tab['label']), ['class' => 'kg-tab-label']),
            ['class' => 'kg-tab-content']
        );
        $out .= html_writer::link(new moodle_url($tab['path'], ['id' => $cmid]), $content, ['class' => $classes]);
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
function seminarplaner_render_multi_dropdown(string $fieldid, array $options, string $placeholder, string $labelprefix): string {
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
