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
 * Internal library functions.
 *
 * @package    mod_seminarplaner
 * @copyright  2026 Guido Brombach <gibro@posteo.de>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

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
 * Build the PDF logo payload (D52) for the client-side export.
 *
 * The stored logo file is embedded as a base64 data URL so the browser-side
 * jsPDF export can place it in the header of every PDF without an extra fetch.
 *
 * @param context_module $context Module context.
 * @param stdClass $seminarplaner Activity record (provides the logo position).
 * @return array{dataurl: string, position: string}|null Logo payload or null when no logo is set.
 */
function seminarplaner_get_pdf_logo(context_module $context, stdClass $seminarplaner): ?array {
    $fs = get_file_storage();
    $files = $fs->get_area_files($context->id, 'mod_seminarplaner', 'logo', 0, 'itemid, filepath, filename', false);
    $file = reset($files);
    if (!$file || $file->is_directory()) {
        return null;
    }

    $content = $file->get_content();
    if ($content === '') {
        return null;
    }

    $position = ($seminarplaner->logoposition ?? '') === 'left' ? 'left' : 'right';

    return [
        'dataurl' => 'data:' . $file->get_mimetype() . ';base64,' . base64_encode($content),
        'position' => $position,
    ];
}

/**
 * Canonical list of PDF/ZIM export column keys (D63).
 *
 * Single source of truth shared by the persisted column setting and its
 * validation. Order here is the default export order.
 *
 * @return string[]
 */
function seminarplaner_pdf_column_keys(): array {
    return [
        'uhrzeit', 'titel', 'seminarphase', 'kurzbeschreibung',
        'debrief', 'ablauf', 'lernziele', 'risiken', 'materialtechnik', 'sonstiges',
    ];
}

/**
 * Read the persisted ZIM-PDF column selection/order for an activity (D63).
 *
 * Stored per activity as plugin config `pdfcolumns_cmid_<cmid>` (JSON), analogous
 * to the D52 logo setting. Returns null when nothing valid is stored, so the
 * client falls back to "all columns in default order".
 *
 * @param int $cmid Course module id.
 * @return array|null {all: bool, order: string[]} or null.
 */
function seminarplaner_get_pdf_columns(int $cmid): ?array {
    $raw = get_config('mod_seminarplaner', 'pdfcolumns_cmid_' . $cmid);
    if ($raw === false || $raw === null || $raw === '') {
        return null;
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        return null;
    }

    $allowed = seminarplaner_pdf_column_keys();
    $order = [];
    foreach ((array)($decoded['order'] ?? []) as $key) {
        $key = (string)$key;
        if (in_array($key, $allowed, true) && !in_array($key, $order, true)) {
            $order[] = $key;
        }
    }
    // Append any columns missing from the stored order so new columns stay reachable.
    foreach ($allowed as $key) {
        if (!in_array($key, $order, true)) {
            $order[] = $key;
        }
    }

    return [
        'all' => !empty($decoded['all']),
        'order' => $order,
        'selected' => array_values(array_filter(
            (array)($decoded['selected'] ?? []),
            static fn($key) => in_array((string)$key, $allowed, true)
        )),
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

    set_error_handler(static function ($errno, $errstr) use ($userid) {
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
function seminarplaner_prepare_page(
    string $script,
    stdClass $cm,
    stdClass $course,
    stdClass $seminarplaner,
    ?string $amdmodule = null
): void {
    global $PAGE;

    $PAGE->set_url($script, ['id' => (int)$cm->id]);
    $PAGE->set_title(format_string($seminarplaner->name));
    $PAGE->set_heading(format_string($course->fullname));
    $PAGE->set_activity_record($seminarplaner);
    $styleversion = is_readable(__DIR__ . '/styles.css') ? (string)filemtime(__DIR__ . '/styles.css') : '1';
    $PAGE->requires->css(new moodle_url('/mod/seminarplaner/styles.css', ['v' => $styleversion]));

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
        set_error_handler(static function ($errno, $errstr) use (&$notice) {
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
 * Canonical seminar phase options used by forms and filters.
 *
 * @return array<string, string>
 */
function seminarplaner_phase_options(): array {
    return [
        'Orientierung' => 'Orientierung',
        'Erfahrungserhebung' => 'Erfahrungserhebung',
        'Analyse' => 'Analyse',
        'Handlungsteil' => 'Handlungsteil',
        'Transfer' => 'Transfer',
    ];
}

/**
 * Gruppengrößen-Cluster (value => label). Ersetzt die frühere 7-Werte-Skala
 * (1 / 2-3 / 3–5 / 6–12 / 13–24 / 25+ / beliebig) durch drei Cluster. Wert und
 * Label sind identisch, damit Filter, Karten, Import/Export und der gespeicherte
 * JSON-Wert konsistent bleiben.
 *
 * @return array<string,string>
 */
function seminarplaner_groupsize_options(): array {
    return [
        'Gruppenarbeit (2-5)' => 'Gruppenarbeit (2-5)',
        'Plenum (10-20)' => 'Plenum (10-20)',
        'beliebig' => 'beliebig',
    ];
}

/**
 * Map legacy seminar phase labels to the current five-phase taxonomy.
 *
 * @param string $phase Raw phase label.
 * @return string
 */
function seminarplaner_normalize_phase(string $phase): string {
    $phase = trim(strip_tags($phase));
    if ($phase === '') {
        return '';
    }

    $aliases = [
        'warm-up' => 'Orientierung',
        'einstieg' => 'Orientierung',
        'erwartungsabfrage' => 'Erfahrungserhebung',
        'vorwissen aktivieren' => 'Erfahrungserhebung',
        'wissen vermitteln' => 'Analyse',
        'reflexion' => 'Handlungsteil',
        'evaluation/feedback' => 'Transfer',
        'evaluation / feedback' => 'Transfer',
        'abschluss' => 'Transfer',
    ];
    $key = core_text::strtolower($phase);

    return $aliases[$key] ?? $phase;
}

/**
 * Normalize multiple seminar phase labels while preserving order and uniqueness.
 *
 * @param array<int, string> $phases Raw phase labels.
 * @return array<int, string>
 */
function seminarplaner_normalize_phases(array $phases): array {
    $out = [];
    $seen = [];
    foreach ($phases as $phase) {
        $normalized = seminarplaner_normalize_phase((string)$phase);
        if ($normalized === '') {
            continue;
        }
        $key = core_text::strtolower($normalized);
        if (isset($seen[$key])) {
            continue;
        }
        $seen[$key] = true;
        $out[] = $normalized;
    }

    return $out;
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
    global $DB;

    if ($context === null) {
        $context = context_module::instance($cmid);
    }

    // Nutzungszweck der Aktivität steuert die sichtbaren Tabs (Referent*innen-
    // Einstellung): konzipieren / durchfuehren / verwalten. Fallback = Standard.
    $usecase = 'durchfuehren';
    $cm = get_coursemodule_from_id('seminarplaner', $cmid, 0, false, IGNORE_MISSING);
    if ($cm) {
        $instance = $DB->get_record('seminarplaner', ['id' => $cm->instance], 'id, usecase');
        if ($instance && !empty($instance->usecase)) {
            $usecase = (string)$instance->usecase;
        }
    }

    $canmanageseminarplaner = has_capability('mod/seminarplaner:managemethods', $context)
        || has_capability('mod/seminarplaner:managegrids', $context)
        || has_capability('mod/seminarplaner:importfrommoddata', $context)
        || has_capability('mod/seminarplaner:exporttomoddata', $context);

    $rendericon = static function (string $name): string {
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

    // D50: die frühere Anlegen-Seite (methods.php) leitet auf die Bibliothek
    // um; beide Schlüssel markieren denselben Tab.
    $tabaliases = ['methodlibrary' => 'methods'];
    $active = $tabaliases[$active] ?? $active;

    $tabs = [];
    if ($canmanageseminarplaner) {
        // Reihenfolge/Benennung D16/D50. Immer sichtbar: Überblick · Sequenz ·
        // Bibliothek · Import/Export. Nach Nutzungszweck zusätzlich:
        // - "durchfuehren": Roter Faden (nach Bibliothek),
        // - "verwalten": Einreichen (am Ende).
        $tabs = [
            'grid' => [
                'label' => get_string('ueberblickmenu', 'mod_seminarplaner'),
                'path' => '/mod/seminarplaner/grid.php',
                'icon' => 'calendar-range',
            ],
            'sequenz' => [
                'label' => get_string('sequenzmenu', 'mod_seminarplaner'),
                'path' => '/mod/seminarplaner/sequenz.php',
                'icon' => 'list-checks',
            ],
            'methods' => [
                'label' => get_string('bibliothekmenu', 'mod_seminarplaner'),
                'path' => '/mod/seminarplaner/methodlibrary.php',
                'icon' => 'layout-grid',
            ],
        ];
        if ($usecase === 'durchfuehren' && has_capability('mod/seminarplaner:viewroterfaden', $context)) {
            $tabs['roterfaden'] = [
                'label' => get_string('roterfadenmenu', 'mod_seminarplaner'),
                'path' => '/mod/seminarplaner/roterfaden.php',
                'icon' => 'route',
            ];
        }
        $tabs['importexport'] = [
            'label' => get_string('importexport', 'mod_seminarplaner'),
            'path' => '/mod/seminarplaner/importexport.php',
            'icon' => 'arrow-left-right',
        ];
        if ($usecase === 'verwalten') {
            $tabs['review'] = [
                'label' => get_string('einreichenmenu', 'mod_seminarplaner'),
                'path' => '/mod/seminarplaner/review.php',
                'icon' => 'clipboard-check',
            ];
        }
    } else if (has_capability('mod/seminarplaner:viewroterfaden', $context)) {
        $tabs = [
            'roterfaden' => [
                'label' => get_string('roterfadenmenu', 'mod_seminarplaner'),
                'path' => '/mod/seminarplaner/roterfaden.php',
                'icon' => 'route',
            ],
        ];
    }

    $out = html_writer::start_div('kg-tabs');
    foreach ($tabs as $key => $tab) {
        $classes = 'kg-tab' . ($key === $active ? ' kg-tab-active' : '');
        $content = html_writer::tag(
            'span',
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
