// This file is part of Moodle - http://moodle.org/
//
// Ableitung des Roten Fadens aus dem veroeffentlichten Snapshot.
//
// Eine Quelle fuer beide Ausgaben: die Bildschirmansicht (roterfaden.js) und das
// Handout-PDF (handout.js) rechnen aus demselben Modell, damit Teilnehmende auf
// Papier genau das sehen, was auf dem Bildschirm steht.
//
// Seit D20 ist die Sequenz die massgebliche Struktur; der Snapshot traegt sie als
// `sequenz` samt kompaktem Karten-Auszug (`methodcards`) fuer Phase und Titel.
// Aeltere Snapshots ohne Sequenz fallen auf `plan.days` (Legacy-Grid) zurueck und
// haben dann keine Phasen — ein erneutes Veroeffentlichen behebt das.
//
// @module mod_seminarplaner/roterfadenmodel

define([], function() {
    const DAYS_ALL = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
    const ANCHORS = ['vormittag', 'nachmittag'];
    const ANCHOR_LABELS = {vormittag: 'Vormittag', nachmittag: 'Nachmittag'};

    // Seminarphasen wie in sequenz.js/grid.js (gleiche Zuordnung, gleiche Palette).
    const PHASE_KEYS = [
        {key: 'orientierung', match: ['orientierung', 'warm-up', 'einstieg']},
        {key: 'erfahrung', match: ['erfahrung', 'erwartungsabfrage', 'vorwissen']},
        {key: 'analyse', match: ['analyse']},
        {key: 'handlung', match: ['handlung', 'aktion', 'praxis']},
        {key: 'transfer', match: ['transfer', 'abschluss', 'auswertung']},
    ];
    const PHASE_LABELS = {
        orientierung: 'Orientierung',
        erfahrung: 'Erfahrungserhebung',
        analyse: 'Analyse',
        handlung: 'Handlungsteil',
        transfer: 'Transfer',
    };

    const phaseKey = (phase) => {
        const raw = Array.isArray(phase) ? phase.filter(Boolean).join(', ') : phase;
        const clean = String(raw || '').trim().toLowerCase();
        if (!clean) {
            return '';
        }
        const found = PHASE_KEYS.find((candidate) => candidate.match.some((m) => clean.includes(m)));
        return found ? found.key : '';
    };

    const parseClock = (value) => {
        if (!value) {
            return null;
        }
        const parts = String(value).split(':');
        const hh = Number.parseInt(parts[0], 10);
        const mm = Number.parseInt(parts[1], 10);
        return (Number.isFinite(hh) && Number.isFinite(mm)) ? ((hh * 60) + mm) : null;
    };
    const clockLabel = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

    // "20 Min" / "2 Std" / "1 Std 30 Min".
    const durationLabel = (minutes) => {
        const total = Math.max(0, Number(minutes) || 0);
        const h = Math.floor(total / 60);
        const m = total % 60;
        if (!h) {
            return `${m} Min`;
        }
        return m ? `${h} Std ${m} Min` : `${h} Std`;
    };

    // Deckungsgleich mit grid.js (deriveAnkerzeiten) und importexport.js: ohne
    // konfigurierte Ankerzeiten schneidet die laengste Pause den Tag.
    const deriveAnkerzeiten = (config) => {
        const cfg = config || {};
        const az = cfg.ankerzeiten;
        if (az && az.vormittag && az.nachmittag
                && parseClock(az.vormittag.start) !== null && parseClock(az.nachmittag.start) !== null) {
            return az;
        }
        const range = cfg.timeRange || {};
        const start = parseClock(range.start) === null ? '08:30' : range.start;
        const end = parseClock(range.end) === null ? '17:30' : range.end;
        let best = null;
        (Array.isArray(cfg.breaks) ? cfg.breaks : []).forEach((brk) => {
            if (!brk || parseClock(brk.start) === null) {
                return;
            }
            const duration = Math.max(0, Number(brk.duration) || 0);
            if (duration && (!best || duration > best.duration)) {
                best = {start: brk.start, duration};
            }
        });
        return {
            vormittag: {start: start, end: best ? best.start : '12:30'},
            nachmittag: {start: best ? clockLabel(parseClock(best.start) + best.duration) : '12:30', end: end},
            ersterTagNurNachmittag: false,
            letzterTagNurVormittag: false,
        };
    };

    // Rich-Text-Unterthemen (Legacy-Bausteine) in einzelne Themen-Zeilen zerlegen —
    // bewusst NICHT an Kommas trennen: ein Unterthema pro Zeile.
    const splitTopics = (html) => {
        const withBreaks = String(html || '')
            .replace(/<\s*br\s*\/?\s*>/gi, '\n')
            .replace(/<\/\s*(?:p|div|li|tr|h[1-6])\s*>/gi, '\n')
            .replace(/<[^>]*>/g, ' ');
        const decoder = document.createElement('textarea');
        decoder.innerHTML = withBreaks;
        return (decoder.value || '')
            .split(/\r?\n/)
            .map((line) => line.replace(/^[\s\-–—*·•]+/, '').replace(/\s+/g, ' ').trim())
            .filter(Boolean);
    };

    // Eine Platzierungs-Gruppe (aufeinanderfolgende Platzierungen desselben
    // Bausteins) ist ein Block — genau wie in der Sequenzansicht.
    const buildFromSequence = (state) => {
        const seq = state.sequenz || {};
        const config = state.config || {};
        const placements = (seq.platzierungen && typeof seq.platzierungen === 'object') ? seq.platzierungen : {};
        const bausteine = (seq.bausteine && typeof seq.bausteine === 'object') ? seq.bausteine : {};
        const auswahlen = (seq.einheitenauswahlen && typeof seq.einheitenauswahlen === 'object')
            ? seq.einheitenauswahlen : {};
        const cards = new Map((Array.isArray(state.methodcards) ? state.methodcards : [])
            .map((card) => [String(card.id), card]));

        const az = deriveAnkerzeiten(config);
        const anchorFrame = {
            vormittag: {start: parseClock(az.vormittag.start), end: parseClock(az.vormittag.end)},
            nachmittag: {start: parseClock(az.nachmittag.start), end: parseClock(az.nachmittag.end)},
        };
        const tage = Array.isArray(seq.tage) ? seq.tage : [];
        const seenBausteine = {};
        const days = [];
        let num = 0;

        tage.forEach((tag, idx) => {
            const dayname = (tag && tag.bezeichnung && (config.days || []).includes(tag.bezeichnung))
                ? tag.bezeichnung
                : (config.days || [])[idx];
            if (!dayname) {
                return;
            }
            // D45: An Anreise-/Abreisetagen entfaellt ein Anker vollstaendig.
            const off = {
                vormittag: idx === 0 && !!az.ersterTagNurNachmittag,
                nachmittag: idx === (tage.length - 1) && !!az.letzterTagNurVormittag,
            };
            const anchors = [];

            ANCHORS.forEach((ankername) => {
                if (off[ankername]) {
                    return;
                }
                const frame = anchorFrame[ankername];
                const pids = (((tag.anker || {})[ankername] || {}).sequenz) || [];
                const items = pids
                    .map((pid) => ({pid: String(pid), data: placements[pid]}))
                    .filter((entry) => entry.data);

                // Aufeinanderfolgende Platzierungen desselben Bausteins buendeln.
                const groups = [];
                items.forEach((entry) => {
                    const bid = entry.data.typ === 'einheit' ? (entry.data.bausteinid || null) : null;
                    const previous = groups.length ? groups[groups.length - 1] : null;
                    if (previous && bid && previous.bausteinid === bid) {
                        previous.items.push(entry);
                        return;
                    }
                    groups.push({bausteinid: bid, items: [entry]});
                });

                let clock = Number.isFinite(frame.start) ? frame.start : 0;
                const blocks = [];
                groups.forEach((group) => {
                    const groupminutes = group.items.reduce((sum, entry) => {
                        return sum + Math.max(0, Number(entry.data.dauer) || 0);
                    }, 0);
                    // Pausen sind keine Programmpunkte — sie ruecken die Uhr weiter,
                    // erscheinen aber nicht als Block.
                    if (group.items[0].data.typ === 'pause') {
                        clock += groupminutes;
                        return;
                    }

                    const baustein = group.bausteinid ? (bausteine[group.bausteinid] || null) : null;
                    const themen = group.items.map((entry) => {
                        const placement = entry.data;
                        const auswahl = placement.einheitenauswahl
                            ? (auswahlen[placement.einheitenauswahl] || null)
                            : null;
                        const aktiv = (auswahl && auswahl.aktiv !== null && auswahl.aktiv !== undefined)
                            ? String(auswahl.aktiv) : '';
                        const card = aktiv ? (cards.get(aktiv) || null) : null;
                        const title = String(placement.titel || '').trim()
                            || String((card && card.titel) || '').trim()
                            || String((baustein && baustein.titel) || '').trim()
                            || 'Seminareinheit';
                        return {
                            title: title,
                            phase: phaseKey(card ? card.seminarphase : ''),
                            minutes: Math.max(0, Number(placement.dauer) || 0),
                        };
                    });

                    const continuation = !!(group.bausteinid && seenBausteine[group.bausteinid]);
                    if (group.bausteinid) {
                        seenBausteine[group.bausteinid] = true;
                    }
                    num += 1;
                    blocks.push({
                        id: `${dayname}-${ankername}-${group.items[0].pid}`,
                        num: num,
                        title: (baustein && baustein.titel) ? String(baustein.titel) : themen[0].title,
                        continuation: continuation,
                        startMin: clock,
                        minutes: groupminutes,
                        phase: themen.find((theme) => theme.phase) ? themen[0].phase : '',
                        themen: themen,
                    });
                    clock += groupminutes;
                });

                if (blocks.length) {
                    anchors.push({
                        key: ankername,
                        name: ANCHOR_LABELS[ankername],
                        start: frame.start,
                        end: frame.end,
                        blocks: blocks,
                    });
                }
            });

            if (anchors.length) {
                days.push({
                    name: String(dayname),
                    anchors: anchors,
                    count: anchors.reduce((sum, anchor) => sum + anchor.blocks.length, 0),
                });
            }
        });

        return days;
    };

    // Fallback fuer Snapshots aus der Zeit vor der Sequenz: jeder Grid-Eintrag ist
    // ein Block, seine Unterthemen werden zu Themen-Zeilen.
    const buildFromPlan = (state) => {
        const plandays = ((state || {}).plan || {}).days || {};
        const config = (state || {}).config || {};
        const units = Array.isArray(((state || {}).planningState || {}).units)
            ? state.planningState.units : [];
        const daynames = Array.isArray(config.days) && config.days.length ? config.days : DAYS_ALL;
        const az = deriveAnkerzeiten(config);
        const middayCut = parseClock(az.nachmittag.start);
        const frames = {
            vormittag: {start: parseClock(az.vormittag.start), end: parseClock(az.vormittag.end)},
            nachmittag: {start: parseClock(az.nachmittag.start), end: parseClock(az.nachmittag.end)},
        };

        const resolveUnit = (entry) => {
            const slotkey = String(entry.slotkey || '').trim();
            if (slotkey) {
                const variants = units.filter((unit) => String(unit.slotkey || '').trim() === slotkey);
                if (variants.length) {
                    return variants.find((unit) => unit.active !== false) || variants[0];
                }
            }
            const unitid = String(entry.unitid || '');
            return unitid ? (units.find((unit) => String(unit.id) === unitid) || null) : null;
        };

        const days = [];
        let num = 0;
        daynames.forEach((dayname) => {
            const list = (Array.isArray(plandays[dayname]) ? plandays[dayname] : [])
                .filter((entry) => entry && entry.kind !== 'break')
                .slice()
                .sort((a, b) => (Number(a.startMin) || 0) - (Number(b.startMin) || 0));
            const buckets = {vormittag: [], nachmittag: []};

            list.forEach((entry) => {
                const startMin = Number(entry.startMin) || 0;
                const endMin = Number(entry.endMin) || startMin;
                const unit = entry.kind === 'unit' ? resolveUnit(entry) : null;
                const title = String((unit && unit.title) || entry.title || 'Seminareinheit');
                const phase = phaseKey(entry.sqPhase || entry.phase || '');
                const minutes = Math.max(0, endMin - startMin);
                const topics = splitTopics((unit && unit.topics) || entry.topics || '');
                const themen = topics.length
                    ? topics.map((topic) => ({title: topic, phase: phase, minutes: 0}))
                    : [{title: title, phase: phase, minutes: minutes}];
                num += 1;
                const anchorkey = (middayCut !== null && startMin >= middayCut) ? 'nachmittag' : 'vormittag';
                buckets[anchorkey].push({
                    id: `${dayname}-${anchorkey}-${entry.uid || num}`,
                    num: num,
                    title: title,
                    continuation: false,
                    startMin: startMin,
                    minutes: minutes,
                    phase: phase,
                    themen: themen,
                });
            });

            const anchors = ANCHORS
                .filter((ankername) => buckets[ankername].length)
                .map((ankername) => ({
                    key: ankername,
                    name: ANCHOR_LABELS[ankername],
                    start: frames[ankername].start,
                    end: frames[ankername].end,
                    blocks: buckets[ankername],
                }));
            if (anchors.length) {
                days.push({
                    name: String(dayname),
                    anchors: anchors,
                    count: anchors.reduce((sum, anchor) => sum + anchor.blocks.length, 0),
                });
            }
        });

        return days;
    };

    return {
        PHASE_LABELS: PHASE_LABELS,
        clockLabel: clockLabel,
        durationLabel: durationLabel,

        /**
         * Tage/Anker/Bloecke aus einem veroeffentlichten Roter-Faden-Snapshot ableiten.
         *
         * @param {Object} state Entschluesselter Snapshot (statejson).
         * @return {Array} Tage mit Ankern, Bloecken und deren Themen.
         */
        buildDays: function(state) {
            const seq = (state || {}).sequenz;
            if (seq && Array.isArray(seq.tage) && seq.tage.length) {
                return buildFromSequence(state);
            }
            return buildFromPlan(state);
        }
    };
});
