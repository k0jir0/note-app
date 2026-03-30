const DEFAULT_BASE_URL = 'http://localhost:3000';
const DEFAULT_SAMPLE_ID = 'workspace-ml-link-text-drift';
const DEFAULT_CONFIDENCE = 'low';
const DEFAULT_ENGINE_MODE = 'ML-assisted self-healing with deterministic verification';
const DEFAULT_ENGINE_NOTE = 'A trained logistic reranker now combines deterministic signals with repair feedback, but every self-heal still requires deterministic verification before continuing.';
const AUTO_HEAL_STRATEGIES = new Set(['data-testid', 'id', 'href', 'name', 'role-and-name', 'placeholder']);

const SUPPORTED_LOCATOR_FAMILIES = [
    'playwright-testid',
    'playwright-role',
    'playwright-placeholder',
    'playwright-text',
    'playwright-css',
    'selenium-id',
    'selenium-name',
    'selenium-link-text',
    'selenium-css'
];

const CONTROL_DEFINITIONS = [
    {
        id: 'locator-repair-sample-select',
        label: 'Sample selector',
        description: 'Chooses an app-shaped failure case to load into the analyzer form.',
        interaction: 'Use it to compare link-text drift, button-label drift, and form-field drift patterns.'
    },
    {
        id: 'locator-repair-load-sample-btn',
        label: 'Load Sample',
        description: 'Copies the selected sample case into the original locator, goal, and HTML snippet fields.',
        interaction: 'Use it when you want a concrete failure case before trying your own snippet.'
    },
    {
        id: 'locator-repair-analyze-btn',
        label: 'Suggest Repairs',
        description: 'Runs the deterministic candidate generator plus the trained reranker against the current locator and HTML snippet.',
        interaction: 'Use it after pasting the failing locator, the step goal, and the current DOM fragment.'
    },
    {
        id: 'locator-repair-train-btn',
        label: 'Train Model',
        description: 'Retrains the self-healing model from bootstrap samples plus accepted and rejected repair history.',
        interaction: 'Use it after collecting feedback or when you want to refresh the persisted self-heal artifact.'
    },
    {
        id: 'locator-repair-refresh-history-btn',
        label: 'Refresh History',
        description: 'Reloads the latest feedback summary and recent repair outcomes.',
        interaction: 'Use it after recording accepted, rejected, or healed suggestions.'
    },
    {
        id: 'locator-repair-html-snippet',
        label: 'HTML snippet input',
        description: 'Accepts the current DOM fragment around the intended element.',
        interaction: 'Paste the narrowest useful snippet so the ranking logic can focus on realistic candidates.'
    }
];

const WORKFLOW = [
    {
        label: 'Capture the failure',
        description: 'Start with the exact broken locator string from Playwright or Selenium plus the step intent.'
    },
    {
        label: 'Paste the current DOM',
        description: 'Provide a focused HTML snippet around the intended element instead of the whole page.'
    },
    {
        label: 'Generate deterministic candidates',
        description: 'The engine extracts interactive candidates and scores stable signals such as data-testid, id, href, name, role, and placeholder attributes.'
    },
    {
        label: 'Rerank with the trained model',
        description: 'A logistic reranker uses those signals plus repair history to estimate which candidate is most likely to heal the broken step.'
    },
    {
        label: 'Verify before continuing',
        description: 'Self-healing is only considered safe after the new locator passes a deterministic runtime check for the intended step.'
    }
];

const REPAIR_LADDER = [
    {
        label: 'Prefer data-testid when available',
        description: 'A dedicated test id is usually the most stable repair because it decouples tests from visible copy and layout shifts.'
    },
    {
        label: 'Fall back to id or name',
        description: 'Stable form control identifiers are usually safer than text locators, especially when UI copy is edited frequently.'
    },
    {
        label: 'Use role plus accessible name for user-facing controls',
        description: 'Buttons and links can still be resilient when role and label stay aligned with the product experience.'
    },
    {
        label: 'Treat href and placeholder as purpose-specific signals',
        description: 'Inputs and navigation links often expose stable attributes that survive cosmetic changes better than surrounding DOM structure.'
    },
    {
        label: 'Allow self-heal only behind verification',
        description: 'Even a strong ML-ranked repair still needs a deterministic follow-up check before it should be trusted at runtime.'
    }
];

const SUPPORTED_SIGNALS = [
    {
        label: 'data-testid',
        description: 'Highest-stability signal when the app exposes one.'
    },
    {
        label: 'id',
        description: 'Strong signal for form fields and module controls when the id is product-owned instead of generated.'
    },
    {
        label: 'name',
        description: 'Useful for form inputs when ids change but field semantics stay the same.'
    },
    {
        label: 'href',
        description: 'Strong signal for navigation links such as Research Workspace module entry points.'
    },
    {
        label: 'role and accessible name',
        description: 'Helps keep repairs aligned with accessible UI semantics.'
    },
    {
        label: 'visible text',
        description: 'Useful for intent matching, but treated as weaker than dedicated automation attributes.'
    },
    {
        label: 'step-goal token overlap',
        description: 'Words from the failing step help the reranker distinguish between similar candidates.'
    },
    {
        label: 'accepted and rejected repair history',
        description: 'The trained model learns from accepted, rejected, and healed repair outcomes over time.'
    }
];

const SAMPLE_CASES = [
    {
        id: 'workspace-ml-link-text-drift',
        title: 'Research link text drift',
        summary: 'A Selenium linkText locator broke after the Alert Triage ML card button text changed but the route and test id stayed stable.',
        originalLocator: 'By.linkText("Open Alert Triage ML Module")',
        stepGoal: 'Open the Alert Triage ML Module from the Research Workspace',
        htmlSnippet: [
            '<div class="d-flex gap-2">',
            '    <a href="/security/module" class="btn btn-outline-dark" data-testid="research-open-security">Open Security Operations Module</a>',
            '    <a href="/ml/module" class="btn btn-outline-dark" data-testid="research-open-ml">Open Alert Triage ML Module</a>',
            '    <a href="/playwright/module" class="btn btn-outline-dark" data-testid="research-open-playwright">Open Playwright Testing Module</a>',
            '</div>'
        ].join('\n'),
        expectedCandidate: {
            dataTestId: 'research-open-ml',
            href: '/ml/module'
        }
    },
    {
        id: 'playwright-load-spec-label-drift',
        title: 'Playwright button copy drift',
        summary: 'A role-and-name locator broke after the visible button label changed but a stable id and test id were added.',
        originalLocator: 'page.getByRole("button", { name: "Load Spec" })',
        stepGoal: 'Reload the generated Playwright spec preview',
        htmlSnippet: [
            '<div class="btn-toolbar gap-2">',
            '    <button type="button" id="playwright-refresh-btn" class="btn btn-outline-dark">Refresh Module</button>',
            '    <button type="button" id="playwright-load-script-btn" data-testid="playwright-load-spec" class="btn btn-outline-dark">Load Starter Spec</button>',
            '    <button type="button" id="playwright-copy-script-btn" class="btn btn-secondary">Copy Spec</button>',
            '</div>'
        ].join('\n'),
        expectedCandidate: {
            dataTestId: 'playwright-load-spec',
            id: 'playwright-load-script-btn'
        }
    },
    {
        id: 'login-email-id-drift',
        title: 'Login field id drift',
        summary: 'A CSS id locator broke after the login field id changed but semantic attributes still identify the email input.',
        originalLocator: 'page.locator("#email")',
        stepGoal: 'Fill the login email field before submitting the form',
        htmlSnippet: [
            '<form action="/auth/login">',
            '    <label for="login-email-input">Email</label>',
            '    <input id="login-email-input" name="email" type="email" placeholder="Email address" data-testid="auth-email-input" />',
            '    <label for="login-password-input">Password</label>',
            '    <input id="login-password-input" name="password" type="password" placeholder="Password" data-testid="auth-password-input" />',
            '</form>'
        ].join('\n'),
        expectedCandidate: {
            dataTestId: 'auth-email-input',
            name: 'email'
        }
    },
    {
        id: 'workspace-selenium-link-drift',
        title: 'Selenium workspace link drift',
        summary: 'A text-driven workspace link broke after the Selenium Testing card text changed but the href and test id stayed stable.',
        originalLocator: 'By.linkText("Open Selenium Testing Module")',
        stepGoal: 'Open the Selenium Testing Module from the Research Workspace',
        htmlSnippet: [
            '<div class="d-flex gap-2">',
            '    <a href="/ml/module" class="btn btn-outline-dark" data-testid="research-open-ml">Open Alert Triage ML Module</a>',
            '    <a href="/selenium/module" class="btn btn-outline-dark" data-testid="research-open-selenium">Open Selenium Testing Module</a>',
            '    <a href="/playwright/module" class="btn btn-outline-dark" data-testid="research-open-playwright">Open Playwright Testing Module</a>',
            '</div>'
        ].join('\n'),
        expectedCandidate: {
            dataTestId: 'research-open-selenium',
            href: '/selenium/module'
        }
    },
    {
        id: 'locator-analyze-button-drift',
        title: 'Self-healing analyze button drift',
        summary: 'The analysis button label changed but the id and test id remained stable.',
        originalLocator: 'page.getByRole("button", { name: "Analyze Locator" })',
        stepGoal: 'Analyze the self-healing request',
        htmlSnippet: [
            '<div class="d-flex gap-2">',
            '    <button type="button" id="locator-repair-load-sample-btn" class="btn btn-outline-dark">Load Sample</button>',
            '    <button type="button" id="locator-repair-analyze-btn" data-testid="locator-repair-suggest" class="btn btn-dark">Suggest Repairs</button>',
            '    <button type="button" id="locator-repair-train-btn" class="btn btn-outline-primary">Train Model</button>',
            '</div>'
        ].join('\n'),
        expectedCandidate: {
            dataTestId: 'locator-repair-suggest',
            id: 'locator-repair-analyze-btn'
        }
    }
];

function normalizeBaseUrl(baseUrl) {
    const normalized = typeof baseUrl === 'string' && baseUrl.trim()
        ? baseUrl.trim()
        : DEFAULT_BASE_URL;

    return normalized.replace(/\/+$/, '');
}

function getSampleCase(sampleId = DEFAULT_SAMPLE_ID) {
    const normalizedId = typeof sampleId === 'string' && sampleId.trim()
        ? sampleId.trim()
        : DEFAULT_SAMPLE_ID;

    return SAMPLE_CASES.find((sample) => sample.id === normalizedId) || SAMPLE_CASES[0];
}

function getSampleCaseIds() {
    return SAMPLE_CASES.map((sample) => sample.id);
}

module.exports = {
    AUTO_HEAL_STRATEGIES,
    CONTROL_DEFINITIONS,
    DEFAULT_BASE_URL,
    DEFAULT_CONFIDENCE,
    DEFAULT_ENGINE_MODE,
    DEFAULT_ENGINE_NOTE,
    DEFAULT_SAMPLE_ID,
    REPAIR_LADDER,
    SAMPLE_CASES,
    SUPPORTED_LOCATOR_FAMILIES,
    SUPPORTED_SIGNALS,
    WORKFLOW,
    getSampleCase,
    getSampleCaseIds,
    normalizeBaseUrl
};
