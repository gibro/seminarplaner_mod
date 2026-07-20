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
 * Grid.
 *
 * @package    mod_seminarplaner
 * @copyright  2026 Guido Brombach <gibro@posteo.de>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

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

// Inline-SVG-Icons (Meta-Line, dekorativ) für die Überblick-Export-Leiste.
$icon = static function(string $paths, float $size = 16, float $stroke = 2.0): string {
    return '<svg width="' . $size . '" height="' . $size . '" viewBox="0 0 24 24" fill="none" '
        . 'stroke="currentColor" stroke-width="' . $stroke . '" aria-hidden="true" focusable="false">'
        . $paths . '</svg>';
};
$icInfo = $icon('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>', 16, 2);
$icDownload = $icon('<path d="M12 3v12M8 11l4 4 4-4M5 21h14"/>', 14, 2.2);

// PDF-Export-Buttons für den Überblick: lösen per Deep-Link denselben Export-Flow
// im Import/Export-Tab aus (kein zweiter Mechanismus).
$pdfbtn = static function(string $id, string $label) use ($icDownload): string {
    return html_writer::tag('button',
        '<span class="kg-btn-content">' . $icDownload . html_writer::tag('span', s($label)) . '</span>',
        ['type' => 'button', 'id' => $id, 'class' => 'kg-btn kg-btn--outline-red kg-ov-pdfbtn']);
};

echo $OUTPUT->header();

echo $OUTPUT->heading(format_string($seminarplaner->name));
echo seminarplaner_render_tabs((int)$cm->id, 'grid');

echo html_writer::start_div('kg-shell kg-grid-readonly');
echo html_writer::tag('div', '', ['id' => 'kg-status', 'class' => 'kg-status', 'role' => 'status', 'aria-live' => 'polite']);
echo html_writer::start_div('sq-pagehead');
echo html_writer::tag('h3', get_string('ueberblickmenu', 'mod_seminarplaner'));
echo html_writer::div(get_string('ueberblick_subline', 'mod_seminarplaner'), 'sq-pagehead__sub');
echo html_writer::end_div();

// Hinweiszeile (Handoff: tiefrot getönt, mit Primär-Button in die Sequenz).
echo html_writer::start_div('kg-ov-hint');
echo html_writer::start_div('kg-ov-hint__note');
echo $icInfo;
echo html_writer::tag('span', get_string('ueberblick_readonlynote', 'mod_seminarplaner'));
echo html_writer::end_div();
echo html_writer::link(
    new moodle_url('/mod/seminarplaner/sequenz.php', ['id' => (int)$cm->id]),
    get_string('ueberblick_tosequenz', 'mod_seminarplaner'),
    ['class' => 'kg-btn kg-btn-primary kg-ov-hint__btn']
);
echo html_writer::end_div();

// Werkzeugleiste (Handoff): eine schmale weiße Karte statt zweier Kästen.
// Erste Zeile: Plan-Auswahl links, „Nur Ansicht"-Badge rechts. Zweite Zeile
// (erst mit geladenem Plan, id kg-grid-step-2 bleibt — grid.js schaltet sie):
// Veröffentlichen-Schalter und PDF-Export.
echo html_writer::start_div('kg-ov-toolbar');
echo html_writer::start_div('kg-ov-toolbar__row');
echo html_writer::start_div('kg-ov-toolbar__group');
echo html_writer::tag('label', 'Seminarplan', ['for' => 'kg-grid-select', 'class' => 'kg-ov-toolbar__label']);
echo html_writer::start_tag('select', ['id' => 'kg-grid-select', 'class' => 'kg-input kg-grid-select']);
foreach ($grids as $grid) {
    echo html_writer::tag('option', format_string($grid->name) . ' (#' . $grid->id . ')', ['value' => $grid->id]);
}
echo html_writer::end_tag('select');
echo html_writer::tag('button', 'Laden', ['type' => 'button', 'id' => 'kg-load-grid', 'class' => 'kg-btn kg-btn-primary']);
echo html_writer::tag('button', 'Löschen', ['type' => 'button', 'id' => 'kg-grid-delete', 'class' => 'kg-btn kg-btn--outline-red']);
echo html_writer::end_div();
echo html_writer::tag('span',
    $icon('<rect x="5" y="11" width="14" height="9"/><path d="M8 11V8a4 4 0 018 0v3"/>', 14, 2)
    . html_writer::tag('span', 'Nur Ansicht'),
    ['class' => 'kg-ov-badge']);
echo html_writer::end_div();

echo html_writer::start_div('kg-ov-toolbar__row kg-ov-toolbar__row--second kg-hidden', ['id' => 'kg-grid-step-2']);
echo html_writer::start_div('kg-ov-toolbar__group');
echo html_writer::start_tag('label', ['class' => 'kg-ov-toolbar__label kg-inline-checkbox', 'for' => 'kg-publish-roterfaden']);
echo html_writer::empty_tag('input', ['type' => 'checkbox', 'id' => 'kg-publish-roterfaden']);
echo html_writer::tag('span', get_string('roterfaden_publishlabel', 'mod_seminarplaner'));
echo html_writer::end_tag('label');
echo html_writer::tag('span', '', ['id' => 'kg-publish-roterfaden-status', 'class' => 'kg-ov-toolbar__status']);
echo html_writer::end_div();
echo html_writer::start_div('kg-ov-pdfbar');
echo html_writer::tag('span', 'PDF-Export', ['class' => 'kg-ov-pdfbar__label']);
echo $pdfbtn('kg-ov-pdf-zim', 'ZIM');
echo $pdfbtn('kg-ov-pdf-flow', 'Konzeptsammlung');
echo $pdfbtn('kg-ov-pdf-handout', 'Teilnehmerplan');
echo $pdfbtn('kg-ov-pdf-materials', 'Material-Checkliste');
echo html_writer::end_div();
echo html_writer::end_div();
echo html_writer::end_div();

echo html_writer::tag('p',
    'Neue Seminarpläne legst du im Tab „Sequenz" an – dort sitzt auch die Einrichtung (Tage und Seminarzeiten).',
    ['class' => 'kg-ov-toolbar__hint']);

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
            <?php foreach (array_keys(seminarplaner_phase_options()) as $phase): ?>
            <label class="kg-tag-option"><input type="checkbox" value="<?= s($phase) ?>"><span><?= s($phase) ?></span></label>
            <?php endforeach; ?>
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
            <label class="kg-tag-option"><input type="checkbox" value="Gruppenarbeit (2-5)"><span>Gruppenarbeit (2-5)</span></label>
            <label class="kg-tag-option"><input type="checkbox" value="Plenum (10-20)"><span>Plenum (10-20)</span></label>
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
    <label class="sp-filter kg-hidden" id="sp-filter-origin-wrap">
      <span class="sp-filter__label">Herkunft</span>
      <select id="sp-filter-origin" class="kg-input">
        <option value="">Alle Seminareinheiten</option>
        <option value="local">Nur lokale Seminareinheiten</option>
      </select>
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

      <div class="sp-grid-scroll" id="sp-grid-scroll">
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
      </div>

      <div id="sp-msg" class="sp-warn" style="margin-top:6px"></div>

      <?php
        // CD-Handoff: Legende der Seminarphasen. Nur sinnvoll, wenn der
        // Überblick aus der Sequenz projiziert (Phasenfarben) - grid.js
        // blendet sie dann ein.
        $phases = [
            'orientierung' => 'Orientierung',
            'erfahrung' => 'Erfahrungserhebung',
            'analyse' => 'Analyse',
            'handlung' => 'Handlungsteil',
            'transfer' => 'Transfer',
        ];
        echo html_writer::start_div('sq-legend kg-ov-legend kg-hidden', ['id' => 'sp-phase-legend']);
        echo html_writer::tag('span', 'Seminarphasen', ['class' => 'kg-ov-legend__label']);
        foreach ($phases as $key => $label) {
            echo html_writer::tag('span',
                html_writer::tag('i', '', ['class' => 'sq-legend__dot sq-phase-bg--' . $key]) . s($label));
        }
        echo html_writer::tag('span', '⇄ Alternative hinterlegt', ['class' => 'kg-ov-legend__alt']);
        echo html_writer::end_div();
      ?>
    </main>
  </div>

</div>
<?php
echo html_writer::end_div();
echo html_writer::end_div();

echo $OUTPUT->footer();
