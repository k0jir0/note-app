// Theme toggle: toggles `dark-mode` on <body>, persists to localStorage
// and posts preference to server if user is authenticated.
(function () {
    function getCsrf() {
        return window.getCsrfToken ? window.getCsrfToken() : '';
    }

    const TOGGLE_ID = 'theme-toggle';
    const STORAGE_KEY = 'app_nightMode';

    function applyMode(isDark) {
        if (isDark) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
    }

    function persistToServer(isDark) {
        // Fire-and-forget; server will enforce CSRF via header
        try {
            fetch('/api/settings/theme', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-csrf-token': getCsrf()
                },
                body: JSON.stringify({ nightMode: isDark })
            }).catch(() => {});
        } catch (e) {
            // ignore
        }
    }

    function init() {
        const checkbox = document.getElementById(TOGGLE_ID);
        if (!checkbox) return;

        // Determine initial value: localStorage wins, then server-rendered body class
        const stored = localStorage.getItem(STORAGE_KEY);
        let isDark = null;
        if (stored === 'true') isDark = true;
        if (stored === 'false') isDark = false;
        if (isDark === null) {
            isDark = document.body.classList.contains('dark-mode');
        }

        checkbox.checked = Boolean(isDark);
        applyMode(Boolean(isDark));

        checkbox.addEventListener('change', (e) => {
            const v = !!e.target.checked;
            applyMode(v);
            localStorage.setItem(STORAGE_KEY, v ? 'true' : 'false');
            persistToServer(v);
        });
    }

    // init when DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
