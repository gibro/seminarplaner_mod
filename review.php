<?php
// This file is part of Moodle - http://moodle.org/

require_once(__DIR__ . '/bootstrap.php');
require_once(__DIR__ . '/locallib.php');

$id = required_param('id', PARAM_INT);
$activity = seminarplaner_require_activity_context($id, 'mod/seminarplaner:view');
$cm = $activity['cm'];
$course = $activity['course'];
$seminarplaner = $activity['seminarplaner'];

seminarplaner_prepare_page('/mod/seminarplaner/review.php', $cm, $course, $seminarplaner, 'review');

echo $OUTPUT->header();

echo $OUTPUT->heading(format_string($seminarplaner->name));
echo seminarplaner_render_tabs((int)$cm->id, 'review');

echo html_writer::start_div('kg-shell');
echo html_writer::start_div('sq-pagehead');
echo html_writer::tag('h3', get_string('einreichenmenu', 'mod_seminarplaner'));
echo html_writer::div('Beiträge zur Prüfung an die Konzeptverantwortlichen übergeben.', 'sq-pagehead__sub');
echo html_writer::end_div();

// D37: Flussdiagramm-Erklaerung des Pruefprozesses.
$flowsteps = [
    ['titel' => 'Einreichen', 'text' => 'Du gibst deinen Beitrag bei den Konzeptverantwortlichen ab.'],
    ['titel' => 'Prüfung', 'text' => 'Sie schauen fachlich darüber – bei Fragen melden sie sich bei dir.'],
    ['titel' => 'Freigabe', 'text' => 'Passt alles, geben sie deinen Beitrag frei.'],
    ['titel' => 'Für alle da', 'text' => 'Dein Beitrag erscheint in der globalen Bibliothek.'],
];
echo html_writer::start_div('kg-flow', ['aria-label' => 'So läuft der Prüfprozess']);
foreach ($flowsteps as $index => $step) {
    if ($index > 0) {
        echo html_writer::tag('span', '→', ['class' => 'kg-flow__arrow', 'aria-hidden' => 'true']);
    }
    echo html_writer::div(
        html_writer::tag('span', (string)($index + 1), ['class' => 'kg-flow__num'])
        . html_writer::tag('strong', s($step['titel']))
        . html_writer::tag('span', s($step['text']), ['class' => 'kg-flow__text']),
        'kg-flow__step'
    );
}
echo html_writer::end_div();

// D37: laufende Einreichungen samt Status sichtbar machen - die Liste
// zeigt je Methoden-Sammlung, wo sie im Flussdiagramm oben steht.
echo html_writer::start_div('kg-ie-block');
echo html_writer::tag('h4', 'Wo stehen deine Einreichungen?');
echo html_writer::tag('div', '', ['id' => 'kg-review-status-list', 'class' => 'kg-review-status-list']);
echo html_writer::end_div();

// D58: Öffentliche Übersichtsliste der Konzeptverantwortlichen als reines
// Vertrauens-/Orientierungssignal (nur Name, kein Kontaktweg). Der Opt-in-
// Schalter erscheint nur für Nutzerinnen mit Konzeptverantwortlichen-Rolle.
echo html_writer::start_div('kg-ie-block');
echo html_writer::tag('h4', 'Das sind unsere Konzeptverantwortlichen');
echo html_writer::tag('p', 'Diese Personen prüfen die eingereichten Beiträge und stehen hinter den freigegebenen Sammlungen und Konzepten.');
echo html_writer::tag('div', '', ['id' => 'kg-review-reviewers-list', 'class' => 'kg-review-reviewers']);
echo html_writer::start_div('kg-review-optin kg-hidden', ['id' => 'kg-review-optin']);
echo html_writer::start_tag('label', ['class' => 'kg-review-optin__label', 'for' => 'kg-review-optin-check']);
echo html_writer::empty_tag('input', ['type' => 'checkbox', 'id' => 'kg-review-optin-check', 'class' => 'kg-review-optin__check']);
echo html_writer::tag('span', 'Mich in dieser Liste anzeigen');
echo html_writer::end_tag('label');
echo html_writer::tag('small', 'Es erscheint nur dein Name – kein Kontaktweg. Gilt für alle von dir betreuten Konzepte.');
echo html_writer::end_div();
echo html_writer::end_div();

// D51: Weggabelung vor den Formularen - erst entscheiden, was eingereicht
// werden soll, dann erscheint nur der passende Bereich (die anderen bleiben
// verborgen). Drei Wege: bestehende Sammlung ergänzen, neue Sammlung
// zusammenstellen, komplettes Seminarkonzept (D32) einreichen.
$reviewchoices = [
    [
        'value' => 'existing',
        'titel' => 'Eine bestehende Methoden-Sammlung ergänzen oder aktualisieren',
        'text'  => 'Neue oder geänderte Seminareinheiten an eine Sammlung übergeben, die es schon gibt.',
    ],
    [
        'value' => 'new',
        'titel' => 'Eine neue Methoden-Sammlung zusammenstellen',
        'text'  => 'Aus deinen vorhandenen Seminareinheiten eine neue Sammlung ohne Ablauf bündeln.',
    ],
    [
        'value' => 'konzept',
        'titel' => 'Ein Seminarkonzept einreichen',
        'text'  => 'Einen kompletten Seminarplan mit Ablauf und den verwendeten Seminareinheiten übergeben.',
    ],
];
echo html_writer::start_div('kg-ie-block kg-review-fork');
echo html_writer::tag('h4', 'Was möchtest du einreichen?');
echo html_writer::start_div('kg-review-choices', ['role' => 'radiogroup', 'aria-label' => 'Was möchtest du einreichen?']);
foreach ($reviewchoices as $choice) {
    echo html_writer::start_tag('label', ['class' => 'kg-review-choice']);
    echo html_writer::empty_tag('input', [
        'type' => 'radio',
        'name' => 'kg-review-mode',
        'value' => $choice['value'],
        'class' => 'kg-review-choice__input',
    ]);
    echo html_writer::tag('span', s($choice['titel']), ['class' => 'kg-review-choice__title']);
    echo html_writer::tag('span', s($choice['text']), ['class' => 'kg-review-choice__desc']);
    echo html_writer::end_tag('label');
}
echo html_writer::end_div();

// Ausklappbare Erklärung des Unterschieds Methoden-Sammlung vs. Seminarkonzept
// (D28/D38): dieselben Seminareinheiten - der Unterschied ist der Ablauf.
// Grafik im Plugin-CD (kantig, Phasenfarben der Sequenzansicht).
$diffsvg = <<<'SVG'
<svg viewBox="0 0 640 272" class="kg-review-diff__svg" role="img"
     aria-label="Eine Methoden-Sammlung ist eine Kiste voller Seminareinheiten ohne Reihenfolge. Ein Seminarkonzept bringt dieselben Einheiten in einen fertigen Ablauf mit Zeiten. Der Unterschied ist der Ablauf.">
  <text x="12" y="20" font-family="sans-serif" font-size="15" font-weight="700" fill="#20242b">Methoden-Sammlung</text>
  <text x="12" y="39" font-family="sans-serif" font-size="12" fill="#666e79">Kiste voller Einheiten &#8211; ohne Reihenfolge</text>
  <rect x="10" y="50" width="280" height="196" fill="#ffffff" stroke="#cfd4da" stroke-width="1.5" stroke-dasharray="7 5"/>
  <g transform="translate(82,104) rotate(-7)"><rect x="-38" y="-21" width="76" height="42" fill="#EAB500"/><rect x="-26" y="-9" width="46" height="5" fill="#ffffff" opacity="0.85"/><rect x="-26" y="2" width="30" height="5" fill="#ffffff" opacity="0.6"/></g>
  <g transform="translate(198,94) rotate(5)"><rect x="-38" y="-21" width="76" height="42" fill="#2F80AB"/><rect x="-26" y="-9" width="46" height="5" fill="#ffffff" opacity="0.85"/><rect x="-26" y="2" width="30" height="5" fill="#ffffff" opacity="0.6"/></g>
  <g transform="translate(112,168) rotate(4)"><rect x="-38" y="-21" width="76" height="42" fill="#882A30"/><rect x="-26" y="-9" width="46" height="5" fill="#ffffff" opacity="0.85"/><rect x="-26" y="2" width="30" height="5" fill="#ffffff" opacity="0.6"/></g>
  <g transform="translate(214,184) rotate(-5)"><rect x="-38" y="-21" width="76" height="42" fill="#5B9945"/><rect x="-26" y="-9" width="46" height="5" fill="#ffffff" opacity="0.85"/><rect x="-26" y="2" width="30" height="5" fill="#ffffff" opacity="0.6"/></g>

  <line x1="320" y1="46" x2="320" y2="248" stroke="#cfd4da" stroke-width="1.5"/>

  <text x="352" y="20" font-family="sans-serif" font-size="15" font-weight="700" fill="#20242b">Seminarkonzept</text>
  <text x="352" y="39" font-family="sans-serif" font-size="12" fill="#666e79">Fertiger Ablauf &#8211; mit Reihenfolge &amp; Zeiten</text>
  <line x1="392" y1="60" x2="392" y2="238" stroke="#cfd4da" stroke-width="2"/>

  <text x="384" y="79" text-anchor="end" font-family="sans-serif" font-size="11" font-weight="600" fill="#666e79">09:00</text>
  <circle cx="392" cy="75" r="3.5" fill="#98a0aa"/>
  <rect x="408" y="60" width="210" height="30" fill="#EAB500"/><rect x="420" y="72" width="96" height="5" fill="#ffffff" opacity="0.85"/>

  <text x="384" y="115" text-anchor="end" font-family="sans-serif" font-size="11" font-weight="600" fill="#666e79">10:15</text>
  <circle cx="392" cy="111" r="3.5" fill="#98a0aa"/>
  <rect x="408" y="96" width="210" height="30" fill="#2F80AB"/><rect x="420" y="108" width="96" height="5" fill="#ffffff" opacity="0.85"/>

  <text x="408" y="152" font-family="sans-serif" font-size="11" font-weight="600" fill="#666e79">&#9749; Mittagspause</text>

  <text x="384" y="187" text-anchor="end" font-family="sans-serif" font-size="11" font-weight="600" fill="#666e79">13:00</text>
  <circle cx="392" cy="183" r="3.5" fill="#98a0aa"/>
  <rect x="408" y="168" width="210" height="30" fill="#882A30"/><rect x="420" y="180" width="96" height="5" fill="#ffffff" opacity="0.85"/>

  <text x="384" y="223" text-anchor="end" font-family="sans-serif" font-size="11" font-weight="600" fill="#666e79">14:15</text>
  <circle cx="392" cy="219" r="3.5" fill="#98a0aa"/>
  <rect x="408" y="204" width="210" height="30" fill="#5B9945"/><rect x="420" y="216" width="96" height="5" fill="#ffffff" opacity="0.85"/>

  <text x="320" y="266" text-anchor="middle" font-family="sans-serif" font-size="13" font-weight="700" fill="#20242b">Gleiche Seminareinheiten &#8211; der Unterschied ist der Ablauf.</text>
</svg>
SVG;
echo html_writer::start_tag('details', ['class' => 'kg-review-diff']);
echo html_writer::tag('summary', 'Worin liegt der Unterschied zwischen Methoden-Sammlung und Seminarkonzept?');
echo html_writer::start_div('kg-review-diff__body');
echo $diffsvg;
echo html_writer::start_tag('ul', ['class' => 'kg-review-diff__list']);
echo html_writer::tag('li', '<strong>Methoden-Sammlung:</strong> eine Kiste voller Seminareinheiten '
    . '<em>ohne</em> feste Reihenfolge – zum Stöbern und einzeln Herauspicken.');
echo html_writer::tag('li', '<strong>Seminarkonzept:</strong> dieselben Einheiten, aber in einen '
    . 'fertigen Ablauf gebracht – mit Reihenfolge, Zeiten und Dramaturgie. Ein kompletter Plan, '
    . 'den andere übernehmen können.');
echo html_writer::end_tag('ul');
echo html_writer::end_div();
echo html_writer::end_tag('details');

echo html_writer::end_div();

// D51: Weg 1 - bestehende Sammlung. Die beiden früher getrennten Kästen
// (Sammlung wählen / Kandidaten einreichen) sind jetzt ein durchgängiger
// Ablauf: Sammlung wählen -> Kandidaten prüfen -> Update-Hinweis -> einreichen.
echo html_writer::start_div('kg-ie-block kg-review-panel kg-hidden', ['id' => 'kg-review-panel-existing']);
echo html_writer::tag('h4', 'Bestehende Methoden-Sammlung ergänzen oder aktualisieren');
echo html_writer::tag('label', '1. Sammlung wählen', ['for' => 'kg-review-existing-set-select', 'class' => 'kg-label']);
echo html_writer::start_tag('select', ['id' => 'kg-review-existing-set-select', 'class' => 'kg-input']);
echo html_writer::tag('option', 'Bitte wählen', ['value' => '0']);
echo html_writer::end_tag('select');
echo html_writer::tag('label', '2. Seminareinheiten prüfen und auswählen', ['class' => 'kg-label']);
echo html_writer::tag('p', 'Nach Auswahl einer Sammlung erscheinen hier neue und geänderte Seminareinheiten zum Übergeben.');
echo html_writer::start_div('kg-row');
echo html_writer::tag('button', 'Alle auswählen', ['type' => 'button', 'id' => 'kg-review-existing-select-all', 'class' => 'kg-btn']);
echo html_writer::tag('button', 'Keine auswählen', ['type' => 'button', 'id' => 'kg-review-existing-select-none', 'class' => 'kg-btn']);
echo html_writer::tag('button', 'Änderungen neu prüfen', ['type' => 'button', 'id' => 'kg-review-existing-refresh', 'class' => 'kg-btn']);
echo html_writer::end_div();
echo html_writer::tag('div', '', ['id' => 'kg-review-existing-candidates', 'class' => 'kg-ie-preview']);
echo html_writer::tag('label', '3. Update-Hinweis für Konzeptverantwortliche', ['for' => 'kg-review-existing-changelog', 'class' => 'kg-label']);
echo html_writer::tag('textarea', '', ['id' => 'kg-review-existing-changelog', 'class' => 'kg-input', 'rows' => 3]);
echo html_writer::start_div('kg-row kg-pdf-actions');
echo html_writer::tag('button', 'Ausgewählte Seminareinheiten einreichen', [
    'type' => 'button',
    'id' => 'kg-review-existing-submit',
    'class' => 'kg-btn kg-btn-primary',
]);
echo html_writer::end_div();
echo html_writer::tag('div', '', ['id' => 'kg-review-existing-status', 'class' => 'kg-status']);
echo html_writer::end_div();

// D51: Weg 2 - neue Methoden-Sammlung.
echo html_writer::start_div('kg-ie-block kg-review-panel kg-hidden', ['id' => 'kg-review-panel-new']);
echo html_writer::tag('h4', 'Neue Methoden-Sammlung zusammenstellen');
echo html_writer::tag('p', 'Wähle aus allen vorhandenen Seminareinheiten aus und bündele sie zu einer neuen Methoden-Sammlung – einer Sammlung ohne Ablauf/Reihenfolge.');
echo html_writer::start_div('kg-two');
echo html_writer::start_div();
echo html_writer::tag('label', 'Name', ['for' => 'kg-review-new-displayname', 'class' => 'kg-label']);
echo html_writer::empty_tag('input', ['type' => 'text', 'id' => 'kg-review-new-displayname', 'class' => 'kg-input']);
echo html_writer::tag('small', 'Name = sichtbarer Anzeigename.');
echo html_writer::end_div();
echo html_writer::start_div();
echo html_writer::tag('label', 'Kurzbezeichnung', ['for' => 'kg-review-new-shortname', 'class' => 'kg-label']);
echo html_writer::empty_tag('input', ['type' => 'text', 'id' => 'kg-review-new-shortname', 'class' => 'kg-input']);
echo html_writer::tag('small', 'Kurzbezeichnung = technischer, eindeutiger Schlüssel ohne Leerzeichen; Name = sichtbarer Anzeigename.');
echo html_writer::end_div();
echo html_writer::end_div();
echo html_writer::tag('label', 'Beschreibung', ['for' => 'kg-review-new-description', 'class' => 'kg-label']);
echo html_writer::tag('textarea', '', ['id' => 'kg-review-new-description', 'class' => 'kg-input', 'rows' => 3]);
echo html_writer::tag('label', 'Update-Hinweis für Konzeptverantwortliche', ['for' => 'kg-review-new-changelog', 'class' => 'kg-label']);
echo html_writer::tag('textarea', '', ['id' => 'kg-review-new-changelog', 'class' => 'kg-input', 'rows' => 3]);
echo html_writer::start_div('kg-row');
echo html_writer::tag('button', 'Alle auswählen', ['type' => 'button', 'id' => 'kg-review-new-select-all', 'class' => 'kg-btn']);
echo html_writer::tag('button', 'Keine auswählen', ['type' => 'button', 'id' => 'kg-review-new-select-none', 'class' => 'kg-btn']);
echo html_writer::end_div();
echo html_writer::tag('div', '', ['id' => 'kg-review-new-methods', 'class' => 'kg-ie-preview']);
echo html_writer::start_div('kg-row kg-pdf-actions');
echo html_writer::tag('button', 'Methoden-Sammlung einreichen', [
    'type' => 'button',
    'id' => 'kg-review-new-submit',
    'class' => 'kg-btn kg-btn-primary',
]);
echo html_writer::end_div();
echo html_writer::tag('div', '', ['id' => 'kg-review-new-status', 'class' => 'kg-status']);
echo html_writer::end_div();

// D32/D51: Weg 3 - Seminarkonzept einreichen. Kompletter Plan (inkl.
// Ablauf/Sequenz) über denselben Prüfprozess wie die Methoden-Sammlungen.
echo html_writer::start_div('kg-ie-block kg-review-panel kg-hidden', ['id' => 'kg-review-panel-konzept']);
echo html_writer::tag('h4', 'Seminarkonzept einreichen');
echo html_writer::tag('p', 'Reiche einen kompletten Seminarplan mit Ablauf ein – im Unterschied zur '
    . 'Methoden-Sammlung (Sammlung ohne Reihenfolge) wandert hier der ganze Plan samt Sequenz und den '
    . 'darin verwendeten Seminareinheiten in die Prüfung.');
echo html_writer::tag('label', 'Seminarplan auswählen', ['for' => 'kg-review-konzept-plan', 'class' => 'kg-label']);
echo html_writer::start_tag('select', ['id' => 'kg-review-konzept-plan', 'class' => 'kg-input']);
echo html_writer::tag('option', 'Bitte wählen', ['value' => '0']);
echo html_writer::end_tag('select');
echo html_writer::tag('label', 'Einreichen als', ['for' => 'kg-review-konzept-target', 'class' => 'kg-label']);
echo html_writer::start_tag('select', ['id' => 'kg-review-konzept-target', 'class' => 'kg-input']);
echo html_writer::tag('option', 'Neues Seminarkonzept', ['value' => '0']);
echo html_writer::end_tag('select');
echo html_writer::start_div('', ['id' => 'kg-review-konzept-newfields']);
echo html_writer::start_div('kg-two');
echo html_writer::start_div();
echo html_writer::tag('label', 'Name', ['for' => 'kg-review-konzept-displayname', 'class' => 'kg-label']);
echo html_writer::empty_tag('input', ['type' => 'text', 'id' => 'kg-review-konzept-displayname', 'class' => 'kg-input']);
echo html_writer::tag('small', 'Name = sichtbarer Anzeigename (vorbelegt mit dem Plan-Namen).');
echo html_writer::end_div();
echo html_writer::start_div();
echo html_writer::tag('label', 'Kurzbezeichnung', ['for' => 'kg-review-konzept-shortname', 'class' => 'kg-label']);
echo html_writer::empty_tag('input', ['type' => 'text', 'id' => 'kg-review-konzept-shortname', 'class' => 'kg-input']);
echo html_writer::tag('small', 'Technischer, eindeutiger Schlüssel ohne Leerzeichen.');
echo html_writer::end_div();
echo html_writer::end_div();
echo html_writer::tag('label', 'Beschreibung', ['for' => 'kg-review-konzept-description', 'class' => 'kg-label']);
echo html_writer::tag('textarea', '', ['id' => 'kg-review-konzept-description', 'class' => 'kg-input', 'rows' => 3]);
echo html_writer::end_div();
echo html_writer::tag('label', 'Update-Hinweis für Konzeptverantwortliche', ['for' => 'kg-review-konzept-changelog', 'class' => 'kg-label']);
echo html_writer::tag('textarea', '', ['id' => 'kg-review-konzept-changelog', 'class' => 'kg-input', 'rows' => 3]);
echo html_writer::start_div('kg-row kg-pdf-actions');
echo html_writer::tag('button', 'Seminarkonzept einreichen', [
    'type' => 'button',
    'id' => 'kg-review-konzept-submit',
    'class' => 'kg-btn kg-btn-primary',
]);
echo html_writer::end_div();
echo html_writer::tag('div', '', ['id' => 'kg-review-konzept-status', 'class' => 'kg-status']);
echo html_writer::end_div();

echo html_writer::end_div();

echo $OUTPUT->footer();
