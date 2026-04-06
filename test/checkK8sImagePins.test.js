const { expect } = require('chai');

const {
    checkKubernetesSupportImages
} = require('../scripts/check-k8s-image-pins');

describe('Kubernetes support-image checks', () => {
    it('accepts digest-pinned support images with explicit resource bounds', () => {
        const manifestText = [
            '        - name: mongo',
            '          image: docker.io/library/mongo:7@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            '          resources:',
            '            requests:',
            '              cpu: 100m',
            '              memory: 256Mi',
            '            limits:',
            '              cpu: 500m',
            '              memory: 512Mi',
            '          securityContext:',
            '            allowPrivilegeEscalation: false',
            '---',
            '        - name: proxy',
            '          image: docker.io/library/nginx:1.27-alpine@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
            '          resources:',
            '            requests:',
            '              cpu: 100m',
            '              memory: 128Mi',
            '            limits:',
            '              cpu: 300m',
            '              memory: 256Mi',
            '          securityContext:',
            '            allowPrivilegeEscalation: false',
            ''
        ].join('\n');

        const result = checkKubernetesSupportImages({ manifestText });

        expect(result).to.deep.equal({
            mongo: 'docker.io/library/mongo:7@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            proxy: 'docker.io/library/nginx:1.27-alpine@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
        });
    });

    it('rejects mutable support image tags', () => {
        const manifestText = [
            '        - name: mongo',
            '          image: docker.io/library/mongo:7',
            '          resources:',
            '            requests:',
            '              cpu: 100m',
            '              memory: 256Mi',
            '            limits:',
            '              cpu: 500m',
            '              memory: 512Mi',
            '          securityContext:',
            '            allowPrivilegeEscalation: false',
            '---',
            '        - name: proxy',
            '          image: docker.io/library/nginx:1.27-alpine@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
            '          resources:',
            '            requests:',
            '              cpu: 100m',
            '              memory: 128Mi',
            '            limits:',
            '              cpu: 300m',
            '              memory: 256Mi',
            '          securityContext:',
            '            allowPrivilegeEscalation: false',
            ''
        ].join('\n');

        expect(() => checkKubernetesSupportImages({ manifestText })).to.throw('mongo image must be pinned by immutable digest.');
    });
});
