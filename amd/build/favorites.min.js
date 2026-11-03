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

// Persoenliche Favoriten unter den Seminareinheiten (D89). Bibliothek und
// Sequenz teilen sich dieses Modul, damit das Herz an beiden Stellen gleich
// aussieht und gleich speichert. Gespeichert wird je Person und Aktivitaet in
// den Moodle-Nutzereinstellungen - nicht an der Karte, denn die gehoert dem
// ganzen Team und ein Herz soll niemandem den Speicherstand veraendern.
//
// @module mod_seminarplaner/favorites

define(['core/ajax', 'core/notification'], function(Ajax, Notification) {
    const call = (methodname, args) => Ajax.call([{methodname, args}])[0];

    let ids = new Set();

    const HEART = '<svg class="sp-fav__icon" width="18" height="18" viewBox="0 0 24 24"'
        + ' stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"'
        + ' aria-hidden="true" focusable="false">'
        + '<path d="M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.6 3.9 4 7.4 4c2 0 3.6 1.1 4.6 2.7C13 5.1 14.6 4 16.6 4'
        + 'c3.5 0 5.8 3.6 4.6 7.1-1.7 4.8-9.2 9.4-9.2 9.4z"/></svg>';

    const label = (fav) => (fav ? 'Aus den Favoriten entfernen' : 'Zu den Favoriten');

    // Herz-Knopf als HTML. Das Klicken verdrahtet die aufrufende Seite selbst
    // (meist delegiert), weil ihre Listen neu gerendert werden.
    const button = (id, extraClass) => {
        const fav = ids.has(String(id));
        return `<button type="button" class="sp-fav${fav ? ' sp-fav--on' : ''}${extraClass ? ' ' + extraClass : ''}"`
            + ` data-fav-id="${String(id).replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`)}"`
            + ` aria-pressed="${fav ? 'true' : 'false'}" title="${label(fav)}" aria-label="${label(fav)}">${HEART}</button>`;
    };

    // Alle Herzen derselben Einheit auf der Seite nachziehen.
    const paint = (id) => {
        const fav = ids.has(String(id));
        document.querySelectorAll('.sp-fav[data-fav-id]').forEach((btn) => {
            if (btn.getAttribute('data-fav-id') !== String(id)) {
                return;
            }
            btn.classList.toggle('sp-fav--on', fav);
            btn.setAttribute('aria-pressed', fav ? 'true' : 'false');
            btn.setAttribute('title', label(fav));
            btn.setAttribute('aria-label', label(fav));
        });
    };

    return {
        /**
         * Laedt die Favoriten der angemeldeten Person fuer diese Aktivitaet.
         *
         * @param {number} cmid Kursmodul-Id.
         * @return {Promise<Set<string>>}
         */
        load: function(cmid) {
            return call('mod_seminarplaner_get_favorites', {cmid}).then((res) => {
                ids = new Set((res && res.ids) || []);
                return ids;
            }).catch(() => ids);
        },

        /**
         * @param {string} id Karten-Id.
         * @return {boolean}
         */
        has: function(id) {
            return ids.has(String(id));
        },

        button,

        /**
         * Schaltet den Favoriten um. Das Herz wechselt sofort; scheitert das
         * Speichern, springt es zurueck.
         *
         * @param {number} cmid Kursmodul-Id.
         * @param {string} id Karten-Id.
         * @return {Promise<boolean>} Neuer Zustand.
         */
        toggle: function(cmid, id) {
            const key = String(id);
            const favorite = !ids.has(key);
            if (favorite) {
                ids.add(key);
            } else {
                ids.delete(key);
            }
            paint(key);
            return call('mod_seminarplaner_set_favorite', {cmid, methodid: key, favorite}).then((res) => {
                ids = new Set((res && res.ids) || []);
                paint(key);
                return ids.has(key);
            }).catch((e) => {
                if (favorite) {
                    ids.delete(key);
                } else {
                    ids.add(key);
                }
                paint(key);
                Notification.exception(e);
                return !favorite;
            });
        },
    };
});
