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
// along with Moodle.  If not, see <http://www.gnu.org/licenses/>.

/**
 * Verknuepfungen zwischen alternativen Seminareinheiten.
 *
 * Bibliotheks-Editor und Sequenz-Dialog aendern dieselben Verknuepfungen und
 * muessen sich gleich verhalten. Der Server ergaenzt beim Speichern jede
 * Verknuepfung in beide Richtungen; wer sie nur an einer Karte loescht,
 * bekommt sie von der Gegenseite zurueck.
 *
 * @module     mod_seminarplaner/alternativelinks
 * @copyright  2026 Guido Brombach <gibro@posteo.de>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
define([], function() {
    const cardId = (card) => (card ? String(card.id === undefined || card.id === null ? '' : card.id).trim() : '');

    const linkIds = (raw) => (Array.isArray(raw) ? raw.map((value) => String(value || '').trim()).filter(Boolean) : []);

    /**
     * Setzt die Alternativen einer Karte und zieht die Gegenseiten nach.
     *
     * Wird eine Alternative abgewaehlt, verlaesst sie den ganzen Kreis: Auch
     * zu den verbleibenden Alternativen der Karte wird die Verknuepfung
     * geloest. Sonst bliebe sie in einem Dreierkreis ueber die dritte Karte
     * verbunden und wuerde im Plan nicht verschwinden.
     *
     * @param {Array} cards Alle Karten der Aktivitaet (werden veraendert).
     * @param {string} cardid Die bearbeitete Karte.
     * @param {Array} selected Die gewaehlten Alternativen.
     */
    const setLinks = (cards, cardid, selected) => {
        const current = String(cardid || '').trim();
        if (!current) {
            return;
        }
        const chosen = new Set(linkIds(selected).filter((id) => id !== current));
        const dropped = new Set();
        cards.forEach((card) => {
            const id = cardId(card);
            if (id === current) {
                linkIds(card.alternativen).filter((other) => !chosen.has(other)).forEach((other) => dropped.add(other));
            } else if (id && linkIds(card.alternativen).includes(current) && !chosen.has(id)) {
                dropped.add(id);
            }
        });
        cards.forEach((card) => {
            const id = cardId(card);
            if (!id) {
                return;
            }
            if (id === current) {
                card.alternativen = Array.from(chosen);
                return;
            }
            let links = linkIds(card.alternativen).filter((other) => other !== current);
            if (dropped.has(id)) {
                links = links.filter((other) => !chosen.has(other));
            }
            if (chosen.has(id)) {
                links = links.filter((other) => !dropped.has(other));
                links.push(current);
            }
            card.alternativen = Array.from(new Set(links));
        });
    };

    /**
     * Baut aus den Karten den Verknuepfungsgraphen (in beide Richtungen).
     *
     * @param {Array} cards Alle Karten der Aktivitaet.
     * @returns {Map} Karten-ID -> Set der verknuepften IDs.
     */
    const linkGraph = (cards) => {
        const graph = new Map();
        const neighbours = (id) => {
            if (!graph.has(id)) {
                graph.set(id, new Set());
            }
            return graph.get(id);
        };
        cards.forEach((card) => {
            const id = cardId(card);
            if (!id) {
                return;
            }
            linkIds(card.alternativen).forEach((other) => {
                neighbours(id).add(other);
                neighbours(other).add(id);
            });
        });
        return graph;
    };

    /**
     * Alle Karten, die ueber Verknuepfungen von einer Karte aus erreichbar sind.
     *
     * @param {Map} graph Ergebnis von linkGraph.
     * @param {string} start Karten-ID.
     * @returns {Set} Erreichbare IDs einschliesslich start.
     */
    const reachableFrom = (graph, start) => {
        const seen = new Set([String(start)]);
        const queue = [String(start)];
        while (queue.length) {
            (graph.get(queue.pop()) || new Set()).forEach((other) => {
                if (!seen.has(other)) {
                    seen.add(other);
                    queue.push(other);
                }
            });
        }
        return seen;
    };

    return {setLinks, linkGraph, reachableFrom};
});
