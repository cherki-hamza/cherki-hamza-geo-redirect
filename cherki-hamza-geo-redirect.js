// ------------------------------------------------------------
// Geo Redirect Script (GCC countries -> meir.laveso.ae)
// Script made by Author: Cherki Hamza
// Author website: https://cherkihamza.com
//
// Usage (IMPORTANT: it must be the FIRST script inside <head>,
// loaded synchronously - NO async / defer attributes):
// 1. External file:
//    <script src="cherki-hamza-geo-redirect.js"></script>
// 2. Direct inline HTML embed:
//    Place the code between <script> and </script> in your <head>
//
// Behaviour:
//  - Visitor from a target country is ALWAYS sent to https://meir.laveso.ae/
//    Path, query string and hash are dropped on purpose
//    (example.com/anything/here?x=1  ->  https://meir.laveso.ae/).
//  - The page stays hidden until the country is known, so the original
//    website is never shown to a visitor who is about to be redirected.
//  - ?stay=1 disables the redirect for the current browser session.
// ------------------------------------------------------------

(function () {
    'use strict';

    // ---------------- Config ----------------
    var TARGET_HOST = 'meir.laveso.ae';
    var TARGET_URL = 'https://' + TARGET_HOST + '/'; // ROOT only, never the current path
    var GCC_COUNTRIES = ['AE']; // , 'SA', 'KW', 'QA', 'BH', 'OM'
    // Optional: only run on these domains (www. is matched automatically).
    // [] = run on whatever site the script is installed on.
    // Test: ['cherkihamza.com']    Live: ['meir.com.au']
    var SOURCE_DOMAINS = [];
    var TIMEOUT_MS = 4000;      // After this the page is shown anyway (a late AE result still redirects)

    // 1. Never run on the target domain (prevents redirect loops)
    if (window.location.hostname === TARGET_HOST) {
        return;
    }

    // 1b. Domain check only: the path, query string and hash are never looked at
    if (SOURCE_DOMAINS.length) {
        var currentHost = window.location.hostname.toLowerCase().replace(/^www\./, '');
        if (SOURCE_DOMAINS.indexOf(currentHost) === -1) {
            return;
        }
    }

    // 2. ?stay=1 -> skip the redirect for this page load only
    try {
        if (new URLSearchParams(window.location.search).get('stay') === '1') {
            return;
        }
    } catch (e) { /* ignore */ }

    // 3. Skip search engine bots, crawlers and audit tools (SEO safety)
    //    (real browsers such as the DuckDuckGo browser are NOT skipped)
    var botRegex = /bot|crawl|spider|slurp|lighthouse|pagespeed|inspectiontool|googleother|mediapartners|bingpreview|facebookexternalhit|whatsapp|embedly|headlesschrome/i;
    if (botRegex.test(navigator.userAgent || '')) {
        return;
    }

    // 4. Browser can't do the lookup -> just show the site
    if (typeof fetch !== 'function') {
        return;
    }

    // ---------------- Helpers ----------------
    var root = document.documentElement;
    var pageRevealed = false;
    var safetyTimer = null;

    function hidePage() {
        if (root) {
            root.style.setProperty('visibility', 'hidden', 'important');
        }
    }

    function revealPage() {
        if (pageRevealed) return;
        pageRevealed = true;
        if (root) {
            root.style.removeProperty('visibility');
        }
    }

    function redirectToTarget() {
        if (safetyTimer) clearTimeout(safetyTimer);
        hidePage(); // keep the page hidden while the browser navigates
        window.location.replace(TARGET_URL);
    }

    // Restored from back/forward cache while hidden -> never stay blank
    window.addEventListener('pageshow', function (e) {
        if (e.persisted) revealPage();
    });

    // 5. Hide the page IMMEDIATELY, before anything renders
    hidePage();
    safetyTimer = setTimeout(revealPage, TIMEOUT_MS);

    // 6. Country lookup: two providers asked in parallel, first valid answer wins
    var PROVIDERS = [
        {
            url: 'https://www.cloudflare.com/cdn-cgi/trace',
            parse: function (text) {
                var m = text.match(/^loc=([A-Z]{2})/m);
                return m ? m[1] : '';
            }
        },
        {
            url: 'https://get.geojs.io/v1/ip/country.json',
            parse: function (text) {
                var data = JSON.parse(text);
                if (Object.prototype.toString.call(data) === '[object Array]') {
                    data = data[0] || {};
                }
                return String(data.country || data.country_code || '').toUpperCase();
            }
        }
    ];

    var lookupDone = false;
    var pending = PROVIDERS.length;

    function onCountry(code) {
        if (lookupDone) return;
        lookupDone = true;

        if (GCC_COUNTRIES.indexOf(code) !== -1) {
            redirectToTarget();          // works even if the safety timer already fired
        } else {
            if (safetyTimer) clearTimeout(safetyTimer);
            revealPage();                // non-GCC visitor (or unknown country) -> show the site
        }
    }

    PROVIDERS.forEach(function (provider) {
        fetch(provider.url, { cache: 'no-store' })
            .then(function (res) {
                if (!res.ok) throw new Error('Bad response');
                return res.text();
            })
            .then(function (text) {
                var code = provider.parse(text);
                if (!/^[A-Z]{2}$/.test(code)) throw new Error('Bad country');
                onCountry(code);
            })
            .catch(function () {
                pending -= 1;
                if (pending === 0) onCountry(''); // every provider failed -> show the site
            });
    });
})();