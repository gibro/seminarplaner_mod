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
        'uhrzeit', 'titel', 'referent', 'seminarphase', 'kurzbeschreibung',
        'debrief', 'ablauf', 'lernziele', 'risiken', 'materialtechnik', 'sonstiges',
    ];
}

/**
 * People who can be assigned to a placed seminar unit (D84).
 *
 * The assignment happens in the sequence, not in the library, and only names
 * course staff: everyone enrolled in this course who may plan seminars here
 * (`managegrids` — Trainer/in, Manager). Participants are never offered.
 *
 * @param context_module $context Module context.
 * @return array List of ['id' => int, 'fullname' => string, 'avatarurl' => string].
 */
function seminarplaner_get_referent_options(context_module $context): array {
    global $PAGE;

    $fields = 'u.id, u.firstname, u.lastname, u.firstnamephonetic, u.lastnamephonetic, u.middlename, '
        . 'u.alternatename, u.picture, u.imagealt, u.email';
    $users = get_enrolled_users($context, 'mod/seminarplaner:managegrids', 0, $fields, 'u.lastname, u.firstname');

    $options = [];
    foreach ($users as $user) {
        $picture = new user_picture($user);
        $picture->size = 100;
        $options[] = [
            'id' => (int)$user->id,
            'fullname' => fullname($user),
            'avatarurl' => $picture->get_url($PAGE)->out(false),
        ];
    }
    return $options;
}

/**
 * Ids that may be stored as Referent*innen of an activity (D84).
 *
 * Returns null when the activity context cannot be resolved. Callers must
 * treat that as "unknown" and skip filtering — an empty list means the
 * opposite ("nobody may be assigned here") and would silently delete
 * assignments.
 *
 * @param int $cmid Course module id.
 * @return int[]|null
 */
function seminarplaner_allowed_referent_ids(int $cmid): ?array {
    static $cache = [];

    if (array_key_exists($cmid, $cache)) {
        return $cache[$cmid];
    }
    try {
        $context = context_module::instance($cmid);
        $users = get_enrolled_users($context, 'mod/seminarplaner:managegrids', 0, 'u.id');
        $ids = array_map('intval', array_keys($users));
    } catch (Throwable $e) {
        $ids = null;
    }
    $cache[$cmid] = $ids;
    return $ids;
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
        if ($usecase === 'durchfuehren' && has_capability('mod/seminarplaner:viewlive', $context)) {
            $tabs['live'] = [
                'label' => get_string('livemenu', 'mod_seminarplaner'),
                'path' => '/mod/seminarplaner/live.php',
                'icon' => 'presentation',
            ];
        }
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
    } else {
        // Reine Durchfuehrende (D69): kein Bearbeiten, aber Souffleur und
        // Roter Faden — je nachdem, was ihre Rolle mitbringt.
        if ($usecase === 'durchfuehren' && has_capability('mod/seminarplaner:viewlive', $context)) {
            $tabs['live'] = [
                'label' => get_string('livemenu', 'mod_seminarplaner'),
                'path' => '/mod/seminarplaner/live.php',
                'icon' => 'presentation',
            ];
        }
        if (has_capability('mod/seminarplaner:viewroterfaden', $context)) {
            $tabs['roterfaden'] = [
                'label' => get_string('roterfadenmenu', 'mod_seminarplaner'),
                'path' => '/mod/seminarplaner/roterfaden.php',
                'icon' => 'route',
            ];
        }
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

/**
 * Render the shared seminar unit editor fields.
 *
 * D17 („ein Editor, drei Einstiege"): Sequenz-Modal und Bibliotheks-Editor
 * teilen sich dieses Markup, damit Feldauswahl, Reihenfolge und Bedienelemente
 * an beiden Stellen identisch sind. Unterschiedlich sind nur die Element-IDs
 * (über $prefix) und der Materialien-Block – die Sequenz lädt ihn per
 * Fragment-API nach, die Bibliothek rendert das Filemanager-Formular direkt.
 *
 * @param string $prefix Id-Präfix der Felder, z. B. 'sq-e-' oder 'ml-e-'.
 * @param array $options 'fieldclass' => Klasse der Feldhülle (Bibliothek braucht
 *                       zusätzlich 'field-card' für die Tiny-Editor-Regeln),
 *                       'lernzielbuttonid' => Id des Lernziel-Helfers ('' = kein Button),
 *                       'materials' => fertiges HTML des Materialien-Blocks,
 *                       'quickid'/'processid'/'materialsid' => Ids der drei Abschnitte,
 *                       'vorbereitung' => bool, Feld „Vorbereitung nötig" mitrendern.
 * @return string
 */
function seminarplaner_render_unit_form_fields(string $prefix, array $options = []): string {
    $fieldclass = (string)($options['fieldclass'] ?? 'sq-field');
    $lernzielbuttonid = (string)($options['lernzielbuttonid'] ?? '');
    $materials = (string)($options['materials'] ?? '');
    $quickid = (string)($options['quickid'] ?? '');
    $processid = (string)($options['processid'] ?? '');
    $materialsid = (string)($options['materialsid'] ?? '');
    $withvorbereitung = !empty($options['vorbereitung']);

    $open = static function (string $label, string $key) use ($prefix, $fieldclass): string {
        return html_writer::start_div($fieldclass)
            . html_writer::tag('label', s($label), ['class' => 'kg-label', 'for' => $prefix . $key]);
    };
    $close = static function (string $hint = ''): string {
        $out = '';
        if ($hint !== '') {
            $out .= html_writer::div(s($hint), 'sq-field__hint');
        }
        return $out . html_writer::end_div();
    };
    $text = static function (string $label, string $key, string $hint = '') use ($prefix, $open, $close): string {
        return $open($label, $key)
            . html_writer::empty_tag('input', ['type' => 'text', 'class' => 'kg-input', 'id' => $prefix . $key])
            . $close($hint);
    };
    $rich = static function (string $label, string $key, int $rows = 6) use ($prefix, $open, $close): string {
        return $open($label, $key)
            . html_writer::tag('textarea', '', [
                'class' => 'kg-input',
                'id' => $prefix . $key,
                'rows' => (string)$rows,
                'autocomplete' => 'off',
            ])
            . $close();
    };
    $multi = static function (
        string $label,
        string $key,
        array $choices,
        string $placeholder,
        string $labelprefix
    ) use ($prefix, $open, $close): string {
        return $open($label, $key)
            . seminarplaner_render_multi_dropdown($prefix . $key, $choices, $placeholder, $labelprefix)
            . $close();
    };
    $select = static function (string $label, string $key, array $choices) use ($prefix, $open, $close): string {
        $out = $open($label, $key);
        $out .= html_writer::start_tag('select', ['class' => 'kg-input', 'id' => $prefix . $key]);
        foreach ($choices as $value => $optionlabel) {
            $out .= html_writer::tag('option', s((string)$optionlabel), ['value' => (string)$value]);
        }
        $out .= html_writer::end_tag('select');
        return $out . $close();
    };
    // Alternative Seminareinheiten (D8/D21): Dropdown mit Suche, dessen Optionen
    // (alle anderen Einheiten des Bestands) erst das JavaScript beim Öffnen füllt.
    $alternativen = static function () use ($prefix, $open, $close): string {
        $out = $open('Alternative Seminareinheiten', 'alternativen');
        $out .= html_writer::start_div('kg-tag-dropdown', [
            'id' => $prefix . 'alternativen-dropdown',
            'data-kg-form-multi-dropdown' => '1',
            'data-kg-field' => '#' . $prefix . 'alternativen',
            'data-kg-label-prefix' => 'Alternativen',
            'data-kg-placeholder' => 'Alternativen wählen',
        ]);
        $out .= html_writer::tag('button', 'Alternativen wählen', [
            'type' => 'button',
            'class' => 'kg-input kg-tag-dropdown-toggle',
            'id' => $prefix . 'alternativen-toggle',
            'data-kg-form-multi-toggle' => '1',
        ]);
        $out .= html_writer::start_div('kg-tag-dropdown-panel kg-hidden', [
            'id' => $prefix . 'alternativen-panel',
            'data-kg-form-multi-panel' => '1',
        ]);
        $out .= html_writer::empty_tag('input', [
            'type' => 'search',
            'class' => 'kg-input kg-multi-search',
            'placeholder' => 'Titel der Seminareinheit suchen',
            'data-kg-form-multi-search' => '1',
        ]);
        $out .= html_writer::start_div('', ['id' => $prefix . 'alternativen-options']);
        $out .= html_writer::end_div();
        $out .= html_writer::end_div();
        $out .= html_writer::end_div();
        $out .= html_writer::empty_tag('input', [
            'type' => 'hidden',
            'id' => $prefix . 'alternativen',
            'value' => '',
        ]);
        return $out . $close();
    };
    // Klapp-Indikator wie überall sonst (.sq-tri) statt des nativen Markers.
    $summary = static function (string $label): string {
        return html_writer::tag(
            'summary',
            html_writer::tag('span', '▸', ['class' => 'sq-tri', 'aria-hidden' => 'true']) . ' ' . s($label)
        );
    };

    $out = html_writer::start_div('', $quickid !== '' ? ['id' => $quickid] : []);
    $out .= $text('Titel', 'titel');
    $out .= $rich('Lernziele (Ich kann …)', 'lernziele');
    if ($lernzielbuttonid !== '') {
        // D62: geführter Lernziel-Editor (Phase → Verb → Inhalt → Satz).
        $out .= html_writer::tag('button', '✎ Lernziel formulieren', [
            'type' => 'button',
            'class' => 'kg-btn sq-lz-trigger',
            'id' => $lernzielbuttonid,
        ]);
    }
    $out .= $rich('Kurzbeschreibung', 'kurzbeschreibung');
    $out .= $alternativen();
    $out .= $text('Zeitbedarf (Minuten)', 'zeitbedarf');
    $out .= $multi('Seminarphase', 'seminarphase', seminarplaner_phase_options(), 'Seminarphasen wählen', 'Seminarphasen');
    $out .= $multi('Sozialform', 'sozialform', [
        'Vortrag' => 'Vortrag',
        'Diskussion' => 'Diskussion',
        'Einzelarbeit' => 'Einzelarbeit',
        'Partnerarbeit' => 'Partnerarbeit',
        'Kleingruppen' => 'Kleingruppen',
        'Galeriegang' => 'Galeriegang',
        'Fishbowl' => 'Fishbowl',
    ], 'Sozialformen wählen', 'Sozialformen');
    $out .= html_writer::end_div();

    $out .= html_writer::start_tag('details', $processid !== ''
        ? ['class' => 'sq-section', 'id' => $processid]
        : ['class' => 'sq-section']);
    $out .= $summary('Ablauf und Rahmen');
    $out .= html_writer::start_div('sq-section__inner');
    $out .= $rich('Ablauf', 'ablauf', 8);
    $out .= $multi('Raumanforderungen', 'raum', [
        'Plenum' => 'Plenum',
        'Stuhlkreis' => 'Stuhlkreis',
        'Stehtische' => 'Stehtische',
        'viel Freifläche' => 'viel Freifläche',
        'Gruppentische' => 'Gruppentische',
        'Gruppenräume' => 'Gruppenräume',
        'akustisch ruhig' => 'akustisch ruhig',
    ], 'Raumanforderungen wählen', 'Raumanforderungen');
    $out .= $select('Gruppengröße', 'gruppengroesse', ['' => '(keine Angabe)'] + seminarplaner_groupsize_options());
    if ($withvorbereitung) {
        // Nur der Bibliotheks-Editor kennt dieses Feld; es speist die Karten-Badges,
        // die Stapelbearbeitung und den Import/Export. Ohne Eingabefeld würde die
        // Bibliothek den gespeicherten Wert beim nächsten Speichern leeren.
        $out .= $select('Vorbereitung nötig', 'vorbereitung', [
            '' => '(keine Angabe)',
            'keine' => 'keine',
            '<10 Min' => '<10 Min',
            '10–30 Min' => '10–30 Min',
            '>30 Min' => '>30 Min',
        ]);
    }
    $out .= $rich('Risiken/Tipps', 'risiken');
    $out .= $rich('Debrief/Reflexionsfragen', 'debrief');
    $out .= $text('Tags/Schlüsselworte', 'tags', 'Hilft beim Wiederfinden und bei Vorschlägen');
    $out .= $text('Autor*in / Kontakt', 'autor');
    $out .= html_writer::end_div();
    $out .= html_writer::end_tag('details');

    $out .= html_writer::start_tag('details', $materialsid !== ''
        ? ['class' => 'sq-section', 'id' => $materialsid]
        : ['class' => 'sq-section']);
    $out .= $summary('Materialien und Technik');
    $out .= html_writer::start_div('sq-section__inner');
    $out .= html_writer::start_div($fieldclass);
    $out .= html_writer::tag('label', 'Materialien', ['class' => 'kg-label', 'for' => $prefix . 'materialien']);
    $out .= $materials;
    $out .= html_writer::end_div();
    $out .= $rich('Material/Technik', 'materialtechnik');
    $out .= html_writer::end_div();
    $out .= html_writer::end_tag('details');

    return $out;
}
