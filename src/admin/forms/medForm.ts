import type {
    RawMedJson,
    RawVariant,
    RawTier,
    RawTierGuidance,
    RawDoseRule,
    RawEarlyVariant,
} from '../types';
import { NO_PROVIDER_NOTIFICATION } from '../../constants';
import {
    createEl,
    makeSection,
    makeTextInput,
    makeComboInput,
    makeNumberInput,
    makeListEditor,
} from './helpers';
import { enableDrag, refreshDragHandles } from './dragDrop';

function reindexTierPaths(variantBlock: HTMLElement, variantIdx: number): void {
    variantBlock.querySelectorAll<HTMLElement>('.tier-block').forEach((tierBlock, tierIdx) => {
        const newPrefix = `guidance.late.variants.${variantIdx}.tiers.${tierIdx}`;
        tierBlock.querySelectorAll<HTMLElement>('[data-path]').forEach((node) => {
            node.dataset.path = node.dataset.path!.replace(
                /guidance\.late\.variants\.\d+\.tiers\.\d+/,
                newPrefix,
            );
        });
        const maxDaysInput = tierBlock.querySelector<HTMLInputElement>('[data-path$=".maxDays"]');
        const maxDays =
            maxDaysInput?.value !== '' && maxDaysInput?.value != null
                ? Number(maxDaysInput.value)
                : null;
        const desc =
            maxDays != null && !isNaN(maxDays)
                ? `within ${maxDays} days overdue`
                : 'beyond all time windows';
        const labelSpan = tierBlock.querySelector<HTMLElement>('.tier-label-text');
        if (labelSpan) labelSpan.textContent = `Window ${tierIdx + 1}: ${desc}`;
    });
}

function appendGuidanceFields(
    body: HTMLDivElement,
    guidance: RawTierGuidance | undefined,
    path: string,
): void {
    body.append(
        makeListEditor('Recommended Steps', guidance?.idealSteps ?? [], `${path}.idealSteps`),
    );
    body.append(
        makeListEditor(
            'Acceptable Alternatives',
            guidance?.pragmaticVariations ?? [],
            `${path}.pragmaticVariations`,
        ),
    );
    body.append(
        makeListEditor(
            'When to Notify Provider',
            guidance?.providerNotifications ?? [],
            `${path}.providerNotifications`,
            NO_PROVIDER_NOTIFICATION,
        ),
    );
}

function renderDoseRule(rule: RawDoseRule, path: string, ruleIdx: number): HTMLDivElement {
    const block = createEl('div', { class: 'dose-rule-block' });
    const header = createEl('div', { class: 'dose-rule-header' }, [
        createEl('span', { class: 'chevron', textContent: '▼' }),
        createEl('span', { textContent: `Dose Rule ${ruleIdx + 1}: ${rule.doses.join(', ')} mg` }),
    ]);
    header.addEventListener('click', () => block.classList.toggle('collapsed'));
    const body = createEl('div', { class: 'dose-rule-body' });

    body.append(makeListEditor('Doses', rule.doses, `${path}.doses`));
    appendGuidanceFields(body, rule.guidance, `${path}.guidance`);

    block.append(header, body);
    return block;
}

function renderTier(tier: RawTier, variantIdx: number, tierIdx: number): HTMLDivElement {
    const label =
        tier.maxDays != null ? `within ${tier.maxDays} days overdue` : 'beyond all time windows';
    const block = createEl('div', { class: 'tier-block', draggable: 'true' });
    const handle = createEl('span', {
        class: 'drag-handle',
        title: 'Drag to reorder',
        textContent: '⠿',
    });
    const header = createEl('div', { class: 'tier-header' }, [
        handle,
        createEl('span', { class: 'chevron', textContent: '▼' }),
        createEl('span', {
            class: 'tier-label-text',
            textContent: `Window ${tierIdx + 1}: ${label}`,
        }),
    ]);
    header.addEventListener('click', () => block.classList.toggle('collapsed'));
    const body = createEl('div', { class: 'tier-body' });

    const path = `guidance.late.variants.${variantIdx}.tiers.${tierIdx}`;
    body.append(
        makeNumberInput('Days Overdue Ceiling (blank = no limit)', tier.maxDays, `${path}.maxDays`),
    );

    if (tier.guidanceByDoseRules) {
        const rules = tier.guidanceByDoseRules;
        const rulesContainer = createEl('div', { class: 'dose-rules-container' });
        rulesContainer.append(
            createEl('div', { class: 'dose-rules-label', textContent: 'Guidance by Dose' }),
        );
        for (let i = 0; i < rules.length; i++) {
            rulesContainer.append(renderDoseRule(rules[i], `${path}.guidanceByDoseRules.${i}`, i));
        }
        body.append(rulesContainer);
    } else {
        appendGuidanceFields(body, tier.guidance, `${path}.guidance`);
    }

    block.append(header, body);
    return block;
}

function renderEarlyVariant(variant: RawEarlyVariant, idx: number): HTMLDivElement {
    const block = createEl('div', { class: 'tier-block collapsed' });
    const header = createEl('div', { class: 'tier-header' }, [
        createEl('span', { class: 'chevron', textContent: '▼' }),
        document.createTextNode(variant.key),
    ]);
    header.addEventListener('click', () => block.classList.toggle('collapsed'));
    const body = createEl('div', { class: 'tier-body' });

    body.append(makeTextInput('Key', variant.key, `guidance.early.variants.${idx}.key`));
    body.append(
        makeNumberInput(
            'Min Days',
            variant.minDays ?? null,
            `guidance.early.variants.${idx}.minDays`,
        ),
    );
    body.append(
        makeTextInput('Same As', variant.sameAs ?? '', `guidance.early.variants.${idx}.sameAs`),
    );
    body.append(
        makeListEditor(
            'Variant Notes',
            variant.guidanceNote ?? [],
            `guidance.early.variants.${idx}.guidanceNote`,
        ),
    );

    block.append(header, body);
    return block;
}

function renderVariant(variant: RawVariant, idx: number): HTMLDivElement {
    const block = createEl('div', { class: 'variant-block' });

    const variantHeader = createEl('div', { class: 'variant-header' });
    variantHeader.append(createEl('label', { textContent: 'Scenario Key:' }));
    variantHeader.append(
        createEl('input', {
            class: 'variant-key-input',
            'data-path': `guidance.late.variants.${idx}.key`,
            value: variant.key,
        }),
    );
    const removeBtn = createEl('button', {
        class: 'remove-scenario-btn',
        type: 'button',
        textContent: '✕ Remove',
    });
    removeBtn.addEventListener('click', () => {
        block.dispatchEvent(
            new CustomEvent('removescenario', { bubbles: true, detail: { variantIdx: idx } }),
        );
    });
    variantHeader.append(removeBtn);
    block.append(variantHeader);

    if (variant.sameAs) {
        block.append(
            createEl('div', {
                class: 'sameAs-note',
                textContent: `Uses the same guidance as "${variant.sameAs}"`,
            }),
        );
        return block;
    }

    const tiers = variant.tiers ?? [];
    for (let i = 0; i < tiers.length; i++) {
        block.append(renderTier(tiers[i], idx, i));
    }
    enableDrag(block, '.tier-block', () => reindexTierPaths(block, idx));
    refreshDragHandles(block, '.tier-block');
    return block;
}

function buildMedInfoPanel(
    panel: HTMLDivElement,
    data: RawMedJson,
    existingGroups: string[],
): void {
    const { section, body } = makeSection('Medication Info');
    body.append(makeTextInput('Medication Name', data.displayName ?? '', 'displayName'));
    body.append(
        makeComboInput(
            'Medication Group',
            data.optgroupLabel ?? '',
            'optgroupLabel',
            existingGroups,
            'med-groups-datalist',
        ),
    );
    // Booster guidance is optional and off by default; offer to add it when absent.
    if (data.guidance && !data.guidance.booster) {
        const addBoosterBtn = createEl('button', {
            class: 'add-scenario-btn',
            type: 'button',
            textContent: '+ Add Booster Guidance',
        });
        addBoosterBtn.addEventListener('click', () => {
            body.dispatchEvent(new CustomEvent('addbooster', { bubbles: true }));
        });
        body.append(addBoosterBtn);
    }
    panel.append(section);
}

function buildSharedPanel(panel: HTMLDivElement, data: RawMedJson): void {
    const { section, body } = makeSection('Provider Notifications — All Scenarios');
    body.append(
        createEl('p', {
            class: 'section-note',
            textContent:
                'These notification rules will appear below any early or late guidance provider notifications.',
        }),
    );
    body.append(
        makeListEditor(
            'When to Notify Provider',
            data.guidance.shared?.providerNotifications ?? [],
            'guidance.shared.providerNotifications',
        ),
    );
    panel.append(section);
}

function buildEarlyPanel(panel: HTMLDivElement, data: RawMedJson): void {
    const early = data.guidance.early ?? {};
    const { section, body } = makeSection('Early Administration Window');
    body.append(
        makeNumberInput(
            'Minimum Days Since Last Dose',
            early.minDays ?? null,
            'guidance.early.minDays',
        ),
    );
    if (early.daysBeforeDue != null) {
        body.append(
            makeNumberInput(
                'Days Before Due Date Allowed',
                early.daysBeforeDue,
                'guidance.early.daysBeforeDue',
            ),
        );
    }
    body.append(
        makeListEditor('Clinical Notes', early.guidanceNote ?? [], 'guidance.early.guidanceNote'),
    );
    const earlyVariants = (early as { variants?: RawEarlyVariant[] }).variants;
    if (Array.isArray(earlyVariants) && earlyVariants.length > 0) {
        body.append(
            createEl('div', {
                class: 'variant-label',
                textContent: 'Formulation-Specific Early Windows',
            }),
        );
        for (let i = 0; i < earlyVariants.length; i++) {
            body.append(renderEarlyVariant(earlyVariants[i], i));
        }
    }
    panel.append(section);
}

function buildLatePanel(panel: HTMLDivElement, data: RawMedJson): void {
    const variants = data.guidance.late?.variants ?? [];
    const { section, body } = makeSection('Overdue Guidance — Scenarios & Time Windows');
    for (let i = 0; i < variants.length; i++) {
        body.append(renderVariant(variants[i], i));
    }
    const addScenarioBtn = createEl('button', {
        class: 'add-scenario-btn',
        type: 'button',
        textContent: '+ Add Scenario',
    });
    addScenarioBtn.addEventListener('click', () => {
        body.dispatchEvent(new CustomEvent('addscenario', { bubbles: true }));
    });
    body.append(addScenarioBtn);
    panel.append(section);
}

function buildBoosterPanel(panel: HTMLDivElement, data: RawMedJson): void {
    const { section, body } = makeSection('Booster Guidance');
    body.append(
        createEl('p', {
            class: 'section-note',
            textContent:
                'Shown as a third guidance type (alongside Early and Late) for this medication. Booster guidance takes no date/dose input.',
        }),
    );
    appendGuidanceFields(body, data.guidance.booster, 'guidance.booster');
    const removeBtn = createEl('button', {
        class: 'remove-scenario-btn',
        type: 'button',
        textContent: '✕ Remove Booster Guidance',
    });
    removeBtn.addEventListener('click', () => {
        body.dispatchEvent(new CustomEvent('removebooster', { bubbles: true }));
    });
    body.append(removeBtn);
    panel.append(section);
}

const GUIDANCE_TAB_MAP: Record<
    string,
    { label: string; build: (panel: HTMLDivElement, data: RawMedJson) => void }
> = {
    shared: { label: 'Shared Notifications', build: buildSharedPanel },
    early: { label: 'Early Guidance', build: buildEarlyPanel },
    late: { label: 'Overdue Guidance', build: buildLatePanel },
    booster: { label: 'Booster Guidance', build: buildBoosterPanel },
};

export function renderForm(
    container: HTMLDivElement,
    data: RawMedJson,
    existingGroups: string[] = [],
): void {
    container.innerHTML = '';

    type TabDef = { label: string; build: (panel: HTMLDivElement) => void };

    const tabDefs: TabDef[] = [
        { label: 'Medication Info', build: (p) => buildMedInfoPanel(p, data, existingGroups) },
    ];

    for (const key of Object.keys(data.guidance)) {
        const entry = GUIDANCE_TAB_MAP[key];
        if (entry) {
            tabDefs.push({ label: entry.label, build: (p) => entry.build(p, data) });
        }
    }

    const tabBar = createEl('div', { class: 'form-tab-bar' });
    const panels = tabDefs.map(() => createEl('div', { class: 'form-tab-panel' }));

    const activateTab = (idx: number): void => {
        tabBar.querySelectorAll('.form-tab-btn').forEach((btn, i) => {
            btn.classList.toggle('active', i === idx);
        });
        panels.forEach((panel, i) => {
            (panel as HTMLDivElement).hidden = i !== idx;
        });
    };

    tabDefs.forEach(({ label }, idx) => {
        const btn = createEl('button', {
            class: 'form-tab-btn',
            type: 'button',
            textContent: label,
        });
        btn.addEventListener('click', () => activateTab(idx));
        tabBar.append(btn);
    });

    container.append(tabBar);
    panels.forEach((panel, idx) => {
        tabDefs[idx].build(panel);
        container.append(panel);
    });

    activateTab(0);
}
