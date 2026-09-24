// ==UserScript==
// @name         München SZE Notfall Termin - Quick Booker
// @namespace    cg-sze-helper
// @version      1.1
// @description  Quick Booker for München SZE Notfall appointments after manual CAPTCHA.
// @match        *://*.muenchen.de/*
// @noframes
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const PATHS = {
        general: '/services/10339028/locations/10461',
        student: '/services/10339027/locations/10187259'
    };

    const currentType =
        location.hash.includes(PATHS.general) ? 'general' :
        location.hash.includes(PATHS.student) ? 'student' :
        null;

    if (!currentType) return;
    if (window.top !== window.self) return;

    if (document.documentElement.dataset.szeQuickBooker === '1') return;
    document.documentElement.dataset.szeQuickBooker = '1';

    const PREFIX =
        currentType === 'student'
            ? '[SZE-STUDENT-AUTO]'
            : '[SZE-GENERAL-AUTO]';

    const LABEL =
        currentType === 'student'
            ? 'SZE Student Quick Booker'
            : 'SZE Quick Booker';

    const SCAN_INTERVAL = 100;
    const SLOT_TIMEOUT = 1400;
    const DATE_RECLICK_DELAY = 1800;

    let enabled = true;
    let lastStatus = '';
    let lastDateClick = 0;
    let pendingSlot = null;
    let pendingSlotTime = 0;
    const attemptedSlots = new Set();
    let weiterClicked = false;
    let finished = false;

    function log(...args) {
        console.log(PREFIX, ...args);
    }

    function visible(el) {
        if (!el) return false;

        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();

        return (
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            rect.width > 0 &&
            rect.height > 0
        );
    }

    function enabledElement(el) {
        return (
            visible(el) &&
            !el.disabled &&
            el.getAttribute('disabled') === null &&
            el.getAttribute('aria-disabled') !== 'true'
        );
    }

    function getAllRoots(root = document) {
        const roots = [root];

        const walker = document.createTreeWalker(
            root,
            NodeFilter.SHOW_ELEMENT
        );

        let node;

        while ((node = walker.nextNode())) {
            if (node.shadowRoot) {
                roots.push(...getAllRoots(node.shadowRoot));
            }
        }

        return roots;
    }

    function queryAllDeep(selector) {
        const result = [];

        for (const root of getAllRoots()) {
            try {
                result.push(...root.querySelectorAll(selector));
            } catch (e) {}
        }

        return [...new Set(result)];
    }

    function deepText() {
        return getAllRoots()
            .map(root => root.textContent || '')
            .join('\n');
    }

    function getButtons() {
        return queryAllDeep(
            'button, [role="button"], input[type="button"], input[type="submit"]'
        ).filter(visible);
    }

    function elementText(el) {
        return (
            el.innerText ||
            el.value ||
            el.textContent ||
            ''
        ).trim();
    }

    function combinedText(el) {
        return [
            elementText(el),
            el.getAttribute('aria-label') || '',
            el.getAttribute('title') || ''
        ].join(' ').trim();
    }

    function setStatus(message) {
        if (message === lastStatus) return;

        lastStatus = message;
        log(message);

        const status = document.getElementById('sze-auto-status');
        if (status) status.textContent = message;
    }

    function createPanel() {
        if (document.getElementById('sze-auto-panel')) return;

        const panel = document.createElement('div');
        panel.id = 'sze-auto-panel';

        panel.style.cssText = `
            position: fixed;
            right: 15px;
            bottom: 15px;
            z-index: 2147483647;
            background: white;
            border: 2px solid #2457a6;
            border-radius: 8px;
            padding: 10px 12px;
            font-family: Arial, sans-serif;
            font-size: 13px;
            box-shadow: 0 2px 10px rgba(0,0,0,.25);
            min-width: 210px;
        `;

        const title = document.createElement('div');
        title.textContent = LABEL;
        title.style.fontWeight = 'bold';
        title.style.marginBottom = '7px';

        const status = document.createElement('div');
        status.id = 'sze-auto-status';
        status.textContent = 'Waiting...';
        status.style.marginBottom = '8px';

        const toggle = document.createElement('button');
        toggle.textContent = 'AUTO: ON';

        toggle.style.cssText = `
            padding: 5px 10px;
            cursor: pointer;
        `;

        toggle.addEventListener('click', () => {
            enabled = !enabled;
            toggle.textContent = enabled ? 'AUTO: ON' : 'AUTO: OFF';

            if (!enabled) {
                setStatus('Paused');
            } else {
                setStatus('Waiting...');
            }
        });

        panel.appendChild(title);
        panel.appendChild(status);
        panel.appendChild(toggle);
        document.body.appendChild(panel);
    }

    function isTerminPage(text) {
        return text.includes('Datum und Uhrzeit');
    }

    function noTermin(text) {
        return text.includes('Aktuell ist kein Termin verfügbar');
    }

    function isContactPage(text) {
        return (
            text.includes('Kontakt') &&
            (
                text.includes('E-Mail') ||
                text.includes('Kontaktdaten') ||
                text.includes('Telefon')
            )
        );
    }

    function findEnabledWeiter(buttons) {
        return buttons.find(el => {
            const text = elementText(el);

            return (
                /^Weiter\b/i.test(text) &&
                enabledElement(el)
            );
        });
    }

    function findDateCandidates(buttons) {
        return buttons.filter(el => {
            if (!enabledElement(el)) return false;

            const text = elementText(el);
            const aria = (el.getAttribute('aria-label') || '').trim();

            const numericDay = /^\d{1,2}$/.test(text);
            const ariaDate = /\d{1,2}[.\-/]\d{1,2}/.test(aria);
            const weekday =
                /(Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag)/i
                    .test(aria);

            return numericDay || ariaDate || weekday;
        });
    }

    function findSlots(buttons) {
        return buttons.filter(el => {
            if (!enabledElement(el)) return false;

            const text = combinedText(el);

            return /\b(?:[01]?\d|2[0-3]):[0-5]\d\b/.test(text);
        });
    }

    function slotKey(el) {
        return combinedText(el);
    }

    function slotFailureDetected(text) {
        return (
            /nicht mehr verfügbar/i.test(text) ||
            /bereits vergeben/i.test(text) ||
            /nicht mehr frei/i.test(text) ||
            /leider.{0,60}(vergeben|verfügbar)/i.test(text)
        );
    }

    function successAlert() {
        if (finished) return;

        finished = true;
        enabled = false;
        setStatus('CONTACT PAGE — TAKE OVER');

        try {
            const ctx =
                new (
                    window.AudioContext ||
                    window.webkitAudioContext
                )();

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.frequency.value = 880;
            gain.gain.value = 0.25;

            osc.start();

            setTimeout(() => {
                osc.stop();
                ctx.close();
            }, 600);

        } catch (e) {}

        setTimeout(() => {
            alert(
                '已经进入 Kontakt 页面。\n\n' +
                '自动操作已停止，请现在接手完成预约。'
            );
        }, 100);
    }

    function tick() {
        if (!enabled || finished) return;

        const stillSupported =
            location.hash.includes(PATHS.general) ||
            location.hash.includes(PATHS.student);

        if (!stillSupported) {
            enabled = false;
            setStatus('Wrong page — stopped');
            return;
        }

        const text = deepText();
        const buttons = getButtons();

        if (isContactPage(text)) {
            successAlert();
            return;
        }

        if (!isTerminPage(text)) {
            setStatus('Waiting for CAPTCHA + Weiter');
            return;
        }

        if (noTermin(text)) {
            pendingSlot = null;
            attemptedSlots.clear();
            weiterClicked = false;
            setStatus('NO TERMIN');
            return;
        }

        if (pendingSlot) {
            const weiter = findEnabledWeiter(buttons);

            if (weiter && !weiterClicked) {
                weiterClicked = true;
                setStatus('Slot selected — clicking Weiter');
                log('Clicking Weiter.');
                weiter.click();
                return;
            }

            if (slotFailureDetected(text)) {
                log('Slot failed:', pendingSlot);
                pendingSlot = null;
                pendingSlotTime = 0;
                setStatus('Slot lost — trying next');
                return;
            }

            if (Date.now() - pendingSlotTime < SLOT_TIMEOUT) {
                return;
            }

            log('Slot timeout:', pendingSlot);
            pendingSlot = null;
            pendingSlotTime = 0;
            setStatus('Trying next slot');
        }

        const slots = findSlots(buttons);

        if (slots.length > 0) {
            const untried =
                slots.filter(
                    slot =>
                        !attemptedSlots.has(
                            slotKey(slot)
                        )
                );

            if (untried.length > 0) {
                const slot = untried[0];
                const key = slotKey(slot);

                attemptedSlots.add(key);
                pendingSlot = key;
                pendingSlotTime = Date.now();

                setStatus('Trying slot: ' + key);
                log('CLICK SLOT:', key, slot);

                slot.click();
                return;
            }

            setStatus('All visible slots tried');
            return;
        }

        const dates = findDateCandidates(buttons);

        if (dates.length > 0) {
            if (Date.now() - lastDateClick < DATE_RECLICK_DELAY) {
                return;
            }

            const date = dates[0];
            lastDateClick = Date.now();

            setStatus(
                'DATE FOUND — clicking ' +
                combinedText(date)
            );

            log(
                'CLICK DATE:',
                combinedText(date),
                date
            );

            date.click();
            return;
        }

        setStatus('Termin page — waiting for date');
    }

    createPanel();

    log(`${LABEL} loaded.`);
    log('CAPTCHA and initial Weiter must be completed manually.');

    setInterval(
        tick,
        SCAN_INTERVAL
    );
})();
