<?php
// This file is part of Moodle - http://moodle.org/

require_once(__DIR__ . '/../../config.php');
require_once($CFG->libdir . '/editorlib.php');
require_once($CFG->libdir . '/formslib.php');
require_once(__DIR__ . '/locallib.php');

$id = required_param('id', PARAM_INT);
$activity = konzeptgenerator_require_activity_context($id, 'mod/konzeptgenerator:managemethods');
$cm = $activity['cm'];
$course = $activity['course'];
$konzeptgenerator = $activity['konzeptgenerator'];
$context = $activity['context'];

konzeptgenerator_prepare_page('/mod/konzeptgenerator/methodlibrary.php', $cm, $course, $konzeptgenerator, 'methodlibrary');

$maxuploadbytes = get_user_max_upload_file_size($context, $CFG->maxbytes);
$materialseditdraftitemid = file_get_submitted_draft_itemid('ml_materialiendraftitemid');
file_prepare_draft_area($materialseditdraftitemid, $context->id, 'mod_konzeptgenerator', 'method_materialien', 0, [
    'subdirs' => 0,
    'maxfiles' => 25,
    'maxbytes' => $maxuploadbytes,
    'accepted_types' => '*',
]);
$materialseditform = new \mod_konzeptgenerator\form\material_filemanager_form(null, [
    'fieldname' => 'ml_materialiendraftitemid',
    'maxbytes' => $maxuploadbytes,
]);
$materialseditform->set_data((object)['ml_materialiendraftitemid' => $materialseditdraftitemid]);

echo $OUTPUT->header();

echo $OUTPUT->heading(format_string($konzeptgenerator->name));
echo konzeptgenerator_render_tabs((int)$cm->id, 'methodlibrary');

echo html_writer::start_div('kg-shell');
echo html_writer::tag('h3', 'Methodenbibliothek verwalten');

echo html_writer::start_div('kg-ie-block kg-library-step');
echo html_writer::tag('h4', '1. Methode suchen');
echo html_writer::start_div('sp-filterbar');

echo '<label class="sp-filter"><span class="sp-filter__label">Suche</span><input id="ml-filter-search" class="kg-input" type="search" placeholder="Titel, Beschreibung, Tags"></label>';

echo '<label class="sp-filter"><span class="sp-filter__label">Tags</span>';
echo '<div class="kg-tag-dropdown" id="ml-filter-tags-dropdown">';
echo '<button type="button" class="kg-input kg-tag-dropdown-toggle" id="ml-filter-tags-toggle">Tags wählen</button>';
echo '<div class="kg-tag-dropdown-panel kg-hidden" id="ml-filter-tags-panel">';
echo '<label class="kg-tag-option"><input type="checkbox" id="ml-filter-tags-all" checked><span>Alle</span></label>';
echo '<div id="ml-filter-tags-options"></div>';
echo '</div></div></label>';

echo '<label class="sp-filter"><span class="sp-filter__label">Seminarphase</span>';
echo '<div class="kg-tag-dropdown" id="ml-filter-phase-dropdown">';
echo '<button type="button" class="kg-input kg-tag-dropdown-toggle" id="ml-filter-phase-toggle">Alle Seminarphasen</button>';
echo '<div class="kg-tag-dropdown-panel kg-hidden" id="ml-filter-phase-panel">';
echo '<label class="kg-tag-option"><input type="checkbox" id="ml-filter-phase-all" checked><span>Alle</span></label>';
echo '<div id="ml-filter-phase-options">';
foreach (['Warm-Up', 'Einstieg', 'Erwartungsabfrage', 'Vorwissen aktivieren', 'Wissen vermitteln', 'Reflexion', 'Transfer', 'Evaluation/Feedback', 'Abschluss'] as $v) {
    echo '<label class="kg-tag-option"><input type="checkbox" value="' . s($v) . '"><span>' . s($v) . '</span></label>';
}
echo '</div></div></div></label>';

echo '<label class="sp-filter"><span class="sp-filter__label">Gruppengröße</span>';
echo '<div class="kg-tag-dropdown" id="ml-filter-group-dropdown">';
echo '<button type="button" class="kg-input kg-tag-dropdown-toggle" id="ml-filter-group-toggle">Alle Gruppengrößen</button>';
echo '<div class="kg-tag-dropdown-panel kg-hidden" id="ml-filter-group-panel">';
echo '<label class="kg-tag-option"><input type="checkbox" id="ml-filter-group-all" checked><span>Alle</span></label>';
echo '<div id="ml-filter-group-options">';
foreach (['1', '2-3', '3–5', '6–12', '13–24', '25+', 'beliebig'] as $v) {
    echo '<label class="kg-tag-option"><input type="checkbox" value="' . s($v) . '"><span>' . s($v) . '</span></label>';
}
echo '</div></div></div></label>';

echo '<label class="sp-filter"><span class="sp-filter__label">Zeitbedarf</span>';
echo '<div class="kg-tag-dropdown" id="ml-filter-duration-dropdown">';
echo '<button type="button" class="kg-input kg-tag-dropdown-toggle" id="ml-filter-duration-toggle">Alle Zeiten</button>';
echo '<div class="kg-tag-dropdown-panel kg-hidden" id="ml-filter-duration-panel">';
echo '<label class="kg-tag-option"><input type="checkbox" id="ml-filter-duration-all" checked><span>Alle</span></label>';
echo '<div id="ml-filter-duration-options">';
foreach (['5', '10', '20', '30', '45', '60', '90', '120', '150', '180', 'mehr als 180 Minuten'] as $v) {
    echo '<label class="kg-tag-option"><input type="checkbox" value="' . s($v) . '"><span>' . s($v) . '</span></label>';
}
echo '</div></div></div></label>';

echo '<label class="sp-filter"><span class="sp-filter__label">Kognitive Dimension</span>';
echo '<div class="kg-tag-dropdown" id="ml-filter-cognitive-dropdown">';
echo '<button type="button" class="kg-input kg-tag-dropdown-toggle" id="ml-filter-cognitive-toggle">Alle Dimensionen</button>';
echo '<div class="kg-tag-dropdown-panel kg-hidden" id="ml-filter-cognitive-panel">';
echo '<label class="kg-tag-option"><input type="checkbox" id="ml-filter-cognitive-all" checked><span>Alle</span></label>';
echo '<div id="ml-filter-cognitive-options">';
foreach ([
    'Erinnern' => 'Erinnern: Wissen wiedergeben oder abrufen (z.B. benennen, definieren)',
    'Verstehen' => 'Verstehen: Informationen interpretieren oder erklären (z.B. zusammenfassen, vergleichen)',
    'Anwenden' => 'Anwenden: Wissen in neuen Situationen umsetzen (z.B. ausführen, verallgemeinern)',
    'Analysieren' => 'Analysieren: Informationen in ihre Bestandteile zerlegen (z.B. unterscheiden, klassifizieren)',
    'Bewerten' => 'Bewerten: Urteile fällen und Kriterien anwenden (z.B. überprüfen, kritisch bewerten)',
    'Erschaffen' => 'Erschaffen: Neues Wissen oder neue Produkte entwickeln (z.B. planen, erzeugen, bauen)',
] as $value => $label) {
    echo '<label class="kg-tag-option"><input type="checkbox" value="' . s($value) . '"><span>' . s($label) . '</span></label>';
}
echo '</div></div></div></label>';

echo html_writer::start_div('sp-filter sp-filter__actions');
echo html_writer::tag('button', 'Filter zurücksetzen', ['type' => 'button', 'id' => 'ml-filter-reset', 'class' => 'kg-btn']);
echo html_writer::end_div();

echo html_writer::end_div();
echo html_writer::tag('div', '', ['id' => 'ml-filter-status', 'class' => 'sp-filter-status']);
echo html_writer::end_div();

echo html_writer::start_div('kg-ie-block kg-library-step');
echo html_writer::tag('h4', '2. Methode auswählen');
echo html_writer::tag('div', '', ['id' => 'ml-method-list', 'class' => 'kg-library-list']);
echo html_writer::end_div();

echo html_writer::start_div('kg-ie-block kg-library-step kg-hidden', ['id' => 'ml-edit-section']);
echo html_writer::tag('h4', '3. Methode bearbeiten');
echo html_writer::start_div('kg-form ig-container kg-container-full', ['id' => 'ml-edit-form']);
echo html_writer::empty_tag('input', ['type' => 'hidden', 'id' => 'ml-edit-id']);
echo html_writer::start_tag('details', ['class' => 'kg-section ig-section', 'id' => 'ml-section-quick', 'open' => 'open']);
echo html_writer::tag('summary', '1) Schnellfassung');
echo html_writer::start_div('kg-stack field-stack ig-inner');
echo html_writer::start_div('field-card');
echo html_writer::tag('label', 'Titel *', ['for' => 'ml-e-titel', 'class' => 'kg-label']);
echo html_writer::empty_tag('input', ['type' => 'text', 'id' => 'ml-e-titel', 'class' => 'kg-input', 'required' => 'required']);
echo html_writer::end_div();
echo html_writer::start_div('field-card');
echo html_writer::start_div('kg-two');
echo html_writer::start_div();
echo html_writer::tag('label', 'Seminarphase', ['for' => 'ml-e-seminarphase', 'class' => 'kg-label']);
echo konzeptgenerator_render_multi_dropdown('ml-e-seminarphase', [
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
echo html_writer::tag('label', 'Tags / Schlüsselworte', ['for' => 'ml-e-tags', 'class' => 'kg-label']);
echo html_writer::empty_tag('input', ['type' => 'text', 'id' => 'ml-e-tags', 'class' => 'kg-input']);
echo html_writer::end_div();
echo html_writer::end_div();
echo html_writer::end_div();
echo html_writer::start_div('field-card');
echo html_writer::tag('label', 'Alternativmethoden', ['for' => 'ml-e-alternativen', 'class' => 'kg-label']);
echo html_writer::start_div('kg-tag-dropdown', [
    'id' => 'ml-e-alternativen-dropdown',
    'data-kg-form-multi-dropdown' => '1',
    'data-kg-field' => '#ml-e-alternativen',
    'data-kg-label-prefix' => 'Alternativen',
    'data-kg-placeholder' => 'Alternativen wählen',
]);
echo html_writer::tag('button', 'Alternativen wählen', [
    'type' => 'button',
    'class' => 'kg-input kg-tag-dropdown-toggle',
    'id' => 'ml-e-alternativen-toggle',
    'data-kg-form-multi-toggle' => '1',
]);
echo html_writer::start_div('kg-tag-dropdown-panel kg-hidden', [
    'id' => 'ml-e-alternativen-panel',
    'data-kg-form-multi-panel' => '1',
]);
echo html_writer::empty_tag('input', [
    'type' => 'search',
    'class' => 'kg-input kg-multi-search',
    'placeholder' => 'Methodentitel suchen',
    'data-kg-form-multi-search' => '1',
]);
echo html_writer::start_div('', ['id' => 'ml-e-alternativen-options']);
echo html_writer::end_div();
echo html_writer::end_div();
echo html_writer::end_div();
echo html_writer::empty_tag('input', [
    'type' => 'hidden',
    'id' => 'ml-e-alternativen',
    'value' => '',
]);
echo html_writer::end_div();
echo html_writer::start_div('field-card');
echo html_writer::start_div('kg-two');
echo html_writer::start_div();
echo html_writer::tag('label', 'Zeitbedarf', ['for' => 'ml-e-zeitbedarf', 'class' => 'kg-label']);
echo html_writer::start_tag('select', ['id' => 'ml-e-zeitbedarf', 'class' => 'kg-input']);
foreach (['5', '10', '20', '30', '45', '60', '90', '120', '150', '180', 'mehr als 180 Minuten'] as $v) {
    echo html_writer::tag('option', s($v), ['value' => $v]);
}
echo html_writer::end_tag('select');
echo html_writer::end_div();
echo html_writer::start_div();
echo html_writer::tag('label', 'Gruppengröße', ['for' => 'ml-e-gruppengroesse', 'class' => 'kg-label']);
echo html_writer::start_tag('select', ['id' => 'ml-e-gruppengroesse', 'class' => 'kg-input']);
foreach (['1', '2-3', '3–5', '6–12', '13–24', '25+', 'beliebig'] as $v) {
    echo html_writer::tag('option', s($v), ['value' => $v]);
}
echo html_writer::end_tag('select');
echo html_writer::end_div();
echo html_writer::end_div();
echo html_writer::end_div();
echo html_writer::start_div('field-card');
echo html_writer::tag('label', 'Kognitive Dimension', ['for' => 'ml-e-kognitive', 'class' => 'kg-label']);
echo konzeptgenerator_render_multi_dropdown('ml-e-kognitive', [
    'Erinnern' => 'Erinnern: Wissen wiedergeben oder abrufen (z.B. benennen, definieren)',
    'Verstehen' => 'Verstehen: Informationen interpretieren oder erklären (z.B. zusammenfassen, vergleichen)',
    'Anwenden' => 'Anwenden: Wissen in neuen Situationen umsetzen (z.B. ausführen, verallgemeinern)',
    'Analysieren' => 'Analysieren: Informationen in ihre Bestandteile zerlegen (z.B. unterscheiden, klassifizieren)',
    'Bewerten' => 'Bewerten: Urteile fällen und Kriterien anwenden (z.B. überprüfen, kritisch bewerten)',
    'Erschaffen' => 'Erschaffen: Neues Wissen oder neue Produkte entwickeln (z.B. planen, erzeugen, bauen)',
], 'Dimensionen wählen', 'Dimensionen');
echo html_writer::end_div();
echo html_writer::start_div('field-card');
echo html_writer::tag('label', 'Kurzbeschreibung', ['for' => 'ml-e-kurzbeschreibung', 'class' => 'kg-label']);
echo html_writer::tag('textarea', '', ['id' => 'ml-e-kurzbeschreibung', 'name' => 'ml_e_kurzbeschreibung', 'class' => 'kg-input', 'rows' => '3']);
echo html_writer::end_div();
echo html_writer::start_div('field-card');
echo html_writer::tag('label', 'Ablauf', ['for' => 'ml-e-ablauf', 'class' => 'kg-label']);
echo html_writer::tag('textarea', '', ['id' => 'ml-e-ablauf', 'name' => 'ml_e_ablauf', 'class' => 'kg-input', 'rows' => '4']);
echo html_writer::end_div();
echo html_writer::end_div();
echo html_writer::end_tag('details');

echo html_writer::start_tag('details', ['class' => 'kg-section ig-section', 'id' => 'ml-section-quality']);
echo html_writer::tag('summary', '2) Qualität & Rahmen');
echo html_writer::start_div('kg-stack field-stack ig-inner');
echo html_writer::start_div('field-card');
echo html_writer::tag('label', 'Lernziele (Ich-kann ...)', ['for' => 'ml-e-lernziele', 'class' => 'kg-label']);
echo html_writer::tag('textarea', '', ['id' => 'ml-e-lernziele', 'name' => 'ml_e_lernziele', 'class' => 'kg-input', 'rows' => '3']);
echo html_writer::end_div();
echo html_writer::start_div('field-card');
echo html_writer::start_div('kg-two');
echo html_writer::start_div();
echo html_writer::tag('label', 'Komplexitätsgrad', ['for' => 'ml-e-komplexitaet', 'class' => 'kg-label']);
echo html_writer::start_tag('select', ['id' => 'ml-e-komplexitaet', 'class' => 'kg-input']);
foreach (['sehr niedrig', 'niedrig', 'mittel', 'hoch'] as $v) {
    echo html_writer::tag('option', s($v), ['value' => $v]);
}
echo html_writer::end_tag('select');
echo html_writer::end_div();
echo html_writer::start_div();
echo html_writer::tag('label', 'Autor*in / Kontakt', ['for' => 'ml-e-autor', 'class' => 'kg-label']);
echo html_writer::empty_tag('input', ['type' => 'text', 'id' => 'ml-e-autor', 'class' => 'kg-input']);
echo html_writer::end_div();
echo html_writer::end_div();
echo html_writer::end_div();
echo html_writer::start_div('field-card');
echo html_writer::tag('label', 'Vorbereitung nötig', ['for' => 'ml-e-vorbereitung', 'class' => 'kg-label']);
echo html_writer::start_tag('select', ['id' => 'ml-e-vorbereitung', 'class' => 'kg-input']);
foreach (['keine', '<10 Min', '10–30 Min', '>30 Min'] as $v) {
    echo html_writer::tag('option', s($v), ['value' => $v]);
}
echo html_writer::end_tag('select');
echo html_writer::end_div();
echo html_writer::start_div('field-card');
echo html_writer::start_div('kg-two');
echo html_writer::start_div();
echo html_writer::tag('label', 'Raumanforderungen', ['for' => 'ml-e-raum', 'class' => 'kg-label']);
echo konzeptgenerator_render_multi_dropdown('ml-e-raum', [
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
echo html_writer::tag('label', 'Sozialform', ['for' => 'ml-e-sozialform', 'class' => 'kg-label']);
echo konzeptgenerator_render_multi_dropdown('ml-e-sozialform', [
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
echo html_writer::tag('label', 'Risiken/Tipps', ['for' => 'ml-e-risiken', 'class' => 'kg-label']);
echo html_writer::tag('textarea', '', ['id' => 'ml-e-risiken', 'name' => 'ml_e_risiken', 'class' => 'kg-input', 'rows' => '3']);
echo html_writer::end_div();
echo html_writer::start_div('field-card');
echo html_writer::tag('label', 'Debrief/Reflexionsfragen', ['for' => 'ml-e-debrief', 'class' => 'kg-label']);
echo html_writer::tag('textarea', '', ['id' => 'ml-e-debrief', 'name' => 'ml_e_debrief', 'class' => 'kg-input', 'rows' => '3']);
echo html_writer::end_div();
echo html_writer::end_div();
echo html_writer::end_tag('details');

echo html_writer::start_tag('details', ['class' => 'kg-section ig-section', 'id' => 'ml-section-materials']);
echo html_writer::tag('summary', '3) Materialien & Technik');
echo html_writer::start_div('kg-stack field-stack ig-inner');
echo html_writer::start_div('field-card');
echo html_writer::tag('label', 'Materialien', ['for' => 'ml-e-materialien', 'class' => 'kg-label']);
$materialseditform->display();
echo html_writer::tag('div', '', ['id' => 'ml-e-materialien-current', 'class' => 'sp-filter-status']);
echo html_writer::end_div();
echo html_writer::start_div('field-card');
echo html_writer::tag('label', 'Material/Technik', ['for' => 'ml-e-materialtechnik', 'class' => 'kg-label']);
echo html_writer::tag('textarea', '', ['id' => 'ml-e-materialtechnik', 'name' => 'ml_e_materialtechnik', 'class' => 'kg-input', 'rows' => '3']);
echo html_writer::end_div();
echo html_writer::end_div();
echo html_writer::end_tag('details');

echo html_writer::start_div('kg-row');
echo html_writer::tag('button', 'Änderungen speichern', ['type' => 'button', 'id' => 'ml-save', 'class' => 'kg-btn kg-btn-primary']);
echo html_writer::tag('button', 'Abbrechen', ['type' => 'button', 'id' => 'ml-cancel', 'class' => 'kg-btn']);
echo html_writer::end_div();

echo html_writer::end_div();
echo html_writer::end_div();

echo html_writer::tag('div', '', ['id' => 'ml-status', 'class' => 'kg-status']);
echo html_writer::end_div();

// Enable preferred Moodle editor (Tiny in Moodle 5.x by default) on rich text fields.
$editor = editors_get_preferred_editor(FORMAT_HTML);
$editoroptions = [
    'context' => $context,
    'maxfiles' => 0,
    'maxbytes' => 0,
    'trusttext' => false,
    'subdirs' => 0,
];
foreach ([
    'ml-e-kurzbeschreibung',
    'ml-e-ablauf',
    'ml-e-lernziele',
    'ml-e-risiken',
    'ml-e-debrief',
    'ml-e-materialtechnik',
] as $editorid) {
    $editor->use_editor($editorid, $editoroptions, null);
}

echo $OUTPUT->footer();
