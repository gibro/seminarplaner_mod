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
// along with Moodle.  If not, see <https://www.gnu.org/licenses/>.

// Überblick als PDF: die Wochenansicht auf genau einer DIN-A4-Seite quer.
//
// Gezeichnet wird als Vektorgrafik aus denselben Daten, die der Überblick
// rendert (overviewPlanDays in grid.js) — kein Bildschirmfoto. Die Farben
// kommen aus den CSS-Tokens (--sq-phase-*, --ig-*), damit PDF und Bildschirm
// nicht auseinanderlaufen; die Hex-Werte hier sind nur Rückfall.
//
// jsPDF muss von der aufrufenden Seite geladen sein (thirdparty/jspdf).
//
// @module mod_seminarplaner/overviewpdf
// @copyright  2026 Guido Brombach <gibro@posteo.de>
// @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later

define([], function() {
    const PHASES = [
        {key: 'warmup', label: 'Warmup/Aktivierung', fallback: '#7B4FA0'},
        {key: 'orientierung', label: 'Orientierung', fallback: '#2F80AB'},
        {key: 'erfahrung', label: 'Erfahrungserhebung', fallback: '#5B9945'},
        {key: 'analyse', label: 'Analyse', fallback: '#EAB500'},
        {key: 'handlung', label: 'Handlungsteil', fallback: '#882A30'},
        {key: 'transfer', label: 'Transfer', fallback: '#646464'},
    ];

    // Seite und Raster in mm.
    const PAGE_W = 297;
    const PAGE_H = 210;
    const MARGIN = 10;
    const AXIS_W = 11;
    const HEAD_H = 7;
    const PT = 0.3528;

    const clock = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

    const hexToRgb = (value, fallback) => {
        const raw = String(value || '').trim() || fallback;
        const m = /^#?([0-9a-f]{6})$/i.exec(raw) || /^#?([0-9a-f]{6})$/i.exec(fallback);
        const n = parseInt(m[1], 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    };

    // Typografische Säuberung für die Standardschrift (WinAnsi).
    const pdfText = (value) => String(value || '')
        .normalize('NFC')
        .replace(/[  -  ]/g, ' ')
        .replace(/[​-‍⁠﻿­]/g, '')
        .replace(/[„“”]/g, '"')
        .replace(/[‚‘’]/g, '\'')
        .replace(/\s+/g, ' ')
        .trim();

    const readPalette = () => {
        const root = document.querySelector('.kg-grid-readonly') || document.documentElement;
        const css = window.getComputedStyle(root);
        const token = (name, fallback) => hexToRgb(css.getPropertyValue(name), fallback);
        const phases = {};
        PHASES.forEach((phase) => {
            phases[phase.key] = token(`--sq-phase-${phase.key}`, phase.fallback);
        });
        return {
            phases,
            darkred: token('--ig-darkred', '#882A30'),
            anthracite: token('--ig-anthracite', '#3C3C3C'),
            gray: token('--ig-gray', '#646464'),
            midgray: token('--ig-midgray', '#B9B9B9'),
            lightgray: token('--ig-lightgray', '#DADADA'),
        };
    };

    // Stil eines Blocks wie im Überblick (styles.css, .sp-item--sqnav …).
    const blockStyle = (item, palette) => {
        if (item.kind === 'break') {
            return {fill: [241, 241, 241], hatch: [228, 228, 228], border: palette.midgray, dashed: true,
                text: palette.gray, isBreak: true};
        }
        if (item.reserved) {
            return {fill: [252, 250, 250], border: [201, 169, 173], dashed: true, text: palette.darkred};
        }
        if (item.phase && palette.phases[item.phase]) {
            const dark = item.phase === 'analyse';
            return {fill: palette.phases[item.phase], border: null,
                text: dark ? palette.anthracite : [255, 255, 255],
                meta: dark ? [96, 96, 96] : [235, 235, 235]};
        }
        if (item.color) {
            return {fill: hexToRgb(item.color, '#FAFAFA'), border: null, text: [255, 255, 255], meta: [235, 235, 235]};
        }
        return {fill: [250, 250, 250], border: palette.lightgray, text: palette.anthracite, meta: palette.gray};
    };

    // Zeilen auf maxLines kürzen, die letzte bekommt eine Ellipse.
    const fitLines = (doc, text, width, maxLines) => {
        const lines = doc.splitTextToSize(text, width);
        if (lines.length <= maxLines) {
            return lines;
        }
        const kept = lines.slice(0, Math.max(1, maxLines));
        let last = kept[kept.length - 1];
        while (last.length > 1 && doc.getTextWidth(`${last}...`) > width) {
            last = last.slice(0, -1);
        }
        kept[kept.length - 1] = `${last.replace(/\s+$/, '')}...`;
        return kept;
    };

    const drawBlock = (doc, item, box, palette) => {
        const style = blockStyle(item, palette);
        const {x, y, w, h} = box;
        doc.setFillColor(...style.fill);
        if (style.border) {
            doc.setDrawColor(...style.border);
            doc.setLineWidth(0.2);
            if (style.dashed) {
                doc.setLineDashPattern([0.8, 0.6], 0);
            }
            doc.roundedRect(x, y, w, h, 0.8, 0.8, 'FD');
            doc.setLineDashPattern([], 0);
        } else {
            doc.roundedRect(x, y, w, h, 0.8, 0.8, 'F');
        }

        const padX = 1.2;
        const innerW = w - (2 * padX);

        if (style.isBreak) {
            // 45°-Schraffur wie am Bildschirm, auf den Block beschnitten.
            doc.saveGraphicsState();
            doc.rect(x, y, w, h, null);
            doc.clip();
            doc.discardPath();
            doc.setDrawColor(...style.hatch);
            doc.setLineWidth(0.9);
            for (let d = -h; d < w; d += 2.4) {
                doc.line(x + d, y + h, x + d + h, y);
            }
            doc.restoreGraphicsState();
            const fs = Math.max(4.5, Math.min(6.5, (h - 0.6) / (PT * 1.1)));
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(fs);
            doc.setTextColor(...style.text);
            const label = fitLines(doc, pdfText(item.title).toUpperCase(), innerW, 1)[0];
            doc.text(label, x + (w / 2), y + (h / 2), {align: 'center', baseline: 'middle'});
            return;
        }

        const timeLabel = `${clock(item.startMin)}-${clock(item.endMin)}`;
        let fs = 7;
        let lh = fs * PT * 1.15;
        if (h < lh + 1) {
            fs = Math.min(fs, Math.max(4.5, (h - 0.6) / (PT * 1.15)));
            lh = fs * PT * 1.15;
        }
        const maxLines = Math.max(1, Math.floor((h - 1) / lh));
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(fs);

        if (maxLines === 1) {
            // Kurzer Block: eine Zeile, Titel und Zeit nebeneinander, wenn Platz.
            doc.setTextColor(...style.text);
            const timeW = doc.getTextWidth(` ${timeLabel}`);
            const withTime = doc.getTextWidth(pdfText(item.title)) + timeW <= innerW;
            const title = fitLines(doc, pdfText(item.title), withTime ? innerW - timeW : innerW, 1)[0];
            const ty = y + (h / 2);
            doc.text(title, x + padX, ty, {baseline: 'middle'});
            if (withTime) {
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(...(style.meta || style.text));
                doc.text(timeLabel, x + w - padX, ty, {baseline: 'middle', align: 'right'});
            }
            return;
        }

        const extras = [timeLabel];
        if (item.referenten && item.referenten.length) {
            extras.push(item.referenten.join(', '));
        }
        const extraLines = Math.min(extras.length, maxLines - 1);
        const titleLines = fitLines(doc, pdfText(item.title), innerW, maxLines - extraLines);
        let ty = y + 0.6 + (fs * PT);
        doc.setTextColor(...style.text);
        titleLines.forEach((line) => {
            doc.text(line, x + padX, ty);
            ty += lh;
        });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(fs - 0.8);
        doc.setTextColor(...(style.meta || style.text));
        extras.slice(0, extraLines).forEach((extra) => {
            doc.text(fitLines(doc, pdfText(extra), innerW, 1)[0], x + padX, ty);
            ty += lh;
        });
    };

    const drawLegend = (doc, usedPhases, palette, y) => {
        let x = MARGIN + AXIS_W;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        PHASES.filter((phase) => usedPhases.has(phase.key)).forEach((phase) => {
            doc.setFillColor(...palette.phases[phase.key]);
            doc.roundedRect(x, y - 2.4, 3, 3, 0.5, 0.5, 'F');
            doc.setTextColor(...palette.anthracite);
            doc.text(phase.label, x + 4.2, y);
            x += 4.2 + doc.getTextWidth(phase.label) + 6;
        });
    };

    return {
        /**
         * Überblick als einseitiges PDF (A4 quer) erzeugen und herunterladen.
         *
         * @param {Object} data
         * @param {String} data.title Titel des Seminarplans (Überschrift).
         * @param {Array} data.days [{name, items: [{kind, title, startMin, endMin, phase, reserved, color, referenten}]}]
         * @param {Number} data.startMin Beginn laut Einrichtung (Minuten).
         * @param {Number} data.endMin Ende laut Einrichtung (Minuten).
         */
        exportPdf: function(data) {
            if (!window.jspdf || typeof window.jspdf.jsPDF !== 'function') {
                throw new Error('PDF-Library ist nicht geladen');
            }
            const palette = readPalette();
            const days = data.days || [];
            const doc = new window.jspdf.jsPDF({orientation: 'landscape', unit: 'mm', format: 'a4'});

            // Kopf: Titel des Seminarplans.
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(15);
            doc.setTextColor(...palette.anthracite);
            const title = fitLines(doc, pdfText(data.title) || 'Seminarplan', PAGE_W - (2 * MARGIN), 1)[0];
            doc.text(title, MARGIN, MARGIN + 5);
            doc.setDrawColor(...palette.darkred);
            doc.setLineWidth(0.6);
            doc.line(MARGIN, MARGIN + 8, MARGIN + 30, MARGIN + 8);

            // Zeitfenster: Einrichtung, erweitert um Einträge außerhalb, auf volle Stunden.
            let start = Number.isFinite(data.startMin) ? data.startMin : 8 * 60;
            let end = Number.isFinite(data.endMin) ? data.endMin : 18 * 60;
            days.forEach((day) => day.items.forEach((item) => {
                start = Math.min(start, item.startMin);
                end = Math.max(end, item.endMin);
            }));
            start = Math.floor(start / 60) * 60;
            end = Math.max(start + 60, Math.ceil(end / 60) * 60);

            const usedPhases = new Set();
            days.forEach((day) => day.items.forEach((item) => {
                if (item.phase && !item.reserved && item.kind !== 'break') {
                    usedPhases.add(item.phase);
                }
            }));

            const gridTop = MARGIN + 13;
            const bodyTop = gridTop + HEAD_H;
            const bodyBottom = PAGE_H - MARGIN - (usedPhases.size ? 7 : 0);
            const gridLeft = MARGIN + AXIS_W;
            const gridRight = PAGE_W - MARGIN;
            const colW = (gridRight - gridLeft) / Math.max(1, days.length);
            const mmPerMin = (bodyBottom - bodyTop) / (end - start);
            const yOf = (min) => bodyTop + ((min - start) * mmPerMin);

            // Kopfzeile mit den Tagen.
            doc.setFillColor(251, 251, 251);
            doc.rect(gridLeft, gridTop, gridRight - gridLeft, HEAD_H, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(...palette.anthracite);
            days.forEach((day, i) => {
                doc.text(fitLines(doc, pdfText(day.name), colW - 2, 1)[0],
                    gridLeft + (i * colW) + (colW / 2), gridTop + (HEAD_H / 2), {align: 'center', baseline: 'middle'});
            });

            // Stundenlinien und Zeitachse.
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            for (let min = start; min <= end; min += 30) {
                const y = yOf(min);
                const full = min % 60 === 0;
                doc.setDrawColor(...(full ? palette.lightgray : [238, 238, 238]));
                doc.setLineWidth(full ? 0.2 : 0.15);
                doc.line(gridLeft, y, gridRight, y);
                if (full) {
                    doc.setTextColor(...palette.gray);
                    doc.text(clock(min), gridLeft - 1.5, y, {align: 'right', baseline: 'middle'});
                }
            }
            doc.setDrawColor(...palette.lightgray);
            doc.setLineWidth(0.2);
            for (let i = 0; i <= days.length; i++) {
                const x = gridLeft + (i * colW);
                doc.line(x, gridTop, x, bodyBottom);
            }
            doc.line(gridLeft, gridTop, gridRight, gridTop);

            // Blöcke.
            days.forEach((day, i) => {
                day.items.slice().sort((a, b) => a.startMin - b.startMin).forEach((item) => {
                    const y0 = yOf(item.startMin);
                    const h = Math.max(1.6, yOf(item.endMin) - y0);
                    drawBlock(doc, item, {x: gridLeft + (i * colW) + 0.8, y: y0 + 0.15, w: colW - 1.6, h: h - 0.3},
                        palette);
                });
            });

            if (usedPhases.size) {
                drawLegend(doc, usedPhases, palette, PAGE_H - MARGIN - 1);
            }

            const safe = pdfText(data.title).replace(/[\\/:*?"<>|]+/g, '-');
            doc.save(safe ? `Ueberblick-${safe}.pdf` : 'Ueberblick.pdf');
        }
    };
});
