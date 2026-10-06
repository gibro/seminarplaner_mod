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

// Gemerkter Seminarplan ueber die Reiter hinweg (Sequenz, Ueberblick, Live,
// Import/Export). Wer in der Sequenz einen Plan waehlt und in den Ueberblick
// wechselt, will denselben Plan sehen - nicht den neuesten. Der Schluessel ist
// derselbe, den der Ueberblick seit jeher benutzt (grid.js). sessionStorage:
// gilt je Browser-Tab und vergeht mit ihm; kein Speicherort fuer Plan-Daten.
//
// @module mod_seminarplaner/planmemory

define([], function() {
    const key = (cmid) => `mod_seminarplaner_loaded_grid_${cmid}`;

    return {
        /**
         * Gemerkte Plan-Id dieser Aktivitaet oder 0.
         *
         * @param {number} cmid
         * @return {number}
         */
        read: function(cmid) {
            try {
                const gridid = Number.parseInt(String(sessionStorage.getItem(key(cmid)) || ''), 10);
                return Number.isFinite(gridid) && gridid > 0 ? gridid : 0;
            } catch (e) {
                return 0;
            }
        },

        /**
         * Plan-Id merken (0 oder ungueltig: vergessen).
         *
         * @param {number} cmid
         * @param {number} gridid
         */
        remember: function(cmid, gridid) {
            const normalized = Number.parseInt(String(gridid || ''), 10);
            try {
                if (Number.isFinite(normalized) && normalized > 0) {
                    sessionStorage.setItem(key(cmid), String(normalized));
                } else {
                    sessionStorage.removeItem(key(cmid));
                }
            } catch (e) {
                // Gesperrter Speicher (privates Fenster): dann eben ohne Merken.
            }
        },
    };
});
