<?php
// This file is part of Moodle - http://moodle.org/

namespace mod_seminarplaner\local\sequence;

defined('MOODLE_INTERNAL') || die();

/**
 * Canonical structure helpers for the D20 sequence data model.
 *
 * The sequence state lives inside the shared grid state JSON under the
 * top level key {@see self::STATE_KEY}. Ordering inside an anchor replaces
 * the legacy startMin/endMin fields; clock times are derived at render time.
 *
 * Structure (see docs/datenmodell-sequenz.md for the full contract):
 * - tage[]: ordered seminar days, each with anchors "vormittag"/"nachmittag"
 *   holding an ordered list of placement ids.
 * - platzierungen: atomic sequence entries ("einheit" or "pause").
 * - einheitenauswahlen: unit level alternatives (candidate refs + active).
 * - bausteine: optional headings with variants (module level alternatives).
 */
class sequence_state {
    /** @var string Key of the sequence section inside the grid state JSON. */
    public const STATE_KEY = 'sequenz';

    /** @var int Current schema version of the sequence section. */
    public const FORMAT_VERSION = 1;

    /** @var string Anchor name for the morning section of a day. */
    public const ANKER_VORMITTAG = 'vormittag';

    /** @var string Anchor name for the afternoon section of a day. */
    public const ANKER_NACHMITTAG = 'nachmittag';

    /** @var string Placement type referencing a unit selection. */
    public const TYP_EINHEIT = 'einheit';

    /** @var string Placement type for an in-anchor break. */
    public const TYP_PAUSE = 'pause';

    /**
     * Create an empty sequence section.
     *
     * @return array
     */
    public static function create_empty(): array {
        return [
            'version' => self::FORMAT_VERSION,
            'tage' => [],
            'platzierungen' => [],
            'einheitenauswahlen' => [],
            'bausteine' => [],
        ];
    }

    /**
     * Create an empty day record.
     *
     * @param int $tag One-based day number.
     * @param string $bezeichnung Day label, e.g. weekday name.
     * @return array
     */
    public static function create_day(int $tag, string $bezeichnung): array {
        return [
            'tag' => $tag,
            'bezeichnung' => $bezeichnung,
            'anker' => [
                self::ANKER_VORMITTAG => ['sequenz' => []],
                self::ANKER_NACHMITTAG => ['sequenz' => []],
            ],
        ];
    }

    /**
     * Whether the given grid state already carries a sequence section.
     *
     * @param array $state Decoded grid state.
     * @return bool
     */
    public static function has_sequence(array $state): bool {
        return isset($state[self::STATE_KEY])
            && is_array($state[self::STATE_KEY])
            && isset($state[self::STATE_KEY]['version']);
    }

    /**
     * Validate referential integrity of a sequence section.
     *
     * Returns a list of human readable problem strings; an empty list
     * means the structure is consistent.
     *
     * @param array $sequenz Sequence section.
     * @return string[]
     */
    public static function validate(array $sequenz): array {
        $problems = [];

        $platzierungen = self::as_array($sequenz['platzierungen'] ?? null);
        $auswahlen = self::as_array($sequenz['einheitenauswahlen'] ?? null);
        $bausteine = self::as_array($sequenz['bausteine'] ?? null);
        $tage = self::as_array($sequenz['tage'] ?? null);

        if (!isset($sequenz['version']) || (int)$sequenz['version'] !== self::FORMAT_VERSION) {
            $problems[] = 'Unbekannte oder fehlende Schema-Version';
        }

        $referenced = [];
        foreach ($tage as $index => $day) {
            if (!is_array($day)) {
                $problems[] = "Tag {$index}: kein Objekt";
                continue;
            }
            $anker = self::as_array($day['anker'] ?? null);
            foreach ([self::ANKER_VORMITTAG, self::ANKER_NACHMITTAG] as $ankername) {
                $sequence = self::as_array(self::as_array($anker[$ankername] ?? null)['sequenz'] ?? null);
                foreach ($sequence as $pid) {
                    $pid = (string)$pid;
                    if (!isset($platzierungen[$pid])) {
                        $problems[] = "Anker {$ankername} (Tag " . ($day['tag'] ?? $index) . "): unbekannte Platzierung {$pid}";
                        continue;
                    }
                    if (isset($referenced[$pid])) {
                        $problems[] = "Platzierung {$pid} mehrfach in Anker-Sequenzen referenziert";
                    }
                    $referenced[$pid] = true;
                }
            }
        }

        foreach ($platzierungen as $pid => $platzierung) {
            if (!is_array($platzierung)) {
                $problems[] = "Platzierung {$pid}: kein Objekt";
                continue;
            }
            $typ = (string)($platzierung['typ'] ?? '');
            if (!in_array($typ, [self::TYP_EINHEIT, self::TYP_PAUSE], true)) {
                $problems[] = "Platzierung {$pid}: unbekannter Typ '{$typ}'";
                continue;
            }
            $dauer = $platzierung['dauer'] ?? null;
            if (!is_int($dauer) || $dauer < 0) {
                $problems[] = "Platzierung {$pid}: ungültige Dauer";
            }
            if ($typ !== self::TYP_EINHEIT) {
                continue;
            }
            $bausteinid = $platzierung['bausteinid'] ?? null;
            if ($bausteinid !== null && !isset($bausteine[(string)$bausteinid])) {
                $problems[] = "Platzierung {$pid}: unbekannter Baustein {$bausteinid}";
            }
            $auswahlid = (string)($platzierung['einheitenauswahl'] ?? '');
            if ($auswahlid === '' || !isset($auswahlen[$auswahlid])) {
                $problems[] = "Platzierung {$pid}: unbekannte Einheiten-Auswahl {$auswahlid}";
            }
        }

        foreach ($auswahlen as $aid => $auswahl) {
            if (!is_array($auswahl)) {
                $problems[] = "Einheiten-Auswahl {$aid}: kein Objekt";
                continue;
            }
            $kandidaten = self::as_array($auswahl['kandidaten'] ?? null);
            $aktiv = $auswahl['aktiv'] ?? null;
            if ($aktiv === null && $kandidaten) {
                $problems[] = "Einheiten-Auswahl {$aid}: keine aktive Kandidatin trotz Kandidatenliste";
            }
            if ($aktiv !== null && !in_array((string)$aktiv, array_map('strval', $kandidaten), true)) {
                $problems[] = "Einheiten-Auswahl {$aid}: aktive Kandidatin nicht in der Kandidatenliste";
            }
        }

        foreach ($bausteine as $bid => $baustein) {
            if (!is_array($baustein)) {
                $problems[] = "Baustein {$bid}: kein Objekt";
                continue;
            }
            $varianten = self::as_array($baustein['varianten'] ?? null);
            $aktivevariante = $baustein['aktivevariante'] ?? null;
            if ($aktivevariante !== null && !isset($varianten[(string)$aktivevariante])) {
                $problems[] = "Baustein {$bid}: aktive Variante {$aktivevariante} existiert nicht";
            }
            foreach ($varianten as $vid => $variante) {
                if (!is_array($variante)) {
                    $problems[] = "Baustein {$bid}: Variante {$vid} kein Objekt";
                    continue;
                }
                foreach (self::as_array($variante['platzierungen'] ?? null) as $pid) {
                    if (!isset($platzierungen[(string)$pid])) {
                        $problems[] = "Baustein {$bid}, Variante {$vid}: unbekannte Platzierung {$pid}";
                    }
                }
            }
        }

        return $problems;
    }

    /**
     * Coerce a value to array.
     *
     * @param mixed $value Value.
     * @return array
     */
    private static function as_array($value): array {
        return is_array($value) ? $value : [];
    }
}
