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
 * Ausgabe fuer die Moodle App.
 *
 * @package    mod_seminarplaner
 * @copyright  2026 Guido Brombach <gibro@posteo.de>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace mod_seminarplaner\output;

use context_module;
use mod_seminarplaner\local\sequence\roterfaden_model;
use mod_seminarplaner\local\service\grid_service;

/**
 * Der Rote Faden in der Moodle App.
 *
 * Die App fuehrt keine AMD-Module aus: was im Browser roterfaden.js im Client
 * rechnet und zeichnet, muss hier fertig vom Server kommen. Abgeleitet wird der
 * Ablauf aus demselben veroeffentlichten Schnappschuss und derselben Regel
 * (roterfaden_model) — die App zeigt also denselben Ablauf wie der Browser,
 * nur in Ionic-Bausteinen und ohne die Planungsseiten, die auf der kleinen
 * Flaeche ohnehin nicht zu bedienen waeren.
 *
 * @package    mod_seminarplaner
 * @copyright  2026 Guido Brombach <gibro@posteo.de>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class mobile {

    /**
     * Den Roten Faden als App-Ansicht der Aktivitaet ausliefern.
     *
     * @param array $args Aufrufparameter der App (cmid, courseid, …).
     * @return array Template, Daten und Dateien fuer die App.
     */
    public static function mobile_course_view(array $args): array {
        global $OUTPUT, $DB;

        $args = (object)$args;
        $cmid = (int)$args->cmid;

        $cm = get_coursemodule_from_id('seminarplaner', $cmid, 0, false, MUST_EXIST);
        $course = $DB->get_record('course', ['id' => $cm->course], '*', MUST_EXIST);
        // $preventredirect: Im Webservice gibt es keine Seite, auf die man
        // weiterleiten koennte. Ohne das Flag endet ein Fall, in dem
        // require_login sonst zur Einschreibeseite schicken wuerde (nicht
        // eingeschriebene Person, verborgener Kurs), in „Nichtunterstuetzte
        // Weiterleitung" statt in einer Fehlermeldung, mit der die App umgehen
        // kann. Auf gibro.de an einer echten Aktivitaet aufgeschlagen.
        require_login($course, true, $cm, true, true);
        $context = context_module::instance($cm->id);

        // Die Beschreibung der Aktivitaet blendet die App selbst ein
        // (displaydescription in db/mobile.php) — sie gehoert nicht ins Template.
        $data = [
            'allowed' => has_capability('mod/seminarplaner:viewroterfaden', $context),
            'noaccessmessage' => get_string('mobile_noaccess', 'mod_seminarplaner'),
            'emptymessage' => get_string('roterfaden_empty', 'mod_seminarplaner'),
            'hasdays' => false,
            'summary' => '',
            'days' => [],
        ];

        if ($data['allowed']) {
            $service = new grid_service();
            $state = $service->get_roterfaden_state((int)$cm->id);
            if (!empty($state['ispublished'])) {
                $days = roterfaden_model::build_days(is_array($state['state'] ?? null) ? $state['state'] : []);
                $data['days'] = self::prepare_days($days);
                $data['hasdays'] = !empty($data['days']);
                $data['summary'] = self::summary_label($days);
            }
        }

        return [
            'templates' => [
                [
                    'id' => 'main',
                    'html' => self::appsafe($OUTPUT->render_from_template('mod_seminarplaner/mobile_view', $data)),
                ],
            ],
            'javascript' => '',
            'otherdata' => '',
            'files' => [],
        ];
    }

    /**
     * Die abgeleiteten Tage fuer das Template aufbereiten.
     *
     * Uhrzeiten, Dauern und Phasenbeschriftungen entstehen hier einmal als
     * fertiger Text — im Template steht danach keine Rechnung mehr.
     *
     * @param array $days Ergebnis von roterfaden_model::build_days().
     * @return array Tage in Template-Form.
     */
    private static function prepare_days(array $days): array {
        $today = self::today_dayname();
        $out = [];
        foreach ($days as $day) {
            $anchors = [];
            foreach ($day['anchors'] as $anchor) {
                $blocks = [];
                foreach ($anchor['blocks'] as $block) {
                    $themen = [];
                    foreach ($block['themen'] as $theme) {
                        $themen[] = [
                            'title' => $theme['title'],
                            'phase' => $theme['phase'],
                            'hasphase' => $theme['phase'] !== '',
                            'phaselabel' => self::phase_label($theme['phase']),
                            'hasduration' => !empty($theme['minutes']),
                            'duration' => roterfaden_model::duration_label((int)$theme['minutes']),
                        ];
                    }
                    $blocks[] = [
                        'num' => $block['num'],
                        'title' => $block['title'],
                        'continuation' => !empty($block['continuation']),
                        'continuationlabel' => get_string('mobile_continuation', 'mod_seminarplaner'),
                        'phase' => $block['phase'],
                        'hasphase' => $block['phase'] !== '',
                        'phaselabel' => self::phase_label($block['phase']),
                        'starttime' => roterfaden_model::clock_label((int)$block['startMin']),
                        'duration' => roterfaden_model::duration_label((int)$block['minutes']),
                        'themen' => $themen,
                        'themencount' => count($themen),
                        // Eine einzelne Themenzeile, die den Blocktitel nur wiederholt,
                        // traegt in der App nichts bei — sie kostet nur Hoehe.
                        'showthemen' => count($themen) > 1
                            || (count($themen) === 1 && $themen[0]['title'] !== $block['title']),
                    ];
                }
                $timespan = ($anchor['start'] !== null && $anchor['end'] !== null)
                    ? roterfaden_model::clock_label((int)$anchor['start'])
                        . '–' . roterfaden_model::clock_label((int)$anchor['end'])
                    : '';
                $anchors[] = [
                    'key' => $anchor['key'],
                    'name' => $anchor['name'],
                    'timespan' => $timespan,
                    'hastimespan' => $timespan !== '',
                    'blocks' => $blocks,
                ];
            }
            $out[] = [
                'name' => $day['name'],
                'istoday' => $day['name'] === $today,
                'todaylabel' => get_string('mobile_today', 'mod_seminarplaner'),
                'countlabel' => self::count_label((int)$day['count']),
                'anchors' => $anchors,
            ];
        }
        return $out;
    }

    /**
     * Kopfzeile "3 Tage · 12 Programmpunkte".
     *
     * @param array $days Ergebnis von roterfaden_model::build_days().
     * @return string
     */
    private static function summary_label(array $days): string {
        if (!$days) {
            return '';
        }
        $blocks = 0;
        foreach ($days as $day) {
            $blocks += (int)$day['count'];
        }
        $dayslabel = count($days) === 1
            ? get_string('mobile_day', 'mod_seminarplaner')
            : get_string('mobile_days', 'mod_seminarplaner', count($days));
        return $dayslabel . ' · ' . self::count_label($blocks);
    }

    /**
     * "1 Programmpunkt" / "n Programmpunkte".
     *
     * @param int $count Anzahl der Bloecke.
     * @return string
     */
    private static function count_label(int $count): string {
        return $count === 1
            ? get_string('mobile_item', 'mod_seminarplaner')
            : get_string('mobile_items', 'mod_seminarplaner', $count);
    }

    /**
     * Beschriftung einer Seminarphase.
     *
     * @param string $phase Phasenschluessel.
     * @return string
     */
    private static function phase_label(string $phase): string {
        if ($phase === '') {
            return '';
        }
        return get_string('phase_' . $phase, 'mod_seminarplaner');
    }

    /**
     * Der heutige Wochentag, wie ihn die Seminarplanung schreibt.
     *
     * Offline zeigt die App den zuletzt geladenen Stand — die Markierung
     * "Heute" stammt dann vom Zeitpunkt des Herunterladens.
     *
     * @return string
     */
    private static function today_dayname(): string {
        $wday = (int)(usergetdate(time())['wday'] ?? 0);
        return roterfaden_model::DAYS_ALL[($wday + 6) % 7] ?? 'Montag';
    }

    /**
     * Geschweifte Klammernpaare aus Seminartexten entschaerfen.
     *
     * Die App uebersetzt das gelieferte HTML durch Angular; ein "{{" in einem
     * Seminartitel waere dort eine Interpolation und liesse die ganze Ansicht
     * leer. Als HTML-Entitaet geschrieben sieht die Nutzerin dieselbe Klammer,
     * Angular aber keine Anweisung mehr.
     *
     * @param string $html Fertig gerendertes Template.
     * @return string
     */
    private static function appsafe(string $html): string {
        return str_replace(['{{', '}}'], ['&#123;&#123;', '&#125;&#125;'], $html);
    }
}
