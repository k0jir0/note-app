const RESEARCH_MODULES = [
    {
        id: 'security-operations',
        category: 'Security Operations',
        title: 'Security Operations Module',
        summary: 'Log analysis, scan importing, correlations, automation status, and demo sample injection now live in one dedicated module page.',
        href: '/security/module',
        actionLabel: 'Open Security Operations Module',
        buttonVariant: 'dark',
        badgeTone: 'dynamic',
        badgeText: ''
    },
    {
        id: 'audit-telemetry',
        category: 'Auditability',
        title: 'Audit Trail and Telemetry Module',
        summary: 'Inspect immutable forwarding posture, request-scoped DB telemetry coverage, TLS 1.3 transport policy, and JSON versus syslog sink previews from one dedicated auditability workspace.',
        href: '/audit-telemetry/module',
        actionLabel: 'Open Audit Trail and Telemetry Module',
        buttonVariant: 'outline-dark',
        badgeTone: 'danger',
        badgeText: 'Auditability + SIEM posture'
    },
    {
        id: 'supply-chain',
        category: 'Supply Chain Security',
        title: 'Supply Chain Security Module',
        summary: 'Review the committed CycloneDX SBOM, npm audit enforcement commands, CI workflow coverage, and the hardened distroless container posture from one dedicated supply-chain workspace.',
        href: '/supply-chain/module',
        actionLabel: 'Open Supply Chain Security Module',
        buttonVariant: 'outline-dark',
        badgeTone: 'success',
        badgeText: 'SBOM + dependency governance'
    },
    {
        id: 'alert-triage-ml',
        category: 'Model Operations',
        title: 'Alert Triage ML Module',
        summary: 'Inspect the alert triage model, review label distributions, and train a new bootstrap or hybrid model from one dedicated page.',
        href: '/ml/module',
        actionLabel: 'Open Alert Triage ML Module',
        buttonVariant: 'outline-dark',
        badgeTone: 'info',
        badgeText: 'Trainable alert triage'
    },
    {
        id: 'playwright-testing',
        category: 'Browser Testing',
        title: 'Playwright Testing Module',
        summary: 'Generate Playwright smoke specs, review browser-test coverage for this app, and export resilient test templates tailored to the Research Workspace.',
        href: '/playwright/module',
        actionLabel: 'Open Playwright Testing Module',
        buttonVariant: 'outline-dark',
        badgeTone: 'primary',
        badgeText: 'Playwright spec templates'
    },
    {
        id: 'selenium-testing',
        category: 'Browser Testing',
        title: 'Selenium Testing Module',
        summary: 'Generate Selenium WebDriver smoke suites, review browser-test coverage for this app, and export script templates tailored to the Research Workspace.',
        href: '/selenium/module',
        actionLabel: 'Open Selenium Testing Module',
        buttonVariant: 'outline-dark',
        badgeTone: 'warning',
        badgeText: 'Browser automation templates'
    },
    {
        id: 'injection-prevention',
        category: 'Data-Layer Defense',
        title: 'Query Injection Prevention Module',
        summary: 'Inspect structured query builders, request-level operator blocking, and the Mongoose hardening that keeps injection-shaped input out of the data layer.',
        href: '/injection-prevention/module',
        actionLabel: 'Open Query Injection Prevention Module',
        buttonVariant: 'outline-dark',
        badgeTone: 'primary',
        badgeText: 'Structured query defense'
    },
    {
        id: 'xss-defense',
        category: 'Browser Protection',
        title: 'XSS and CSP Defense Module',
        summary: 'Inspect escaped rendering, DOM sink discipline, and the strict Content Security Policy that keeps unauthorized scripts from running.',
        href: '/xss-defense/module',
        actionLabel: 'Open XSS and CSP Defense Module',
        buttonVariant: 'outline-dark',
        badgeTone: 'info',
        badgeText: 'Escaping + CSP backstop'
    },
    {
        id: 'break-glass',
        category: 'Emergency Operations',
        title: 'Break-Glass and Emergency Control Module',
        summary: 'Inspect the runtime kill switch, confirm read-only versus offline posture, and verify the emergency control plane that can neutralize the application during an active cyber event.',
        href: '/break-glass/module',
        actionLabel: 'Open Break-Glass and Emergency Control Module',
        buttonVariant: 'outline-dark',
        badgeTone: 'danger',
        badgeText: 'Read-only + offline neutralization'
    },
    {
        id: 'access-control',
        category: 'Server Authorization',
        title: 'Server Access Control Module',
        summary: 'Inspect protected-by-default API coverage, ownership scoping, and the server-side checks that block broken-access-control attempts even if the frontend is bypassed.',
        href: '/access-control/module',
        actionLabel: 'Open Server Access Control Module',
        buttonVariant: 'outline-dark',
        badgeTone: 'warning',
        badgeText: 'Protected-by-default APIs'
    },
    {
        id: 'self-healing',
        category: 'Locator Resilience',
        title: 'Self-Healing Locator Repair Module',
        summary: 'Explore ML-assisted self-healing for broken Playwright and Selenium locators, compare trained repair strategies, and inspect deterministic self-heal candidates from current DOM snippets.',
        href: '/self-healing/module',
        actionLabel: 'Open Self-Healing Locator Repair Module',
        buttonVariant: 'outline-dark',
        badgeTone: 'secondary',
        badgeText: 'ML-assisted self-healing'
    },
    {
        id: 'mission-assurance',
        category: 'Mission Policy',
        title: 'Mission Access Assurance Module',
        summary: 'Model least-privilege tactical access with RBAC plus ABAC, compare mission roles against data classifications, and simulate whether sensitive actions should be allowed before they reach a hardened workflow.',
        href: '/mission-assurance/module',
        actionLabel: 'Open Mission Access Assurance Module',
        buttonVariant: 'outline-dark',
        badgeTone: 'dark',
        badgeText: 'RBAC + ABAC policy lab'
    },
    {
        id: 'hardware-mfa',
        category: 'Strong Authentication',
        title: 'Hardware-Backed MFA Module',
        summary: 'Inspect registered strong factors, simulate hardware-token or PKI-backed step-up, and confirm whether the current session has enough assurance for hardened mission actions.',
        href: '/hardware-mfa/module',
        actionLabel: 'Open Hardware-Backed MFA Module',
        buttonVariant: 'outline-dark',
        badgeTone: 'success',
        badgeText: 'Hardware token + PKI step-up'
    },
    {
        id: 'session-management',
        category: 'Session Control',
        title: 'Session Security Module',
        summary: 'Inspect idle and absolute timeout policy, review live server-side session state, and simulate whether abandoned or superseded sessions should lock down immediately.',
        href: '/session-management/module',
        actionLabel: 'Open Session Security Module',
        buttonVariant: 'outline-dark',
        badgeTone: 'danger',
        badgeText: 'Strict timeout + single-session control'
    }
];

function listResearchModules() {
    return RESEARCH_MODULES.map((module) => ({
        ...module
    }));
}

module.exports = {
    RESEARCH_MODULES,
    listResearchModules
};
