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
 * Erweiterbare Mehrfach-Dropdowns (z. B. Sozialform).
 *
 * Ein Dropdown mit data-kg-form-multi-extensible="1" (seminarplaner_render_multi_dropdown
 * mit $addlabel) nimmt neben den vorgegebenen Werten eigene auf: über das
 * Eingabefeld unten im Panel, aus der Bibliothek der Aktivität (was andere
 * Einheiten schon verwenden) und aus der gerade geladenen Einheit. Ohne das fiel
 * ein Wert außerhalb der festen Liste beim Speichern still weg.
 *
 * Bibliotheks-Editor und Sequenz-Dialog haben je eigene Dropdown-Logik; beide
 * nutzen dieses Modul für das Anlegen der Optionen.
 *
 * @module     mod_seminarplaner/multiextend
 * @copyright  2026 Guido Brombach <gibro@posteo.de>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
define([], function() {
    const OPTION = '[data-kg-form-multi-option="1"]';
    const MAX_LENGTH = 80;

    const isExtensible = (dropdown) => !!dropdown && dropdown.getAttribute('data-kg-form-multi-extensible') === '1';

    const options = (dropdown) => Array.from(dropdown.querySelectorAll(OPTION));

    const findOption = (dropdown, value) => {
        const wanted = String(value || '').trim().toLowerCase();
        return options(dropdown).find((cb) => String(cb.value || '').trim().toLowerCase() === wanted) || null;
    };

    /**
     * Liefert die Option zu einem Wert (gleich ohne Rücksicht auf Groß-/Kleinschreibung)
     * und legt sie an, wenn es sie noch nicht gibt.
     *
     * @param {HTMLElement} dropdown
     * @param {string} value
     * @returns {HTMLInputElement|null}
     */
    const ensureOption = (dropdown, value) => {
        const label = String(value || '').trim().replace(/\s+/g, ' ').slice(0, MAX_LENGTH);
        if (!dropdown || !label) {
            return null;
        }
        const existing = findOption(dropdown, label);
        if (existing) {
            return existing;
        }
        const panel = dropdown.querySelector('[data-kg-form-multi-panel="1"]');
        if (!panel) {
            return null;
        }
        const sibling = options(dropdown)[0];
        const row = document.createElement('label');
        row.className = 'kg-tag-option kg-tag-option--custom';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = label;
        checkbox.setAttribute('data-kg-form-multi-option', '1');
        // In der Stapelbearbeitung kann das Feld gerade gesperrt sein.
        checkbox.disabled = !!(sibling && sibling.disabled);
        const text = document.createElement('span');
        text.textContent = label;
        row.appendChild(checkbox);
        row.appendChild(text);
        const adder = panel.querySelector('[data-kg-form-multi-add="1"]');
        panel.insertBefore(row, adder || null);
        return checkbox;
    };

    const selectedValues = (dropdown) => options(dropdown)
        .filter((cb) => cb.checked)
        .map((cb) => String(cb.value || '').trim())
        .filter(Boolean);

    /**
     * Ergänzt alle erweiterbaren Dropdowns der Seite um die Werte, die die
     * Bibliothek schon verwendet - so steht eine einmal angelegte Sozialform
     * auch bei der nächsten Einheit zur Wahl.
     *
     * @param {Array} cards Seminareinheiten der Bibliothek.
     * @param {Function} split Zerlegt einen Feldwert in seine Einträge.
     */
    const addLibraryValues = (cards, split) => {
        document.querySelectorAll('[data-kg-form-multi-dropdown="1"][data-kg-form-multi-extensible="1"]')
            .forEach((dropdown) => {
                const key = String(dropdown.getAttribute('data-kg-field') || '').replace(/^#(ml-e-|ml-bulk-|sq-e-)/, '');
                const seen = new Set();
                (cards || []).forEach((card) => {
                    split(card && card[key]).forEach((value) => {
                        const norm = String(value).trim().toLowerCase();
                        if (norm && !seen.has(norm)) {
                            seen.add(norm);
                            ensureOption(dropdown, value);
                        }
                    });
                });
            });
    };

    /**
     * Bindet das Eingabefeld „Weitere …" eines erweiterbaren Dropdowns.
     *
     * @param {HTMLElement} dropdown
     * @param {Function} onChange Bekommt die nun ausgewählten Werte.
     */
    const bindAdder = (dropdown, onChange) => {
        if (!isExtensible(dropdown)) {
            return;
        }
        const input = dropdown.querySelector('[data-kg-form-multi-add-input="1"]');
        const button = dropdown.querySelector('[data-kg-form-multi-add-button="1"]');
        if (!input || !button) {
            return;
        }
        const add = () => {
            const checkbox = ensureOption(dropdown, input.value);
            if (!checkbox) {
                return;
            }
            checkbox.checked = true;
            input.value = '';
            onChange(selectedValues(dropdown));
            input.focus();
        };
        button.addEventListener('click', add);
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                // Kein Absenden des umgebenden Formulars/Dialogs.
                event.preventDefault();
                event.stopPropagation();
                add();
            }
        });
    };

    return {isExtensible, ensureOption, selectedValues, addLibraryValues, bindAdder};
});
