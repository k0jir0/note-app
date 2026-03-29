const { expect } = require('chai');

const {
    createImmutableLogClient,
    installGlobalConsoleMirror
} = require('../src/utils/immutableLogService');

describe('immutable log service', () => {
    it('sends append-only log entries to the remote sink', async () => {
        const calls = [];
        const client = createImmutableLogClient({
            immutableLogging: {
                enabled: true,
                endpoint: 'https://logs.example.com/append',
                token: 'write-only-token',
                timeoutMs: 2000,
                source: 'note-app-web',
                format: 'json'
            }
        }, {
            fetchImpl: async (url, options) => {
                calls.push({ url, options, body: JSON.parse(options.body) });
                return { ok: true, status: 202 };
            },
            osLib: { hostname: () => 'host-a' }
        });

        const sent = await client.audit('HTTP request completed', {
            category: 'http-request',
            statusCode: 403
        });

        expect(sent).to.equal(true);
        expect(calls).to.have.length(1);
        expect(calls[0].url).to.equal('https://logs.example.com/append');
        expect(calls[0].options.method).to.equal('POST');
        expect(calls[0].options.headers.Authorization).to.equal('Bearer write-only-token');
        expect(calls[0].options.headers['X-Log-Format']).to.equal('json');
        expect(calls[0].body.source).to.equal('note-app-web');
        expect(calls[0].body.host).to.equal('host-a');
        expect(calls[0].body.level).to.equal('audit');
        expect(calls[0].body.format).to.equal('json');
        expect(calls[0].body.metadata).to.deep.include({
            category: 'http-request',
            statusCode: 403
        });
        expect(calls[0].body.entryHash).to.be.a('string').with.length.greaterThan(10);
    });

    it('formats immutable log entries as RFC 5424 syslog when configured', async () => {
        const calls = [];
        const client = createImmutableLogClient({
            immutableLogging: {
                enabled: true,
                endpoint: 'https://logs.example.com/append',
                token: 'write-only-token',
                timeoutMs: 2000,
                source: 'note-app-web',
                format: 'syslog'
            }
        }, {
            fetchImpl: async (url, options) => {
                calls.push({ url, options });
                return { ok: true, status: 202 };
            },
            osLib: { hostname: () => 'host-a' },
            clock: () => new Date('2026-03-29T12:00:00.000Z')
        });

        const sent = await client.error('Security incident observed', {
            category: 'db-state-change',
            statusCode: 500
        });

        expect(sent).to.equal(true);
        expect(calls).to.have.length(1);
        expect(calls[0].options.headers['Content-Type']).to.equal('text/plain; charset=utf-8');
        expect(calls[0].options.headers['X-Log-Format']).to.equal('syslog');
        expect(calls[0].options.body).to.match(/^<131>1 2026-03-29T12:00:00.000Z host-a note-app-web - - \[note-app@48577 /);
        expect(calls[0].options.body).to.include('"message":"Security incident observed"');
        expect(calls[0].options.body).to.include('"category":"db-state-change"');
    });

    it('mirrors console methods into immutable logs', async () => {
        const sentEntries = [];
        const consoleDouble = {
            log: () => {},
            info: () => {},
            warn: () => {},
            error: () => {}
        };
        const client = {
            enabled: true,
            capture: async (level, message, metadata) => {
                sentEntries.push({ level, message, metadata });
                return true;
            }
        };

        const restore = installGlobalConsoleMirror(client, { consoleRef: consoleDouble });
        consoleDouble.error('Security incident observed', { statusCode: 500 });
        await new Promise((resolve) => setTimeout(resolve, 0));
        restore();

        expect(sentEntries).to.have.length(1);
        expect(sentEntries[0].level).to.equal('error');
        expect(sentEntries[0].message).to.include('Security incident observed');
        expect(sentEntries[0].metadata.channel).to.equal('console');
    });
});