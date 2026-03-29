const fs = require('fs');
const path = require('path');

const {
    DEFAULT_SOURCE,
    buildEntryHash,
    buildRequestPayload
} = require('../utils/immutableLogService');

const PROJECT_ROOT = path.join(__dirname, '..', '..');

function safeReadText(filePath, fallback = '') {
    try {
        return fs.readFileSync(filePath, 'utf8');
    } catch (_error) {
        return fallback;
    }
}

function safeReadJson(filePath, fallback) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (_error) {
        return fallback;
    }
}

function isDevelopmentComponent(component = {}) {
    const properties = Array.isArray(component.properties) ? component.properties : [];
    return properties.some((property) => property && property.name === 'cdx:npm:package:development' && property.value === 'true');
}

function readLicenseLabel(component = {}) {
    const licenses = Array.isArray(component.licenses) ? component.licenses : [];
    if (!licenses.length) {
        return 'Unknown';
    }

    const first = licenses[0] || {};
    if (first.license && first.license.id) {
        return first.license.id;
    }

    if (first.expression) {
        return first.expression;
    }

    return 'Unknown';
}

function sortByCountThenLabel(entries = []) {
    return entries.sort((left, right) => {
        if (right.count !== left.count) {
            return right.count - left.count;
        }

        return String(left.label).localeCompare(String(right.label));
    });
}

function buildLicenseSummary(components = []) {
    const counts = components.reduce((accumulator, component) => {
        const label = readLicenseLabel(component);
        accumulator[label] = (accumulator[label] || 0) + 1;
        return accumulator;
    }, {});

    return sortByCountThenLabel(Object.entries(counts).map(([label, count]) => ({ label, count }))).slice(0, 8);
}

function buildTopComponents(components = []) {
    return components
        .slice()
        .sort((left, right) => {
            if (isDevelopmentComponent(left) !== isDevelopmentComponent(right)) {
                return Number(isDevelopmentComponent(left)) - Number(isDevelopmentComponent(right));
            }

            return `${left.name || ''}${left.version || ''}`.localeCompare(`${right.name || ''}${right.version || ''}`);
        })
        .slice(0, 12)
        .map((component) => ({
            name: component.name || 'unknown',
            version: component.version || 'unknown',
            scope: isDevelopmentComponent(component) ? 'Development' : 'Production',
            license: readLicenseLabel(component),
            purl: component.purl || ''
        }));
}

function buildContainerChecks({ dockerfileText, dockerignoreText, securityWorkflowText }) {
    return [
        {
            label: 'Distroless runtime image',
            passed: /FROM\s+gcr\.io\/distroless\//i.test(dockerfileText),
            detail: 'The runtime stage uses a distroless Node image instead of a general-purpose Linux base.'
        },
        {
            label: 'Non-root container execution',
            passed: /:nonroot/i.test(dockerfileText) || /--chown=nonroot:nonroot/i.test(dockerfileText),
            detail: 'The final image is built around the nonroot distroless variant and copies files with nonroot ownership.'
        },
        {
            label: 'Production-only dependency install',
            passed: /npm\s+ci\s+--omit=dev/i.test(dockerfileText),
            detail: 'The build installs only runtime dependencies in the container path.'
        },
        {
            label: 'Tight Docker build context',
            passed: Boolean(dockerignoreText.trim()),
            detail: 'A .dockerignore file keeps secrets, tests, local logs, and other non-runtime files out of the image context.'
        },
        {
            label: 'CI scans the built app image',
            passed: /docker build --tag note-app:ci/i.test(securityWorkflowText) && /image-ref:\s*'note-app:ci'/i.test(securityWorkflowText),
            detail: 'The security workflow scans the app image produced by this repo, not a placeholder base image.'
        }
    ];
}

function buildSupplyChainModuleViewModel({ projectRoot = PROJECT_ROOT } = {}) {
    const packageJson = safeReadJson(path.join(projectRoot, 'package.json'), {});
    const sbom = safeReadJson(path.join(projectRoot, 'sbom', 'note-app.cdx.json'), {
        metadata: {},
        components: []
    });
    const dockerfileText = safeReadText(path.join(projectRoot, 'Dockerfile'));
    const dockerignoreText = safeReadText(path.join(projectRoot, '.dockerignore'));
    const securityWorkflowText = safeReadText(path.join(projectRoot, '.github', 'workflows', 'security-scan.yml'));
    const dependencyWorkflowText = safeReadText(path.join(projectRoot, '.github', 'workflows', 'dependency-audit.yml'));
    const components = Array.isArray(sbom.components) ? sbom.components : [];
    const developmentComponents = components.filter((component) => isDevelopmentComponent(component));
    const productionComponents = components.filter((component) => !isDevelopmentComponent(component));
    const scripts = packageJson && packageJson.scripts ? packageJson.scripts : {};
    const auditScripts = ['audit:deps', 'audit:prod', 'audit:report', 'sbom:generate']
        .filter((scriptName) => typeof scripts[scriptName] === 'string')
        .map((scriptName) => ({
            name: scriptName,
            command: scripts[scriptName]
        }));
    const componentMetadata = sbom && sbom.metadata && sbom.metadata.component ? sbom.metadata.component : {};
    const toolMetadata = Array.isArray(sbom && sbom.metadata && sbom.metadata.tools) ? sbom.metadata.tools[0] : null;

    return {
        summary: {
            totalComponents: components.length,
            productionComponents: productionComponents.length,
            developmentComponents: developmentComponents.length,
            auditScriptCount: auditScripts.length,
            hardeningCheckCount: buildContainerChecks({ dockerfileText, dockerignoreText, securityWorkflowText }).filter((check) => check.passed).length
        },
        sbom: {
            generatedAt: sbom && sbom.metadata && sbom.metadata.timestamp ? sbom.metadata.timestamp : 'Unavailable',
            format: sbom && sbom.bomFormat ? sbom.bomFormat : 'Unknown',
            specVersion: sbom && sbom.specVersion ? sbom.specVersion : 'Unknown',
            projectName: componentMetadata.name || packageJson.name || 'note-app',
            projectVersion: componentMetadata.version || packageJson.version || '0.0.0',
            toolName: toolMetadata && toolMetadata.name ? toolMetadata.name : 'Unknown',
            toolVersion: toolMetadata && toolMetadata.version ? toolMetadata.version : 'Unknown'
        },
        auditScripts,
        licenseSummary: buildLicenseSummary(components),
        topComponents: buildTopComponents(components),
        containerChecks: buildContainerChecks({ dockerfileText, dockerignoreText, securityWorkflowText }),
        workflowChecks: [
            {
                label: 'Dependency audit workflow present',
                passed: Boolean(dependencyWorkflowText.trim()),
                detail: 'The repository includes a dedicated dependency-audit workflow for npm audit enforcement.'
            },
            {
                label: 'Security scan workflow present',
                passed: Boolean(securityWorkflowText.trim()),
                detail: 'The repository includes a security scan workflow that publishes Trivy scan artifacts.'
            }
        ]
    };
}

function buildSampleTelemetryEvent() {
    return {
        category: 'db-state-change',
        who: {
            type: 'user',
            userId: '6629b1f0c8c4c1f0f4a10123',
            email: 'analyst@example.com'
        },
        what: {
            model: 'Notes',
            action: 'update',
            documentId: '6629b1f0c8c4c1f0f4a10999',
            before: {
                id: '6629b1f0c8c4c1f0f4a10999',
                topLevelKeys: ['_id', 'content', 'title', 'updatedAt', 'userId'],
                snapshotHash: '3d4e64f0b3b996bdba66750be53b30ca90aa9b2c3f2d773340d6d34edfc41811'
            },
            after: {
                id: '6629b1f0c8c4c1f0f4a10999',
                topLevelKeys: ['_id', 'content', 'title', 'updatedAt', 'userId'],
                snapshotHash: '6ced05658cb7e3a616463a7fe30173d4e67644fdd5f6ba4f8bccebc76dcf58ce'
            },
            changeSet: {
                operators: ['$set'],
                changedPaths: ['content', 'title'],
                updateHash: 'ce6315129fc1fd7cb753c64cd6ef0dd3aa9adca47999fefaf35f8454deb48f2d'
            }
        },
        when: '2026-03-29T18:22:14.000Z',
        where: {
            channel: 'http',
            requestId: 'req-29-mar-audit-lab',
            method: 'POST',
            path: '/api/notes/6629b1f0c8c4c1f0f4a10999',
            ip: '203.0.113.24',
            userAgent: 'Mozilla/5.0 Research Workspace'
        },
        how: {
            mechanism: 'findOneAndUpdate',
            telemetryVersion: 1
        }
    };
}

function buildImmutablePreview({ immutableLogging = {} } = {}) {
    const sampleEvent = buildSampleTelemetryEvent();
    const entry = {
        schemaVersion: 1,
        application: 'note-app',
        source: immutableLogging.source || DEFAULT_SOURCE,
        host: 'research-workspace',
        level: 'audit',
        message: 'Database state changed',
        metadata: sampleEvent,
        timestamp: sampleEvent.when,
        sequence: 1,
        previousHash: ''
    };
    const entryHash = buildEntryHash(entry);

    return {
        sampleEvent,
        jsonPreview: buildRequestPayload(entry, entryHash, 'json').body,
        syslogPreview: buildRequestPayload(entry, entryHash, 'syslog').body,
        entryHash
    };
}

function buildAuditTelemetryModuleViewModel({ appLocals = {} } = {}) {
    const runtimeConfig = appLocals && appLocals.runtimeConfig ? appLocals.runtimeConfig : {};
    const immutableLogging = appLocals && appLocals.immutableLogging
        ? appLocals.immutableLogging
        : (runtimeConfig.immutableLogging || {});
    const transport = appLocals && appLocals.transportSecurity
        ? appLocals.transportSecurity
        : (runtimeConfig.transport || {});
    const immutablePreview = buildImmutablePreview({ immutableLogging });
    const postureChecks = [
        {
            label: 'Immutable log forwarding',
            passed: Boolean(immutableLogging.enabled),
            detail: immutableLogging.enabled
                ? `Forwarding to ${immutableLogging.endpoint || 'configured sink'} with ${immutableLogging.format || 'json'} formatting.`
                : 'Disabled in the current runtime configuration.'
        },
        {
            label: 'SIEM formatting',
            passed: ['json', 'syslog'].includes(String(immutableLogging.format || 'json')),
            detail: `The runtime can emit ${String(immutableLogging.format || 'json').toUpperCase()} payloads for downstream collectors.`
        },
        {
            label: 'TLS 1.3 transport posture',
            passed: Boolean(transport.httpsEnabled) && transport.tlsMinVersion === 'TLSv1.3' && transport.tlsMaxVersion === 'TLSv1.3',
            detail: transport.httpsEnabled
                ? `HTTPS is enabled with ${transport.tlsMinVersion || 'TLSv1.3'} to ${transport.tlsMaxVersion || 'TLSv1.3'} only.`
                : 'The current runtime is using HTTP, but the hardened HTTPS mode is locked to TLS 1.3 only when enabled.'
        },
        {
            label: 'Request-scoped DB telemetry',
            passed: true,
            detail: 'Create, update, delete, and tracked bulk-write mutations emit Who/What/When/Where/How audit envelopes.'
        },
        {
            label: 'Sanitized client-facing metadata',
            passed: true,
            detail: 'Response banners and raw internal error details are intentionally suppressed before reaching the client.'
        }
    ];

    return {
        summary: {
            immutableLoggingEnabled: Boolean(immutableLogging.enabled),
            format: String(immutableLogging.format || 'json').toUpperCase(),
            tlsMode: transport.httpsEnabled ? `${transport.tlsMinVersion || 'TLSv1.3'} only` : 'HTTP / local-dev mode',
            telemetryCoverageCount: 4
        },
        immutableLogging: {
            enabled: Boolean(immutableLogging.enabled),
            endpoint: immutableLogging.endpoint || 'Not configured',
            source: immutableLogging.source || DEFAULT_SOURCE,
            timeoutMs: Number.isFinite(immutableLogging.timeoutMs) ? immutableLogging.timeoutMs : 2000,
            format: String(immutableLogging.format || 'json').toUpperCase()
        },
        transport: {
            protocol: transport.protocol || 'http',
            httpsEnabled: Boolean(transport.httpsEnabled),
            tlsMinVersion: transport.tlsMinVersion || 'TLSv1.3',
            tlsMaxVersion: transport.tlsMaxVersion || 'TLSv1.3',
            requestClientCertificate: Boolean(transport.requestClientCertificate),
            requireClientCertificate: Boolean(transport.requireClientCertificate)
        },
        telemetryCoverage: [
            {
                action: 'Create',
                detail: 'save and insertMany flows record the created document snapshot and top-level keys.'
            },
            {
                action: 'Update',
                detail: 'save, findOneAndUpdate, updateOne, updateMany, and telemetry-aware bulk writes record changed paths and before/after hashes.'
            },
            {
                action: 'Delete',
                detail: 'findOneAndDelete, deleteOne, deleteMany, and tracked bulk deletes preserve the pre-delete snapshot summary.'
            },
            {
                action: 'Request context',
                detail: 'Each event includes actor identity, request method, path, IP, and user agent when the change came from HTTP.'
            }
        ],
        postureChecks,
        immutablePreview: {
            sampleEventJson: JSON.stringify(immutablePreview.sampleEvent, null, 2),
            jsonPayload: JSON.stringify(JSON.parse(immutablePreview.jsonPreview), null, 2),
            syslogPayload: immutablePreview.syslogPreview,
            entryHash: immutablePreview.entryHash
        },
        responseHardening: [
            'Server banners like X-Powered-By are disabled before responses leave the app.',
            'Client-visible errors are sanitized so stack traces and internal implementation details are not exposed.',
            'Immutable request auditing mirrors operationally important events without weakening the primary request flow.'
        ]
    };
}

module.exports = {
    buildSupplyChainModuleViewModel,
    buildAuditTelemetryModuleViewModel
};