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
 * Tag-Vorschläge beim Tippen (Bibliotheks-Editor und Einheiten-Dialog der Sequenz).
 *
 * Das Tags-Feld ist ein freies Textfeld mit kommagetrennten Einträgen. Während
 * man tippt, schlägt dieses Modul die Tags vor, die in der Bibliothek der
 * Aktivität schon vorkommen - damit dieselbe Sache nicht unter drei
 * Schreibweisen landet. Verlässt man das Feld, bekommt ein Eintrag, der sich
 * nur in Groß-/Kleinschreibung von einem vorhandenen Tag unterscheidet, dessen
 * Schreibweise.
 *
 * @module     mod_seminarplaner/tagsuggest
 * @copyright  2026 Guido Brombach <gibro@posteo.de>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
define([], function() {
    const SEPARATOR = /[,;]/;
    const MAX_SUGGESTIONS = 8;
    let instances = 0;

    const escapeHtml = (str) => String(str || '').replace(/[&<>"']/g, (ch) => (
        {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[ch] || ch
    ));

    // Vorhandene Tags, je Schreibweise-unabhängigem Schlüssel einmal, mit Häufigkeit.
    // Die häufigste Schreibweise gewinnt.
    const collectTags = (raw) => {
        const spellings = new Map();
        (raw || []).forEach((tag) => {
            const label = String(tag || '').trim();
            if (!label) {
                return;
            }
            const key = label.toLowerCase();
            if (!spellings.has(key)) {
                spellings.set(key, new Map());
            }
            const counts = spellings.get(key);
            counts.set(label, (counts.get(label) || 0) + 1);
        });
        return Array.from(spellings.entries()).map(([key, counts]) => {
            let best = '';
            let total = 0;
            counts.forEach((count, label) => {
                total += count;
                if (!best || count > counts.get(best)) {
                    best = label;
                }
            });
            return {key, label: best, count: total};
        });
    };

    // Grenzen des Eintrags, in dem der Cursor steht.
    const currentSegment = (input) => {
        const value = input.value;
        const caret = typeof input.selectionStart === 'number' ? input.selectionStart : value.length;
        let start = caret;
        while (start > 0 && !SEPARATOR.test(value[start - 1])) {
            start--;
        }
        let end = caret;
        while (end < value.length && !SEPARATOR.test(value[end])) {
            end++;
        }
        return {start, end, token: value.slice(start, end).trim()};
    };

    const rank = (entry, query) => {
        const label = entry.key;
        if (label.startsWith(query)) {
            return 0;
        }
        if (label.split(/[\s&/-]+/).some((word) => word.startsWith(query))) {
            return 1;
        }
        return label.includes(query) ? 2 : -1;
    };

    const highlight = (label, query) => {
        const at = label.toLowerCase().indexOf(query);
        if (at < 0) {
            return escapeHtml(label);
        }
        return escapeHtml(label.slice(0, at))
            + `<strong>${escapeHtml(label.slice(at, at + query.length))}</strong>`
            + escapeHtml(label.slice(at + query.length));
    };

    /**
     * Hängt die Vorschläge an ein Tags-Eingabefeld.
     *
     * @param {HTMLInputElement} input Das Tags-Feld.
     * @param {Function} getTags Liefert beim Aufruf alle Tags der Bibliothek (Array von Strings, Dubletten erlaubt).
     */
    const attach = (input, getTags) => {
        if (!input || input.dataset.kgTagsuggest === '1') {
            return;
        }
        input.dataset.kgTagsuggest = '1';
        instances++;
        const listid = `kg-tagsuggest-${instances}`;
        const host = input.parentElement;
        if (host) {
            host.classList.add('kg-tagsuggest-host');
        }
        const list = document.createElement('ul');
        list.className = 'kg-tagsuggest';
        list.id = listid;
        list.setAttribute('role', 'listbox');
        list.setAttribute('aria-label', 'Vorhandene Tags');
        list.hidden = true;
        input.insertAdjacentElement('afterend', list);
        input.setAttribute('role', 'combobox');
        input.setAttribute('aria-autocomplete', 'list');
        input.setAttribute('aria-controls', listid);
        input.setAttribute('aria-expanded', 'false');
        input.setAttribute('autocomplete', 'off');

        let items = [];
        let active = -1;

        const close = () => {
            list.hidden = true;
            list.innerHTML = '';
            items = [];
            active = -1;
            input.setAttribute('aria-expanded', 'false');
            input.removeAttribute('aria-activedescendant');
        };

        const setActive = (index) => {
            active = index;
            Array.from(list.children).forEach((li, i) => {
                li.classList.toggle('kg-tagsuggest__item--active', i === index);
                li.setAttribute('aria-selected', i === index ? 'true' : 'false');
            });
            if (index >= 0 && list.children[index]) {
                input.setAttribute('aria-activedescendant', list.children[index].id);
                list.children[index].scrollIntoView({block: 'nearest'});
            } else {
                input.removeAttribute('aria-activedescendant');
            }
        };

        const open = () => {
            const segment = currentSegment(input);
            const query = segment.token.toLowerCase();
            if (!query) {
                close();
                return;
            }
            // Was im Feld schon steht, wird nicht noch einmal angeboten.
            const used = new Set(input.value.split(SEPARATOR).map((t) => t.trim().toLowerCase()).filter(Boolean));
            used.delete(query);
            items = collectTags(getTags())
                .filter((entry) => !used.has(entry.key))
                .map((entry) => ({entry, score: rank(entry, query)}))
                .filter((hit) => hit.score >= 0 && hit.entry.key !== query)
                .sort((a, b) => a.score - b.score || b.entry.count - a.entry.count
                    || a.entry.label.localeCompare(b.entry.label, 'de'))
                .slice(0, MAX_SUGGESTIONS)
                .map((hit) => hit.entry);
            if (!items.length) {
                close();
                return;
            }
            list.innerHTML = items.map((entry, i) => `
                <li id="${listid}-${i}" class="kg-tagsuggest__item" role="option" aria-selected="false" data-index="${i}">
                  <span class="kg-tagsuggest__label">${highlight(entry.label, query)}</span>
                  <span class="kg-tagsuggest__count" title="So oft in der Bibliothek verwendet">${entry.count}</span>
                </li>`).join('');
            list.hidden = false;
            input.setAttribute('aria-expanded', 'true');
            setActive(-1);
        };

        const accept = (index) => {
            const entry = items[index];
            if (!entry) {
                return;
            }
            const segment = currentSegment(input);
            const value = input.value;
            const before = value.slice(0, segment.start).replace(/\s*$/, '');
            const after = value.slice(segment.end);
            const prefix = before ? `${before} ` : '';
            // Am Ende gleich das Komma für den nächsten Tag setzen.
            const insert = after.trim() === '' ? `${entry.label}, ` : entry.label;
            input.value = prefix + insert + (after.trim() === '' ? '' : after);
            const caret = (prefix + insert).length;
            input.setSelectionRange(caret, caret);
            close();
            input.dispatchEvent(new Event('input', {bubbles: true}));
            input.focus();
        };

        // Gleiche Sache, gleiche Schreibweise: beim Verlassen an vorhandene Tags angleichen.
        const normalizeSpelling = () => {
            const known = new Map(collectTags(getTags()).map((entry) => [entry.key, entry.label]));
            const parts = input.value.split(SEPARATOR).map((t) => t.trim()).filter(Boolean);
            const normalized = parts.map((t) => known.get(t.toLowerCase()) || t);
            const unique = normalized.filter((t, i) => normalized.findIndex((o) => o.toLowerCase() === t.toLowerCase()) === i);
            const next = unique.join(', ');
            if (next !== input.value.trim().replace(/[,;\s]+$/, '')) {
                input.value = next;
                input.dispatchEvent(new Event('change', {bubbles: true}));
            } else if (/[,;]\s*$/.test(input.value)) {
                input.value = next;
            }
        };

        input.addEventListener('input', open);
        input.addEventListener('click', open);
        input.addEventListener('keydown', (event) => {
            if (list.hidden) {
                if (event.key === 'ArrowDown') {
                    open();
                    if (!list.hidden) {
                        event.preventDefault();
                        setActive(0);
                    }
                }
                return;
            }
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActive((active + 1) % items.length);
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActive(active <= 0 ? items.length - 1 : active - 1);
            } else if ((event.key === 'Enter' || event.key === 'Tab') && active >= 0) {
                event.preventDefault();
                event.stopPropagation();
                accept(active);
            } else if (event.key === 'Escape') {
                // Nur die Liste schließen, nicht den Dialog drumherum.
                event.preventDefault();
                event.stopPropagation();
                close();
            }
        });
        input.addEventListener('blur', () => {
            close();
            normalizeSpelling();
        });
        // Mausklick wählt aus, ohne dass das Feld vorher den Fokus verliert.
        list.addEventListener('mousedown', (event) => event.preventDefault());
        list.addEventListener('click', (event) => {
            const li = event.target.closest('[data-index]');
            if (li) {
                accept(Number(li.getAttribute('data-index')));
            }
        });
    };

    return {attach};
});
