import type { GuidanceResult, SubmitContext } from './guidance';

// ─── Registry key ─────────────────────────────────────────────────────────────

/** Unique string key for each medication entry in the registry (derived from JSON filename). */
export type MedicationKey = string;

// ─── Guidance params / output ─────────────────────────────────────────────────

/**
 * Parameters passed to getLateGuidance. Use only the fields relevant to
 * the medication — unused fields are ignored by each closure.
 */
export interface LateGuidanceParams {
    daysSince?: number;
    weeksSince?: number;
    variant?: string;
    dose?: string;
}

// ─── Form / UI types ──────────────────────────────────────────────────────────

/** A row in the guidance summary panel. */
export type InfoRowSpec =
    | { label: string; value: string } // static string
    | { label: string; field: string; format: 'date' | 'option-label' } // field value
    | { label: string; format: 'days-weeks' | 'days-months' | 'days-weeks-months' }; // computed time

// ─── Early variant support ──────────────────────────────────────────────────

/** Definition for a single early-guidance variant (e.g. monthly vs. weekly). */
export interface EarlyVariantDef {
    /** Minimum days since last injection required for early administration. */
    minDays?: number;
    /** Variant-specific notes shown before shared early.guidanceNote bullets. */
    guidanceNote?: string[];
}

/** Auto-derives validateLate / buildLateParams / buildLateInfoRows from JSON data */
export interface LateSpec {
    requiredFields: { id: string; message: string }[];
    dateField: string;
    paramKey?: 'dose' | 'variant';
    paramField?: string;
    includeWeeksSince?: boolean;
    infoRows: InfoRowSpec[];
}

/** A single option in a select field */
export interface SelectOption {
    value: string;
    label: string;
}

/** Describes one form field (date input or select) */
export type FieldSpec =
    | { type: 'date'; id: string; label: string }
    | {
          type: 'select';
          id: string;
          label: string;
          placeholder?: string;
          onchange?: string;
          options: SelectOption[];
      };

/** A named group of fields shown/hidden together */
export interface FormGroupSpec {
    groupId: string;
    fields: FieldSpec[];
}

// ─── MedDefinition ────────────────────────────────────────────────────────────

export interface MedDefinition {
    displayName: string;
    earlyGuidance: string;
    /** Days before the scheduled next injection that early administration is permitted. */
    earlyDaysBeforeDue?: number;
    /** Minimum days since last injection required for early administration. */
    earlyMinDays?: number;
    /** Bullet points for when to notify the provider, shown in early guidance. */
    earlyProviderNotification?: string[];
    /** Bullet points shown in BOTH early and late provider-notification sections. */
    commonProviderNotifications?: string[];
    /**
     * When set, early guidance is variant-aware. This is the form field ID
     * (select) used to choose the variant (e.g. monthly vs. weekly).
     */
    earlyParamField?: string;
    /** Form field ID for the last injection date when earlyParamField is used. */
    earlyDateField?: string;
    /** Maps each variant key to its early-guidance definition. */
    earlyVariantMap?: Record<string, EarlyVariantDef>;
    /** Shared notes from early.guidanceNote — appended after variant-specific notes. */
    earlySharedNotes?: string[];
    /**
     * Optional booster guidance — a flat, time/dose-independent result shown as a
     * third guidance type (peer of early/late). Present only for meds whose JSON
     * has a `guidance.booster` block (e.g. Sublocade, Brixadi).
     */
    boosterGuidance?: GuidanceResult;
    getLateGuidance(params: LateGuidanceParams): GuidanceResult;

    // UI config: used by main.ts to generically handle form interaction
    optgroupLabel: string; // medication <select> optgroup label
    formGroupsSpec: FormGroupSpec[]; // declarative spec; drives runtime HTML generation
    lateFieldsGroup: string;
    subFieldGroups?: string[]; // extra groups to hide on medication change
    /** All form field IDs this med uses — used to build ctx and clear fields on change */
    formFieldIds: string[];
    /** ID of the sub-group selector element (if this med has a sub-group toggle) */
    subGroupSelectorId?: string;
    /** Optional: handle a sub-group selector change (e.g. injection type toggle) */
    handleSubGroupChange?(
        subGroupVal: string,
        show: (id: string) => void,
        hide: (id: string) => void,
        clear: (id: string) => void,
    ): void;
    validateLate(ctx: SubmitContext): string | null;
    buildLateParams(ctx: SubmitContext): LateGuidanceParams;
    buildLateInfoRows(ctx: SubmitContext, daysSince: number): [string, string][];
}

// ─── Internal raw JSON shapes (used by loader) ────────────────────────────────

export type RawTier = Record<string, unknown>;

/** A single entry in a `variants` array; `sameAs` reuses another variant's tiers. */
export type VariantEntry = { key: string; tiers?: RawTier[]; sameAs?: string };

/** Internal: the core fields built by buildCoreDef. */
export type CoreDef = Pick<
    MedDefinition,
    | 'displayName'
    | 'earlyGuidance'
    | 'earlyDaysBeforeDue'
    | 'earlyMinDays'
    | 'earlyProviderNotification'
    | 'commonProviderNotifications'
    | 'earlyParamField'
    | 'earlyDateField'
    | 'earlyVariantMap'
    | 'earlySharedNotes'
    | 'boosterGuidance'
    | 'getLateGuidance'
>;

/** Average days per month (365.25 / 12). */
export const DAYS_PER_MONTH = 30.44;
