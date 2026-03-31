const { expect } = require('chai');

const router = require('../src/routes/breakGlassRoutes');
const { requireAuthAPI } = require('../src/middleware/auth');
const { buildBreakGlassState } = require('../src/services/breakGlassService');

function findRouteLayer(method, path) {
    return router.stack.find((layer) => layer.route && layer.route.path === path && layer.route.methods[method]);
}

function createRes() {
    return {
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

describe('Break-glass routes', () => {
    it('registers the emergency page and runtime control endpoints', () => {
        const routeLayers = router.stack.filter((layer) => layer.route);
        expect(routeLayers).to.have.length(3);
    });

    it('protects the runtime control endpoints with API auth', () => {
        const getLayer = findRouteLayer('get', '/api/runtime/break-glass');
        const postLayer = findRouteLayer('post', '/api/runtime/break-glass');

        expect(getLayer.route.stack[0].handle).to.equal(requireAuthAPI);
        expect(postLayer.route.stack[0].handle).to.equal(requireAuthAPI);
    });

    it('renders the emergency page with 503 when break-glass mode is active', async () => {
        const layer = findRouteLayer('get', '/emergency');
        const req = {
            app: {
                locals: {
                    breakGlass: buildBreakGlassState({ mode: 'offline', reason: 'Containment', activatedBy: 'operator@example.com' })
                }
            }
        };
        const res = createRes();

        await layer.route.stack[0].handle(req, res);

        expect(res.statusCode).to.equal(503);
        expect(res.rendered.view).to.equal('pages/emergency');
        expect(res.rendered.locals.breakGlass.mode).to.equal('offline');
    });

    it('returns the current break-glass state for authorized operators', async () => {
        const layer = findRouteLayer('get', '/api/runtime/break-glass');
        const req = {
            user: { accessProfile: { missionRole: 'break_glass' } },
            app: { locals: { breakGlass: buildBreakGlassState({ mode: 'read_only', reason: 'Preserve data', activatedBy: 'operator@example.com' }) } }
        };
        const res = createRes();

        await layer.route.stack[2].handle(req, res);

        expect(res.statusCode).to.equal(200);
        expect(res.payload.success).to.equal(true);
        expect(res.payload.breakGlass.mode).to.equal('read_only');
    });

    it('updates the runtime break-glass mode for authorized operators', async () => {
        const layer = findRouteLayer('post', '/api/runtime/break-glass');
        const req = {
            body: { mode: 'offline', reason: 'Containment' },
            user: {
                email: 'admin@example.com',
                accessProfile: { missionRole: 'admin' }
            },
            app: { locals: { breakGlass: buildBreakGlassState({ mode: 'disabled' }) } }
        };
        const res = createRes();

        await layer.route.stack[2].handle(req, res);

        expect(res.statusCode).to.equal(200);
        expect(req.app.locals.breakGlass.mode).to.equal('offline');
        expect(req.app.locals.breakGlass.reason).to.equal('Containment');
        expect(res.payload.success).to.equal(true);
    });
});
