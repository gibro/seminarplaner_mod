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
 * Methodlibrary.
 *
 * @package    mod_seminarplaner
 * @copyright  2026 Guido Brombach <gibro@posteo.de>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

require_once(__DIR__ . '/bootstrap.php');
require_once($CFG->libdir . '/editorlib.php');
require_once($CFG->libdir . '/formslib.php');
require_once(__DIR__ . '/locallib.php');

$id = required_param('id', PARAM_INT);
$activity = seminarplaner_require_activity_context($id, 'mod/seminarplaner:managemethods');
$cm = $activity['cm'];
$course = $activity['course'];
$seminarplaner = $activity['seminarplaner'];
$context = $activity['context'];
seminarplaner_cleanup_invalid_fileprefs((int)$USER->id);

seminarplaner_prepare_page('/mod/seminarplaner/methodlibrary.php', $cm, $course, $seminarplaner, 'methodlibrary');
$PAGE->requires->js_init_code('window.onbeforeunload = null;');

$maxuploadbytes = get_user_max_upload_file_size($context, $CFG->maxbytes);
$requestededitmethodid = optional_param('editmethodid', '', PARAM_ALPHANUMEXT);
$requestededitmaterialitemid = optional_param('editmaterialitemid', 0, PARAM_INT);
$methodcardservice = new \mod_seminarplaner\local\service\method_card_service();
$materialseditdraftitemid = file_get_submitted_draft_itemid('ml_materialiendraftitemid');
if ($requestededitmethodid !== '') {
    $materialseditdraftitemid = $methodcardservice->prepare_material_draft_itemid(
        (int)$cm->id,
        (int)$context->id,
        $requestededitmethodid,
        (int)$materialseditdraftitemid,
        (int)$requestededitmaterialitemid
    );
}
if ($requestededitmethodid === '') {
    file_prepare_draft_area($materialseditdraftitemid, $context->id, 'mod_seminarplaner', 'method_materialien', 0, [
        'subdirs' => 0,
        'maxfiles' => 25,
        'maxbytes' => $maxuploadbytes,
        'areamaxbytes' => $maxuploadbytes,
        'accepted_types' => '*',
    ]);
}
$materialseditform = new \mod_seminarplaner\form\material_filemanager_form(null, [
    'fieldname' => 'ml_materialiendraftitemid',
    'maxbytes' => $maxuploadbytes,
    'context' => $context,
]);
if (method_exists($materialseditform, 'disable_form_change_checker')) {
    $materialseditform->disable_form_change_checker();
}
$materialseditform->set_data((object)['ml_materialiendraftitemid' => $materialseditdraftitemid]);

echo $OUTPUT->header();

echo $OUTPUT->heading(format_string($seminarplaner->name));
echo seminarplaner_render_tabs((int)$cm->id, 'methodlibrary');

echo html_writer::start_div('kg-shell');
echo html_writer::start_div('sq-pagehead');
echo html_writer::tag('h3', 'Bibliothek');
echo html_writer::div('Alle Seminareinheiten durchsuchen, bearbeiten und für deine Pläne '
    . 'übernehmen – oder eine neue anlegen.', 'sq-pagehead__sub');
echo html_writer::end_div();

// D55: Bibliothek in drei Unterbereiche als Tabs - lokale Seminareinheiten
// (Arbeitsfläche), immer durchsuchbare globale Methodensammlungen und die
// bereits importierten globalen Seminarkonzepte.
// Der Konzepte-Tab erscheint nur, wenn tatsächlich welche importiert wurden
// (Marker aus import_global_seminarkonzept) - sonst gäbe es dort nichts zu
// zeigen.
$importedkonzepteraw = get_config('mod_seminarplaner', 'imported_konzepte_cmid_' . (int)$cm->id);
$importedkonzepte = ($importedkonzepteraw !== false && $importedkonzepteraw !== null && $importedkonzepteraw !== '')
    ? json_decode((string)$importedkonzepteraw, true) : [];
$hasimportedkonzepte = is_array($importedkonzepte) && count($importedkonzepte) > 0;

echo html_writer::start_div('ml-subtabs', ['role' => 'tablist']);
echo html_writer::tag('button', 'Lokale Seminareinheiten', [
    'type' => 'button', 'class' => 'ml-subtab ml-subtab--active', 'data-ml-tab' => 'local',
    'role' => 'tab', 'aria-selected' => 'true',
]);
echo html_writer::tag('button', 'Methodensammlungen', [
    'type' => 'button', 'class' => 'ml-subtab', 'data-ml-tab' => 'collections',
    'role' => 'tab', 'aria-selected' => 'false',
]);
if ($hasimportedkonzepte) {
    echo html_writer::tag('button', 'Globale Seminarkonzepte', [
        'type' => 'button', 'class' => 'ml-subtab', 'data-ml-tab' => 'concepts',
        'role' => 'tab', 'aria-selected' => 'false',
    ]);
}
echo html_writer::end_div();

// Tab 1: Lokale Seminareinheiten (Standard-Ansicht).
echo html_writer::start_div('ml-tabpanel', ['id' => 'ml-tab-local', 'role' => 'tabpanel']);

// Filterleiste, Liste, Mehrfachbearbeitung und Editor sind für lokale
// Seminareinheiten und für Konzept-Einheiten dasselbe - Konzept-Einheiten SIND
// lokale Kopien, nur mit Herkunft. Deshalb gibt es diesen Block genau einmal;
// beim Tab-Wechsel wandert er in das aktive Panel und die JS-Seite tauscht nur
// aus, welche Einheiten er zeigt (siehe activateSubtab). Eine zweite Kopie
// hätte Drag-and-drop, Auswahl und Editor doppelt verdrahtet.
echo html_writer::start_div('', ['id' => 'ml-browse']);

// D50: Anlegen ist kein eigener Bereich mehr, sondern ein Button in der
// Bibliothek, der den Editor unten öffnet (leer, im Anlegen-Modus).
echo html_writer::start_div('kg-row kg-row--action', ['id' => 'ml-create-row']);
echo html_writer::tag('button', get_string('bibliothek_create', 'mod_seminarplaner'), [
    'type' => 'button',
    'id' => 'ml-create-open',
    'class' => 'kg-btn kg-btn-primary',
]);
// Sucht über alle drei Bereiche auf einmal - die Suche in der Filterleiste
// darunter bleibt auf den aktiven Tab beschränkt. Solange hier etwas steht,
// treten die Tabs samt Filterleiste zurück und es zählt nur die Trefferliste.
echo '<label class="sp-filter ml-allsearch"><span class="sp-filter__label">Alle Bereiche durchsuchen</span>'
    . '<input id="ml-allsearch" class="kg-input" type="search" '
    . 'placeholder="Titel, Beschreibung, Tags – lokal, Methodensammlung und Konzepte"></label>';
echo html_writer::end_div();

// Trefferliste der bereichsübergreifenden Suche. Liegt bewusst innerhalb von
// #ml-browse, damit sie mit dem Block in den aktiven Tab wandert.
echo html_writer::start_div('kg-ie-block kg-library-step kg-hidden', ['id' => 'ml-allsearch-block']);
echo html_writer::tag('h4', 'Treffer in allen Bereichen');
echo html_writer::tag('div', '', ['id' => 'ml-allsearch-status', 'class' => 'sp-filter-status']);
echo html_writer::tag('div', '', ['id' => 'ml-allsearch-list', 'class' => 'kg-library-list']);
echo html_writer::end_div();

echo html_writer::start_div('kg-ie-block kg-library-step', ['id' => 'ml-filter-block']);
echo html_writer::tag('h4', 'Seminareinheit suchen');
echo html_writer::start_div('sp-filterbar');

echo '<label class="sp-filter"><span class="sp-filter__label">Suche</span>'
    . '<input id="ml-filter-search" class="kg-input" type="search" '
    . 'placeholder="Titel, Beschreibung, Tags"></label>';

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
foreach (array_keys(seminarplaner_phase_options()) as $v) {
    echo '<label class="kg-tag-option"><input type="checkbox" value="' . s($v) . '"><span>' . s($v) . '</span></label>';
}
echo '</div></div></div></label>';

echo '<label class="sp-filter"><span class="sp-filter__label">Gruppengröße</span>';
echo '<div class="kg-tag-dropdown" id="ml-filter-group-dropdown">';
echo '<button type="button" class="kg-input kg-tag-dropdown-toggle" id="ml-filter-group-toggle">Alle Gruppengrößen</button>';
echo '<div class="kg-tag-dropdown-panel kg-hidden" id="ml-filter-group-panel">';
echo '<label class="kg-tag-option"><input type="checkbox" id="ml-filter-group-all" checked><span>Alle</span></label>';
echo '<div id="ml-filter-group-options">';
foreach (array_keys(seminarplaner_groupsize_options()) as $v) {
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

// Herkunft = aus welchem Seminarkonzept. Nur im Konzept-Tab sinnvoll, und dort
// erst ab dem zweiten importierten Konzept - bei einem einzigen gäbe es nichts
// zu unterscheiden. Im lokalen Tab liegen keine Konzept-Einheiten mehr (die
// haben ihren eigenen Tab), deshalb ist der Filter dort entfallen.
echo '<label class="sp-filter kg-hidden" id="ml-filter-origin-wrap"><span class="sp-filter__label">Herkunft</span>';
echo '<select id="ml-filter-origin" class="kg-input">';
echo '<option value="">Alle Seminarkonzepte</option>';
echo '</select>';
echo '</label>';

echo html_writer::start_div('sp-filter sp-filter__actions');
echo html_writer::tag('button', 'Filter zurücksetzen', ['type' => 'button', 'id' => 'ml-filter-reset', 'class' => 'kg-btn']);
echo html_writer::tag('button', 'Mehrere auswählen', ['type' => 'button', 'id' => 'ml-bulk-select-toggle', 'class' => 'kg-btn']);
echo html_writer::end_div();

echo html_writer::end_div();
echo html_writer::tag('div', '', ['id' => 'ml-filter-status', 'class' => 'sp-filter-status']);
echo html_writer::end_div();

echo html_writer::start_div('kg-ie-block kg-library-step', ['id' => 'ml-list-block']);
echo html_writer::tag('h4', 'Seminareinheit auswählen');
echo html_writer::tag('div', '', ['id' => 'ml-method-list', 'class' => 'kg-library-list']);
echo html_writer::end_div();

echo html_writer::start_div('ml-bulk-toolbar kg-hidden', ['id' => 'ml-bulk-toolbar']);
echo html_writer::tag('span', '', ['id' => 'ml-bulk-toolbar-count', 'class' => 'ml-bulk-toolbar-count']);
echo html_writer::tag('button', 'Alle auswählen', ['type' => 'button', 'id' => 'ml-bulk-selectall', 'class' => 'kg-btn']);
echo html_writer::tag('button', 'Auswahl aufheben', ['type' => 'button', 'id' => 'ml-bulk-selectnone', 'class' => 'kg-btn']);
echo html_writer::tag('button', 'Bearbeiten', [
    'type' => 'button',
    'id' => 'ml-bulk-edit-open',
    'class' => 'kg-btn kg-btn-primary',
]);
echo html_writer::end_div();

echo html_writer::start_div('kg-ie-block kg-library-step kg-hidden', ['id' => 'ml-bulk-section']);
echo html_writer::tag('h4', 'Mehrere Seminareinheiten stapelweise bearbeiten');
echo html_writer::start_div('kg-form ig-container kg-container-full', ['id' => 'ml-bulk-form']);
echo html_writer::start_div('kg-stack field-stack ig-inner');

$bulkmultifields = [
    'seminarphase' => ['Seminarphase', seminarplaner_phase_options(), 'Seminarphasen wählen', 'Seminarphasen'],
    'raum' => ['Raumanforderungen', [
        'Plenum' => 'Plenum',
        'Stuhlkreis' => 'Stuhlkreis',
        'Stehtische' => 'Stehtische',
        'viel Freifläche' => 'viel Freifläche',
        'Gruppentische' => 'Gruppentische',
        'Gruppenräume' => 'Gruppenräume',
        'akustisch ruhig' => 'akustisch ruhig',
    ], 'Raumanforderungen wählen', 'Raumanforderungen'],
    'sozialform' => ['Sozialform', [
        'Vortrag' => 'Vortrag',
        'Diskussion' => 'Diskussion',
        'Einzelarbeit' => 'Einzelarbeit',
        'Partnerarbeit' => 'Partnerarbeit',
        'Kleingruppen' => 'Kleingruppen',
        'Galeriegang' => 'Galeriegang',
        'Fishbowl' => 'Fishbowl',
    ], 'Sozialformen wählen', 'Sozialformen'],
];
foreach ($bulkmultifields as $fieldname => $fielddef) {
    [$label, $options, $placeholder, $labelprefix] = $fielddef;
    echo html_writer::start_div('field-card');
    echo html_writer::tag('label', $label, ['class' => 'kg-label']);
    echo html_writer::start_div('kg-two');
    echo html_writer::start_tag('select', [
        'id' => 'ml-bulk-mode-' . $fieldname,
        'class' => 'kg-input kg-bulk-mode-select',
        'data-bulk-value-target' => '#ml-bulk-' . $fieldname . '-value',
    ]);
    echo html_writer::tag('option', 'Nicht ändern', ['value' => 'none']);
    echo html_writer::tag('option', 'Hinzufügen', ['value' => 'add']);
    echo html_writer::tag('option', 'Entfernen', ['value' => 'remove']);
    echo html_writer::tag('option', 'Ersetzen', ['value' => 'replace']);
    echo html_writer::end_tag('select');
    echo html_writer::start_div('kg-bulk-value kg-bulk-value--disabled', ['id' => 'ml-bulk-' . $fieldname . '-value']);
    echo seminarplaner_render_multi_dropdown('ml-bulk-' . $fieldname, $options, $placeholder, $labelprefix);
    echo html_writer::end_div();
    echo html_writer::end_div();
    echo html_writer::end_div();
}

echo html_writer::start_div('field-card');
echo html_writer::tag('label', 'Tags / Schlüsselworte', ['class' => 'kg-label']);
echo html_writer::start_div('kg-two');
echo html_writer::start_tag('select', [
    'id' => 'ml-bulk-mode-tags',
    'class' => 'kg-input kg-bulk-mode-select',
    'data-bulk-value-target' => '#ml-bulk-tags-value',
]);
echo html_writer::tag('option', 'Nicht ändern', ['value' => 'none']);
echo html_writer::tag('option', 'Hinzufügen', ['value' => 'add']);
echo html_writer::tag('option', 'Entfernen', ['value' => 'remove']);
echo html_writer::tag('option', 'Ersetzen', ['value' => 'replace']);
echo html_writer::end_tag('select');
echo html_writer::start_div('kg-bulk-value kg-bulk-value--disabled', ['id' => 'ml-bulk-tags-value']);
echo html_writer::empty_tag('input', [
    'type' => 'text',
    'id' => 'ml-bulk-tags',
    'class' => 'kg-input',
    'placeholder' => 'Tags, durch Komma getrennt',
    'disabled' => 'disabled',
]);
echo html_writer::end_div();
echo html_writer::end_div();
echo html_writer::end_div();

$bulkselectfields = [
    'zeitbedarf' => ['Zeitbedarf', ['5', '10', '20', '30', '45', '60', '90', '120', '150', '180', 'mehr als 180 Minuten']],
    'gruppengroesse' => ['Gruppengröße', array_keys(seminarplaner_groupsize_options())],
    'vorbereitung' => ['Vorbereitung nötig', ['keine', '<10 Min', '10–30 Min', '>30 Min']],
];
foreach ($bulkselectfields as $fieldname => $fielddef) {
    [$label, $options] = $fielddef;
    echo html_writer::start_div('field-card');
    echo html_writer::tag('label', $label, ['class' => 'kg-label']);
    echo html_writer::start_div('kg-two');
    echo html_writer::start_tag('select', [
        'id' => 'ml-bulk-mode-' . $fieldname,
        'class' => 'kg-input kg-bulk-mode-select',
        'data-bulk-value-target' => '#ml-bulk-' . $fieldname . '-value',
    ]);
    echo html_writer::tag('option', 'Nicht ändern', ['value' => 'none']);
    echo html_writer::tag('option', 'Ersetzen', ['value' => 'replace']);
    echo html_writer::end_tag('select');
    echo html_writer::start_div('kg-bulk-value kg-bulk-value--disabled', ['id' => 'ml-bulk-' . $fieldname . '-value']);
    echo html_writer::start_tag('select', ['id' => 'ml-bulk-' . $fieldname, 'class' => 'kg-input', 'disabled' => 'disabled']);
    foreach ($options as $v) {
        echo html_writer::tag('option', s($v), ['value' => $v]);
    }
    echo html_writer::end_tag('select');
    echo html_writer::end_div();
    echo html_writer::end_div();
    echo html_writer::end_div();
}

echo html_writer::end_div();
echo html_writer::start_div('kg-row');
echo html_writer::tag('button', 'Änderungen anwenden', [
    'type' => 'button',
    'id' => 'ml-bulk-save',
    'class' => 'kg-btn kg-btn-primary',
]);
echo html_writer::tag('button', 'Abbrechen', ['type' => 'button', 'id' => 'ml-bulk-cancel', 'class' => 'kg-btn']);
echo html_writer::end_div();
echo html_writer::end_div();
echo html_writer::end_div();

$editsectionclasses = 'kg-ie-block kg-library-step';
if ($requestededitmethodid === '') {
    $editsectionclasses .= ' kg-hidden';
}
echo html_writer::start_div($editsectionclasses, ['id' => 'ml-edit-section']);
echo html_writer::tag('h4', 'Seminareinheit bearbeiten', ['id' => 'ml-edit-heading']);
echo html_writer::start_div('kg-form ig-container kg-container-full', ['id' => 'ml-edit-form']);
echo html_writer::empty_tag('input', ['type' => 'hidden', 'id' => 'ml-edit-id']);
// D17 („ein Editor, drei Einstiege"): Felder, Reihenfolge und Bedienelemente
// kommen aus demselben Renderer wie im Sequenz-Modal. Unterschied hier: die
// Materialien hängen am Filemanager-Formular dieser Seite (die Sequenz lädt es
// per Fragment-API nach) und „Vorbereitung nötig" gibt es nur in der
// Bibliothek – ohne das Feld würde der gespeicherte Wert beim Speichern
// verloren gehen (Karten-Badge, Stapelbearbeitung, Import/Export).
// Die Feldhülle trägt zusätzlich 'field-card', weil daran die Layout-Regeln
// für die Tiny-Editoren hängen.
ob_start();
$materialseditform->display();
echo html_writer::tag('div', '', ['id' => 'ml-e-materialien-current', 'class' => 'sp-filter-status']);
$mlmaterialsblock = ob_get_clean();
echo seminarplaner_render_unit_form_fields('ml-e-', [
    'fieldclass' => 'sq-field field-card',
    'lernzielbuttonid' => 'ml-lz-open-lernziele',
    'materials' => $mlmaterialsblock,
    'quickid' => 'ml-section-quick',
    'processid' => 'ml-section-quality',
    'materialsid' => 'ml-section-materials',
    'vorbereitung' => true,
]);

echo html_writer::start_div('kg-row');
echo html_writer::tag('button', 'Änderungen speichern', [
    'type' => 'button',
    'id' => 'ml-save',
    'class' => 'kg-btn kg-btn-primary',
]);
echo html_writer::tag('button', 'Abbrechen', ['type' => 'button', 'id' => 'ml-cancel', 'class' => 'kg-btn']);
echo html_writer::end_div();

echo html_writer::end_div();
echo html_writer::end_div();

echo html_writer::tag('div', '', ['id' => 'ml-status', 'class' => 'kg-status', 'role' => 'status', 'aria-live' => 'polite']);

echo html_writer::end_div(); // Ende #ml-browse (wandert zwischen den Tabs).

echo html_writer::end_div(); // Ende Tab 1 (#ml-tab-local).

// Tab 2: Methodensammlungen (globale Bibliothek, immer durchsuchbar).
// D29/D33: globale Bibliothek - immer durchsuchbar, kein Vor-Import einer
// ganzen Methoden-Sammlung noetig; Uebernehmen legt sofort eine lokale Kopie an.
echo html_writer::start_div('ml-tabpanel kg-hidden', ['id' => 'ml-tab-collections', 'role' => 'tabpanel']);
echo html_writer::start_div('kg-ie-block kg-library-step', ['id' => 'gl-section']);
echo html_writer::tag('h4', 'Methodensammlungen');
echo html_writer::tag('p', 'Stöbere in den Methoden aller veröffentlichten Methoden-Sammlungen – '
    . 'ohne sie vorher importieren zu müssen. „Übernehmen" legt sofort eine eigene Kopie '
    . 'in deinem Bestand (Tab „Lokale Seminareinheiten") an; das globale Original bleibt unberührt.');
echo '<label class="sp-filter"><span class="sp-filter__label">Suche</span>'
    . '<input id="gl-search" class="kg-input" type="search" placeholder="Titel, Beschreibung, Tags, Sammlung"></label>';
echo html_writer::tag('div', '', ['id' => 'gl-facets', 'class' => 'gl-facets']);
echo html_writer::tag('div', '', ['id' => 'gl-status', 'class' => 'sp-filter-status']);
echo html_writer::tag('div', '', ['id' => 'gl-list', 'class' => 'kg-library-list gl-list']);
echo html_writer::end_div();
echo html_writer::end_div(); // Ende Tab 2 (#ml-tab-collections).

// Tab 3: Globale Seminarkonzepte (bereits importierte, D55).
// D55: zeigt nur die Seminarkonzepte, die bereits über den Import (D32,
// Import/Export-Tab) in den lokalen Bestand geholt wurden - kein Import hier.
// Panel nur ausgeben, wenn der zugehörige Tab existiert (mindestens ein
// importiertes Konzept).
if ($hasimportedkonzepte) {
    echo html_writer::start_div('ml-tabpanel kg-hidden', ['id' => 'ml-tab-concepts', 'role' => 'tabpanel']);
    echo html_writer::start_div('kg-ie-block kg-library-step', ['id' => 'ml-konzepte-block']);
    echo html_writer::tag('h4', 'Globale Seminarkonzepte');
    echo html_writer::tag('p', 'Die Seminareinheiten aus den Seminarkonzepten, die du bereits in deinen '
        . 'Bestand geholt hast. Es sind eigenständige lokale Kopien – du kannst sie hier genauso '
        . 'bearbeiten wie deine übrigen Seminareinheiten, das globale Original bleibt unberührt. '
        . 'Neue Konzepte holst du über den Tab „Import/Export".');
    echo html_writer::tag('div', '', ['id' => 'ml-konzepte-status', 'class' => 'sp-filter-status']);
    // Kopfzeile je Konzept: Herkunft auf einen Blick und der Absprung in den
    // Plan, falls das Konzept einen mitgebracht hat. Die Einheiten selbst
    // rendert darunter der geteilte Block (#ml-browse).
    echo html_writer::tag('div', '', ['id' => 'ml-konzepte-list', 'class' => 'ml-konzepte-list']);
    echo html_writer::end_div();
    echo html_writer::end_div(); // Ende Tab 3 (#ml-tab-concepts).
}

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
foreach (
    [
    'ml-e-kurzbeschreibung',
    'ml-e-ablauf',
    'ml-e-lernziele',
    'ml-e-risiken',
    'ml-e-debrief',
    'ml-e-materialtechnik',
    ] as $editorid
) {
    $editor->use_editor($editorid, $editoroptions, null);
}

echo $OUTPUT->footer();
