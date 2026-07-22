import type { SubmitContext, GuidanceResult } from '../interfaces/guidance';
import type {
    LateGuidanceParams,
    InfoRowSpec,
    LateSpec,
    SelectOption,
    FieldSpec,
    FormGroupSpec,
    MedDefinition,
    VariantEntry,
} from '../interfaces/med';
import { DAYS_PER_MONTH } from '../interfaces/med';
import { daysSinceDate, formatDate, formatWeeksAndDays, pluralize } from '../utils';
import { buildTiers, buildVariantMap, resolveLateTier, normalizeGuidance } from './tierBuilder';
import { composeEarlyGuidance, buildEarlyFields } from './earlyBuilder';

/** Builds the `getLateGuidance` closure from a pre-built tiers map. */
function buildLateGuidanceFn(
    tiersMap: Record<string, ReturnType<typeof buildTiers>>,
): MedDefinition['getLateGuidance'] {
    return ({ daysSince, variant, dose }) => {
        const variantKey = variant ?? (dose != null && tiersMap[dose] ? dose : 'default');
        const tiers = tiersMap[variantKey];
        if (!tiers)
            throw new Error(
                `[getLateGuidance] Unknown variant key: "${variantKey}" — available: ${Object.keys(tiersMap).join(', ')}`,
            );
        return resolveLateTier(tiers, daysSince!, dose);
    };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildCoreDef(json: any) {
    if (!json.guidance?.late) throw new Error(`Missing late guidance for ${json.displayName}`);
    const lg = json.guidance.late as Record<string, unknown>;
    const commonNotifs = json.guidance.shared?.providerNotifications as string[] | undefined;

    if (!lg['variants']) throw new Error(`No variants in late guidance for ${json.displayName}`);
    const tiersMap = buildVariantMap(lg['variants'] as VariantEntry[], buildTiers);

    const early = json.guidance.early;
    const booster = json.guidance.booster as GuidanceResult | undefined;
    return {
        displayName: json.displayName as string,
        earlyGuidance: composeEarlyGuidance(
            early?.daysBeforeDue,
            early?.minDays,
            early?.guidanceNote as string[] | undefined,
        ),
        ...buildEarlyFields(early, json.earlySpec),
        ...(commonNotifs?.length ? { commonProviderNotifications: commonNotifs } : {}),
        ...(booster?.idealSteps?.length ? { boosterGuidance: normalizeGuidance(booster) } : {}),
        getLateGuidance: buildLateGuidanceFn(tiersMap),
    };
}

/** Derives lateFieldsGroup, subFieldGroups, formFieldIds, and subGroupSelectorId from a FormGroupSpec array. */
function withGroups(spec: FormGroupSpec[]) {
    if (!spec.length || !spec[0].fields.length) {
        throw new Error(
            '[withGroups] formGroupsSpec must have at least one group with at least one field',
        );
    }
    const firstField = spec[0].fields[0];
    const subGroupSelectorId =
        firstField.type === 'select' && firstField.onchange ? firstField.id : undefined;
    return {
        formGroupsSpec: spec,
        lateFieldsGroup: spec[0].groupId,
        subFieldGroups: spec.length > 1 ? spec.slice(1).map((g) => g.groupId) : undefined,
        formFieldIds: spec.flatMap((g) => g.fields.map((f) => f.id)),
        subGroupSelectorId,
    };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildStandardDef(json: any) {
    const formGroupsSpec = json.formGroupsSpec as FormGroupSpec[];
    const optionsByField: Record<string, SelectOption[]> = Object.fromEntries(
        formGroupsSpec
            .flatMap((g) => g.fields)
            .filter((f): f is Extract<FieldSpec, { type: 'select' }> => f.type === 'select')
            .map((f) => [f.id, f.options]),
    );
    const baseUI = {
        optgroupLabel: json.optgroupLabel as string,
        ...withGroups(formGroupsSpec),
    };

    function renderInfoRow(
        row: InfoRowSpec,
        ctx: SubmitContext,
        daysSince: number,
    ): [string, string] {
        if ('value' in row) return [row.label, row.value];
        if ('field' in row) {
            const raw = ctx[row.field];
            return [
                row.label,
                row.format === 'date'
                    ? formatDate(raw)
                    : (optionsByField[row.field]?.find((o) => o.value === raw)?.label ?? raw),
            ];
        }
        const displayDays = Math.max(0, daysSince);
        const approxMonths = Math.round(displayDays / DAYS_PER_MONTH);
        const bareLabel = `${displayDays} day${displayDays !== 1 ? 's' : ''}`;
        const weeksBreak = displayDays > 0 ? formatWeeksAndDays(displayDays) : null;
        const t =
            row.format === 'days-months'
                ? `${bareLabel}${approxMonths > 0 ? ` (approximately ${pluralize(approxMonths, 'month')})` : ''}`
                : `${bareLabel}${weeksBreak && weeksBreak !== bareLabel ? ` (${weeksBreak})` : ''}`;
        return [row.label, t];
    }

    // Branched lateSpec (e.g. invega_sustenna)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spec = json.lateSpec as any;
    if (spec.kind === 'branched') {
        type Branch = {
            requiredFields: { id: string; message: string }[];
            dateField: string;
            showGroup: string;
            params?: Record<string, string>;
            paramKey?: string;
            paramField?: string;
            infoRows: InfoRowSpec[];
        };
        const branchField = spec.branchField as string;
        const requiredBase = spec.requiredBase as { id: string; message: string }[];
        const branches = spec.branches as Record<string, Branch>;
        const subGroupSpecs = formGroupsSpec.slice(1);

        return {
            ...baseUI,
            handleSubGroupChange: (
                branchVal: string,
                show: (id: string) => void,
                hide: (id: string) => void,
                clear: (id: string) => void,
            ) => {
                const branch = branches[branchVal];
                for (const g of subGroupSpecs) {
                    if (branch?.showGroup === g.groupId) {
                        show(g.groupId);
                    } else {
                        hide(g.groupId);
                        g.fields.forEach((f) => clear(f.id));
                    }
                }
            },
            validateLate: (ctx: SubmitContext) => {
                const failBase = requiredBase.find(({ id }) => !ctx[id]);
                if (failBase) return failBase.message;
                return (
                    branches[ctx[branchField]]?.requiredFields.find(({ id }) => !ctx[id])
                        ?.message ?? null
                );
            },
            buildLateParams: (ctx: SubmitContext) => {
                const branch = branches[ctx[branchField]];
                const daysSince = daysSinceDate(ctx[branch.dateField]);
                const params: LateGuidanceParams = { daysSince, ...branch.params };
                if (branch.paramKey && branch.paramField)
                    params[branch.paramKey as 'dose' | 'variant'] = ctx[branch.paramField];
                return params;
            },
            buildLateInfoRows: (ctx: SubmitContext, daysSince: number) =>
                branches[ctx[branchField]].infoRows.map((row) =>
                    renderInfoRow(row, ctx, daysSince),
                ),
        };
    }

    // Standard (single-path) lateSpec
    const lateSpec = spec as LateSpec;
    return {
        ...baseUI,
        validateLate: (ctx: SubmitContext) =>
            lateSpec.requiredFields.find(({ id }) => !ctx[id])?.message ?? null,
        buildLateParams: (ctx: SubmitContext) => {
            const daysSince = daysSinceDate(ctx[lateSpec.dateField]);
            const params: LateGuidanceParams = { daysSince };
            if (lateSpec.paramKey && lateSpec.paramField)
                params[lateSpec.paramKey] = ctx[lateSpec.paramField];
            if (lateSpec.includeWeeksSince) params.weeksSince = Math.floor(daysSince / 7);
            return params;
        },
        buildLateInfoRows: (ctx: SubmitContext, daysSince: number) =>
            lateSpec.infoRows.map((row) => renderInfoRow(row, ctx, daysSince)),
    };
}
