const { expect } = require('chai');

const {
    buildBlockedPayload,
    enforceBreakGlass,
    isApiRequest,
    isBypassPath
} = require('../src/middleware/breakGlass');
const { buildBreakGlassState } = require('../src/services/breakGlassService');

function createRes() {
    return {
        locals: {},
        statusCode: 200,
        payload: null,
        redirectedTo: null,
        rendered: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.payload = body;
            return body;
        },
        redirect(location) {
            this.redirectedTo = location;
            return location;
        },
        render(view, locals) {
            this.rendered = { view, locals };
            return this.rendered;
        }
    };
}

describe('Break-glass middleware', () => {
    it('identifies API-style requests and bypass paths', () => {
        expect(isApiRequest({ path: '/api/notes', get: () => '' })).to.equal(true);
        expect(isApiRequest({ path: '/notes', get: () => 'application/json' })).to.equal(true);
        expect(isBypassPath('/emergency')).to.equal(true);
        expect(isBypassPath('/api/runtime/break-glass')).to.equal(true);
        expect(isBypassPath('/notes')).to.equal(false);
    });

    it('redirects page traffic to the emergency page when offline mode is active', () => {
        const req = {
            method: 'GET',
            path: '/notes',
            get: () => 'text/html',
            app: { locals: { breakGlass: buildBreakGlassState({ mode: 'offline', reason: 'Incident response', activatedBy: 'operator@example.com' }) } }
        };
        const res = createRes();
        let nextCalled = false;

        enforceBreakGlass(req, res, () => {
            nextCalled = true;
        });

        expect(nextCalled).to.equal(false);
        expect(res.redirectedTo).to.equal('/emergency');
    });

    it('returns a 503 JSON response for blocked offline API requests', () => {
        const state = buildBreakGlassState({ mode: 'offline', reason: 'Containment', activatedBy: 'operator@example.com' });
        const req = {
            method: 'GET',
            path: '/api/notes',
            get: () => 'application/json',
            app: { locals: { breakGlass: state } }
        };
        const res = createRes();

        enforceBreakGlass(req, res, () => {});

        expect(res.statusCode).to.equal(503);
        expect(res.payload).to.deep.equal(buildBlockedPayload(state));
    });

    it('renders the emergency page for blocked read-only write requests', () => {
        const req = {
            method: 'POST',
            path: '/notes',
            get: () => 'text/html',
            app: { locals: { breakGlass: buildBreakGlassState({ mode: 'read_only', reason: 'Preserve evidence', activatedBy: 'admin@example.com' }) } }
        };
        const res = createRes();

        enforceBreakGlass(req, res, () => {});

        expect(res.statusCode).to.equal(503);
        expect(res.rendered.view).to.equal('pages/emergency');
        expect(res.rendered.locals.breakGlass.mode).to.equal('read_only');
    });

    it('allows safe read requests through in read-only mode', () => {
        const req = {
            method: 'GET',
            path: '/notes',
            get: () => 'text/html',
            app: { locals: { breakGlass: buildBreakGlassState({ mode: 'read_only', reason: 'Preserve evidence', activatedBy: 'admin@example.com' }) } }
        };
        const res = createRes();
        let nextCalled = false;

        enforceBreakGlass(req, res, () => {
            nextCalled = true;
        });

        expect(nextCalled).to.equal(true);
        expect(res.statusCode).to.equal(200);
    });
});
