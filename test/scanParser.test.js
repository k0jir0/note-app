const { expect } = require('chai');

const { parseScanInput, detectFormat, getPortSeverity } = require('../src/utils/scanParser');

describe('Scan Parser Utility', () => {
    describe('detectFormat()', () => {
        it('detects Nmap XML format', () => {
            expect(detectFormat('<nmaprun scanner="nmap">')).to.equal('nmap');
        });

        it('detects Nikto text format', () => {
            expect(detectFormat('- Nikto v2.1.6\n+ Target IP: 10.0.0.1')).to.equal('nikto');
        });

        it('detects JSON format', () => {
            expect(detectFormat('{"target":"10.0.0.1","findings":[]}')).to.equal('json');
        });

        it('falls back to text format', () => {
            expect(detectFormat('22/tcp open ssh')).to.equal('text');
        });
    });

    describe('getPortSeverity()', () => {
        it('marks RDP (3389) as high risk', () => {
            expect(getPortSeverity(3389)).to.equal('high');
        });

        it('marks SSH (22) as medium risk', () => {
            expect(getPortSeverity(22)).to.equal('medium');
        });

        it('marks HTTP (80) as low risk', () => {
            expect(getPortSeverity(80)).to.equal('low');
        });
    });

    describe('parseScanInput() - Nikto', () => {
        it('parses Nikto text and extracts findings', () => {
            const input = [
                '- Nikto v2.1.6',
                '---------------------------------------------------------------------------',
                '+ Target IP:          10.10.10.1',
                '+ Target Hostname:    target.local',
                '+ Target Port:        80',
                '---------------------------------------------------------------------------',
                '+ /admin/: Admin directory found.',
                '+ OSVDB-3233: /icons/README: Apache default file found.',
                '+ OSVDB-3268: /phpmyadmin/: phpMyAdmin found.'
            ].join('\n');

            const result = parseScanInput(input);

            expect(result.tool).to.equal('nikto');
            expect(result.target).to.equal('target.local');
            expect(result.findings.length).to.be.at.least(3);
        });

        it('assigns high severity to admin path findings', () => {
            const input = [
                '- Nikto v2.1.6',
                '+ Target IP: 10.0.0.1',
                '+ /admin/: Admin directory found.'
            ].join('\n');

            const result = parseScanInput(input);
            const adminFinding = result.findings.find((f) => /admin/i.test(f.title));

            expect(adminFinding).to.exist;
            expect(adminFinding.severity).to.equal('high');
        });
    });

    describe('parseScanInput() - Nmap XML', () => {
        it('parses Nmap XML and extracts open ports', () => {
            const input = `<?xml version="1.0"?>
<nmaprun scanner="nmap">
  <host>
    <address addr="192.168.1.100" addrtype="ipv4"/>
    <ports>
      <port protocol="tcp" portid="22">
        <state state="open" reason="syn-ack"/>
        <service name="ssh" product="OpenSSH" version="7.9"/>
      </port>
      <port protocol="tcp" portid="3389">
        <state state="open" reason="syn-ack"/>
        <service name="ms-wbt-server"/>
      </port>
      <port protocol="tcp" portid="8080">
        <state state="closed" reason="reset"/>
        <service name="http-proxy"/>
      </port>
    </ports>
  </host>
</nmaprun>`;

            const result = parseScanInput(input);

            expect(result.tool).to.equal('nmap');
            expect(result.target).to.equal('192.168.1.100');
            expect(result.findings).to.have.length(2);
            const rdp = result.findings.find((f) => f.details.port === 3389);
            expect(rdp).to.exist;
            expect(rdp.severity).to.equal('high');
        });
    });

    describe('parseScanInput() - JSON', () => {
        it('parses a JSON findings array', () => {
            const input = JSON.stringify([
                { title: 'SQL injection in /search', severity: 'high', type: 'vulnerability' },
                { title: 'Missing security headers', severity: 'medium', type: 'misconfiguration' }
            ]);

            const result = parseScanInput(input);

            expect(result.tool).to.equal('json');
            expect(result.findings).to.have.length(2);
            expect(result.findings[0].severity).to.equal('high');
        });
    });

    describe('parseScanInput() - generic text', () => {
        it('extracts open ports from plain text nmap-style output', () => {
            const input = [
                '22/tcp   open  ssh',
                '80/tcp   open  http',
                '3389/tcp open  ms-wbt-server'
            ].join('\n');

            const result = parseScanInput(input);

            expect(result.tool).to.equal('text');
            expect(result.findings).to.have.length(3);
            const rdp = result.findings.find((f) => f.details.port === 3389);
            expect(rdp.severity).to.equal('high');
        });

        it('extracts CVE references from plain text', () => {
            const input = [
                'Host is vulnerable to CVE-2021-44228 (Log4Shell)',
                'CVE-2021-44228 allows remote code execution.'
            ].join('\n');

            const result = parseScanInput(input);

            const cveFinding = result.findings.find((f) => f.type === 'vulnerability');
            expect(cveFinding).to.exist;
            expect(cveFinding.severity).to.equal('high');
        });
    });

    describe('parseScanInput() - edge cases', () => {
        it('returns empty findings for empty input', () => {
            const result = parseScanInput('');

            expect(result.findings).to.have.length(0);
            expect(result.linesAnalyzed).to.equal(0);
        });

        it('handles non-string input gracefully', () => {
            const result = parseScanInput(null);

            expect(result.findings).to.have.length(0);
        });
    });
});
