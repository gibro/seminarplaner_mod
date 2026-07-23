// This file is part of Moodle - http://moodle.org/
//
// Ableitung der Schrittfolge fuer die Live-Ansicht (Durchfuehrungsmodus, D69).
//
// Der Rote Faden buendelt aufeinanderfolgende Platzierungen desselben Bausteins
// zu einem Block — fuer den Ueberblick richtig, fuer den Souffleur falsch: hier
// laeuft eine Einheit nach der anderen, und lange Ablauf-Texte zerfallen nach D70
// zusaetzlich in Abschnitte. Deshalb ein eigenes Modell.
//
// Was es NICHT selbst rechnet: die Ankerzeiten. Die Regel (D45, Mittagsschnitt,
// An-/Abreisetage) steht in roterfadenmodel und wird von dort geholt — vier
// Kopien derselben Ableitung sind bereits eine zu viel.
//
// @module mod_seminarplaner/livemodel

define(['mod_seminarplaner/roterfadenmodel'], function(Model) {
    const ANCHORS = ['vormittag', 'nachmittag'];
    const ANCHOR_LABELS = {vormittag: 'Vormittag', nachmittag: 'Nachmittag'};

    // Zusammengesetzt, damit ESLint (no-script-url) das Praefix nicht als
    // Eval-URL wertet — gleiche Bauart wie in grid.js.
    const SCRIPT_URL_PREFIX = 'java' + 'script:';

    const escapeHtml = (str) => String(str === null || str === undefined ? '' : str).replace(/[&<>"']/g, (ch) => {
        return ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[ch] || ch;
    });

    /**
     * Fremd-HTML aus den Einheiten-Feldern von allem befreien, was ausfuehrt.
     *
     * @param {string} html Rohes Feld-HTML aus dem Tiny-Editor.
     * @return {DocumentFragment} Geleertes Fragment zum Weiterverarbeiten.
     */
    const sanitizeToFragment = (html) => {
        const tpl = document.createElement('template');
        tpl.innerHTML = String(html || '');
        tpl.content.querySelectorAll('script,style,iframe,object,embed,link,meta').forEach((el) => el.remove());
        tpl.content.querySelectorAll('*').forEach((el) => {
            Array.from(el.attributes).forEach((attr) => {
                const name = String(attr.name || '').toLowerCase();
                const value = String(attr.value || '').trim().toLowerCase();
                if (name.startsWith('on') || name === 'style') {
                    el.removeAttribute(attr.name);
                    return;
                }
                if ((name === 'href' || name === 'src') && value.startsWith(SCRIPT_URL_PREFIX)) {
                    el.removeAttribute(attr.name);
                }
            });
        });
        return tpl.content;
    };

    const decodeEntities = (value) => {
        const area = document.createElement('textarea');
        area.innerHTML = String(value || '');
        return String(area.value || '');
    };

    /**
     * Feld-HTML anzeigefertig machen: echtes HTML wird gesaeubert, Klartext bekommt Zeilenumbrueche.
     *
     * @param {string} value Feldinhalt.
     * @return {string} Sicheres HTML.
     */
    const richText = (value) => {
        const raw = String(value || '').trim();
        if (!raw) {
            return '';
        }
        if (/<[a-z][\s\S]*>/i.test(raw)) {
            const holder = document.createElement('div');
            holder.appendChild(sanitizeToFragment(raw));
            return holder.innerHTML;
        }
        const decoded = decodeEntities(raw).trim();
        if (/<[a-z][\s\S]*>/i.test(decoded)) {
            const holder = document.createElement('div');
            holder.appendChild(sanitizeToFragment(decoded));
            return holder.innerHTML;
        }
        return escapeHtml(raw).replace(/\r?\n/g, '<br>');
    };

    const hasContent = (html) => String(html || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').trim() !== '';

    /**
     * D70: Das Ablauf-Feld an seinen vorhandenen Ueberschriften in Abschnitte schneiden.
     *
     * Rein darstellungsseitig — das Feld bleibt ein einziger Freitext, es wird
     * nichts migriert. Eine Einheit ohne erkennbare Ueberschrift behaelt ihren
     * kompletten Ablauf als eine einzige Karte.
     *
     * @param {string} html Inhalt des Ablauf-Felds.
     * @return {Array} Abschnitte als {title, html}; leer, wenn nichts drinsteht.
     */
    const splitAblauf = (html) => {
        const raw = String(html || '').trim();
        if (!raw) {
            return [];
        }
        if (!/<[a-z][\s\S]*>/i.test(raw)) {
            const text = richText(raw);
            return hasContent(text) ? [{title: '', html: text}] : [];
        }

        const fragment = sanitizeToFragment(raw);
        const sections = [];
        let current = {title: '', nodes: []};

        Array.from(fragment.childNodes).forEach((node) => {
            const tag = node.nodeType === 1 ? String(node.tagName || '').toLowerCase() : '';
            if (/^h[1-6]$/.test(tag)) {
                sections.push(current);
                current = {title: (node.textContent || '').replace(/\s+/g, ' ').trim(), nodes: []};
                return;
            }
            current.nodes.push(node);
        });
        sections.push(current);

        const out = sections.map((section) => {
            const holder = document.createElement('div');
            section.nodes.forEach((node) => holder.appendChild(node.cloneNode(true)));
            return {title: section.title, html: holder.innerHTML};
        }).filter((section) => section.title !== '' || hasContent(section.html));

        // Kein Trennschnitt gefunden: der ganze Text bleibt eine Karte.
        if (!out.length) {
            const holder = document.createElement('div');
            holder.appendChild(fragment.cloneNode(true));
            return hasContent(holder.innerHTML) ? [{title: '', html: holder.innerHTML}] : [];
        }
        return out;
    };

    /**
     * Die Material/Technik-Checkliste in einzelne Punkte zerlegen (D69).
     *
     * Listenpunkte werden zu abhakbaren Zeilen. Steht dort Fliesstext statt
     * einer Liste, bleibt er ungeteilt — dann zeigt die Ansicht ihn als Block.
     *
     * @param {string} html Inhalt des Felds „Material/Technik".
     * @return {Object} {items: Array<string>, html: string}.
     */
    const checklist = (html) => {
        const safe = richText(html);
        if (!safe) {
            return {items: [], html: ''};
        }
        const holder = document.createElement('div');
        holder.innerHTML = safe;
        const items = Array.from(holder.querySelectorAll('li'))
            .map((li) => li.innerHTML.trim())
            .filter((item) => hasContent(item));
        if (items.length) {
            return {items: items, html: ''};
        }
        // Aufzaehlung ohne <ul>: Absaetze und harte Zeilenumbrueche trennen die
        // Punkte. Nur wenn ausschliesslich Absaetze dastehen — sobald etwas
        // anderes dazwischen liegt (Tabelle, Ueberschrift), ist es Fliesstext.
        const children = Array.from(holder.children);
        const blocks = children.filter((el) => ['P', 'DIV'].includes(el.tagName));
        if (children.length && blocks.length !== children.length) {
            return {items: [], html: safe};
        }
        const lines = [];
        (blocks.length ? blocks : [holder]).forEach((block) => {
            block.innerHTML.split(/<br\s*\/?>/i).forEach((line) => {
                const trimmed = line.trim();
                if (hasContent(trimmed)) {
                    lines.push(trimmed);
                }
            });
        });
        // Eine einzelne Zeile ist keine Checkliste.
        return lines.length > 1 ? {items: lines, html: ''} : {items: [], html: safe};
    };

    /**
     * Die Sequenz eines Plans in die lineare Folge der Einheiten uebersetzen.
     *
     * @param {Object} state Planzustand (statejson) mit `sequenz` und `config`.
     * @param {Array} cards Seminareinheiten in der Live-Fassung (get_live_state).
     * @return {Array} Einheiten in Durchfuehrungsreihenfolge.
     */
    const buildUnits = (state, cards) => {
        const src = state || {};
        const seq = src.sequenz || {};
        const config = src.config || {};
        const placements = (seq.platzierungen && typeof seq.platzierungen === 'object') ? seq.platzierungen : {};
        const bausteine = (seq.bausteine && typeof seq.bausteine === 'object') ? seq.bausteine : {};
        const auswahlen = (seq.einheitenauswahlen && typeof seq.einheitenauswahlen === 'object')
            ? seq.einheitenauswahlen : {};
        const cardmap = new Map((Array.isArray(cards) ? cards : []).map((card) => [String(card.id), card]));

        const az = Model.deriveAnkerzeiten(config);
        const frames = {
            vormittag: {start: Model.parseClock(az.vormittag.start), end: Model.parseClock(az.vormittag.end)},
            nachmittag: {start: Model.parseClock(az.nachmittag.start), end: Model.parseClock(az.nachmittag.end)},
        };
        const tage = Array.isArray(seq.tage) ? seq.tage : [];
        const seenBausteine = {};
        const units = [];

        tage.forEach((tag, dayindex) => {
            const daynames = Array.isArray(config.days) ? config.days : [];
            const dayname = (tag && tag.bezeichnung && daynames.includes(tag.bezeichnung))
                ? tag.bezeichnung
                : (daynames[dayindex] || `Tag ${dayindex + 1}`);
            // D45: An Anreise-/Abreisetagen entfaellt ein Anker vollstaendig.
            const off = {
                vormittag: dayindex === 0 && !!az.ersterTagNurNachmittag,
                nachmittag: dayindex === (tage.length - 1) && !!az.letzterTagNurVormittag,
            };

            ANCHORS.forEach((anchorkey) => {
                if (off[anchorkey]) {
                    return;
                }
                const frame = frames[anchorkey];
                let clock = Number.isFinite(frame.start) ? frame.start : 0;
                const pids = (((tag.anker || {})[anchorkey] || {}).sequenz) || [];

                pids.forEach((pid) => {
                    const placement = placements[String(pid)];
                    if (!placement) {
                        return;
                    }
                    const minutes = Math.max(0, Number(placement.dauer) || 0);
                    const ispause = placement.typ === 'pause';
                    const baustein = (!ispause && placement.bausteinid)
                        ? (bausteine[placement.bausteinid] || null) : null;
                    const auswahl = placement.einheitenauswahl
                        ? (auswahlen[placement.einheitenauswahl] || null) : null;
                    const aktiv = (auswahl && auswahl.aktiv !== null && auswahl.aktiv !== undefined)
                        ? String(auswahl.aktiv) : '';
                    const card = aktiv ? (cardmap.get(aktiv) || null) : null;

                    const title = String(placement.titel || '').trim()
                        || String((card && card.titel) || '').trim()
                        || String((baustein && baustein.titel) || '').trim()
                        || (ispause ? 'Pause' : 'Seminareinheit');
                    const phase = ispause ? '' : Model.phaseKey(card ? card.seminarphase : '');
                    const continuation = !!(placement.fortsetzung
                        || (placement.bausteinid && seenBausteine[placement.bausteinid]));
                    if (placement.bausteinid) {
                        seenBausteine[placement.bausteinid] = true;
                    }

                    units.push({
                        id: `${dayindex}-${anchorkey}-${pid}`,
                        index: units.length,
                        kind: ispause ? 'pause' : 'einheit',
                        dayIndex: dayindex,
                        dayName: String(dayname),
                        anchorKey: anchorkey,
                        anchorLabel: ANCHOR_LABELS[anchorkey],
                        title: title,
                        bausteinTitel: baustein && baustein.titel ? String(baustein.titel) : '',
                        continuation: continuation,
                        phase: phase,
                        phaseLabel: phase ? Model.PHASE_LABELS[phase] : '',
                        startMin: clock,
                        endMin: clock + minutes,
                        minutes: minutes,
                        cardId: card ? String(card.id) : '',
                        sections: ispause ? [] : splitAblauf(card ? card.ablauf : ''),
                        checklist: ispause ? {items: [], html: ''} : checklist(card ? card.materialtechnik : ''),
                        materialien: (card && Array.isArray(card.materialien)) ? card.materialien : [],
                        // D84: Zugeordnete Referent*innen als reine Nutzer-Ids;
                        // Name und Profilbild loest die Ansicht selbst auf.
                        referenten: (!ispause && Array.isArray(placement.referenten)) ? placement.referenten : [],
                    });
                    clock += minutes;
                });
            });
        });

        return units;
    };

    /**
     * D72: Die Schrittfolge, durch die Vor/Zurueck blaettert.
     *
     * Ein Schritt ist ein Ablauf-Abschnitt einer Einheit; Einheiten ohne
     * gegliederten Ablauf (und Pausen) stellen genau einen Schritt. Rein
     * sequenziell — Zeitangaben im Ablauf-Text werden nicht ausgewertet.
     *
     * @param {Array} units Einheiten aus buildUnits.
     * @return {Array} Schritte als {unitIndex, sectionIndex, sectionCount}.
     */
    const buildSteps = (units) => {
        const steps = [];
        (Array.isArray(units) ? units : []).forEach((unit, unitindex) => {
            const count = Math.max(1, unit.sections.length);
            for (let i = 0; i < count; i++) {
                steps.push({
                    unitIndex: unitindex,
                    sectionIndex: unit.sections.length ? i : -1,
                    sectionCount: unit.sections.length,
                });
            }
        });
        return steps;
    };

    return {
        buildUnits: buildUnits,
        buildSteps: buildSteps,
        splitAblauf: splitAblauf,
        checklist: checklist,
        richText: richText,
        escapeHtml: escapeHtml,
    };
});
