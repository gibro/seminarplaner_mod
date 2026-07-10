<?php
// This file is part of Moodle - http://moodle.org/

require_once(__DIR__ . '/bootstrap.php');
require_once($CFG->libdir . '/editorlib.php');
require_once(__DIR__ . '/locallib.php');

$id = required_param('id', PARAM_INT);
$activity = seminarplaner_require_activity_context($id, 'mod/seminarplaner:managegrids');
$cm = $activity['cm'];
$course = $activity['course'];
$seminarplaner = $activity['seminarplaner'];
$context = $activity['context'];

seminarplaner_prepare_page('/mod/seminarplaner/sequenz.php', $cm, $course, $seminarplaner, 'sequenz');

echo $OUTPUT->header();

echo $OUTPUT->heading(format_string($seminarplaner->name));
echo seminarplaner_render_tabs((int)$cm->id, 'sequenz');

echo html_writer::start_div('kg-shell sq-shell');
echo html_writer::tag('div', '', ['id' => 'sq-status', 'class' => 'kg-status', 'aria-live' => 'polite']);

// CD-Handoff: Seitenkopf mit rotem Regel-Strich; der Erklärsatz ersetzt
// die frühere gelbe Hinweisbox.
echo html_writer::start_div('sq-pagehead');
echo html_writer::tag('h3', 'Sequenzansicht');
echo html_writer::div(get_string('sequenz_previewnote', 'mod_seminarplaner'),
    'sq-pagehead__sub', ['id' => 'sq-preview-note']);
echo html_writer::end_div();

// Plan selection, creation and setup (D45: templates live here now).
echo html_writer::start_div('sq-planbar');
echo html_writer::tag('label', get_string('sequenz_planlabel', 'mod_seminarplaner'),
    ['for' => 'sq-grid-select', 'class' => 'kg-label sq-planbar__label']);
echo html_writer::tag('select', '', ['id' => 'sq-grid-select', 'class' => 'kg-input sq-planbar__select']);
echo html_writer::tag('button', '＋ Neuer Seminarplan', [
    'type' => 'button', 'id' => 'sq-new-plan', 'class' => 'kg-btn',
]);
echo html_writer::tag('button', 'Einrichtung', [
    'type' => 'button', 'id' => 'sq-edit-setup', 'class' => 'kg-btn',
    'title' => 'Tage und Seminarzeiten dieses Seminarplans anpassen',
]);
echo html_writer::end_div();

// Setup panel (create new plan / reconfigure the loaded one).
$days = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
?>
<div class="sq-setup kg-hidden" id="sq-setup-panel">
  <form id="sq-setup-form">
    <div class="sp-modal__section" id="sq-setup-name-section">
      <h3 id="sq-setup-title">Neuen Seminarplan anlegen</h3>
      <label class="sp-modal__field" for="sq-setup-name">
        <span class="sp-modal__label">Name</span>
        <input type="text" id="sq-setup-name" class="kg-input" placeholder="Neuer Seminarplan">
      </label>
    </div>

    <div class="sp-modal__section">
      <h3>Vorlage wählen</h3>
      <select name="preset" id="sp-config-preset" class="kg-input kg-grid-select">
        <option value="custom">Individuelle Konfiguration</option>
        <option value="standard-week">Standard-Woche (Mo-Fr)</option>
        <option value="sunday-to-friday">Seminarwoche (So-Fr)</option>
        <option value="weekend-seminar">Wochenendseminar (Fr-So, Fr Anreise / So Abreise)</option>
        <option value="half-week-mo-mi">Halbe Woche (Mo-Mi)</option>
        <option value="half-week-mi-fr">Halbe Woche (Mi-Fr)</option>
        <option value="compact-day">Kompakttag</option>
      </select>
    </div>

    <div class="sp-modal__section">
      <h3>Wochentage</h3>
      <div class="sp-days-grid">
        <?php
        foreach ($days as $day) {
            $idattr = 'sp-day-' . strtolower(substr($day, 0, 2));
            echo '<label class="sp-day-checkbox"><input type="checkbox" name="days" value="' . s($day) . '" id="' . s($idattr) . '"><span>' . s($day) . '</span></label>';
        }
        ?>
      </div>
      <label class="sp-modal__field sp-first-day-field" for="sp-config-first-day">
        <span class="sp-modal__label">Erster Seminartag</span>
        <select name="firstDay" id="sp-config-first-day" class="kg-input kg-grid-select">
          <?php
          foreach ($days as $day) {
              echo '<option value="' . s($day) . '">' . s($day) . '</option>';
          }
          ?>
        </select>
      </label>
    </div>

    <div class="sp-modal__section">
      <h3>Seminarzeiten</h3>
      <div class="sp-time-range sp-anchor-times">
        <span class="sp-anchor-label">Vormittag</span>
        <label class="sp-modal__field"><span class="sp-modal__label">von</span><input type="time" name="vormittagStart" id="sp-config-vm-start" class="kg-input" value="08:30"></label>
        <label class="sp-modal__field"><span class="sp-modal__label">bis</span><input type="time" name="vormittagEnd" id="sp-config-vm-end" class="kg-input" value="12:30"></label>
      </div>
      <div class="sp-time-range sp-anchor-times">
        <span class="sp-anchor-label">Nachmittag</span>
        <label class="sp-modal__field"><span class="sp-modal__label">von</span><input type="time" name="nachmittagStart" id="sp-config-nm-start" class="kg-input" value="13:15"></label>
        <label class="sp-modal__field"><span class="sp-modal__label">bis</span><input type="time" name="nachmittagEnd" id="sp-config-nm-end" class="kg-input" value="17:30"></label>
      </div>
      <label class="kg-label kg-inline-checkbox">
        <input type="checkbox" name="firstDayAfternoonOnly" id="sp-config-first-arrival">
        <span>Erster Tag beginnt erst am Nachmittag (Anreise)</span>
      </label>
      <label class="kg-label kg-inline-checkbox">
        <input type="checkbox" name="lastDayMorningOnly" id="sp-config-last-departure">
        <span>Letzter Tag endet mit dem Vormittag (Abreise)</span>
      </label>
      <p class="sp-filter-status">Die Zeiten sind eine Vorbelegung aus der Vorlage und lassen sich frei anpassen.
        Zwischen Vormittag und Nachmittag liegt die Mittagspause. Kurze Zwischenpausen musst du nicht
        vorausplanen – die Sequenzansicht erinnert daran, wenn lange ohne Pause gearbeitet wird.</p>
    </div>

    <div class="sp-modal__actions">
      <button type="button" class="kg-btn" id="sq-setup-cancel">Abbrechen</button>
      <button type="submit" class="kg-btn kg-btn-primary" id="sq-setup-submit">Übernehmen</button>
    </div>
  </form>
</div>
<?php

// Toolbar with day navigation.
echo html_writer::start_div('sq-toolbar');
echo html_writer::start_div('sq-toolbar__nav');
echo html_writer::tag('button', '‹', [
    'type' => 'button', 'id' => 'sq-prev-day', 'class' => 'kg-btn',
    'title' => get_string('sequenz_prevday', 'mod_seminarplaner'),
    'aria-label' => get_string('sequenz_prevday', 'mod_seminarplaner'),
]);
echo html_writer::tag('div', '', ['id' => 'sq-day-label', 'class' => 'sq-daylabel']);
echo html_writer::tag('button', '›', [
    'type' => 'button', 'id' => 'sq-next-day', 'class' => 'kg-btn',
    'title' => get_string('sequenz_nextday', 'mod_seminarplaner'),
    'aria-label' => get_string('sequenz_nextday', 'mod_seminarplaner'),
]);
echo html_writer::end_div();
// Kleiner ⓘ-Button mit Erklär-Popover (Öffnen/Schließen macht sequenz.js).
$renderinfo = static function(string $text): string {
    return html_writer::tag('span',
        html_writer::tag('button', 'i', [
            'type' => 'button', 'class' => 'sq-info__btn',
            'aria-label' => 'Erklärung anzeigen', 'aria-expanded' => 'false',
        ])
        . html_writer::tag('span', s($text), ['class' => 'sq-info__pop', 'role' => 'tooltip']),
        ['class' => 'sq-info']);
};

echo html_writer::start_div('sq-toolbar__actions');
// D16/D37: the finished sequence can be published as the Common Thread
// directly from the toolbar. Schieberegler wie der Empfehlungs-Toggle,
// die genaue Erklärung steckt im ⓘ-Popover.
echo html_writer::start_tag('span', ['class' => 'sq-publish', 'id' => 'sq-publish-wrap']);
echo html_writer::start_tag('label', ['class' => 'sq-toggle', 'for' => 'sq-publish-roterfaden']);
echo html_writer::empty_tag('input', ['type' => 'checkbox', 'id' => 'sq-publish-roterfaden']);
echo html_writer::tag('span', get_string('sequenz_publishlabel', 'mod_seminarplaner'));
echo html_writer::end_tag('label');
// Erklärung UND der dynamische Veröffentlichungs-Status stecken im Popover;
// die Toolbar-Zeile bleibt dadurch einzeilig.
echo html_writer::tag('span',
    html_writer::tag('button', 'i', [
        'type' => 'button', 'class' => 'sq-info__btn',
        'aria-label' => 'Erklärung anzeigen', 'aria-expanded' => 'false',
    ])
    . html_writer::tag('span',
        s(get_string('sequenz_publishlabel_info', 'mod_seminarplaner'))
        . html_writer::tag('span', '', ['id' => 'sq-publish-roterfaden-status', 'class' => 'sq-info__status']),
        ['class' => 'sq-info__pop', 'role' => 'tooltip']),
    ['class' => 'sq-info']);
echo html_writer::end_tag('span');
echo html_writer::start_tag('label', ['class' => 'sq-toggle', 'for' => 'sq-drama-toggle']);
echo html_writer::empty_tag('input', ['type' => 'checkbox', 'id' => 'sq-drama-toggle']);
echo html_writer::tag('span', get_string('sequenz_dramatoggle', 'mod_seminarplaner'));
echo html_writer::end_tag('label');
echo $renderinfo(get_string('sequenz_dramatoggle_info', 'mod_seminarplaner'));
// CD-Handoff: Neue Einheiten lassen sich jederzeit aus der Werkzeugleiste
// heraus gestalten (Quick-Create). Die Anker-Buttons darunter übernehmen
// weiterhin nur Bestehendes aus der Bibliothek.
echo html_writer::tag('button', '＋ Neue Einheit anlegen', [
    'type' => 'button', 'id' => 'sq-new-unit', 'class' => 'kg-btn',
    'title' => 'Neue Seminareinheit anlegen und in den aktuellen Tag einplanen',
]);
// Saving happens automatically in the background; this passive indicator
// replaces the former Speichern button (it only confused once nothing
// had to be saved manually anymore).
echo html_writer::tag('span', '', [
    'id' => 'sq-save-state', 'class' => 'sq-savestate', 'aria-live' => 'polite',
]);
echo html_writer::end_div();
// Volle Zeile unter den Werkzeugen: genutzte Vorlage + An-/Abreise-Hinweise
// (füllt sequenz.js aus der Plan-Konfiguration).
echo html_writer::tag('div', '', ['id' => 'sq-plan-info', 'class' => 'sq-toolbar__info']);
echo html_writer::end_div();

// Anchors are rendered by the AMD module.
echo html_writer::tag('div', '', ['id' => 'sq-day']);
echo html_writer::tag('div', '', ['id' => 'sq-drama', 'class' => 'sq-drama']);

// Phase legend.
$phases = [
    'orientierung' => 'Orientierung',
    'erfahrung' => 'Erfahrungserhebung',
    'analyse' => 'Analyse',
    'handlung' => 'Handlungsteil',
    'transfer' => 'Transfer',
];
echo html_writer::start_div('sq-legend');
foreach ($phases as $key => $label) {
    echo html_writer::tag('span',
        html_writer::tag('i', '', ['class' => 'sq-legend__dot sq-phase-bg--' . $key]) . s($label));
}
echo html_writer::end_div();

echo html_writer::end_div();

echo html_writer::tag('div', '', ['id' => 'sq-toast', 'class' => 'sq-toast', 'role' => 'status', 'aria-live' => 'polite']);

// ---------------------------------------------------------------------------
// D17-Einheiten-Editor als statisches Modal: Der Moodle-Editor (Tiny) wird an
// feste Element-IDs gebunden und beim Seitenladen initialisiert – deshalb
// liegt dieses Modal im Seitenmarkup statt im dynamisch gebauten #sq-modal.
// Bearbeiten (openEditor) und Anlegen (openCreateEditor, D50) teilen es sich;
// sequenz.js füllt die Felder und schaltet Überschrift/Speichern-Button um.
// ---------------------------------------------------------------------------
$sqtext = static function(string $label, string $key, string $hint = ''): string {
    $out = html_writer::start_div('sq-field');
    $out .= html_writer::tag('label', s($label), ['class' => 'kg-label', 'for' => 'sq-e-' . $key]);
    $out .= html_writer::empty_tag('input', ['type' => 'text', 'class' => 'kg-input', 'id' => 'sq-e-' . $key]);
    if ($hint !== '') {
        $out .= html_writer::div(s($hint), 'sq-field__hint');
    }
    $out .= html_writer::end_div();
    return $out;
};
$sqrich = static function(string $label, string $key, int $rows = 6): string {
    $out = html_writer::start_div('sq-field');
    $out .= html_writer::tag('label', s($label), ['class' => 'kg-label', 'for' => 'sq-e-' . $key]);
    $out .= html_writer::tag('textarea', '', ['class' => 'kg-input', 'id' => 'sq-e-' . $key, 'rows' => (string)$rows]);
    $out .= html_writer::end_div();
    return $out;
};

echo html_writer::start_div('sq-modal-overlay', ['id' => 'sq-unit-modal']);
echo html_writer::start_div('sq-modal');
echo html_writer::start_div('sq-modal__head');
echo html_writer::tag('h3', 'Seminareinheit bearbeiten', ['id' => 'sq-unit-modal-title']);
echo html_writer::tag('button', '✕', ['type' => 'button', 'class' => 'sq-modal__close', 'id' => 'sq-unit-close']);
echo html_writer::end_div();
echo html_writer::start_div('sq-modal__body');
echo $sqtext('Titel', 'titel');
echo $sqrich('Lernziele (Ich kann …)', 'lernziele');
echo $sqrich('Kurzbeschreibung', 'kurzbeschreibung');
echo $sqtext('Zeitbedarf (Minuten)', 'zeitbedarf');
echo $sqtext('Seminarphase', 'seminarphase', 'Mehrere Phasen mit Komma trennen');
echo $sqtext('Sozialform', 'sozialform');
echo html_writer::start_tag('details', ['class' => 'sq-section']);
echo html_writer::tag('summary', 'Ablauf und Rahmen');
echo html_writer::start_div('sq-section__inner');
echo $sqrich('Ablauf', 'ablauf', 8);
echo $sqtext('Raumanforderungen', 'raum');
echo $sqtext('Gruppengröße', 'gruppengroesse');
echo $sqrich('Risiken/Tipps', 'risiken');
echo $sqrich('Debrief/Reflexionsfragen', 'debrief');
echo $sqtext('Tags/Schlüsselworte', 'tags', 'Hilft beim Wiederfinden und bei Vorschlägen');
echo $sqtext('Autor*in / Kontakt', 'autor');
echo html_writer::end_div();
echo html_writer::end_tag('details');
echo html_writer::start_tag('details', ['class' => 'sq-section']);
echo html_writer::tag('summary', 'Materialien und Technik');
echo html_writer::start_div('sq-section__inner');
echo $sqrich('Material/Technik', 'materialtechnik');
echo html_writer::div('Datei-Anhänge verwaltest du weiterhin im Tab „Bibliothek".', 'sq-field__hint');
echo html_writer::end_div();
echo html_writer::end_tag('details');
echo html_writer::end_div();
echo html_writer::start_div('sq-modal__footer');
echo html_writer::tag('button', 'Abbrechen', ['type' => 'button', 'class' => 'kg-btn', 'id' => 'sq-unit-cancel']);
echo html_writer::tag('button', 'Übernehmen', ['type' => 'button', 'class' => 'kg-btn kg-btn-primary', 'id' => 'sq-unit-save']);
echo html_writer::end_div();
echo html_writer::end_div();
echo html_writer::end_div();

// Moodle-Editor (Tiny in 5.x) auf den Rich-Text-Feldern – gleiche Verdrahtung
// wie in library.php/methodlibrary.php (Backlog „Rich-Text im Sequenz-Modal").
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
    'sq-e-lernziele',
    'sq-e-kurzbeschreibung',
    'sq-e-ablauf',
    'sq-e-risiken',
    'sq-e-debrief',
    'sq-e-materialtechnik',
] as $editorid) {
    $editor->use_editor($editorid, $editoroptions, null);
}

echo $OUTPUT->footer();
