import { describe, expect, it } from '@jest/globals';
import { deobfuscate, extractEmails, hintLinks, normalizeUrl, parseOverpass, pool, rankEmails, scoreEmail } from '../jobHunt';

describe('jobHunt', () => {
  it('extracts and de-obfuscates emails', () => {
    const html = '<a href="mailto:Careers@Acme.sa">x</a> info [at] acme [dot] sa hr&#64;acme.sa logo@2x.png';
    expect(rankEmails(extractEmails(html))).toEqual(['careers@acme.sa', 'hr@acme.sa', 'info@acme.sa']);
    expect(deobfuscate('a (at) b (dot) com')).toBe('a@b.com');
  });

  it('prefers hiring addresses and drops junk', () => {
    expect(scoreEmail('jobs@x.com')).toBe(3);
    expect(scoreEmail('info@x.com')).toBe(1);
    expect(scoreEmail('ali@x.com')).toBe(0);
    expect(scoreEmail('chris@x.com')).toBe(0);
    expect(scoreEmail('hr.dept@x.com')).toBe(3);
    expect(scoreEmail('noreply@x.com')).toBeNull();
    expect(scoreEmail('abc@sentry.io')).toBeNull();
  });

  it('finds same-site careers/contact links only', () => {
    const html = '<a href="/careers">Join</a><a href="https://other.com/jobs">x</a><a href="/menu">Menu</a><a href="/ar/تواصل">تواصل معنا</a>';
    expect(hintLinks(html, 'https://www.acme.sa/')).toEqual(['https://www.acme.sa/careers', expect.stringContaining('https://www.acme.sa/ar/')]);
  });

  it('parses overpass results', () => {
    const list = parseOverpass({
      elements: [
        { type: 'node', id: 1, lat: 21, lon: 39, tags: { name: 'Acme', website: 'acme.sa', office: 'company' } },
        { type: 'way', id: 2, center: { lat: 21.1, lon: 39.1 }, tags: { name: 'Beta', 'contact:email': 'hr@beta.sa;info@beta.sa' } },
        { type: 'node', id: 3, lat: 21, lon: 39, tags: { name: 'Acme', website: 'acme.sa' } },
        { type: 'node', id: 4, tags: { name: 'NoCoords', website: 'x.sa' } },
      ],
    });
    expect(list.map((c) => c.name)).toEqual(['Acme', 'Beta']);
    expect(list[0]).toMatchObject({ website: 'https://acme.sa/', status: 'pending', emails: [] });
    expect(list[1]).toMatchObject({ emails: ['hr@beta.sa', 'info@beta.sa'], status: 'done' });
    expect(normalizeUrl('')).toBeNull();
  });

  it('runs a bounded pool', async () => {
    let live = 0;
    let peak = 0;
    const done: number[] = [];
    await pool([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      peak = Math.max(peak, ++live);
      await new Promise((r) => setTimeout(r, 5));
      live--;
      done.push(n);
    });
    expect(peak).toBe(3);
    expect(done.sort()).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});
