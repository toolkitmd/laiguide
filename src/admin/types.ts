export interface ChangelogChange {
    path: string;
    from: string;
    to: string;
}

export interface ChangelogEntry {
    timestamp: string;
    email: string;
    action: 'update' | 'delete' | 'restore';
    medKey: string;
    displayName: string;
    changes?: ChangelogChange[];
    /** Full med JSON at save time — used for point-in-time restoration. */
    snapshot?: Record<string, unknown>;
    /** ISO timestamp of the point restored to; set when action === 'restore'. */
    restoreTarget?: string;
}

/** Guidance text and bullet points for a single tier window. */
export interface RawTierGuidance {
    idealSteps: string[];
    pragmaticVariations?: string[];
    providerNotifications?: string[];
}

/** A dose-specific guidance rule within a tier (used when guidance varies by maintenance dose). */
export interface RawDoseRule {
    doses: string[];
    guidance: RawTierGuidance;
}

/** A time-window tier within a variant (e.g. ≤ 27 days overdue). */
export interface RawTier {
    maxDays: number | null;
    guidance?: RawTierGuidance;
    guidanceByDoseRules?: RawDoseRule[];
}

/** A late-guidance variant (e.g. "initiation" vs "maintenance"). */
export interface RawVariant {
    key: string;
    /** If set, this variant inherits tiers from the named variant. */
    sameAs?: string;
    tiers?: RawTier[];
}

export interface RawLateGuidance {
    variants: RawVariant[];
    internalNotes?: string[];
}

export interface RawSharedGuidance {
    providerNotifications?: string[];
}

export interface RawEarlyVariant {
    key: string;
    minDays?: number;
    sameAs?: string;
    guidanceNote?: string[];
}

export interface RawEarlyGuidance {
    minDays?: number;
    daysBeforeDue?: number;
    guidanceNote?: string[];
    variants?: RawEarlyVariant[];
}

export interface RawGuidance {
    shared?: RawSharedGuidance;
    early?: RawEarlyGuidance;
    late: RawLateGuidance;
    /** Optional flat booster guidance (same shape as a tier's guidance). */
    booster?: RawTierGuidance;
}

/**
 * The shape of a medication JSON file as stored in src/meds/*.json.
 * Fields beyond these are preserved on save but not surfaced in the form editor.
 */
export interface RawMedJson {
    displayName: string;
    optgroupLabel: string;
    guidance: RawGuidance;
    [key: string]: unknown;
}
