<?php
// This file is part of Moodle - http://moodle.org/

require_once(__DIR__ . '/bootstrap.php');
require_once(__DIR__ . '/locallib.php');

$id = required_param('id', PARAM_INT);
$activity = seminarplaner_require_activity_context($id, 'mod/seminarplaner:managegrids');
$cm = $activity['cm'];
$course = $activity['course'];
$seminarplaner = $activity['seminarplaner'];

$gridservice = new \mod_seminarplaner\local\service\grid_service();
$grids = $gridservice->list_grids((int)$cm->id);

seminarplaner_prepare_page('/mod/seminarplaner/grid.php', $cm, $course, $seminarplaner, 'grid');

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
$renderbuttonlabel = static function(string $text, string $icon) use ($rendericontext): string {
    return $rendericontext($icon, $text, 'kg-btn-content');
};

echo $OUTPUT->header();

echo $OUTPUT->heading(format_string($seminarplaner->name));
echo seminarplaner_render_tabs((int)$cm->id, 'grid');

echo html_writer::start_div('kg-shell');
echo html_writer::tag('div', '', ['id' => 'kg-status', 'class' => 'kg-status']);
echo html_writer::tag('h3', 'Seminarplaner (Drag & Drop)');

echo html_writer::start_div('kg-ie-block kg-library-step', ['id' => 'kg-grid-step-1']);
echo html_writer::tag('h4', '1. Seminarplan erstellen oder laden');
echo html_writer::start_div('kg-two');
echo html_writer::start_div('kg-ie-block');
echo html_writer::tag('h5', 'Seminarplan erstellen');
echo html_writer::tag('label', 'Name', ['for' => 'kg-grid-name', 'class' => 'kg-label']);
echo html_writer::empty_tag('input', ['type' => 'text', 'id' => 'kg-grid-name', 'class' => 'kg-input', 'placeholder' => 'Neuer Seminarplan']);
echo html_writer::start_div('kg-row kg-row--action');
echo html_writer::tag('button', 'Seminarplan erstellen', ['type' => 'button', 'id' => 'kg-create-grid', 'class' => 'kg-btn kg-btn-primary']);
echo html_writer::end_div();
echo html_writer::tag('p', 'Namen eingeben, Einstellungen festlegen und mit "Übernehmen" erstellen.', ['class' => 'sp-filter-status']);
echo html_writer::end_div();

echo html_writer::start_div('kg-ie-block');
echo html_writer::tag('h5', 'Seminarplan laden');
echo html_writer::tag('label', 'Vorhandene Seminarpläne', ['for' => 'kg-grid-select', 'class' => 'kg-label']);
echo html_writer::start_tag('select', ['id' => 'kg-grid-select', 'class' => 'kg-input kg-grid-select']);
foreach ($grids as $grid) {
    echo html_writer::tag('option', format_string($grid->name) . ' (#' . $grid->id . ')', ['value' => $grid->id]);
}
echo html_writer::end_tag('select');
echo html_writer::start_div('kg-row kg-row--action');
echo html_writer::tag('button', 'Seminarplan laden', ['type' => 'button', 'id' => 'kg-load-grid', 'class' => 'kg-btn kg-btn-primary']);
echo html_writer::end_div();
echo html_writer::tag('p', 'Seminarplan auswählen und "Seminarplan laden" klicken', ['class' => 'sp-filter-status']);
echo html_writer::end_div();
echo html_writer::end_div();

?>
<div class="sp-config-inline kg-hidden" id="sp-config-inline">
  <form class="sp-modal__body" id="sp-config-form">
    <div class="sp-modal__section">
      <div class="sp-modal__field">
        <h3>Vorlage wählen</h3>
        <select name="preset" id="sp-config-preset" class="kg-input kg-grid-select">
          <option value="custom">Individuelle Konfiguration</option>
          <option value="standard-week">Standard-Woche (Mo-Fr, 8:30-17:30)</option>
          <option value="weekend-seminar">Wochenendseminar (Fr-So, 8:30-17:30)</option>
          <option value="half-week-mo-mi">Halbe Woche (Mo-Mi, 8:30-17:30)</option>
          <option value="half-week-mi-fr">Halbe Woche (Mi-Fr, 8:30-17:30)</option>
          <option value="compact-day">Kompakttag (8:30-17:30)</option>
        </select>
      </div>
    </div>

    <div class="sp-modal__section">
      <h3>Wochentage</h3>
      <div class="sp-days-grid">
        <?php
        $days = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
        foreach ($days as $day) {
            $idattr = 'sp-day-' . strtolower(substr($day, 0, 2));
            echo '<label class="sp-day-checkbox"><input type="checkbox" name="days" value="' . s($day) . '" id="' . s($idattr) . '"><span>' . s($day) . '</span></label>';
        }
        ?>
      </div>
    </div>

    <div class="sp-modal__section">
      <h3>Zeitbereich</h3>
      <div class="sp-time-range">
        <label class="sp-modal__field"><span class="sp-modal__label">Start</span><input type="time" name="timeStart" id="sp-config-time-start" class="kg-input" value="08:30"></label>
        <label class="sp-modal__field"><span class="sp-modal__label">Ende</span><input type="time" name="timeEnd" id="sp-config-time-end" class="kg-input" value="17:30"></label>
      </div>
    </div>

    <div class="sp-modal__section">
      <div class="sp-breaks-header">
        <h3>Pausenzeiten</h3>
        <button type="button" class="kg-btn" id="sp-add-break">+ Pause hinzufügen</button>
      </div>
      <div class="sp-breaks-list" id="sp-breaks-list"></div>
    </div>

    <div class="sp-modal__actions">
      <button type="submit" class="kg-btn kg-btn-primary">Übernehmen</button>
    </div>
  </form>
</div>
<?php
echo html_writer::end_div();

echo html_writer::start_div('kg-ie-block kg-library-step kg-hidden', ['id' => 'kg-grid-step-2']);
echo html_writer::tag('h4', '2. Seminarplan anzeigen und speichern');
echo html_writer::start_div('field-card');
echo html_writer::start_div('kg-row');
echo html_writer::start_tag('label', ['class' => 'kg-label kg-inline-checkbox']);
echo html_writer::empty_tag('input', ['type' => 'checkbox', 'id' => 'kg-publish-roterfaden']);
echo html_writer::tag('span', get_string('roterfaden_publishlabel', 'mod_seminarplaner'));
echo html_writer::end_tag('label');
echo html_writer::tag('span', '', ['id' => 'kg-publish-roterfaden-status', 'class' => 'sp-filter-status']);
echo html_writer::end_div();
echo html_writer::end_div();

?>
<div class="sp-wrapper">
  <div class="sp-filterbar" id="sp-filterbar">
    <label class="sp-filter">
      <span class="sp-filter__label">Suche</span>
      <input id="sp-filter-search" class="kg-input" type="search" placeholder="Titel, Beschreibung, Tags">
    </label>
    <label class="sp-filter">
      <span class="sp-filter__label">Tags</span>
      <div class="kg-tag-dropdown" id="sp-filter-tags-dropdown">
        <button type="button" class="kg-input kg-tag-dropdown-toggle" id="sp-filter-tags-toggle">Tags wählen</button>
        <div class="kg-tag-dropdown-panel kg-hidden" id="sp-filter-tags-panel">
          <label class="kg-tag-option">
            <input type="checkbox" id="sp-filter-tags-all" checked>
            <span>Alle</span>
          </label>
          <div id="sp-filter-tags-options"></div>
        </div>
      </div>
    </label>
    <label class="sp-filter">
      <span class="sp-filter__label">Seminarphase</span>
      <div class="kg-tag-dropdown" id="sp-filter-phase-dropdown">
        <button type="button" class="kg-input kg-tag-dropdown-toggle" id="sp-filter-phase-toggle">Alle Seminarphasen</button>
        <div class="kg-tag-dropdown-panel kg-hidden" id="sp-filter-phase-panel">
          <label class="kg-tag-option"><input type="checkbox" id="sp-filter-phase-all" checked><span>Alle</span></label>
          <div id="sp-filter-phase-options">
            <label class="kg-tag-option"><input type="checkbox" value="Warm-Up"><span>Warm-Up</span></label>
            <label class="kg-tag-option"><input type="checkbox" value="Einstieg"><span>Einstieg</span></label>
            <label class="kg-tag-option"><input type="checkbox" value="Erwartungsabfrage"><span>Erwartungsabfrage</span></label>
            <label class="kg-tag-option"><input type="checkbox" value="Vorwissen aktivieren"><span>Vorwissen aktivieren</span></label>
            <label class="kg-tag-option"><input type="checkbox" value="Wissen vermitteln"><span>Wissen vermitteln</span></label>
            <label class="kg-tag-option"><input type="checkbox" value="Reflexion"><span>Reflexion</span></label>
            <label class="kg-tag-option"><input type="checkbox" value="Transfer"><span>Transfer</span></label>
            <label class="kg-tag-option"><input type="checkbox" value="Evaluation/Feedback"><span>Evaluation/Feedback</span></label>
            <label class="kg-tag-option"><input type="checkbox" value="Abschluss"><span>Abschluss</span></label>
          </div>
        </div>
      </div>
    </label>
    <label class="sp-filter">
      <span class="sp-filter__label">Gruppengröße</span>
      <div class="kg-tag-dropdown" id="sp-filter-group-dropdown">
        <button type="button" class="kg-input kg-tag-dropdown-toggle" id="sp-filter-group-toggle">Alle Gruppengrößen</button>
        <div class="kg-tag-dropdown-panel kg-hidden" id="sp-filter-group-panel">
          <label class="kg-tag-option"><input type="checkbox" id="sp-filter-group-all" checked><span>Alle</span></label>
          <div id="sp-filter-group-options">
            <label class="kg-tag-option"><input type="checkbox" value="1"><span>1</span></label>
            <label class="kg-tag-option"><input type="checkbox" value="2-3"><span>2-3</span></label>
            <label class="kg-tag-option"><input type="checkbox" value="3–5"><span>3–5</span></label>
            <label class="kg-tag-option"><input type="checkbox" value="6–12"><span>6–12</span></label>
            <label class="kg-tag-option"><input type="checkbox" value="13–24"><span>13–24</span></label>
            <label class="kg-tag-option"><input type="checkbox" value="25+"><span>25+</span></label>
            <label class="kg-tag-option"><input type="checkbox" value="beliebig"><span>beliebig</span></label>
          </div>
        </div>
      </div>
    </label>
    <label class="sp-filter">
      <span class="sp-filter__label">Zeitbedarf</span>
      <div class="kg-tag-dropdown" id="sp-filter-duration-dropdown">
        <button type="button" class="kg-input kg-tag-dropdown-toggle" id="sp-filter-duration-toggle">Alle Zeiten</button>
        <div class="kg-tag-dropdown-panel kg-hidden" id="sp-filter-duration-panel">
          <label class="kg-tag-option"><input type="checkbox" id="sp-filter-duration-all" checked><span>Alle</span></label>
          <div id="sp-filter-duration-options">
            <label class="kg-tag-option"><input type="checkbox" value="5"><span>5</span></label>
            <label class="kg-tag-option"><input type="checkbox" value="10"><span>10</span></label>
            <label class="kg-tag-option"><input type="checkbox" value="20"><span>20</span></label>
            <label class="kg-tag-option"><input type="checkbox" value="30"><span>30</span></label>
            <label class="kg-tag-option"><input type="checkbox" value="45"><span>45</span></label>
            <label class="kg-tag-option"><input type="checkbox" value="60"><span>60</span></label>
            <label class="kg-tag-option"><input type="checkbox" value="90"><span>90</span></label>
            <label class="kg-tag-option"><input type="checkbox" value="120"><span>120</span></label>
            <label class="kg-tag-option"><input type="checkbox" value="150"><span>150</span></label>
            <label class="kg-tag-option"><input type="checkbox" value="180"><span>180</span></label>
            <label class="kg-tag-option"><input type="checkbox" value="mehr als 180 Minuten"><span>mehr als 180 Minuten</span></label>
          </div>
        </div>
      </div>
    </label>
    <label class="sp-filter">
      <span class="sp-filter__label">Kognitive Dimension</span>
      <div class="kg-tag-dropdown" id="sp-filter-cognitive-dropdown">
        <button type="button" class="kg-input kg-tag-dropdown-toggle" id="sp-filter-cognitive-toggle">Alle Dimensionen</button>
        <div class="kg-tag-dropdown-panel kg-hidden" id="sp-filter-cognitive-panel">
          <label class="kg-tag-option"><input type="checkbox" id="sp-filter-cognitive-all" checked><span>Alle</span></label>
          <div id="sp-filter-cognitive-options">
            <label class="kg-tag-option"><input type="checkbox" value="Erinnern"><span>Erinnern: Wissen wiedergeben oder abrufen (z.B. benennen, definieren)</span></label>
            <label class="kg-tag-option"><input type="checkbox" value="Verstehen"><span>Verstehen: Informationen interpretieren oder erklären (z.B. zusammenfassen, vergleichen)</span></label>
            <label class="kg-tag-option"><input type="checkbox" value="Anwenden"><span>Anwenden: Wissen in neuen Situationen umsetzen (z.B. ausführen, verallgemeinern)</span></label>
            <label class="kg-tag-option"><input type="checkbox" value="Analysieren"><span>Analysieren: Informationen in ihre Bestandteile zerlegen (z.B. unterscheiden, klassifizieren)</span></label>
            <label class="kg-tag-option"><input type="checkbox" value="Bewerten"><span>Bewerten: Urteile fällen und Kriterien anwenden (z.B. überprüfen, kritisch bewerten)</span></label>
            <label class="kg-tag-option"><input type="checkbox" value="Erschaffen"><span>Erschaffen: Neues Wissen oder neue Produkte entwickeln (z.B. planen, erzeugen, bauen)</span></label>
          </div>
        </div>
      </div>
    </label>
    <div class="sp-filter sp-filter__actions">
      <button class="kg-btn" id="sp-filter-reset" type="button">Filter zurücksetzen</button>
    </div>
  </div>
  <div class="sp-filter-status" id="sp-filter-status" aria-live="polite"></div>

  <div class="sp-layout">
    <aside class="sp-sidebar">
      <div class="sp-sidebar-tabs" id="sp-source-tabs" role="tablist" aria-label="Quellenanzeige">
        <span class="sp-source-tab is-active" id="sp-source-tab-methods" data-tab-value="#sp-tab-methods" data-source="methods" role="tab" aria-selected="true" tabindex="0">Seminareinheiten</span>
        <span class="sp-source-tab" id="sp-source-tab-units" data-tab-value="#sp-tab-units" data-source="units" role="tab" aria-selected="false" tabindex="0">Bausteine</span>
      </div>
      <div class="sp-tab-content">
        <div class="sp-tab-panel active" id="sp-tab-methods" data-tab-info>
          <div id="sp-methods"></div>
        </div>
        <div class="sp-tab-panel" id="sp-tab-units" data-tab-info>
          <div id="sp-units"></div>
        </div>
      </div>
    </aside>

    <main>
      <div class="sp-weekbar" role="toolbar" aria-label="Ansicht und Zeitraster">
        <div class="sp-weekbar__nav">
          <div class="sp-view-switch" role="group" aria-label="Ansicht wechseln">
            <button class="kg-btn is-active" id="sp-view-week" type="button"><?php echo $renderbuttonlabel('Woche', 'calendar-range'); ?></button>
            <button class="kg-btn" id="sp-view-day" type="button"><?php echo $renderbuttonlabel('Tag', 'calendar-days'); ?></button>
          </div>
          <div class="sp-day-switch" role="group" aria-label="Tag wechseln">
            <select id="sp-day-select" class="kg-input kg-grid-select" aria-label="Tag auswählen"></select>
          </div>
          <div class="sp-weekbar__actions" role="group" aria-label="Plan Aktionen">
            <button type="button" id="sp-addbreak" class="kg-btn"><?php echo $renderbuttonlabel('Pause hinzufügen', 'plus'); ?></button>
            <button type="button" id="sp-clear" class="kg-btn"><?php echo $renderbuttonlabel('Seminarplan löschen', 'trash-2'); ?></button>
            <span id="sp-saved-state" class="sp-saved-state" aria-live="polite"><?php echo $rendericontext('clipboard-check', 'Gespeichert: -', 'kg-btn-content'); ?></span>
          </div>
        </div>
        <div class="sp-weekbar__meta">
          <label class="sp-time-scale" for="sp-time-scale">
            <span>Zeitraster</span>
            <select id="sp-time-scale" class="kg-input kg-grid-select" aria-label="Zeitraster wählen">
              <option value="5">5 Min</option>
              <option value="15" selected>15 Min</option>
              <option value="30">30 Min</option>
            </select>
          </label>
          <div class="sp-weekbar__range" id="sp-view-label">Wochenansicht</div>
        </div>
      </div>

      <div class="sp-row" id="sp-header">
        <div></div>
      </div>

      <div class="sp-row sp-row--allday" id="sp-allday-row">
        <div class="sp-allday-label" aria-hidden="true"></div>
      </div>

      <div class="sp-row" id="sp-grid-row">
        <div class="sp-timecol">
          <div id="sp-times"></div>
        </div>
      </div>

      <div id="sp-msg" class="sp-warn" style="margin-top:6px"></div>
    </main>
  </div>

</div>
<?php
echo html_writer::end_div();
echo html_writer::end_div();

echo $OUTPUT->footer();
