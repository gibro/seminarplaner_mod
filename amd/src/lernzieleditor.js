// This file is part of Moodle - http://moodle.org/

/**
 * D62 – Geführter Lernziel-Generator „Der Differenzierer".
 *
 * Modaler Baukasten aus fünf Spalten (Denkoperation nach Bloom, Inhalt,
 * Quelle, Produkt, Arbeitsform), der einen „Ich kann …"-Satz zusammensetzt
 * und Leeres weglässt. Nach dem Vorbild von „The Differentiator" (Ian Byrd).
 *
 * Ein Editor, mehrere Einsatzorte: die Sequenz (Seminarziele D61 und das
 * Lernziele-Feld des Einheiten-Modals D21) und die Bibliothek (Lernziele-Feld
 * des Methoden-Editors). Aufruf: open(onAccept); onAccept bekommt
 * (satz, phase) – phase ist die aus der Bloom-Gruppe abgeleitete
 * Seminarphase (D41) oder leer.
 *
 * @module     mod_seminarplaner/lernzieleditor
 * @copyright  2026 IG Metall
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
define([], function() {

    const escapeHtml = (str) => String(str || '').replace(/[&<>"']/g, (ch) => {
        return ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[ch] || ch;
    });

    // D62 – „Der Differenzierer": Bausteine des geführten Lernziel-Generators.
    // Fünf Spalten (Denkoperation, Inhalt, Quelle, Produkt, Arbeitsform); aus
    // dem Gewählten baut sich ein „Ich kann …"-Satz, Leeres fällt weg. Nach dem
    // Vorbild von „The Differentiator" (Ian Byrd), übertragen auf die
    // gewerkschaftliche Bildung. Die Denkoperationen folgen den Stufen von
    // Blooms Taxonomie.
    const DIFF_DATA = [
        {
            cat: 'denken',
            title: 'Denkoperation',
            hint: 'Was tun die Teilnehmenden geistig? Steht im Lernziel als Infinitiv – '
                + 'je höher die Stufe, desto anspruchsvoller die Aufgabe.',
            groups: [
                {label: 'Kennen', items: ['benennen', 'aufzählen', 'wiedergeben', 'zuordnen', 'kennenlernen']},
                {label: 'Verstehen', items: [
                    'erklären', 'erläutern', 'einordnen', 'zusammenfassen', 'unterscheiden', 'in eigene Worte fassen',
                ]},
                {label: 'Anwenden', items: ['anwenden', 'prüfen', 'übertragen', 'umsetzen', 'strukturieren', 'berechnen']},
                {label: 'Analysieren', items: [
                    'analysieren', 'untersuchen', 'durchschauen', 'vergleichen', 'hinterfragen', 'aufdecken',
                ]},
                {label: 'Bewerten', items: [
                    'bewerten', 'einschätzen', 'beurteilen', 'abwägen', 'begründen', 'reflektieren', 'diskutieren',
                ]},
                {label: 'Erarbeiten und durchsetzen', items: [
                    'erarbeiten', 'entwickeln', 'formulieren', 'gestalten', 'aushandeln',
                    'verhandeln', 'durchsetzen', 'organisieren', 'mobilisieren', 'moderieren', 'präsentieren',
                ]},
            ],
        },
        {
            cat: 'inhalt',
            title: 'Inhalt',
            hint: 'Nicht das Thema selbst, sondern die Linse darauf. '
                + 'Dieselbe Frage unter einer anderen Linse ergibt ein anderes Seminar.',
            groups: [
                {label: 'Recht und Regelwerk', items: [
                    'den gesetzlichen Rahmen', 'die Beteiligungsrechte', 'die Zuständigkeiten',
                    'die Fristen und Verfahren', 'die bestehenden Regelungen', 'die Rechtsprechung', 'die Fachbegriffe',
                ]},
                {label: 'Betriebliche Wirklichkeit', items: [
                    'die betriebliche Praxis', 'die Lage der Kolleg*innen', 'die konkreten Fälle',
                    'die Zahlen dahinter', 'die Belastungen', 'die eigenen Erfahrungen',
                ]},
                {label: 'Interessen und Macht', items: [
                    'die Interessen der Beteiligten', 'die Konfliktlinien', 'die Argumente der Arbeitgeberseite',
                    'die Machtverhältnisse', 'die wirtschaftlichen Hintergründe', 'die Frage, wer profitiert',
                ]},
                {label: 'Handlung und Durchsetzung', items: [
                    'die Handlungsspielräume', 'die Verhandlungsstrategie', 'die Beteiligung der Belegschaft',
                    'die Durchsetzbarkeit', 'die möglichen Verbündeten', 'die Kosten des Nichthandelns', 'den nächsten Schritt',
                ]},
                {label: 'Einordnung', items: [
                    'die Entwicklung über die Zeit', 'die gesellschaftliche Dimension', 'die Perspektiven verschiedener Gruppen',
                    'die Übertragbarkeit auf den eigenen Betrieb', 'die Widersprüche', 'die offenen Fragen',
                ]},
            ],
        },
        {
            cat: 'quelle',
            title: 'Quelle',
            hint: 'Woher kommt das Material? '
                + 'Erfahrung und betriebliche Beispiele sind hier keine Zutat, sondern der Ausgangspunkt.',
            groups: [
                {label: 'Erfahrung und Betrieb', items: [
                    'die eigene Erfahrung', 'die Erfahrungen der Kolleg*innen', 'ein betriebliches Beispiel',
                    'einen konkreten Fall aus dem Betrieb', 'ein Gespräch in der Sprechstunde', 'einen Rundgang durch den Betrieb',
                ]},
                {label: 'Recht und Regelwerk', items: [
                    'den passenden Paragrafen im BetrVG', 'eine Betriebsvereinbarung', 'den Tarifvertrag',
                    'die Rechtsprechung', 'einen Gesetzeskommentar',
                ]},
                {label: 'Zahlen und Dokumente', items: [
                    'die Gefährdungsbeurteilung', 'den Geschäftsbericht', 'die Kennzahlen des Betriebs',
                    'eine Beschäftigtenbefragung', 'das Sitzungsprotokoll', 'die Unterlagen des Wirtschaftsausschusses',
                ]},
                {label: 'Menschen und Material', items: [
                    'die Gewerkschaftssekretärin', 'eine sachverständige Person', 'Material der IG Metall',
                    'eine Fachzeitschrift', 'einen Podcast oder ein Video',
                ]},
            ],
        },
        {
            cat: 'produkt',
            title: 'Produkt',
            hint: 'Was nehmen die Teilnehmenden mit in den Betrieb? Das Produkt entscheidet, ob das Gelernte handlungsfähig macht.',
            groups: [
                {label: 'Aushandeln', items: [
                    'einen Antrag an den Arbeitgeber', 'eine Stellungnahme', 'den Entwurf einer Betriebsvereinbarung',
                    'ein Forderungspapier', 'eine Verhandlungsstrategie', 'einen Gesprächsleitfaden',
                ]},
                {label: 'Überzeugen', items: [
                    'eine Argumentationshilfe', 'einen Beitrag für die Betriebsversammlung', 'einen Aushang',
                    'ein Flugblatt', 'einen Redebeitrag', 'eine Präsentation',
                ]},
                {label: 'Ordnen', items: [
                    'eine Checkliste', 'einen Maßnahmenplan', 'ein Schaubild',
                    'einen Zeitplan', 'eine Fallanalyse', 'ein Protokoll',
                ]},
                {label: 'Beteiligen', items: [
                    'einen Beteiligungsplan', 'eine Kampagnenidee', 'eine Aktionsidee',
                    'eine Befragung der Kolleg*innen', 'ein Konzept für die Sprechstunde',
                ]},
            ],
        },
        {
            cat: 'form',
            title: 'Arbeitsform',
            hint: 'Allein denken, im Tandem streiten, im Rollenspiel erproben – jede Form verändert das Lernen.',
            groups: [
                {label: 'Allein und zu zweit', items: ['in Einzelarbeit', 'im Tandem']},
                {label: 'In der Gruppe', items: ['in der Kleingruppe', 'im Plenum']},
                {label: 'Erprobend', items: ['im Rollenspiel', 'in einer Simulation', 'am Fallbeispiel']},
            ],
        },
    ];

    // Bloom-Gruppe der Denkoperation → Seminarphase (D41): erhält die
    // Vorbelegung der Seminarphase im Einheiten-Modal, wenn im Editor eine
    // Denkoperation gewählt wurde.
    const DIFF_PHASE_BY_GROUP = {
        'Kennen': 'orientierung',
        'Verstehen': 'analyse',
        'Anwenden': 'handlung',
        'Analysieren': 'analyse',
        'Bewerten': 'transfer',
        'Erarbeiten und durchsetzen': 'handlung',
    };

    // Themenvorschläge aus dem Bildungsprogramm (Handlungsfelder, häufige
    // Seminarthemen) für die Auswahlliste des Thema-Feldes.
    const DIFF_THEMEN = [
        'Arbeitszeit', 'Schichtarbeit', 'Entgelt und Eingruppierung', 'Tarifrunde', 'Leistung und Leistungsdruck',
        'Betriebsvereinbarungen', 'Kündigung und Kündigungsschutz', 'Arbeitsvertrag', 'Befristung und Leiharbeit',
        'Arbeits- und Gesundheitsschutz', 'Gefährdungsbeurteilung', 'psychische Belastung',
        'Betriebliches Eingliederungsmanagement', 'Sucht im Betrieb', 'Schwerbehindertenvertretung und Teilhabe',
        'Datenschutz im Betrieb', 'Künstliche Intelligenz im Betrieb', 'Digitalisierung und mobile Arbeit',
        'Transformation der Industrie', 'Personalplanung und Qualifizierung', 'Umstrukturierung',
        'Interessenausgleich und Sozialplan', 'Wirtschaftsausschuss und Bilanz', 'Betriebsratswahl',
        'Betriebsversammlung', 'Mitgliedergewinnung', 'Beteiligung der Belegschaft', 'Konfliktgespräche',
        'Verhandlungsführung', 'Moderation von Sitzungen', 'Gleichstellung im Betrieb', 'Ausbildung und Übernahme',
        'Jugend- und Auszubildendenvertretung', 'Rente und Altersteilzeit', 'Argumente gegen rechts',
        'Klima- und Industriepolitik',
    ];

    const DIFF_PLATZHALTER = {
        thema: '[Thema]', denken: '[Denkoperation]', inhalt: '[Inhalt]',
        quelle: '[Quelle]', produkt: '[Produkt]', form: '[Arbeitsform]',
    };

    // Satzbausteine: Textstück ({text}) oder Platzhalter für eine Spalte ({cat}).
    const diffT = (text) => ({text});
    const diffS = (cat) => ({cat});

    // Das Objekt des Satzes ist die inhaltliche Linse. Fehlt sie, springt das
    // Thema ein („das Thema Arbeitszeit analysieren") und wird nicht doppelt genannt.
    function diffObjekt(v) {
        if (v.inhalt) {
            return {teile: [diffS('inhalt')], themaVerbraucht: false};
        }
        if (v.thema) {
            return {teile: [diffT('das Thema '), diffS('thema')], themaVerbraucht: true};
        }
        return {teile: [diffS('inhalt')], themaVerbraucht: false};
    }

    // Reiht Klauseln: eine allein steht für sich, mehrere mit Komma, die letzte mit „und".
    function diffReihen(klauseln) {
        const teile = [];
        klauseln.forEach((k, i) => {
            if (i) {
                teile.push(diffT(i === klauseln.length - 1 ? ' und ' : ', '));
            }
            teile.push.apply(teile, k);
        });
        return teile;
    }

    // Zusatzklauseln nach dem Hauptsatz: „, dafür X nutzen und daraus Y erstellen".
    function diffZusatz(v, nachNebensatz) {
        if (v.quelle && v.produkt) {
            return [diffT(', dafür '), diffS('quelle'), diffT(' nutzen und daraus '), diffS('produkt'), diffT(' erstellen')];
        }
        if (v.quelle) {
            return [diffT(', dafür '), diffS('quelle'), diffT(' nutzen')];
        }
        if (v.produkt) {
            return [diffT(nachNebensatz ? ', und daraus ' : ' und daraus '), diffS('produkt'), diffT(' erstellen')];
        }
        return [];
    }

    // Satzmuster: jedes ist eine Funktion, die nur die Klauseln bildet, für die
    // es auch Bausteine gibt – fehlt ein Baustein, entfällt sein Teilsatz.
    const DIFF_TEMPLATES = [
        // Thema vorn
        (v) => {
            const o = diffObjekt(v);
            const p = [diffT('Ich kann ')];
            if (v.thema && !o.themaVerbraucht) {
                p.push(diffT('zum Thema '), diffS('thema'), diffT(' '));
            }
            p.push.apply(p, o.teile);
            p.push(diffT(' '), diffS('denken'));
            p.push.apply(p, diffZusatz(v));
            if (v.form) {
                p.push(diffT(' – '), diffS('form'));
            }
            p.push(diffT('.'));
            return p;
        },
        // Thema in der Mitte, Quelle als „indem"-Satz
        (v) => {
            const o = diffObjekt(v);
            const p = [diffT('Ich kann ')];
            p.push.apply(p, o.teile);
            if (v.thema && !o.themaVerbraucht) {
                p.push(diffT(' zum Thema '), diffS('thema'));
            }
            p.push(diffT(' '), diffS('denken'));
            if (v.quelle && v.produkt) {
                p.push(
                    diffT(', indem ich '), diffS('quelle'), diffT(' auswerte und daraus '), diffS('produkt'), diffT(' erstelle')
                );
            } else if (v.quelle) {
                p.push(diffT(', indem ich '), diffS('quelle'), diffT(' auswerte'));
            } else if (v.produkt) {
                p.push(diffT(' und daraus '), diffS('produkt'), diffT(' erstellen'));
            }
            if (v.form) {
                p.push(diffT(' – '), diffS('form'));
            }
            p.push(diffT('.'));
            return p;
        },
        // Thema im Nebensatz
        (v) => {
            const o = diffObjekt(v);
            const p = [diffT('Ich kann ')];
            p.push.apply(p, o.teile);
            p.push(diffT(' '), diffS('denken'));
            const nebensatz = Boolean(v.thema && !o.themaVerbraucht);
            if (nebensatz) {
                p.push(diffT(', wenn es um das Thema '), diffS('thema'), diffT(' geht'));
            }
            p.push.apply(p, diffZusatz(v, nebensatz));
            if (v.form) {
                p.push(diffT(' – '), diffS('form'));
            }
            p.push(diffT('.'));
            return p;
        },
        // Quelle vorn, Thema am Ende
        (v) => {
            const o = diffObjekt(v);
            const klauseln = [];
            if (v.quelle) {
                klauseln.push([diffS('quelle'), diffT(' auswerten')]);
            }
            klauseln.push(o.teile.concat([diffT(' '), diffS('denken')]));
            if (v.produkt) {
                klauseln.push([diffT('daraus '), diffS('produkt'), diffT(' erstellen')]);
            }
            const p = [diffT('Ich kann ')];
            p.push.apply(p, diffReihen(klauseln));
            const schluss = [];
            if (v.thema && !o.themaVerbraucht) {
                schluss.push([diffT('alles zum Thema '), diffS('thema')]);
            }
            if (v.form) {
                schluss.push([diffS('form')]);
            }
            if (schluss.length) {
                p.push(diffT(' – '));
                schluss.forEach((s, i) => {
                    if (i) {
                        p.push(diffT(', '));
                    }
                    p.push.apply(p, s);
                });
            }
            p.push(diffT('.'));
            return p;
        },
        // Kurze Nachsätze
        (v) => {
            const o = diffObjekt(v);
            const p = [diffT('Ich kann ')];
            p.push.apply(p, o.teile);
            p.push(diffT(' '), diffS('denken'));
            if (v.produkt) {
                p.push(diffT(' und das Ergebnis als '), diffS('produkt'), diffT(' präsentieren'));
            }
            if (v.quelle) {
                p.push(diffT(' – dafür ziehe ich '), diffS('quelle'), diffT(' heran'));
            }
            p.push(diffT('.'));
            if (v.thema && !o.themaVerbraucht) {
                p.push(diffT(' Thema: '), diffS('thema'), diffT('.'));
            }
            if (v.form) {
                p.push(diffT(' Gearbeitet wird '), diffS('form'), diffT('.'));
            }
            return p;
        },
    ];

    // Nicht jedes Muster passt zu jeder Auswahl: fehlt der tragende Baustein,
    // wäre das Muster nur eine blasse Variante von Muster 1.
    const DIFF_TAUGT = [
        (v) => Boolean(v.thema),
        (v) => Boolean(v.quelle),
        (v) => Boolean(v.thema),
        (v) => Boolean(v.quelle),
        (v) => Boolean(v.produkt || v.quelle),
    ];

    function diffPassendeMuster(v) {
        const passend = DIFF_TEMPLATES.map((_, i) => i).filter((i) => DIFF_TAUGT[i](v));
        return passend.length ? passend : [0];
    }

    // Die Seminarphase (D41) der gewählten Denkoperation – über ihre Bloom-Gruppe.
    function diffPhaseForVerb(verb) {
        if (!verb) {
            return '';
        }
        const denken = DIFF_DATA.find((c) => c.cat === 'denken');
        const group = denken.groups.find((g) => g.items.indexOf(verb) !== -1);
        return group ? (DIFF_PHASE_BY_GROUP[group.label] || '') : '';
    }

    // Das offene Editor-Overlay schließen (Singleton über die feste ID).
    function close() {
        const overlay = document.getElementById('sq-lz-overlay');
        if (overlay) {
            overlay.remove();
        }
    }

    function open(onAccept) {
            close();
            const acceptCb = typeof onAccept === "function" ? onAccept : null;

            // Auswahl-Zustand nur für diese Editor-Sitzung.
            const state = {denken: null, inhalt: null, quelle: null, produkt: null, form: null};
            let thema = '';
            let template = 0;

            const overlay = document.createElement('div');
            overlay.className = 'sq-modal-overlay sq-lz-overlay open';
            overlay.id = 'sq-lz-overlay';
            document.body.appendChild(overlay);

            // Das Thema steht als Titel im Satz („zum Thema Arbeitszeit") – ein
            // führender Artikel würde dort doppelt stehen und fällt weg.
            const themaText = () => thema.trim().replace(/^(der|die|das|den|dem|des)\s+/i, '');
            const wert = (cat) => (cat === 'thema' ? themaText() : state[cat]);
            const werte = () => ({
                thema: wert('thema'), denken: wert('denken'), inhalt: wert('inhalt'),
                quelle: wert('quelle'), produkt: wert('produkt'), form: wert('form'),
            });
            const teile = () => DIFF_TEMPLATES[template](werte());
            const plainSentence = () => teile()
                .map((st) => st.text || wert(st.cat) || DIFF_PLATZHALTER[st.cat])
                .join('');
            // Übernehmen erst, wenn der Satz vollständig ist: jeder Baustein im
            // gewählten Muster ist belegt – kein Platzhalter bleibt stehen.
            const isComplete = () => teile().every((st) => !st.cat || Boolean(wert(st.cat)));

            // Das Muster bleibt, solange es zur Auswahl passt – sonst springt der
            // Satz in ein Muster, das die vorhandenen Bausteine trägt.
            const passendeMuster = () => diffPassendeMuster(werte());
            const fixTemplate = () => {
                const passend = passendeMuster();
                if (passend.indexOf(template) === -1) {
                    template = passend[Math.floor(Math.random() * passend.length)];
                }
            };

            // Satz-Vorschau mit farbigen Bausteinen aufbauen.
            const renderSentence = () => {
                const host = overlay.querySelector('#sq-lz-sentence');
                if (!host) {
                    return;
                }
                host.textContent = '';
                teile().forEach((st) => {
                    if (st.text) {
                        if (/^[,.;:]/.test(st.text)) {
                            const punct = document.createElement('span');
                            punct.className = 'sq-lz-punct';
                            punct.textContent = st.text;
                            host.appendChild(punct);
                        } else {
                            host.appendChild(document.createTextNode(st.text));
                        }
                        return;
                    }
                    const gewaehlt = wert(st.cat);
                    const slot = document.createElement('span');
                    slot.className = 'sq-lz-slot ' + (gewaehlt ? 'filled' : 'empty');
                    slot.dataset.cat = st.cat;
                    slot.textContent = gewaehlt || DIFF_PLATZHALTER[st.cat];
                    if (st.cat === 'thema') {
                        slot.tabIndex = 0;
                        slot.title = 'Thema oben eintragen';
                        const focusThema = () => {
                            const input = overlay.querySelector('#sq-lz-thema');
                            if (input) {
                                input.focus();
                            }
                        };
                        slot.addEventListener('click', focusThema);
                        slot.addEventListener('keydown', (event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                focusThema();
                            }
                        });
                    }
                    host.appendChild(slot);
                });
            };

            const refreshChips = (cat) => {
                overlay.querySelectorAll('.sq-lz-chip[data-cat="' + cat + '"]').forEach((chip) => {
                    chip.setAttribute('aria-pressed', String(chip.dataset.value === state[cat]));
                });
            };

            const updateAccept = () => {
                const accept = overlay.querySelector('[data-lz="accept"]');
                if (accept) {
                    accept.disabled = !isComplete();
                }
            };

            const select = (cat, value) => {
                state[cat] = value;
                refreshChips(cat);
                fixTemplate();
                renderSentence();
                updateAccept();
            };

            const rollOne = (cat) => {
                const col = DIFF_DATA.find((c) => c.cat === cat);
                const pool = col.groups.reduce((all, g) => all.concat(g.items), []).filter((i) => i !== state[cat]);
                if (pool.length) {
                    select(cat, pool[Math.floor(Math.random() * pool.length)]);
                }
            };

            // Wechselt bewusst die Formulierung – nur unter den passenden Mustern.
            const rollTemplate = () => {
                const passend = passendeMuster();
                const andere = passend.filter((i) => i !== template);
                const pool = andere.length ? andere : passend;
                template = pool[Math.floor(Math.random() * pool.length)];
                renderSentence();
            };

            // Spalte mit gruppierten Chips.
            const columnHtml = (col) => {
                const groups = col.groups.map((group) => {
                    const chips = group.items.map((item) =>
                        `<button type="button" class="sq-lz-chip" data-cat="${col.cat}"`
                        + ` data-value="${escapeHtml(item)}" aria-pressed="false">${escapeHtml(item)}</button>`).join('');
                    return `<div class="sq-lz-group">
                              <div class="sq-lz-group__label">${escapeHtml(group.label)}</div>
                              <div class="sq-lz-chips">${chips}</div>
                            </div>`;
                }).join('');
                return `<section class="sq-lz-col" data-cat="${col.cat}">
                          <div class="sq-lz-col__head">
                            <span class="sq-lz-col__title">${escapeHtml(col.title)}</span>
                            <button type="button" class="sq-lz-dice" data-roll="${col.cat}"
                              title="${escapeHtml(col.title)} zufällig wählen">würfeln</button>
                          </div>
                          <p class="sq-lz-col__hint">${escapeHtml(col.hint)}</p>
                          <div class="sq-lz-options">${groups}</div>
                        </section>`;
            };

            const themenOptions = DIFF_THEMEN.map((t) => `<option value="${escapeHtml(t)}"></option>`).join('');
            overlay.innerHTML = `
                <div class="sq-modal sq-lz-modal">
                  <div class="sq-modal__head">
                    <h3>Lernziel formulieren</h3>
                    <button type="button" class="sq-modal__close" data-lz="close">✕</button>
                  </div>
                  <div class="sq-modal__body">
                    <p class="sq-lz-lede">Baue ein Lernziel in der Ich-kann-Form: Denkoperation, inhaltliche Linse, \
Quelle, Produkt und Arbeitsform. Du musst nicht aus jeder Liste etwas wählen – der Satz lässt weg, was du \
offenlässt. Würfeln ist erlaubt.</p>
                    <div class="sq-field sq-lz-thema-field">
                      <div class="sq-lz-thema-head">
                        <label class="kg-label" for="sq-lz-thema">Thema (optional)</label>
                        <button type="button" class="sq-lz-dice" data-roll="thema" title="Thema würfeln">würfeln</button>
                      </div>
                      <input type="text" class="kg-input" id="sq-lz-thema" list="sq-lz-themen"
                        placeholder="z. B. Arbeitszeit" autocomplete="off">
                      <datalist id="sq-lz-themen">${themenOptions}</datalist>
                    </div>
                    <div class="sq-field">
                      <label class="kg-label">Lernziel</label>
                      <p class="sq-lz-sentence" id="sq-lz-sentence"></p>
                    </div>
                    <div class="sq-lz-toolbar">
                      <button type="button" class="kg-btn" data-lz="roll-all">🎲 Alles würfeln</button>
                      <button type="button" class="kg-btn" data-lz="rephrase">Andere Formulierung</button>
                      <button type="button" class="kg-btn" data-lz="clear">Zurücksetzen</button>
                    </div>
                    <div class="sq-lz-columns">${DIFF_DATA.map(columnHtml).join('')}</div>
                  </div>
                  <div class="sq-modal__footer">
                    <button type="button" class="kg-btn" data-lz="close">Abbrechen</button>
                    <button type="button" class="kg-btn kg-btn-primary" data-lz="accept" disabled>Übernehmen</button>
                  </div>
                </div>`;

            overlay.addEventListener('click', (event) => {
                if (event.target === overlay) {
                    close();
                    return;
                }
                const chip = event.target.closest('.sq-lz-chip[data-cat]');
                if (chip) {
                    const cat = chip.dataset.cat;
                    const value = chip.dataset.value;
                    select(cat, state[cat] === value ? null : value);
                    return;
                }
                const dice = event.target.closest('[data-roll]');
                if (dice) {
                    const cat = dice.getAttribute('data-roll');
                    if (cat === 'thema') {
                        const pool = DIFF_THEMEN.filter((t) => t !== thema.trim());
                        thema = pool[Math.floor(Math.random() * pool.length)];
                        const input = overlay.querySelector('#sq-lz-thema');
                        if (input) {
                            input.value = thema;
                        }
                        fixTemplate();
                        renderSentence();
                        updateAccept();
                    } else {
                        rollOne(cat);
                    }
                    return;
                }
                const action = event.target.closest('[data-lz]');
                if (!action) {
                    return;
                }
                const type = action.getAttribute('data-lz');
                if (type === 'close') {
                    close();
                } else if (type === 'roll-all') {
                    DIFF_DATA.forEach((col) => rollOne(col.cat));
                    rollTemplate();
                    updateAccept();
                } else if (type === 'rephrase') {
                    rollTemplate();
                } else if (type === 'clear') {
                    Object.keys(state).forEach((cat) => {
                        state[cat] = null;
                        refreshChips(cat);
                    });
                    thema = '';
                    const input = overlay.querySelector('#sq-lz-thema');
                    if (input) {
                        input.value = '';
                    }
                    template = 0;
                    fixTemplate();
                    renderSentence();
                    updateAccept();
                } else if (type === 'accept') {
                    if (isComplete() && acceptCb) {
                        acceptCb(plainSentence(), diffPhaseForVerb(state.denken));
                    }
                    close();
                }
            });

            const themaInput = overlay.querySelector('#sq-lz-thema');
            if (themaInput) {
                themaInput.addEventListener('input', () => {
                    thema = themaInput.value;
                    fixTemplate();
                    renderSentence();
                    updateAccept();
                });
                themaInput.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter') {
                        event.preventDefault();
                        themaInput.blur();
                    }
                });
            }

            fixTemplate();
            renderSentence();
    }

    return {open: open, close: close};
});
