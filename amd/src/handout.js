// This file is part of Moodle - http://moodle.org/
//
// Handout-PDF fuer Teilnehmende (D64) — der einzige Handout-Generator.
//
// Wird aus dem Roten Faden (Teilnehmende erzeugen es selbst) und aus dem
// Import/Export-Tab (Lehrende) aufgerufen. Beide Wege ergeben dasselbe Dokument,
// weil beide aus demselben Modell rechnen (roterfadenmodel) — kein zweiter
// Mechanismus.
//
// Der Aufruf braucht nur `mod/seminarplaner:viewroterfaden`: gelesen wird
// ausschliesslich der veroeffentlichte Snapshot (get_roterfaden_state).
//
// jsPDF muss von der aufrufenden Seite geladen sein (thirdparty/jspdf).
//
// @module mod_seminarplaner/handout

define(['core/ajax', 'mod_seminarplaner/roterfadenmodel'], function(Ajax, Model) {
    const asCall = (methodname, args) => Ajax.call([{methodname, args}])[0];

    // Typografische Saeuberung wie im Import/Export-Tab (identische Regeln, damit
    // beide Ausgabewege zeichengleich sind).
    const normalizePdfText = (value) => {
        const letterClass = 'A-Za-zÀ-ÖØ-öø-ÿ0-9';
        const tightenSpacedLetters = (input) => {
            const pattern = new RegExp(`\\b[${letterClass}](?:\\s+[${letterClass}]){3,}\\b`, 'g');
            return input.replace(pattern, (match) => match.replace(/\s+/g, ''));
        };
        let text = String(value || '');
        if (typeof text.normalize === 'function') {
            text = text.normalize('NFC');
        }
        text = text
            .replace(/\u00A0/g, ' ')
            .replace(/[\u2000-\u200A\u202F]/g, ' ')
            .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
            .replace(/\u00AD/g, '')
            .replace(/\u2011/g, '-')
            .replace(/[\u2013\u2014]/g, '-')
            .replace(/[„“”]/g, '"')
            .replace(/[‚‘’]/g, '\'')
            .replace(/…/g, '...')
            .replace(/\s+([,.;:!?])/g, '$1')
            .replace(/([([{])\s+/g, '$1')
            .replace(/\s+([)\]}])/g, '$1');
        text = tightenSpacedLetters(text);
        text = text.replace(/\b([A-Za-zÀ-ÖØ-öø-ÿ])\.\s+([A-Za-zÀ-ÖØ-öø-ÿ])\./g, '$1.$2.');
        text = text.replace(/\s+\/\s+/g, '/');
        return text.replace(/\s+/g, ' ').trim();
    };

    const escapeTextForPdf = (text) => {
        if (!text) {
            return '';
        }
        const div = document.createElement('div');
        div.innerHTML = String(text);
        const plain = (div.textContent || div.innerText || '').replace(/\r?\n/g, ' ');
        return normalizePdfText(plain);
    };

    const detectLogoFormat = (dataurl) => {
        const value = String(dataurl || '').toLowerCase();
        if (value.startsWith('data:image/png')) {
            return 'PNG';
        }
        if (value.startsWith('data:image/webp')) {
            return 'WEBP';
        }
        return 'JPEG';
    };

    // D52: Logo in den Seitenkopf stempeln (Fehler duerfen den Export nie blockieren).
    const prepareLogo = (logo) => {
        if (!logo || !logo.dataurl) {
            return Promise.resolve(null);
        }
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve({
                dataurl: logo.dataurl,
                position: logo.position === 'left' ? 'left' : 'right',
                format: detectLogoFormat(logo.dataurl),
                w: img.naturalWidth || img.width || 1,
                h: img.naturalHeight || img.height || 1
            });
            img.onerror = () => resolve(null);
            img.src = logo.dataurl;
        });
    };

    const stampLogo = (doc, logo) => {
        if (!logo) {
            return;
        }
        try {
            const pageWidth = doc.internal.pageSize.getWidth();
            const scale = Math.min(14 / logo.h, 45 / logo.w, 1);
            const w = logo.w * scale;
            const h = logo.h * scale;
            const x = logo.position === 'left' ? 14 : (pageWidth - 14 - w);
            doc.addImage(logo.dataurl, logo.format, x, 8, w, h);
        } catch (e) {
            // Logo-Fehler duerfen den PDF-Export nie blockieren.
        }
    };

    const drawTitlePage = (doc, logo, meta) => {
        stampLogo(doc, logo);
        const pageHeight = doc.internal.pageSize.getHeight();
        let y = 48;
        doc.setFont(undefined, 'bold');
        doc.setFontSize(26);
        doc.text('Handout', 14, y);
        y += 12;
        doc.setFont(undefined, 'normal');
        doc.setFontSize(14);
        doc.text('Für Teilnehmende', 14, y);
        y += 16;

        doc.setDrawColor(220, 224, 233);
        doc.setLineWidth(0.3);
        doc.line(14, y, 196, y);
        y += 10;

        doc.setFontSize(11);
        [
            ['Titel', meta.title],
            ['Datum', meta.date],
            ['Seminarnummer', meta.number],
            ['Kontakt', meta.contact]
        ].forEach(([label, value]) => {
            doc.setFont(undefined, 'bold');
            doc.text(`${label}:`, 14, y);
            doc.setFont(undefined, 'normal');
            doc.text(escapeTextForPdf(value) || '—', 52, y);
            y += 9;
        });

        doc.setFont(undefined, 'normal');
        doc.setFontSize(9);
        doc.text('Seminarplaner', 14, pageHeight - 14);
    };

    // Das Handout bildet den Roten Faden ab: Tag -> Vormittag/Nachmittag ->
    // Programmpunkt (Uhrzeit + Titel) -> Themen als Aufzaehlung.
    const drawDays = (doc, logo, days) => {
        const pageHeight = doc.internal.pageSize.getHeight();
        let y = 24;
        const ensureSpace = (needed) => {
            if (y + needed > pageHeight - 16) {
                doc.addPage();
                stampLogo(doc, logo);
                y = 24;
            }
        };

        days.forEach((day) => {
            ensureSpace(18);
            doc.setFont(undefined, 'bold');
            doc.setFontSize(16);
            doc.setTextColor(0, 0, 0);
            doc.text(escapeTextForPdf(day.name), 14, y);
            y += 3;
            doc.setDrawColor(220, 224, 233);
            doc.setLineWidth(0.3);
            doc.line(14, y, 196, y);
            y += 9;

            day.anchors.forEach((anchor) => {
                ensureSpace(14);
                doc.setFont(undefined, 'bold');
                doc.setFontSize(12);
                doc.setTextColor(136, 42, 48); // Tiefrot (CD-Akzent).
                doc.text(escapeTextForPdf(anchor.name), 16, y);
                doc.setTextColor(0, 0, 0);
                y += 8;

                anchor.blocks.forEach((block) => {
                    const heading = `${Model.clockLabel(block.startMin)} Uhr · ${block.title}`
                        + (block.continuation ? ' (Fortsetzung)' : '');
                    const titleLines = doc.splitTextToSize(escapeTextForPdf(heading), 176);
                    ensureSpace(Math.max(8, titleLines.length * 6) + 2);
                    doc.setFont(undefined, 'bold');
                    doc.setFontSize(11);
                    doc.text(titleLines, 18, y);
                    y += (titleLines.length * 6) + 1;

                    doc.setFont(undefined, 'normal');
                    doc.setFontSize(10);
                    // Ein einzelnes Thema wiederholt nur die Ueberschrift — dann keine
                    // Aufzaehlung (so wie am Bildschirm der Block seinen Titel traegt).
                    const themen = (block.themen.length === 1 && block.themen[0].title === block.title)
                        ? [] : block.themen;
                    themen.forEach((theme) => {
                        const lines = doc.splitTextToSize(escapeTextForPdf(theme.title), 168);
                        ensureSpace(Math.max(6, lines.length * 5.5));
                        doc.text('•', 22, y);
                        doc.text(lines, 27, y);
                        y += lines.length * 5.5;
                    });
                    y += 3;
                });
                y += 2;
            });
            y += 2;
        });
    };

    return {
        /**
         * Handout-PDF aus dem veroeffentlichten Roten Faden erzeugen und herunterladen.
         *
         * @param {Number} cmid Kursmodul-ID.
         * @param {Object|null} logo Logo-Daten (dataurl/position) aus seminarplaner_get_pdf_logo.
         * @return {Promise} Erfuellt, sobald der Download angestossen wurde.
         */
        exportPdf: function(cmid, logo) {
            if (!window.jspdf || typeof window.jspdf.jsPDF !== 'function') {
                return Promise.reject(new Error('PDF-Library ist nicht geladen'));
            }
            const jsPDF = window.jspdf.jsPDF;
            return Promise.all([
                asCall('mod_seminarplaner_get_roterfaden_state', {cmid: cmid}),
                prepareLogo(logo)
            ]).then(([res, preparedlogo]) => {
                if (!res || !res.ispublished) {
                    throw new Error('Es ist noch kein Roter Faden veröffentlicht.');
                }
                let state = {};
                try {
                    state = res.statejson ? JSON.parse(res.statejson) : {};
                } catch (e) {
                    state = {};
                }
                const days = Model.buildDays(state);
                const meta = (state && state.meta) ? state.meta : {};

                const doc = new jsPDF();
                drawTitlePage(doc, preparedlogo, {
                    title: meta.title || '',
                    date: meta.date || '',
                    number: meta.number || '',
                    contact: meta.contact || ''
                });
                doc.addPage();
                stampLogo(doc, preparedlogo);

                if (!days.length) {
                    doc.setFont(undefined, 'normal');
                    doc.setFontSize(12);
                    doc.text('Für diesen Seminarplan ist noch kein Ablauf veröffentlicht.', 14, 30);
                } else {
                    drawDays(doc, preparedlogo, days);
                }

                doc.save(meta.title ? `Handout-${meta.title}.pdf` : 'Handout.pdf');
            });
        }
    };
});
