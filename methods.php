<?php
// This file is part of Moodle - http://moodle.org/

require_once(__DIR__ . '/../../config.php');
require_once($CFG->libdir . '/editorlib.php');
require_once($CFG->libdir . '/formslib.php');
require_once(__DIR__ . '/locallib.php');

$id = required_param('id', PARAM_INT);
$activity = seminarplaner_require_activity_context($id, 'mod/seminarplaner:view');
$cm = $activity['cm'];
$course = $activity['course'];
$seminarplaner = $activity['seminarplaner'];
$context = $activity['context'];
seminarplaner_cleanup_invalid_fileprefs((int)$USER->id);

seminarplaner_prepare_page('/mod/seminarplaner/methods.php', $cm, $course, $seminarplaner, 'methods');
$PAGE->requires->js_init_code('window.onbeforeunload = null;');

$maxuploadbytes = get_user_max_upload_file_size($context, $CFG->maxbytes);
$materialsadddraftitemid = file_get_submitted_draft_itemid('kg_materialiendraftitemid');
file_prepare_draft_area($materialsadddraftitemid, $context->id, 'mod_seminarplaner', 'method_materialien', 0, [
    'subdirs' => 0,
    'maxfiles' => 25,
    'maxbytes' => $maxuploadbytes,
    'areamaxbytes' => $maxuploadbytes,
    'accepted_types' => '*',
]);
$materialsaddform = new \mod_seminarplaner\form\material_filemanager_form(null, [
    'fieldname' => 'kg_materialiendraftitemid',
    'maxbytes' => $maxuploadbytes,
    'context' => $context,
]);
$materialsaddform->set_data((object)['kg_materialiendraftitemid' => $materialsadddraftitemid]);
$lucidebaseurl = $CFG->wwwroot . '/mod/seminarplaner/pix/lucide';
$renderlucide = static function(string $name, string $sizeclass = 'kg-lucide--sm') use ($lucidebaseurl): string {
    return html_writer::empty_tag('img', [
        'src' => $lucidebaseurl . '/' . $name . '.svg',
        'class' => trim('kg-lucide ' . $sizeclass),
        'alt' => '',
        'aria-hidden' => 'true',
        'loading' => 'lazy',
        'decoding' => 'async',
    ]);
};
$rendericontext = static function(string $icon, string $text, string $wrapperclass = 'kg-label-content') use ($renderlucide): string {
    return html_writer::tag('span',
        $renderlucide($icon) . html_writer::tag('span', s($text)),
        ['class' => $wrapperclass]
    );
};
$rendersummary = static function(string $text, string $icon) use ($rendericontext): string {
    return $rendericontext($icon, $text, 'kg-summary-content');
};
$renderbuttonlabel = static function(string $text, string $icon) use ($rendericontext): string {
    return $rendericontext($icon, $text, 'kg-btn-content');
};

echo $OUTPUT->header();

echo $OUTPUT->heading(format_string($seminarplaner->name));
echo seminarplaner_render_tabs((int)$cm->id, 'methods');

echo html_writer::start_div('kg-shell');
echo html_writer::start_div('ig-container kg-container-full', ['id' => 'kg-add-method-section']);
echo html_writer::tag('h3', 'Neue Methodenkarte erstellen');
echo html_writer::start_div('ig-nav');
echo html_writer::link('#kg-section-quick', '1) Schnellfassung');
echo html_writer::link('#kg-section-quality', '2) Qualität & Rahmen');
echo html_writer::link('#kg-section-materials', '3) Materialien & Technik');
echo html_writer::end_div();

echo html_writer::start_div('kg-form', ['id' => 'kg-method-form']);
echo html_writer::start_tag('details', ['class' => 'kg-section ig-section', 'id' => 'kg-section-quick', 'open' => 'open']);
echo html_writer::tag('summary', $rendersummary('1) Schnellfassung', 'notebook-pen'));
echo html_writer::start_div('kg-stack field-stack ig-inner');
echo html_writer::start_div('field-card');
echo html_writer::tag('label', $rendericontext('file-text', 'Titel *'), ['for' => 'kg-f-titel', 'class' => 'kg-label']);
echo html_writer::empty_tag('input', ['type' => 'text', 'id' => 'kg-f-titel', 'class' => 'kg-input', 'required' => 'required']);
echo html_writer::end_div();
echo html_writer::start_div('field-card');
echo html_writer::start_div('kg-two');
echo html_writer::start_div();
echo html_writer::tag('label', 'Seminarphase', ['for' => 'kg-f-seminarphase', 'class' => 'kg-label']);
echo seminarplaner_render_multi_dropdown('kg-f-seminarphase', [
    'Warm-Up' => 'Warm-Up',
    'Einstieg' => 'Einstieg',
    'Erwartungsabfrage' => 'Erwartungsabfrage',
    'Vorwissen aktivieren' => 'Vorwissen aktivieren',
    'Wissen vermitteln' => 'Wissen vermitteln',
    'Reflexion' => 'Reflexion',
    'Transfer' => 'Transfer',
    'Evaluation/Feedback' => 'Evaluation/Feedback',
    'Abschluss' => 'Abschluss',
], 'Seminarphasen wählen', 'Seminarphasen');
echo html_writer::end_div();
echo html_writer::start_div();
echo html_writer::tag('label', $rendericontext('tags', 'Tags / Schlüsselworte'), ['for' => 'kg-f-tags', 'class' => 'kg-label']);
echo html_writer::empty_tag('input', ['type' => 'text', 'id' => 'kg-f-tags', 'class' => 'kg-input']);
echo html_writer::end_div();
echo html_writer::end_div();
echo html_writer::end_div();
echo html_writer::start_div('field-card');
echo html_writer::tag('label', $rendericontext('git-compare-arrows', 'Alternativmethoden'), ['for' => 'kg-f-alternativen', 'class' => 'kg-label']);
echo html_writer::start_div('kg-tag-dropdown', [
    'id' => 'kg-f-alternativen-dropdown',
    'data-kg-form-multi-dropdown' => '1',
    'data-kg-field' => '#kg-f-alternativen',
    'data-kg-label-prefix' => 'Alternativen',
    'data-kg-placeholder' => 'Alternativen wählen',
]);
echo html_writer::tag('button', 'Alternativen wählen', [
    'type' => 'button',
    'class' => 'kg-input kg-tag-dropdown-toggle',
    'id' => 'kg-f-alternativen-toggle',
    'data-kg-form-multi-toggle' => '1',
]);
echo html_writer::start_div('kg-tag-dropdown-panel kg-hidden', [
    'id' => 'kg-f-alternativen-panel',
    'data-kg-form-multi-panel' => '1',
]);
echo html_writer::start_div('', ['id' => 'kg-f-alternativen-options']);
echo html_writer::end_div();
echo html_writer::tag('div', '', ['id' => 'kg-f-alternativen-hint', 'class' => 'sp-filter-status']);
echo html_writer::end_div();
echo html_writer::end_div();
echo html_writer::empty_tag('input', [
    'type' => 'hidden',
    'id' => 'kg-f-alternativen',
    'value' => '',
]);
echo html_writer::end_div();
echo html_writer::start_div('field-card');
echo html_writer::start_div('kg-two');
echo html_writer::start_div();
echo html_writer::tag('label', $rendericontext('clock-3', 'Zeitbedarf'), ['for' => 'kg-f-zeitbedarf', 'class' => 'kg-label']);
echo html_writer::start_tag('select', ['id' => 'kg-f-zeitbedarf', 'class' => 'kg-input']);
foreach (['5', '10', '20', '30', '45', '60', '90', '120', '150', '180', 'mehr als 180 Minuten'] as $v) {
    echo html_writer::tag('option', s($v), ['value' => $v]);
}
echo html_writer::end_tag('select');
echo html_writer::end_div();
echo html_writer::start_div();
echo html_writer::tag('label', $rendericontext('users', 'Gruppengröße'), ['for' => 'kg-f-gruppengroesse', 'class' => 'kg-label']);
echo html_writer::start_tag('select', ['id' => 'kg-f-gruppengroesse', 'class' => 'kg-input']);
foreach (['1', '2-3', '3–5', '6–12', '13–24', '25+', 'beliebig'] as $v) {
    echo html_writer::tag('option', s($v), ['value' => $v]);
}
echo html_writer::end_tag('select');
echo html_writer::end_div();
echo html_writer::end_div();
echo html_writer::end_div();
echo html_writer::start_div('field-card');
echo html_writer::tag('label', $rendericontext('brain', 'Kognitive Dimension'), ['for' => 'kg-f-kognitive', 'class' => 'kg-label']);
echo seminarplaner_render_multi_dropdown('kg-f-kognitive', [
    'Erinnern' => 'Erinnern: Wissen wiedergeben oder abrufen (z.B. benennen, definieren)',
    'Verstehen' => 'Verstehen: Informationen interpretieren oder erklären (z.B. zusammenfassen, vergleichen)',
    'Anwenden' => 'Anwenden: Wissen in neuen Situationen umsetzen (z.B. ausführen, verallgemeinern)',
    'Analysieren' => 'Analysieren: Informationen in ihre Bestandteile zerlegen (z.B. unterscheiden, klassifizieren)',
    'Bewerten' => 'Bewerten: Urteile fällen und Kriterien anwenden (z.B. überprüfen, kritisch bewerten)',
    'Erschaffen' => 'Erschaffen: Neues Wissen oder neue Produkte entwickeln (z.B. planen, erzeugen, bauen)',
], 'Dimensionen wählen', 'Dimensionen');
echo html_writer::end_div();
echo html_writer::start_div('field-card');
echo html_writer::tag('label', 'Kurzbeschreibung', ['for' => 'kg-f-kurzbeschreibung', 'class' => 'kg-label']);
echo html_writer::tag('textarea', '', ['id' => 'kg-f-kurzbeschreibung', 'name' => 'kg_f_kurzbeschreibung', 'class' => 'kg-input', 'rows' => '10']);
echo html_writer::end_div();
echo html_writer::start_div('field-card');
echo html_writer::tag('label', 'Ablauf', ['for' => 'kg-f-ablauf', 'class' => 'kg-label']);
echo html_writer::tag('textarea', '', ['id' => 'kg-f-ablauf', 'name' => 'kg_f_ablauf', 'class' => 'kg-input', 'rows' => '10']);
echo html_writer::end_div();
echo html_writer::end_div();
echo html_writer::end_tag('details');

echo html_writer::start_tag('details', ['class' => 'kg-section ig-section', 'id' => 'kg-section-quality']);
echo html_writer::tag('summary', $rendersummary('2) Qualität & Rahmen', 'shield-check'));
echo html_writer::start_div('kg-stack field-stack ig-inner');
echo html_writer::start_div('field-card');
echo html_writer::tag('label', $rendericontext('target', 'Lernziele (Ich-kann ...)'), ['for' => 'kg-f-lernziele', 'class' => 'kg-label']);
echo html_writer::tag('textarea', '', ['id' => 'kg-f-lernziele', 'name' => 'kg_f_lernziele', 'class' => 'kg-input', 'rows' => '10']);
echo html_writer::end_div();
echo html_writer::start_div('field-card');
echo html_writer::start_div('kg-two');
echo html_writer::start_div();
echo html_writer::tag('label', 'Komplexitätsgrad', ['for' => 'kg-f-komplexitaet', 'class' => 'kg-label']);
echo html_writer::start_tag('select', ['id' => 'kg-f-komplexitaet', 'class' => 'kg-input']);
foreach (['sehr niedrig', 'niedrig', 'mittel', 'hoch'] as $v) {
    echo html_writer::tag('option', s($v), ['value' => $v]);
}
echo html_writer::end_tag('select');
echo html_writer::end_div();
echo html_writer::start_div();
echo html_writer::tag('label', 'Autor*in / Kontakt', ['for' => 'kg-f-autor', 'class' => 'kg-label']);
echo html_writer::empty_tag('input', ['type' => 'text', 'id' => 'kg-f-autor', 'class' => 'kg-input']);
echo html_writer::end_div();
echo html_writer::end_div();
echo html_writer::end_div();
echo html_writer::start_div('field-card');
echo html_writer::tag('label', 'Vorbereitung nötig', ['for' => 'kg-f-vorbereitung', 'class' => 'kg-label']);
echo html_writer::start_tag('select', ['id' => 'kg-f-vorbereitung', 'class' => 'kg-input']);
foreach (['keine', '<10 Min', '10–30 Min', '>30 Min'] as $v) {
    echo html_writer::tag('option', s($v), ['value' => $v]);
}
echo html_writer::end_tag('select');
echo html_writer::end_div();
echo html_writer::start_div('field-card');
echo html_writer::start_div('kg-two');
echo html_writer::start_div();
echo html_writer::tag('label', 'Raumanforderungen', ['for' => 'kg-f-raum', 'class' => 'kg-label']);
echo seminarplaner_render_multi_dropdown('kg-f-raum', [
    'Plenum' => 'Plenum',
    'Stuhlkreis' => 'Stuhlkreis',
    'Stehtische' => 'Stehtische',
    'viel Freifläche' => 'viel Freifläche',
    'Gruppentische' => 'Gruppentische',
    'Gruppenräume' => 'Gruppenräume',
    'akustisch ruhig' => 'akustisch ruhig',
], 'Raumanforderungen wählen', 'Raumanforderungen');
echo html_writer::end_div();
echo html_writer::start_div();
echo html_writer::tag('label', $rendericontext('handshake', 'Sozialform'), ['for' => 'kg-f-sozialform', 'class' => 'kg-label']);
echo seminarplaner_render_multi_dropdown('kg-f-sozialform', [
    'Vortrag' => 'Vortrag',
    'Diskussion' => 'Diskussion',
    'Einzelarbeit' => 'Einzelarbeit',
    'Partnerarbeit' => 'Partnerarbeit',
    'Kleingruppen' => 'Kleingruppen',
    'Galeriegang' => 'Galeriegang',
    'Fishbowl' => 'Fishbowl',
], 'Sozialformen wählen', 'Sozialformen');
echo html_writer::end_div();
echo html_writer::end_div();
echo html_writer::end_div();
echo html_writer::start_div('field-card');
echo html_writer::tag('label', $rendericontext('triangle-alert', 'Risiken/Tipps'), ['for' => 'kg-f-risiken', 'class' => 'kg-label']);
echo html_writer::tag('textarea', '', ['id' => 'kg-f-risiken', 'name' => 'kg_f_risiken', 'class' => 'kg-input', 'rows' => '10']);
echo html_writer::end_div();
echo html_writer::start_div('field-card');
echo html_writer::tag('label', 'Debrief/Reflexionsfragen', ['for' => 'kg-f-debrief', 'class' => 'kg-label']);
echo html_writer::tag('textarea', '', ['id' => 'kg-f-debrief', 'name' => 'kg_f_debrief', 'class' => 'kg-input', 'rows' => '10']);
echo html_writer::end_div();
echo html_writer::end_div();
echo html_writer::end_tag('details');

echo html_writer::start_tag('details', ['class' => 'kg-section ig-section', 'id' => 'kg-section-materials']);
echo html_writer::tag('summary', $rendersummary('3) Materialien & Technik', 'wrench'));
echo html_writer::start_div('kg-stack field-stack ig-inner');
echo html_writer::start_div('field-card');
echo html_writer::tag('label', $rendericontext('paperclip', 'Materialien'), ['for' => 'kg-f-materialien', 'class' => 'kg-label']);
$materialsaddform->display();
echo html_writer::end_div();
echo html_writer::start_div('field-card');
echo html_writer::tag('label', 'Material/Technik', ['for' => 'kg-f-materialtechnik', 'class' => 'kg-label']);
echo html_writer::tag('textarea', '', ['id' => 'kg-f-materialtechnik', 'name' => 'kg_f_materialtechnik', 'class' => 'kg-input', 'rows' => '10']);
echo html_writer::end_div();
echo html_writer::end_div();
echo html_writer::end_tag('details');

echo html_writer::start_div('kg-row');
echo html_writer::tag('button', $renderbuttonlabel('Methode hinzufügen', 'plus'), ['type' => 'button', 'id' => 'kg-add-method', 'class' => 'kg-btn kg-btn-primary kg-btn-with-icon']);
echo html_writer::end_div();

echo html_writer::end_div();
echo html_writer::tag('div', '', ['id' => 'kg-status', 'class' => 'kg-status']);
echo html_writer::end_div();
echo html_writer::end_div();

// Enable preferred Moodle editor (Tiny in Moodle 5.x by default) on rich text fields.
$editor = editors_get_preferred_editor(FORMAT_HTML);
$contentstyle = 'html,body{max-width:100%;overflow-x:hidden;box-sizing:border-box;}'
    . 'body{white-space:normal;word-break:break-word;overflow-wrap:anywhere;}'
    . 'p,div,span,li,td,th{max-width:100%;word-break:break-word;overflow-wrap:anywhere;}'
    . 'img,table,iframe,pre,code{max-width:100%;}';
$editoroptions = [
    'context' => $context,
    'maxfiles' => 0,
    'maxbytes' => 0,
    'trusttext' => false,
    'subdirs' => 0,
    'content_style' => $contentstyle,
];
foreach ([
    'kg-f-kurzbeschreibung',
    'kg-f-ablauf',
    'kg-f-lernziele',
    'kg-f-risiken',
    'kg-f-debrief',
    'kg-f-materialtechnik',
] as $editorid) {
    $editor->use_editor($editorid, $editoroptions, null);
}

echo $OUTPUT->footer();
