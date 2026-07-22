import { describe, it, expect } from 'vitest';
import { MED_REGISTRY } from '../medLoader';
import type { GuidanceResult } from '../interfaces/guidance';
import { hasNotif, localDaysAgo } from './helpers';

function getGuidance(days: number, variant: string): GuidanceResult {
    return MED_REGISTRY['sublocade'].getLateGuidance({
        daysSince: days,
        variant,
    }) as GuidanceResult;
}

describe('sublocade booster guidance', () => {
    // Booster is now a standalone guidance type (guidance.booster), not a late variant.
    it('exposes boosterGuidance with the booster requirements', () => {
        const r = MED_REGISTRY['sublocade'].boosterGuidance as GuidanceResult;
        expect(r).toBeDefined();
        expect(
            r.idealSteps.some((s) => s.includes('booster dose may be administered any time')),
        ).toBe(true);
        expect(r.idealSteps.some((s) => s.includes('At least 24 hours'))).toBe(true);
        expect(
            r.idealSteps.some((s) => s.includes('unregulated fentanyl or other unregulated opioids')),
        ).toBe(true);
        expect(hasNotif(r.providerNotifications, 'reporting NO use of unregulated opioids')).toBe(
            true,
        );
    });

    it('is no longer selectable as a late dose/history variant', () => {
        expect(() => getGuidance(0, '100mg-booster')).toThrow();
    });
});

describe('sublocade getLateGuidance', () => {
    // ── 100 mg monthly ────────────────────────────────────────────────────────
    describe('100 mg monthly — 5 tiers', () => {
        it('≤20 days: not yet overdue', () => {
            const r = getGuidance(20, '100mg-monthly');
            expect(r.idealSteps.some((s) => s.includes('not yet overdue'))).toBe(true);
            expect(r.providerNotifications).toBeUndefined();
        });

        it('21–35 days: administer regardless (mentions 300 mg switch)', () => {
            const r = getGuidance(28, '100mg-monthly');
            expect(r.idealSteps.some((s) => s.includes('Administer the next injection'))).toBe(
                true,
            );
            expect(
                r.idealSteps.some((s) =>
                    s.includes('regardless of the level of unregulated opioid use'),
                ),
            ).toBe(true);
            expect(r.idealSteps.some((s) => s.includes('Sublocade 300 mg'))).toBe(true);
            expect(r.providerNotifications).toBeUndefined();
        });

        it('36–42 days: fentanyl assessment — moderate dependence OK (+ 300 mg note)', () => {
            const r = getGuidance(38, '100mg-monthly');
            expect(
                r.idealSteps.some((s) => s.includes('Conduct a fentanyl dependence assessment')),
            ).toBe(true);
            expect(r.idealSteps.some((s) => s.includes('moderate fentanyl dependence'))).toBe(true);
            expect(r.idealSteps.some((s) => s.includes('Sublocade 300 mg'))).toBe(true);
            expect(
                hasNotif(
                    r.providerNotifications,
                    'Consult prescriber if patient does not meet minimal/no, or moderate',
                ),
            ).toBe(true);
        });

        it('43–56 days: fentanyl assessment — minimal/no or 8 mg subl only (+ 300 mg note)', () => {
            const r = getGuidance(50, '100mg-monthly');
            expect(
                r.idealSteps.some((s) => s.includes('Conduct a fentanyl dependence assessment')),
            ).toBe(true);
            expect(
                r.idealSteps.some((s) =>
                    s.includes('8 mg of sublingual buprenorphine in the last 24 hours'),
                ),
            ).toBe(true);
            expect(r.idealSteps.some((s) => s.includes('moderate fentanyl dependence'))).toBe(
                false,
            );
            expect(r.idealSteps.some((s) => s.includes('Sublocade 300 mg'))).toBe(true);
            expect(
                hasNotif(
                    r.providerNotifications,
                    'Consult prescriber if patient does not meet minimal/no fentanyl dependence',
                ),
            ).toBe(true);
        });

        it('57+ days: consult prescriber in real-time', () => {
            const r = getGuidance(60, '100mg-monthly');
            expect(r.idealSteps.some((s) => s.includes('Consult a prescriber in real-time'))).toBe(
                true,
            );
            expect(
                hasNotif(r.providerNotifications, 'Consult prescriber before any injection'),
            ).toBe(true);
        });

        it('exact tier boundaries: 20/21, 35/36, 42/43, 56/57', () => {
            expect(
                getGuidance(20, '100mg-monthly').idealSteps.some((s) =>
                    s.includes('not yet overdue'),
                ),
            ).toBe(true);
            expect(
                getGuidance(21, '100mg-monthly').idealSteps.some((s) =>
                    s.includes('Administer the next injection'),
                ),
            ).toBe(true);
            expect(
                getGuidance(35, '100mg-monthly').idealSteps.some((s) =>
                    s.includes('Administer the next injection'),
                ),
            ).toBe(true);
            expect(
                getGuidance(36, '100mg-monthly').idealSteps.some((s) =>
                    s.includes('moderate fentanyl dependence'),
                ),
            ).toBe(true);
            expect(
                getGuidance(42, '100mg-monthly').idealSteps.some((s) =>
                    s.includes('moderate fentanyl dependence'),
                ),
            ).toBe(true);
            expect(
                getGuidance(43, '100mg-monthly').idealSteps.some((s) =>
                    s.includes('moderate fentanyl dependence'),
                ),
            ).toBe(false);
            expect(
                getGuidance(56, '100mg-monthly').idealSteps.some((s) =>
                    s.includes('8 mg of sublingual buprenorphine'),
                ),
            ).toBe(true);
            expect(
                getGuidance(57, '100mg-monthly').idealSteps.some((s) =>
                    s.includes('Consult a prescriber in real-time'),
                ),
            ).toBe(true);
        });
    });

    // ── 300 mg, fewer than 3 doses ────────────────────────────────────────────
    describe('300 mg, <3 doses — 5 tiers', () => {
        it('≤20 days: not yet overdue', () => {
            const r = getGuidance(15, '300mg-less-than-3-doses');
            expect(r.idealSteps.some((s) => s.includes('not yet overdue'))).toBe(true);
            expect(r.providerNotifications).toBeUndefined();
        });

        it('21–35 days: administer regardless (no 300 mg switch note)', () => {
            const r = getGuidance(28, '300mg-less-than-3-doses');
            expect(r.idealSteps.some((s) => s.includes('Administer the next injection'))).toBe(
                true,
            );
            expect(
                r.idealSteps.some((s) =>
                    s.includes('regardless of the level of unregulated opioid use'),
                ),
            ).toBe(true);
            expect(r.idealSteps.some((s) => s.includes('Sublocade 300 mg'))).toBe(false);
            expect(r.providerNotifications).toBeUndefined();
        });

        it('36–49 days: fentanyl assessment — moderate dependence OK', () => {
            const r = getGuidance(42, '300mg-less-than-3-doses');
            expect(
                r.idealSteps.some((s) => s.includes('Conduct a fentanyl dependence assessment')),
            ).toBe(true);
            expect(r.idealSteps.some((s) => s.includes('moderate fentanyl dependence'))).toBe(true);
            expect(
                hasNotif(
                    r.providerNotifications,
                    'Consult prescriber if patient does not meet minimal/no, or moderate',
                ),
            ).toBe(true);
        });

        it('50–56 days: fentanyl assessment — minimal/no or 8 mg subl only', () => {
            const r = getGuidance(53, '300mg-less-than-3-doses');
            expect(
                r.idealSteps.some((s) => s.includes('Conduct a fentanyl dependence assessment')),
            ).toBe(true);
            expect(
                r.idealSteps.some((s) =>
                    s.includes('8 mg of sublingual buprenorphine in the last 24 hours'),
                ),
            ).toBe(true);
            expect(r.idealSteps.some((s) => s.includes('moderate fentanyl dependence'))).toBe(
                false,
            );
            expect(
                hasNotif(
                    r.providerNotifications,
                    'Consult prescriber if patient does not meet minimal/no fentanyl dependence',
                ),
            ).toBe(true);
        });

        it('57+ days: consult prescriber in real-time', () => {
            const r = getGuidance(70, '300mg-less-than-3-doses');
            expect(r.idealSteps.some((s) => s.includes('Consult a prescriber in real-time'))).toBe(
                true,
            );
            expect(
                hasNotif(r.providerNotifications, 'Consult prescriber before any injection'),
            ).toBe(true);
        });

        it('exact tier boundaries: 20/21, 35/36, 49/50, 56/57', () => {
            expect(
                getGuidance(20, '300mg-less-than-3-doses').idealSteps.some((s) =>
                    s.includes('not yet overdue'),
                ),
            ).toBe(true);
            expect(
                getGuidance(21, '300mg-less-than-3-doses').idealSteps.some((s) =>
                    s.includes('Administer the next injection'),
                ),
            ).toBe(true);
            expect(
                getGuidance(35, '300mg-less-than-3-doses').idealSteps.some((s) =>
                    s.includes('Administer the next injection'),
                ),
            ).toBe(true);
            expect(
                getGuidance(36, '300mg-less-than-3-doses').idealSteps.some((s) =>
                    s.includes('moderate fentanyl dependence'),
                ),
            ).toBe(true);
            expect(
                getGuidance(49, '300mg-less-than-3-doses').idealSteps.some((s) =>
                    s.includes('moderate fentanyl dependence'),
                ),
            ).toBe(true);
            expect(
                getGuidance(50, '300mg-less-than-3-doses').idealSteps.some((s) =>
                    s.includes('moderate fentanyl dependence'),
                ),
            ).toBe(false);
            expect(
                getGuidance(56, '300mg-less-than-3-doses').idealSteps.some((s) =>
                    s.includes('8 mg of sublingual buprenorphine'),
                ),
            ).toBe(true);
            expect(
                getGuidance(57, '300mg-less-than-3-doses').idealSteps.some((s) =>
                    s.includes('Consult a prescriber in real-time'),
                ),
            ).toBe(true);
        });
    });

    // ── 300 mg, well-established (>2 doses) ───────────────────────────────────
    describe('300 mg, >2 doses — 5 tiers', () => {
        it('≤20 days: not yet overdue', () => {
            const r = getGuidance(10, '300mg-more-than-2-doses');
            expect(r.idealSteps.some((s) => s.includes('not yet overdue'))).toBe(true);
            expect(r.providerNotifications).toBeUndefined();
        });

        it('21–49 days: administer regardless (widest window)', () => {
            const r = getGuidance(35, '300mg-more-than-2-doses');
            expect(r.idealSteps.some((s) => s.includes('Administer the next injection'))).toBe(
                true,
            );
            expect(
                r.idealSteps.some((s) =>
                    s.includes('regardless of the level of unregulated opioid use'),
                ),
            ).toBe(true);
            expect(r.idealSteps.some((s) => s.includes('Sublocade 300 mg'))).toBe(false);
            expect(r.providerNotifications).toBeUndefined();
        });

        it('50–56 days: fentanyl assessment — moderate dependence OK', () => {
            const r = getGuidance(53, '300mg-more-than-2-doses');
            expect(
                r.idealSteps.some((s) => s.includes('Conduct a fentanyl dependence assessment')),
            ).toBe(true);
            expect(r.idealSteps.some((s) => s.includes('moderate fentanyl dependence'))).toBe(true);
            expect(
                hasNotif(
                    r.providerNotifications,
                    'Consult prescriber if patient does not meet minimal/no, or moderate',
                ),
            ).toBe(true);
        });

        it('57–70 days: fentanyl assessment — minimal/no or 8 mg subl only', () => {
            const r = getGuidance(63, '300mg-more-than-2-doses');
            expect(
                r.idealSteps.some((s) => s.includes('Conduct a fentanyl dependence assessment')),
            ).toBe(true);
            expect(
                r.idealSteps.some((s) =>
                    s.includes('8 mg of sublingual buprenorphine in the last 24 hours'),
                ),
            ).toBe(true);
            expect(r.idealSteps.some((s) => s.includes('moderate fentanyl dependence'))).toBe(
                false,
            );
            expect(
                hasNotif(
                    r.providerNotifications,
                    'Consult prescriber if patient does not meet minimal/no fentanyl dependence',
                ),
            ).toBe(true);
        });

        it('71+ days: consult prescriber in real-time', () => {
            const r = getGuidance(80, '300mg-more-than-2-doses');
            expect(r.idealSteps.some((s) => s.includes('Consult a prescriber in real-time'))).toBe(
                true,
            );
            expect(
                hasNotif(r.providerNotifications, 'Consult prescriber before any injection'),
            ).toBe(true);
        });

        it('exact tier boundaries: 20/21, 49/50, 56/57, 70/71', () => {
            expect(
                getGuidance(20, '300mg-more-than-2-doses').idealSteps.some((s) =>
                    s.includes('not yet overdue'),
                ),
            ).toBe(true);
            expect(
                getGuidance(21, '300mg-more-than-2-doses').idealSteps.some((s) =>
                    s.includes('Administer the next injection'),
                ),
            ).toBe(true);
            expect(
                getGuidance(49, '300mg-more-than-2-doses').idealSteps.some((s) =>
                    s.includes('Administer the next injection'),
                ),
            ).toBe(true);
            expect(
                getGuidance(50, '300mg-more-than-2-doses').idealSteps.some((s) =>
                    s.includes('moderate fentanyl dependence'),
                ),
            ).toBe(true);
            expect(
                getGuidance(56, '300mg-more-than-2-doses').idealSteps.some((s) =>
                    s.includes('moderate fentanyl dependence'),
                ),
            ).toBe(true);
            expect(
                getGuidance(57, '300mg-more-than-2-doses').idealSteps.some((s) =>
                    s.includes('moderate fentanyl dependence'),
                ),
            ).toBe(false);
            expect(
                getGuidance(70, '300mg-more-than-2-doses').idealSteps.some((s) =>
                    s.includes('8 mg of sublingual buprenorphine'),
                ),
            ).toBe(true);
            expect(
                getGuidance(71, '300mg-more-than-2-doses').idealSteps.some((s) =>
                    s.includes('Consult a prescriber in real-time'),
                ),
            ).toBe(true);
        });
    });

    // ── Date-derived params (buildLateParams) ─────────────────────────────────
    describe('date-derived boundaries (via buildLateParams)', () => {
        const entry = MED_REGISTRY['sublocade'];

        it('100mg-monthly: day 20 → not due; day 21 → administer; day 36 → assessment; day 57 → prescriber', () => {
            const p20 = entry.buildLateParams({
                'last-sublocade': localDaysAgo(20),
                'sublocade-type': '100mg-monthly',
            });
            const p21 = entry.buildLateParams({
                'last-sublocade': localDaysAgo(21),
                'sublocade-type': '100mg-monthly',
            });
            const p36 = entry.buildLateParams({
                'last-sublocade': localDaysAgo(36),
                'sublocade-type': '100mg-monthly',
            });
            const p57 = entry.buildLateParams({
                'last-sublocade': localDaysAgo(57),
                'sublocade-type': '100mg-monthly',
            });
            expect(p20.variant).toBe('100mg-monthly');
            expect(
                (entry.getLateGuidance(p20) as GuidanceResult).idealSteps.some((s) =>
                    s.includes('not yet overdue'),
                ),
            ).toBe(true);
            expect(
                (entry.getLateGuidance(p21) as GuidanceResult).idealSteps.some((s) =>
                    s.includes('Administer the next injection'),
                ),
            ).toBe(true);
            expect(
                (entry.getLateGuidance(p36) as GuidanceResult).idealSteps.some((s) =>
                    s.includes('moderate fentanyl dependence'),
                ),
            ).toBe(true);
            expect(
                (entry.getLateGuidance(p57) as GuidanceResult).idealSteps.some((s) =>
                    s.includes('Consult a prescriber in real-time'),
                ),
            ).toBe(true);
        });

        it('300mg-less-than-3-doses: day 35 → administer; day 36 → assessment; day 50 → minimal/no only; day 57 → prescriber', () => {
            const g = (d: number) =>
                entry.getLateGuidance(
                    entry.buildLateParams({
                        'last-sublocade': localDaysAgo(d),
                        'sublocade-type': '300mg-less-than-3-doses',
                    }),
                ) as GuidanceResult;
            expect(g(35).idealSteps.some((s) => s.includes('Administer the next injection'))).toBe(
                true,
            );
            expect(g(36).idealSteps.some((s) => s.includes('moderate fentanyl dependence'))).toBe(
                true,
            );
            expect(g(50).idealSteps.some((s) => s.includes('moderate fentanyl dependence'))).toBe(
                false,
            );
            expect(
                g(57).idealSteps.some((s) => s.includes('Consult a prescriber in real-time')),
            ).toBe(true);
        });

        it('300mg-more-than-2-doses: day 49 → administer; day 50 → assessment; day 57 → minimal/no only; day 71 → prescriber', () => {
            const g = (d: number) =>
                entry.getLateGuidance(
                    entry.buildLateParams({
                        'last-sublocade': localDaysAgo(d),
                        'sublocade-type': '300mg-more-than-2-doses',
                    }),
                ) as GuidanceResult;
            expect(g(49).idealSteps.some((s) => s.includes('Administer the next injection'))).toBe(
                true,
            );
            expect(g(50).idealSteps.some((s) => s.includes('moderate fentanyl dependence'))).toBe(
                true,
            );
            expect(g(57).idealSteps.some((s) => s.includes('moderate fentanyl dependence'))).toBe(
                false,
            );
            expect(
                g(71).idealSteps.some((s) => s.includes('Consult a prescriber in real-time')),
            ).toBe(true);
        });

        it('validates: missing date field', () => {
            expect(entry.validateLate({ 'sublocade-type': '100mg-monthly' })).toMatch(/date/i);
        });

        it('validates: missing type field', () => {
            expect(entry.validateLate({ 'last-sublocade': localDaysAgo(30) })).toMatch(/dose/i);
        });

        it('validates: both fields present → null', () => {
            expect(
                entry.validateLate({
                    'last-sublocade': localDaysAgo(30),
                    'sublocade-type': '100mg-monthly',
                }),
            ).toBeNull();
        });
    });
});
