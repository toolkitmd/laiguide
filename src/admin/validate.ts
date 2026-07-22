import type { RawMedJson, RawVariant, RawTier, RawDoseRule } from './types';

export type ValidationResult = { ok: true; data: RawMedJson } | { ok: false; error: string };

function isNonEmptyString(v: unknown): v is string {
    return typeof v === 'string' && v.trim().length > 0;
}

function isNonNegativeNumber(v: unknown): boolean {
    return typeof v === 'number' && !isNaN(v) && v >= 0;
}

function validateTier(tier: RawTier, scenarioKey: string, tierIdx: number): string | null {
    const label = `Scenario "${scenarioKey}", Window ${tierIdx + 1}`;
    if (tier.maxDays != null && !isNonNegativeNumber(tier.maxDays)) {
        return `${label}: Max Days must be a non-negative number.`;
    }
    if (tier.guidanceByDoseRules) {
        if (!tier.guidanceByDoseRules.length) {
            return `${label}: must have at least one dose rule.`;
        }
        for (let i = 0; i < tier.guidanceByDoseRules.length; i++) {
            const rule = tier.guidanceByDoseRules[i] as RawDoseRule;
            if (!rule.doses?.length) {
                return `${label}, Dose Rule ${i + 1}: must specify at least one dose.`;
            }
            if (!rule.guidance?.idealSteps?.length) {
                return `${label}, Dose Rule ${i + 1}: must have at least one Ideal Step.`;
            }
        }
        return null;
    }
    if (!tier.guidance?.idealSteps?.length) {
        return `${label}: must have at least one Ideal Step.`;
    }
    return null;
}

function validateVariant(variant: RawVariant, idx: number): string | null {
    if (!isNonEmptyString(variant.key)) {
        return `Overdue Guidance Scenario ${idx + 1} is missing a key.`;
    }
    if (variant.sameAs) return null; // inherited — no tiers required
    if (!variant.tiers?.length) {
        return `Scenario "${variant.key}": must have at least one window.`;
    }
    for (let i = 0; i < variant.tiers.length; i++) {
        const err = validateTier(variant.tiers[i], variant.key, i);
        if (err) return err;
    }
    // Tiers with a null maxDays (open-ended) must come last, and maxDays must be strictly ascending.
    const tiers = variant.tiers;
    for (let i = 0; i < tiers.length - 1; i++) {
        if (tiers[i].maxDays == null) {
            return `Scenario "${variant.key}": the open-ended window (no ceiling) must be the last window.`;
        }
        if (tiers[i + 1].maxDays != null && tiers[i + 1].maxDays! <= tiers[i].maxDays!) {
            return `Scenario "${variant.key}": Days Overdue Ceiling must be ascending (Window ${i + 1}: ${tiers[i].maxDays} ≥ Window ${i + 2}: ${tiers[i + 1].maxDays}).`;
        }
    }
    return null;
}

/**
 * Validates raw JSON from the editor and narrows it to RawMedJson.
 * Returns { ok: true, data } on success or { ok: false, error } on failure.
 */
export function validateMedJson(raw: unknown): ValidationResult {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return { ok: false, error: 'Data must be a JSON object.' };
    }
    const d = raw as Record<string, unknown>;

    if (!isNonEmptyString(d.displayName)) return { ok: false, error: 'Display Name is required.' };
    if (!isNonEmptyString(d.optgroupLabel)) return { ok: false, error: 'Category is required.' };

    if (!d.guidance || typeof d.guidance !== 'object' || Array.isArray(d.guidance)) {
        return { ok: false, error: 'Guidance data is missing.' };
    }
    const guidance = d.guidance as Record<string, unknown>;

    const early = guidance.early as Record<string, unknown> | undefined;
    if (early) {
        if (early.minDays != null && !isNonNegativeNumber(early.minDays)) {
            return { ok: false, error: 'Early Guidance: Min Days must be a non-negative number.' };
        }
        if (early.daysBeforeDue != null && !isNonNegativeNumber(early.daysBeforeDue)) {
            return {
                ok: false,
                error: 'Early Guidance: Days Before Due must be a non-negative number.',
            };
        }
    }

    const late = guidance.late as Record<string, unknown> | undefined;
    if (!late || !Array.isArray(late.variants) || late.variants.length === 0) {
        return { ok: false, error: 'Late Guidance must have at least one scenario.' };
    }

    const variants = late.variants as RawVariant[];
    for (let i = 0; i < variants.length; i++) {
        const err = validateVariant(variants[i], i);
        if (err) return { ok: false, error: err };
    }

    const booster = guidance.booster as Record<string, unknown> | undefined;
    if (booster) {
        const steps = booster.idealSteps;
        if (!Array.isArray(steps) || steps.length === 0) {
            return {
                ok: false,
                error: 'Booster Guidance: must have at least one Ideal Step (or remove the Booster Guidance section).',
            };
        }
    }

    return { ok: true, data: d as RawMedJson };
}
