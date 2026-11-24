window.__ModuleLoader__.load({
  id: 'dsh-rea-gate',
  factory(require) {
    const React = require('react')
    const { Button, IconRefreshOutlineRegular, Pill, StateDot, Switch, writeClipboard } = require('@deepseek-ai/dsh-client-ui-primitives')
    const h = React.createElement

    const PANEL_ID = 'rea-gate'

    const CSS = `
      .rea-gate {
        color: var(--dsw-alias-label-primary);
        font-size: 13px;
        line-height: 20px;
        min-width: 0;
        container-type: inline-size;
      }
      /* Matches DSH first-level system pages (PluginManagerPage / TaskManagerPage). */
      .rea-gate-page {
        width: 100%;
        height: 100%;
        min-width: 0;
        min-height: 0;
        overflow-x: hidden;
        overflow-y: auto;
        scrollbar-gutter: stable;
        background: var(--dsw-alias-bg-base);
        --dsh-scrollbar-width: 9px;
        --dsh-scrollbar-thumb-border: 2px;
      }
      .rea-gate-page-inner {
        box-sizing: border-box;
        width: 100%;
        max-width: 960px;
        margin: 0 auto;
        padding: 0 clamp(24px, 4vw, 48px) 48px;
      }
      @media (max-width: 767px) {
        .rea-gate-page-inner {
          padding-inline: 20px;
        }
      }
      .rea-gate h1, .rea-gate h3, .rea-gate h4, .rea-gate p, .rea-gate dl, .rea-gate dd { margin: 0; }
      .rea-gate h1 { font-size: 20px; font-weight: 500; line-height: 28px; }
      .rea-gate h3 { font-size: 14px; font-weight: 500; line-height: 20px; color: var(--dsw-alias-label-primary); }
      .rea-gate-controls { display: grid; gap: 24px; }
      .rea-gate-page .rea-gate-controls { gap: 28px; }

      .rea-gate .rea-page-head {
        display: flex; align-items: center; gap: 12px;
        padding-top: 28px; margin-bottom: 24px;
      }
      [data-platform='darwin'] .rea-gate-page .rea-page-head {
        padding-top: calc(28px + var(--dsh-frame-top-clearance, 0px));
      }
      .rea-gate .rea-logo {
        display: grid; place-items: center; flex: none;
        width: 36px; height: 36px; border-radius: var(--dsw-radius-sm, 8px);
        border: 0.5px solid var(--dsw-alias-settings-card-stroke, var(--dsw-alias-border-l2));
        background: var(--dsw-alias-bg-module-platform, var(--dsw-alias-bg-layer-2));
      }
      .rea-gate .rea-page-sub { margin-top: 2px; }

      .rea-gate .rea-heading {
        display: flex; align-items: flex-end; justify-content: space-between;
        gap: 8px 16px; flex-wrap: wrap; margin-bottom: 10px;
      }
      .rea-gate .rea-heading-main { min-width: 0; }
      .rea-gate .rea-heading-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 2px; }
      .rea-gate .rea-muted {
        color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
        font-size: 12px; line-height: 18px; overflow-wrap: anywhere;
      }
      .rea-gate .rea-label { font-size: 13px; font-weight: 500; line-height: 20px; }

      .rea-gate .rea-group {
        border: 0.5px solid var(--dsw-alias-settings-card-stroke, var(--dsw-alias-border-l2));
        background: var(--dsw-alias-settings-card-fill, var(--dsw-alias-bg-layer-1));
        border-radius: var(--dsw-radius-md, 12px);
        overflow: hidden;
        min-width: 0;
      }
      .rea-gate .rea-row {
        display: flex; align-items: center; justify-content: space-between;
        gap: 10px 16px; padding: 12px 16px; min-height: 28px;
      }
      .rea-gate .rea-row + .rea-row,
      .rea-gate .rea-divider { border-top: 0.5px solid var(--dsw-alias-border-l2); }
      .rea-gate .rea-content { padding: 12px 16px; min-width: 0; }
      .rea-gate .rea-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      .rea-gate .rea-list { margin: 0; padding: 0; list-style: none; }
      .rea-gate .rea-stack { display: grid; gap: 8px; }
      .rea-gate .rea-status { display: inline-flex; align-items: center; gap: 6px; flex: none; }

      .rea-gate .rea-setting-row { flex-wrap: wrap; }
      .rea-gate .rea-setting-info { flex: 1 1 220px; min-width: 0; }
      .rea-gate .rea-setting-info p { margin-top: 2px; }
      .rea-gate .rea-setting-actions { margin-inline-start: auto; justify-content: flex-end; }

      /* Badges & Pills */
      .rea-gate .rea-badge {
        display: inline-flex; align-items: center; gap: 5px;
        padding: 2px 8px; border-radius: 999px;
        font-size: 11.5px; font-weight: 500; line-height: 16px;
        white-space: nowrap; font-variant-numeric: tabular-nums;
        background: var(--dsw-alias-bg-module-platform, var(--dsw-alias-bg-layer-2));
        color: var(--dsw-alias-label-secondary);
        border: 0.5px solid transparent;
      }
      .rea-gate .rea-badge[data-tone="ready"] {
        background: color-mix(in srgb, var(--dsw-alias-state-success-primary) 12%, transparent);
        color: var(--dsw-alias-state-success-primary);
        border-color: color-mix(in srgb, var(--dsw-alias-state-success-primary) 24%, transparent);
      }
      .rea-gate .rea-badge[data-tone="attention"] {
        background: color-mix(in srgb, var(--dsw-alias-state-warn-primary, #d97706) 13%, transparent);
        color: var(--dsw-alias-state-warn-primary, #b45309);
        border-color: color-mix(in srgb, var(--dsw-alias-state-warn-primary, #d97706) 28%, transparent);
      }
      .rea-gate .rea-badge[data-tone="info"] {
        background: color-mix(in srgb, var(--dsw-alias-state-business-primary, #2563eb) 10%, transparent);
        color: var(--dsw-alias-state-business-primary, var(--dsw-alias-label-primary));
        border-color: color-mix(in srgb, var(--dsw-alias-state-business-primary, #2563eb) 22%, transparent);
      }
      .rea-gate .rea-version-pill {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 11.5px; line-height: 16px;
        padding: 2px 7px;
        border-radius: var(--dsw-radius-xs, 4px);
        background: var(--dsw-alias-bg-module-platform, var(--dsw-alias-bg-layer-2));
        color: var(--dsw-alias-label-primary);
        font-variant-numeric: tabular-nums;
      }

      /* Overview / Lifecycle */
      .rea-gate .rea-overview-title { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      .rea-gate .rea-overview-name { font-size: 14px; font-weight: 500; line-height: 22px; }
      .rea-gate .rea-overview-hint { margin-top: 4px; }
      .rea-gate .rea-maintenance-bar {
        padding: 8px 16px;
        background: var(--dsw-alias-bg-module-platform, var(--dsw-alias-bg-layer-2));
      }
      .rea-gate .rea-danger-ghost { color: var(--dsw-alias-state-error-primary) !important; }
      @media (hover: hover) {
        .rea-gate .rea-danger-ghost:hover:not(:disabled) {
          background: var(--dsw-alias-interactive-bg-hover-danger) !important;
        }
      }
      .rea-gate .rea-danger-solid {
        background: var(--dsw-alias-state-error-primary) !important;
        border-color: var(--dsw-alias-state-error-primary) !important;
        color: #fff !important;
      }

      /* Feedback Banner */
      .rea-gate .rea-feedback { display: grid; gap: 8px; }
      .rea-gate .rea-feedback-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
      .rea-gate .rea-dismiss {
        appearance: none; border: none; background: transparent; cursor: pointer;
        color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary)); font-size: 14px; line-height: 1;
        padding: 3px 6px; border-radius: var(--dsw-radius-xs, 4px); flex: none;
      }
      @media (hover: hover) {
        .rea-gate .rea-dismiss:hover {
          background: var(--dsw-alias-interactive-bg-hover);
          color: var(--dsw-alias-label-primary);
        }
      }
      .rea-gate .rea-output {
        max-height: 10em; overflow: auto; margin: 0; padding: 8px 10px;
        border-radius: var(--dsw-radius-sm, 8px);
        background: var(--dsw-alias-bg-module-platform, var(--dsw-alias-bg-layer-2));
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        white-space: pre-wrap; overflow-wrap: anywhere; font-size: 11.5px; line-height: 17px;
      }
      .rea-gate .rea-error { color: var(--dsw-alias-state-error-primary); }

      /* Subheaders inside cards */
      .rea-gate .rea-subhead {
        display: flex; align-items: center; justify-content: space-between; gap: 8px;
        padding: 7px 16px;
        background: var(--dsw-alias-bg-module-platform, var(--dsw-alias-bg-layer-2));
        font-size: 12px; font-weight: 500; line-height: 18px;
        color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
        font-variant-numeric: tabular-nums;
      }

      /* Workspaces */
      .rea-gate .rea-ws-item {
        display: flex; align-items: center; justify-content: space-between;
        gap: 10px 14px; padding: 10px 16px;
      }
      .rea-gate .rea-ws-item + .rea-ws-item { border-top: 0.5px solid var(--dsw-alias-border-l2); }
      .rea-gate .rea-ws-main { display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1 1 200px; }
      .rea-gate .rea-ws-icon {
        display: grid; place-items: center; flex: none;
        width: 28px; height: 28px; border-radius: var(--dsw-radius-sm, 8px);
        background: var(--dsw-alias-bg-module-platform, var(--dsw-alias-bg-layer-2));
        color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
      }
      .rea-gate .rea-ws-text { min-width: 0; flex: 1; }
      .rea-gate .rea-ws-name { font-size: 13px; font-weight: 500; line-height: 20px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .rea-gate .rea-ws-path {
        display: block; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 11.5px; line-height: 17px;
        color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .rea-gate .rea-ws-controls { display: flex; align-items: center; gap: 8px; flex: none; }
      .rea-gate .rea-ws-empty { padding: 12px 16px; }

      /* Engine Accordion List */
      .rea-gate .rea-engine-item { min-width: 0; }
      .rea-gate .rea-engine-item + .rea-engine-item { border-top: 0.5px solid var(--dsw-alias-border-l2); }
      .rea-gate .rea-engine-trigger {
        appearance: none; border: none; background: transparent; width: 100%; text-align: start;
        font: inherit; color: inherit; cursor: pointer;
        display: flex; align-items: center; justify-content: space-between; gap: 12px;
        padding: 12px 16px;
        transition: background 140ms var(--ds-ease-in-out, cubic-bezier(0.4, 0, 0.2, 1));
      }
      @media (hover: hover) {
        .rea-gate .rea-engine-trigger:hover {
          background: var(--dsw-alias-interactive-bg-hover);
        }
      }
      .rea-gate .rea-engine-trigger:focus-visible {
        outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
        outline-offset: -2px;
      }
      .rea-gate .rea-engine-left { display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1; }
      .rea-gate .rea-engine-mark {
        display: grid; place-items: center; flex: none;
        width: 22px; height: 22px; border-radius: 6px;
        background: var(--dsw-alias-bg-module-platform, var(--dsw-alias-bg-layer-2));
        color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
        font-size: 12px; font-weight: 600;
      }
      .rea-gate .rea-engine-mark[data-state="ready"] {
        background: var(--dsw-alias-state-success-primary);
        color: #fff;
      }
      .rea-gate .rea-engine-mark[data-state="attention"] {
        background: color-mix(in srgb, var(--dsw-alias-state-warn-primary, #d97706) 16%, transparent);
        color: var(--dsw-alias-state-warn-primary, #b45309);
      }
      .rea-gate .rea-engine-text { min-width: 0; flex: 1; }
      .rea-gate .rea-engine-title-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
      .rea-gate .rea-engine-dep {
        font-size: 11px; line-height: 16px; padding: 0 6px; border-radius: var(--dsw-radius-xs, 4px);
        background: var(--dsw-alias-bg-module-platform, var(--dsw-alias-bg-layer-2));
        color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
      }
      .rea-gate .rea-engine-desc {
        margin-top: 2px;
        color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
        font-size: 12px; line-height: 18px;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .rea-gate .rea-engine-right { display: flex; align-items: center; gap: 10px; flex: none; }
      .rea-gate .rea-chevron {
        display: grid; place-items: center; flex: none;
        width: 20px; height: 20px;
        color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
        transition: transform 140ms var(--ds-ease-in-out, cubic-bezier(0.4, 0, 0.2, 1));
      }
      .rea-gate .rea-chevron[data-open="true"] { transform: rotate(90deg); }

      /* Expanded Engine Detail Drawer */
      .rea-gate .rea-engine-detail {
        margin: 0 16px 14px 50px;
        padding: 12px 14px;
        border-radius: var(--dsw-radius-sm, 8px);
        border: 0.5px solid var(--dsw-alias-border-l2);
        background: var(--dsw-alias-bg-module-platform, var(--dsw-alias-bg-layer-2));
        display: grid; gap: 12px;
      }
      .rea-gate .rea-detail-block { display: grid; gap: 6px; min-width: 0; }
      .rea-gate .rea-detail-label {
        font-size: 11px; font-weight: 500; line-height: 17px;
        color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
      }
      .rea-gate .rea-detail-guide { font-size: 12.5px; color: var(--dsw-alias-label-primary); line-height: 19px; }

      /* Env Var Chips & Path Config */
      .rea-gate .rea-env-list { display: grid; gap: 8px; }
      .rea-gate .rea-env-row {
        display: grid; gap: 8px;
        padding: 8px 10px; border-radius: var(--dsw-radius-sm, 8px);
        background: var(--dsw-alias-bg-base, var(--dsw-alias-bg-layer-1));
        border: 0.5px solid var(--dsw-alias-border-l2);
        min-width: 0;
      }
      .rea-gate .rea-env-head {
        display: flex; align-items: center; justify-content: space-between; gap: 8px; min-width: 0;
      }
      .rea-gate .rea-env-main { display: flex; align-items: center; gap: 8px; min-width: 0; flex-wrap: wrap; }
      .rea-gate .rea-env-code {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 12px; color: var(--dsw-alias-label-primary);
        overflow-wrap: anywhere;
      }
      .rea-gate .rea-env-state { font-size: 11.5px; color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary)); }
      .rea-gate .rea-env-state[data-set="true"] { color: var(--dsw-alias-state-success-primary); font-weight: 500; }
      .rea-gate .rea-env-edit {
        display: flex; align-items: center; gap: 6px; flex-wrap: wrap; min-width: 0;
      }
      .rea-gate .rea-path-input {
        flex: 1 1 200px; min-width: 0; height: 32px; box-sizing: border-box;
        padding: 0 10px;
        border: 0.5px solid var(--dsw-alias-border-l4, var(--dsw-alias-border-l2));
        border-radius: var(--dsw-radius-sm, 8px);
        background: var(--dsw-alias-bg-layer-3, var(--dsw-alias-bg-base));
        color: var(--dsw-alias-label-primary);
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 12px; line-height: 18px;
      }
      .rea-gate .rea-path-input::placeholder {
        color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
        font-family: inherit;
      }
      .rea-gate .rea-path-input:focus {
        outline: none;
        border-color: var(--dsw-alias-state-business-primary);
      }
      .rea-gate .rea-path-input:disabled { opacity: 0.6; }
      @media (pointer: coarse) {
        .rea-gate .rea-path-input { font-size: 16px; }
      }

      /* Diagnostic Callout inside Detail */
      .rea-gate .rea-diag-box {
        padding: 9px 11px; border-radius: var(--dsw-radius-sm, 8px);
        background: var(--dsw-alias-bg-base, var(--dsw-alias-bg-layer-1));
        border: 0.5px solid var(--dsw-alias-border-l2);
        border-inline-start: 2.5px solid var(--dsw-alias-border-l2);
        font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary);
        display: grid; gap: 8px;
      }
      .rea-gate .rea-diag-box[data-tone="attention"] {
        border-inline-start-color: var(--dsw-alias-state-warn-primary, #d97706);
        color: var(--dsw-alias-label-primary);
      }
      .rea-gate .rea-diag-box[data-tone="ready"] {
        border-inline-start-color: var(--dsw-alias-state-success-primary);
        color: var(--dsw-alias-label-primary);
      }
      .rea-gate .rea-hash-row {
        display: flex; align-items: center; justify-content: space-between; gap: 8px;
        padding: 5px 8px; border-radius: var(--dsw-radius-xs, 4px);
        background: var(--dsw-alias-bg-module-platform, var(--dsw-alias-bg-layer-2));
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 11.5px; min-width: 0;
      }
      .rea-gate .rea-hash-val { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
      .rea-gate .rea-inline-link {
        color: var(--dsw-alias-link, var(--dsw-alias-state-business-primary));
        text-decoration: none; font-weight: 500;
      }
      @media (hover: hover) {
        .rea-gate .rea-inline-link:hover { text-decoration: underline; }
      }

      /* Resource Links inside Detail & Headers */
      .rea-gate .rea-detail-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding-top: 2px; }
      .rea-gate .rea-download {
        display: inline-flex; align-items: center; gap: 4px;
        min-height: 28px; padding: 0 10px; border-radius: var(--dsw-radius-sm, 8px);
        border: 0.5px solid var(--dsw-alias-border-l2);
        background: var(--dsw-alias-bg-base, var(--dsw-alias-bg-layer-1));
        color: var(--dsw-alias-label-primary);
        font-size: 12px; font-weight: 500; text-decoration: none;
        transition: background 140ms var(--ds-ease-in-out, cubic-bezier(0.4, 0, 0.2, 1));
      }
      @media (hover: hover) {
        .rea-gate .rea-download:hover {
          background: var(--dsw-alias-interactive-bg-hover);
        }
      }
      .rea-gate .rea-download:focus-visible {
        outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
        outline-offset: 2px;
      }
      .rea-gate .rea-download-plain {
        border-color: transparent; background: transparent; padding-inline: 6px;
        color: var(--dsw-alias-link, var(--dsw-alias-state-business-primary)); font-weight: 400;
      }
      @media (hover: hover) {
        .rea-gate .rea-download-plain:hover {
          background: transparent;
          text-decoration: underline;
        }
      }

      /* Collapsible Cards (Usage Guide & Advanced Diagnostics) */
      .rea-gate .rea-disclosure-bar {
        display: flex; align-items: center; justify-content: space-between; gap: 12px;
        padding-inline-end: 16px;
        transition: background 140ms var(--ds-ease-in-out, cubic-bezier(0.4, 0, 0.2, 1));
      }
      @media (hover: hover) {
        .rea-gate .rea-disclosure-bar:hover {
          background: var(--dsw-alias-interactive-bg-hover);
        }
      }
      .rea-gate .rea-disclosure-main {
        appearance: none; border: none; background: transparent; flex: 1; min-width: 0;
        text-align: start; font: inherit; color: inherit; cursor: pointer;
        padding: 12px 0 12px 16px;
      }
      .rea-gate .rea-disclosure-main:focus-visible,
      .rea-gate .rea-disclosure-trigger:focus-visible {
        outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
        outline-offset: -2px;
      }
      .rea-gate .rea-disclosure-right {
        display: flex; align-items: center; gap: 10px; flex: none;
      }
      .rea-gate .rea-disclosure-chevron-btn {
        appearance: none; border: none; background: transparent; padding: 0;
        display: grid; place-items: center; cursor: pointer; color: inherit;
      }
      .rea-gate .rea-disclosure-trigger {
        appearance: none; border: none; background: transparent; width: 100%; min-width: 0;
        text-align: start; font: inherit; color: inherit; cursor: pointer;
        display: flex; align-items: center; justify-content: space-between; gap: 12px;
        padding: 12px 16px;
        transition: background 140ms var(--ds-ease-in-out, cubic-bezier(0.4, 0, 0.2, 1));
      }
      @media (hover: hover) {
        .rea-gate .rea-disclosure-trigger:hover {
          background: var(--dsw-alias-interactive-bg-hover);
        }
      }

      /* Prompt Example Cards */
      .rea-gate .rea-prompt-card {
        display: flex; align-items: center; justify-content: space-between; gap: 10px;
        padding: 9px 10px 9px 12px; border-radius: var(--dsw-radius-sm, 8px);
        background: var(--dsw-alias-bg-module-platform, var(--dsw-alias-bg-layer-2));
        min-width: 0;
      }
      .rea-gate .rea-prompt-text {
        display: flex; align-items: baseline; gap: 8px; min-width: 0; flex: 1;
        font-size: 12.5px; line-height: 19px; color: var(--dsw-alias-label-primary);
      }
      .rea-gate .rea-prompt-quote { color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary)); font-weight: 600; flex: none; }
      .rea-gate .rea-copy-btn { flex: none; min-width: 56px; justify-content: center; }
      .rea-gate .rea-copy-done { color: var(--dsw-alias-state-success-primary) !important; }

      /* Path row in Advanced Diagnostics */
      .rea-gate .rea-path-code {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 12px; line-height: 18px;
        color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
        overflow-wrap: anywhere;
      }

      /* Dialog */
      .rea-gate .rea-dialog {
        box-sizing: border-box; width: min(480px, calc(100vw - 32px));
        max-height: calc(100dvh - 32px); padding: 0; color: inherit;
        background: var(--dsw-alias-bg-layer-1, Canvas);
        border: 0.5px solid var(--dsw-alias-settings-card-stroke, var(--dsw-alias-border-l2));
        border-radius: var(--dsw-radius-lg, 16px);
        box-shadow: 0 16px 40px rgb(0 0 0 / 24%);
      }
      .rea-gate .rea-dialog::backdrop { background: var(--dsw-alias-bg-mask-1, rgb(0 0 0 / 24%)); }
      .rea-gate .rea-dialog-title { font-size: 15px; font-weight: 600; line-height: 22px; }
      .rea-gate .rea-dialog-body { padding: 0 16px 16px; display: grid; gap: 10px; overflow-wrap: anywhere; }
      .rea-gate .rea-impact-list {
        margin: 0; padding: 10px 12px; list-style: none; border-radius: var(--dsw-radius-sm, 8px);
        background: var(--dsw-alias-bg-module-platform, var(--dsw-alias-bg-layer-2));
        display: grid; gap: 6px; font-size: 12px; line-height: 18px;
      }
      .rea-gate .rea-impact-list li { display: flex; gap: 8px; }
      .rea-gate .rea-impact-tag { flex: none; font-weight: 600; min-width: 44px; }
      .rea-gate .rea-impact-remove { color: var(--dsw-alias-state-error-primary); }
      .rea-gate .rea-impact-keep { color: var(--dsw-alias-state-success-primary); }
      .rea-gate .rea-checkbox-row {
        display: flex; align-items: flex-start; gap: 8px; cursor: pointer;
        padding: 8px 10px; border-radius: var(--dsw-radius-sm, 8px);
        border: 0.5px solid var(--dsw-alias-border-l2);
        font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-primary);
      }
      .rea-gate .rea-checkbox-row input {
        margin-top: 2px; flex: none; accent-color: var(--dsw-alias-state-error-primary);
      }

      @container (max-width: 560px) {
        .rea-gate .rea-engine-desc { white-space: normal; }
        .rea-gate .rea-engine-detail { margin: 0 12px 12px 12px; }
        .rea-gate .rea-ws-item { flex-wrap: wrap; }
        .rea-gate .rea-ws-controls { margin-inline-start: auto; }
      }
    `

    const operations = {
      install: { pending: '正在安装并注册 REA…', success: 'REA 安装与注册已完成' },
      reinstall: { pending: '正在通过 npm 重新安装并注册最新版 REA…', success: 'REA 已重新安装并注册到 DSH' },
      update: { pending: '正在更新 REA…', success: 'REA 更新命令已完成' },
      uninstall: { pending: '正在卸载 REA 集成…', success: 'REA 集成已卸载' },
      'uninstall-full': { pending: '正在卸载 REA 集成与命令行包…', success: 'REA 集成与命令行包已彻底卸载' },
      repair: { pending: '正在重新注册 REA…', success: 'REA 注册修复步骤已完成' },
      preference: { pending: '正在保存…', failure: '无法保存会话默认设置，请重试。', success: '已保存' },
      workspace: { pending: '正在更新工作区规则…', failure: '无法保存工作区规则，请重试。' },
      'install-engine': { pending: '正在通过 Homebrew 安装（可能需要几分钟）…', success: '安装完成并已自动检测本机环境', failure: '安装失败，请查看输出或点击官方链接手动下载。' },
      'set-env': { pending: '正在保存路径并重新检测…', success: '路径配置已保存并重新检测', failure: '无法保存路径配置，请重试。' },
    }

    function operationMeta(operation) {
      if (!operation) return null
      if (operation.startsWith('engine-install:')) return operations['install-engine']
      if (operation.startsWith('engine-env:')) return operations['set-env']
      return operations[operation] ?? null
    }

    const ENV_PLACEHOLDERS = {
      GHIDRA_INSTALL_DIR: '例如 /opt/homebrew/opt/ghidra/libexec',
      JAVA_HOME: '例如 /opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home',
      HOPPER_LAUNCHER_PATH: '例如 /usr/local/bin/hopper',
      REA_IDA_MCP_CONFIG: '例如 ~/.config/ida/mcp.json',
      REA_JADX_MCP_JAR: '例如 ~/tools/jadx-headless-mcp-0.7.1-all.jar',
      REA_APKTOOL_COMMAND: '例如 /opt/homebrew/bin/apktool',
      REA_ADB_PATH: '例如 /opt/homebrew/bin/adb',
      REA_KUNA_COMMAND: '例如 /usr/local/bin/kuna',
    }

    const ENGINE_GROUPS = [
      { id: 'native', title: '原生二进制分析', engines: ['ghidra', 'hopper', 'ida', 'kuna'] },
      { id: 'android', title: 'Android 逆向', engines: ['jadx', 'apktool', 'adb'] },
      { id: 'runtime', title: '共享运行时依赖', engines: ['java'] },
    ]

    const providers = {
      ghidra: {
        name: 'Ghidra',
        dep: '需 Java',
        description: 'NSA 开源反编译与原生二进制分析框架。',
        setup: '下载并解压 Ghidra 12.2+ 发行包，将解压后的根目录路径配置到环境变量 GHIDRA_INSTALL_DIR，同时确保具备兼容版本的 JDK。',
        href: 'https://github.com/NationalSecurityAgency/ghidra/releases',
        label: '下载 Ghidra',
      },
      java: {
        name: 'Java (JDK)',
        description: '供 Ghidra 和 jadx 使用的运行时环境。',
        setup: '若系统 PATH 中尚未配置兼容的 JDK，请安装 Temurin JDK 并设置 JAVA_HOME；如 PATH 已可直接调用 java，REA 也会尝试自动识别。',
        href: 'https://adoptium.net/temurin/releases/',
        label: '下载 JDK',
      },
      hopper: {
        name: 'Hopper',
        description: 'macOS / Linux 交互式反汇编与反编译工具。',
        setup: '安装 Hopper 后运行 rea setup 自动接入，或将启动器路径配置到环境变量 HOPPER_LAUNCHER_PATH。',
        href: 'https://www.hopperapp.com/download.html',
        label: '下载 Hopper',
      },
      ida: {
        name: 'IDA',
        description: '原生二进制逆向平台，通过独立 IDA MCP 桥接。',
        setup: '安装 IDA 并按照指南配置上游 IDA MCP 注册 JSON，然后将该 JSON 文件路径设置到环境变量 REA_IDA_MCP_CONFIG。',
        href: 'https://hex-rays.com/ida-free',
        label: '获取 IDA Free',
        extraLinks: [
          {
            key: 'ida-guide',
            href: 'https://github.com/morluto/rea/blob/main/docs/providers/ida-provider.md',
            label: 'IDA MCP 配置指南',
            text: 'MCP 配置指南',
          },
        ],
      },
      jadx: {
        name: 'jadx',
        dep: '需 Java',
        description: 'Android DEX / APK 反编译引擎。',
        setup: '从上游仓库下载 jadx-headless-mcp 发行版 JAR 并核对完整性，再将该 JAR 的绝对路径配置到环境变量 REA_JADX_MCP_JAR。',
        href: 'https://github.com/1013503897/jadx-headless-mcp/releases',
        label: '下载 jadx MCP',
      },
      apktool: {
        name: 'apktool',
        description: '解码 APK 资源文件与 AndroidManifest 清单。',
        setup: '安装 apktool 并加入系统 PATH，或通过环境变量 REA_APKTOOL_COMMAND 指定可执行文件绝对路径。',
        href: 'https://apktool.org/docs/install/',
        label: '安装 apktool',
      },
      adb: {
        name: 'adb',
        description: '连接与调试 Android 真机和模拟器。',
        setup: '安装 Android platform-tools 并加入 PATH，或通过环境变量 REA_ADB_PATH 指定 adb 可执行文件路径。',
        href: 'https://developer.android.com/tools/releases/platform-tools',
        label: '下载 platform-tools',
      },
      kuna: {
        name: 'Kuna',
        description: '轻量级原生二进制反编译引擎。',
        setup: '获取对应平台的 Kuna 可执行文件后，将其绝对路径配置到环境变量 REA_KUNA_COMMAND。',
        href: 'https://github.com/Noelo-Lab/kuna/releases',
        label: '下载 Kuna',
      },
    }

    async function call(path, init) {
      try {
        const response = await fetch('api/dsh-rea-gate/' + path, init)
        const result = await response.json()
        return response.ok || result?.ok === false ? result : null
      } catch {
        return null
      }
    }

    function post(body) {
      return call('toggle', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
    }

    function useGate() {
      const [state, setState] = React.useState(null)
      const [updateLookup, setUpdateLookup] = React.useState({ latest: null, checking: false, error: null })
      const [pending, setPending] = React.useState('load')
      const [feedback, setFeedback] = React.useState(null)
      const request = React.useRef(false)
      const updateRequest = React.useRef(false)
      const followUps = React.useRef(0)
      const followTimer = React.useRef(null)

      React.useEffect(() => () => {
        if (followTimer.current) clearTimeout(followTimer.current)
      }, [])

      const load = React.useCallback(async (refresh = false, options = {}) => {
        if (request.current) return
        request.current = true
        if (!options.silent) {
          setPending('load')
          setFeedback(null)
        }
        const next = await call(refresh ? 'state?refresh=1' : 'state')
        if (next && next.ok !== false) {
          setState(next)
          // A slow engine check answered with the cached view. Re-read once the
          // background `rea doctor` settles instead of blocking the first paint.
          if (next.checks === 'pending' && followUps.current < 3) {
            followUps.current += 1
            if (followTimer.current) clearTimeout(followTimer.current)
            followTimer.current = setTimeout(() => { void load(false, { silent: true }) }, 2_000)
            followTimer.current?.unref?.()
          }
        } else if (!options.silent) {
          setFeedback({ operation: 'load', error: true, title: '无法读取本机状态，请重试。' })
        }
        request.current = false
        if (!options.silent) setPending(null)
      }, [])

      React.useEffect(() => { void load() }, [load])

      async function checkForUpdates() {
        if (updateRequest.current) return
        updateRequest.current = true
        setUpdateLookup(({ latest }) => ({ latest, checking: true, error: null }))
        const next = await post({ action: 'check-update' })
        if (next?.ok !== false && typeof next?.latest === 'string') {
          setUpdateLookup({ latest: next.latest, checking: false, error: null })
        } else {
          setUpdateLookup({
            latest: null, checking: false,
            error: { error: true, title: '无法查询 npm 稳定版，请重试。', output: next?.message },
          })
        }
        updateRequest.current = false
      }

      async function run(body, operation = body.action ?? 'preference') {
        if (request.current) return false
        request.current = true
        setPending(operation)
        setFeedback(null)
        const next = await post(body)
        if (typeof next?.installed === 'boolean') setState(next)
        const success = Boolean(next && next.ok !== false)
        const meta = operationMeta(operation)
        if (!success) {
          setFeedback({ operation, error: true, title: meta?.failure ?? '操作失败，请重新检测本机状态。', output: next?.message })
        } else if (meta?.success) {
          setFeedback({ operation, title: meta.success, output: next.message })
        }
        request.current = false
        setPending(null)
        return success
      }

      const dismissFeedback = React.useCallback(() => setFeedback(null), [])
      const dismissUpdateError = React.useCallback(() => setUpdateLookup((prev) => ({ ...prev, error: null })), [])

      return { state, updateLookup, pending, feedback, run, load, checkForUpdates, dismissFeedback, dismissUpdateError }
    }

    function Chevron({ open }) {
      return h('span', { className: 'rea-chevron', 'data-open': String(Boolean(open)), 'aria-hidden': true },
        h('svg', { width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none' },
          h('path', {
            d: 'M6 3.5L10.5 8L6 12.5',
            stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round',
          }),
        ),
      )
    }

    function FolderIcon() {
      return h('svg', { width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true },
        h('path', {
          d: 'M2 4.5C2 3.67 2.67 3 3.5 3H6.2L7.5 4.5H12.5C13.33 4.5 14 5.17 14 6V11.5C14 12.33 13.33 13 12.5 13H3.5C2.67 13 2 12.33 2 11.5V4.5Z',
          stroke: 'currentColor', strokeWidth: 1.3, strokeLinejoin: 'round',
        }),
      )
    }

    function Section({ title, meta, actions, children }) {
      return h('section', null,
        h('div', { className: 'rea-heading' },
          h('div', { className: 'rea-heading-main' },
            h('h3', null, title),
            meta && h('div', { className: 'rea-heading-meta' }, meta),
          ),
          actions,
        ),
        children,
      )
    }

    function Status({ state = 'idle', children }) {
      return h('span', { className: 'rea-status' }, h(StateDot, { state, size: 7 }), children)
    }

    function CopyButton({ text, label = '复制', copiedLabel = '已复制', ariaLabel }) {
      const [status, setStatus] = React.useState('idle')
      const timer = React.useRef(null)
      React.useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
      const copy = async (event) => {
        event?.stopPropagation?.()
        if (timer.current) clearTimeout(timer.current)
        try {
          if (writeClipboard) await writeClipboard(text)
          else await navigator.clipboard.writeText(text)
          setStatus('copied')
        } catch {
          setStatus('failed')
        }
        timer.current = setTimeout(() => setStatus('idle'), 1800)
        timer.current?.unref?.()
      }
      const caption = status === 'copied' ? copiedLabel : status === 'failed' ? '复制失败' : label
      return h(Button, {
        variant: 'ghost',
        size: 'sm',
        className: status === 'copied' ? 'rea-copy-btn rea-copy-done' : 'rea-copy-btn',
        'aria-label': ariaLabel,
        onClick: copy,
      }, caption)
    }

    function DownloadLink({ href, label, plain, children }) {
      return h('a', {
        className: plain ? 'rea-download rea-download-plain' : 'rea-download',
        href,
        'aria-label': label,
        target: '_blank',
        rel: 'noopener noreferrer',
      }, children, h('span', { 'aria-hidden': true }, '↗'))
    }

    // The npm lookup returns a stable release. A prerelease of the same core is older.
    function compareToStable(current, latest) {
      const versionPattern = /^v?(\d+)\.(\d+)\.(\d+)(-[\w.-]+)?(?:\+[\w.-]+)?$/
      const local = current?.match(versionPattern)
      const remote = latest?.match(versionPattern)
      if (!local || !remote || remote[4]) return null
      for (let part = 1; part <= 3; part++) {
        const difference = Number(local[part]) - Number(remote[part])
        if (difference) return Math.sign(difference)
      }
      return local[4] ? -1 : 0
    }

    function versionAction(state, latest, retry) {
      if (state.cli === 'missing') return { action: 'install', label: '安装 REA', hint: '通过 npm 安装命令行工具并注册到 DSH。' }
      if (state.cli === 'unavailable' && !state.version) {
        return { action: 'reload', label: '重新检测本机', hint: '无法读取 REA 命令行状态。' }
      }
      if (!state.installed) {
        return state.version
          ? { action: 'install', operation: 'repair', label: '注册到 DSH', hint: '已找到本机 REA，可直接注册。' }
          : { action: 'install', label: '安装 REA' }
      }
      const registration = state.registration?.state
      if (registration && !['aligned', 'healthy'].includes(registration)) {
        return { action: 'install', operation: 'repair', label: '修复注册', hint: 'DSH 注册需要重新配置。' }
      }

      const comparison = compareToStable(state.version, latest)
      if (comparison === -1) return { action: 'update', label: '更新 REA', hint: `发现 npm 稳定版 ${latest}` }
      if (comparison === 0) return { action: 'check-update', label: '重新检查', hint: '已是最新版', secondary: true }
      if (comparison === 1) return { action: 'check-update', label: '重新检查', hint: `当前版本高于 npm 稳定版 ${latest}`, secondary: true }
      return {
        action: 'check-update',
        label: retry ? '重试检查更新' : latest ? '重新检查' : '检查更新',
        hint: latest ? `npm 稳定版 ${latest}，请重新检测本机版本。` : '可随时检查 npm 稳定版更新。',
      }
    }

    function UninstallDialog({ onConfirm, onDismiss }) {
      const dialog = React.useRef(null)
      const titleId = React.useId()
      const [removePackage, setRemovePackage] = React.useState(false)
      React.useEffect(() => {
        if (dialog.current && !dialog.current.open) dialog.current.showModal()
      }, [])
      const close = () => {
        dialog.current?.close()
        onDismiss()
      }
      return h('dialog', {
        className: 'rea-dialog', ref: dialog, 'aria-labelledby': titleId,
        onCancel: (event) => { event.preventDefault(); close() },
      },
        h('div', { className: 'rea-row' },
          h('h3', { id: titleId, className: 'rea-dialog-title' }, '卸载 REA 集成'),
        ),
        h('div', { className: 'rea-dialog-body' },
          h('p', { className: 'rea-muted' }, '此操作会清理本机所有客户端中的 REA 注册信息，确认继续吗？'),
          h('ul', { className: 'rea-impact-list' },
            h('li', null,
              h('span', { className: 'rea-impact-tag rea-impact-remove' }, '将移除'),
              h('span', null, removePackage
                ? 'REA 为 DSH 及其他客户端创建的注册和技能文件，以及本机全局 rea-agents 命令行包'
                : 'REA 为 DSH 及其他客户端创建的注册和技能文件'),
            ),
            h('li', null,
              h('span', { className: 'rea-impact-tag rea-impact-keep' }, '将保留'),
              h('span', null, removePackage
                ? '工作区门控偏好与本地分析引擎'
                : 'REA 命令行软件包、工作区门控偏好与本地分析引擎'),
            ),
          ),
          h('label', { className: 'rea-checkbox-row' },
            h('input', {
              type: 'checkbox',
              checked: removePackage,
              onChange: (event) => setRemovePackage(Boolean(event?.target?.checked)),
            }),
            h('span', null, '同时卸载本机 rea-agents 命令行包（npm uninstall -g rea-agents）'),
          ),
        ),
        h('div', { className: 'rea-content rea-divider rea-actions rea-setting-actions' },
          h(Button, { variant: 'outline', size: 'sm', onClick: close }, '取消'),
          h(Button, {
            variant: 'primary', size: 'sm', className: 'rea-danger-solid',
            onClick: () => { close(); return onConfirm(removePackage) },
          }, removePackage ? '彻底卸载' : '确认卸载'),
        ),
      )
    }

    function Feedback({ feedback, onDismiss }) {
      return h('div', { className: 'rea-feedback' },
        h('div', { className: 'rea-feedback-head' },
          h('div', {
            role: feedback.error ? 'alert' : 'status',
            className: feedback.error ? 'rea-error' : 'rea-muted',
          }, feedback.title),
          onDismiss && h('button', {
            type: 'button', className: 'rea-dismiss', 'aria-label': '关闭提示', onClick: onDismiss,
          }, '×'),
        ),
        feedback.output && h('pre', {
          className: 'rea-output rea-muted', dir: 'ltr', tabIndex: 0, 'aria-label': '命令输出',
        }, feedback.output),
      )
    }

    function Lifecycle({ state, updateLookup, pending, feedback, load, run, checkForUpdates, dismissFeedback, dismissUpdateError }) {
      const [confirmUninstall, setConfirmUninstall] = React.useState(false)
      const busy = Boolean(pending) || updateLookup.checking
      const registration = state.registration?.state
      const registered = registration === 'aligned' || registration === 'healthy'
      const registrationTone = registered ? 'ready' : registration === 'missing' ? 'idle' : registration ? 'attention' : 'idle'
      const registrationLabel = registered ? 'DSH 已注册'
        : registration === 'missing' ? 'DSH 未注册'
          : registration ? 'DSH 注册异常' : 'DSH 注册待确认'
      const toolCount = state.registeredTools ?? 0
      const toolsNotice = toolCount > 0 && registration === 'missing'
        ? '本机注册已移除，但宿主仍显示已加载工具，可重新检测确认。'
        : toolCount === 0 && state.installed
          ? '工具尚未加载到当前宿主，重新检测后如仍未生效可重启 DSH。'
          : null

      const canMaintain = state.installed && !['missing', 'unavailable'].includes(state.cli)
      const isLifecycleOp = (op) => Boolean(op && !['load', 'preference', 'workspace'].includes(op) && !op.startsWith('engine-'))
      const localFeedback = isLifecycleOp(feedback?.operation) ? feedback : null
      const primary = versionAction(state, updateLookup.latest, Boolean(updateLookup.error))
      const lifecyclePending = isLifecycleOp(pending)
      const start = () => {
        if (primary.action === 'check-update') return checkForUpdates()
        return primary.action === 'reload' ? load(true) : run({ action: primary.action }, primary.operation)
      }
      const showReinstall = !state.installed && Boolean(state.version)

      return h(Section, { title: '运行状态与更新' },
        h('div', { className: 'rea-group' },
          h('div', { className: 'rea-row rea-setting-row' },
            h('div', { className: 'rea-setting-info' },
              h('div', { className: 'rea-overview-title' },
                h('span', { className: 'rea-overview-name' }, 'REA'),
                h('span', { className: 'rea-version-pill', dir: state.version ? 'ltr' : undefined },
                  state.version ?? (state.cli === 'missing' ? '未安装' : '版本待确认'),
                ),
                h('span', { className: 'rea-badge', 'data-tone': registrationTone },
                  h(Status, { state: registered ? 'done' : 'idle' }, registrationLabel),
                ),
                (state.installed || toolCount > 0) && h('span', { className: 'rea-badge', 'data-tone': toolCount > 0 ? 'ready' : 'idle' },
                  toolCount > 0 ? `宿主已加载 ${toolCount} 个工具` : '宿主未加载',
                ),
              ),
              h('p', { className: 'rea-muted rea-overview-hint', role: 'status' },
                updateLookup.checking ? '正在查询 npm 稳定版…' : primary.hint,
              ),
              toolsNotice && h('p', { className: 'rea-muted rea-overview-hint' }, toolsNotice),
            ),
            h('div', { className: 'rea-actions rea-setting-actions' },
              h(Button, { variant: primary.secondary ? 'outline' : 'primary', size: 'sm', disabled: busy, onClick: start },
                updateLookup.checking ? '检查中…' : primary.label),
              showReinstall && h(Button, {
                variant: 'outline', size: 'sm', disabled: busy,
                onClick: () => run({ action: 'reinstall' }, 'reinstall'),
              }, '重装最新版'),
              !canMaintain && h(DownloadLink, { href: 'https://rea.tools/get-started/', plain: true }, 'REA 安装指南'),
            ),
          ),
          canMaintain && h('div', { className: 'rea-row rea-setting-row rea-maintenance-bar rea-divider' },
            h('span', { className: 'rea-setting-info rea-muted' }, 'DSH 集成维护'),
            h('div', { className: 'rea-actions rea-setting-actions' },
              h(DownloadLink, { href: 'https://rea.tools/get-started/', plain: true }, 'REA 安装指南'),
              primary.operation !== 'repair' && h(Button, {
                variant: 'ghost', size: 'sm', disabled: busy,
                onClick: () => run({ action: 'install' }, 'repair'),
              }, '重新注册'),
              h(Button, {
                variant: 'ghost', size: 'sm', className: 'rea-danger-ghost', disabled: busy, 'aria-haspopup': 'dialog',
                onClick: () => setConfirmUninstall(true),
              }, '卸载集成'),
            ),
          ),
          lifecyclePending && h('div', { className: 'rea-content rea-divider', role: 'status' },
            h(Status, { state: 'ongoing' }, operationMeta(pending)?.pending),
          ),
          localFeedback && h('div', { className: 'rea-content rea-divider' },
            h(Feedback, { feedback: localFeedback, onDismiss: dismissFeedback }),
          ),
          updateLookup.error && primary.action === 'check-update' &&
            h('div', { className: 'rea-content rea-divider' },
              h(Feedback, { feedback: updateLookup.error, onDismiss: dismissUpdateError }),
            ),
        ),
        confirmUninstall && h(UninstallDialog, {
          onConfirm: (removePackage) => run(
            removePackage ? { action: 'uninstall', removePackage: true } : { action: 'uninstall' },
            removePackage ? 'uninstall-full' : 'uninstall',
          ),
          onDismiss: () => setConfirmUninstall(false),
        }),
      )
    }

    function splitWorkspacePath(fullPath) {
      const normalized = String(fullPath || '').replace(/[\\/]+$/, '')
      if (!normalized) return { name: fullPath || '/', path: fullPath || '/' }
      const parts = normalized.split(/[\\/]/)
      return { name: parts[parts.length - 1] || normalized, path: fullPath }
    }

    function SessionDefaults({ state, pending, feedback, run }) {
      const savingDefault = pending === 'preference'
      const defaultFeedback = feedback?.operation === 'preference' ? feedback : null
      const workspaceFeedback = feedback?.operation === 'workspace' ? feedback : null
      const workspaces = state.workspaces ?? []

      return h(Section, { title: '会话与工作区设置' },
        h('div', { className: 'rea-group' },
          h('div', { className: 'rea-row rea-setting-row' },
            h('div', { className: 'rea-setting-info' },
              h('div', { className: 'rea-label' }, '新会话默认启用 REA'),
              h('p', { className: 'rea-muted' }, '未单独配置的工作区将继承此设置；当前会话可随时通过顶部 REA 胶囊切换。'),
              defaultFeedback?.error && h('p', { className: 'rea-muted rea-error', role: 'alert' }, defaultFeedback.title),
            ),
            h('div', { className: 'rea-actions rea-setting-actions' },
              h('span', { role: 'status', className: 'rea-muted' },
                savingDefault ? operations.preference.pending : defaultFeedback?.error ? '' : defaultFeedback?.title,
              ),
              h(Switch, {
                checked: state.default ?? state.open ?? false,
                label: '新会话默认启用 REA',
                disabled: Boolean(pending),
                onChange: (open) => run({ open }, 'preference'),
              }),
            ),
          ),
          h('div', { className: 'rea-subhead rea-divider' },
            h('span', null, '工作区独立规则'),
            workspaces.length > 0 && h('span', null, `${workspaces.length} 个已记忆`),
          ),
          workspaceFeedback?.error && h('div', { className: 'rea-content rea-divider' },
            h('p', { className: 'rea-muted rea-error', role: 'alert' }, workspaceFeedback.title),
          ),
          workspaces.length === 0
            ? h('div', { className: 'rea-ws-empty rea-muted' },
              '暂无工作区独立规则。在任意会话顶部切换 REA 开关时，会自动记住该工作区的偏好。',
            )
            : h('ul', { className: 'rea-list', 'aria-label': '工作区独立规则' },
              workspaces.map(({ path, open }) => {
                const { name } = splitWorkspacePath(path)
                return h('li', { key: path, className: 'rea-ws-item' },
                  h('div', { className: 'rea-ws-main' },
                    h('span', { className: 'rea-ws-icon' }, h(FolderIcon)),
                    h('div', { className: 'rea-ws-text' },
                      h('div', { className: 'rea-ws-name', title: path }, name),
                      h('span', { className: 'rea-ws-path', dir: 'ltr', title: path }, path),
                    ),
                  ),
                  h('div', { className: 'rea-ws-controls' },
                    h('span', { className: 'rea-badge', 'data-tone': open ? 'ready' : 'idle' }, open ? '已启用' : '已关闭'),
                    h(Switch, {
                      checked: open,
                      label: `工作区 ${path} 启用 REA`,
                      disabled: Boolean(pending),
                      onChange: (nextOpen) => run({ workspace: path, open: nextOpen }, 'workspace'),
                    }),
                    h(Button, {
                      variant: 'ghost',
                      size: 'sm',
                      disabled: Boolean(pending),
                      title: '移除独立规则，恢复继承全局默认',
                      'aria-label': `重置工作区 ${path}`,
                      onClick: () => run({ action: 'reset-workspace', workspace: path }, 'workspace'),
                    }, '重置'),
                  ),
                )
              }),
            ),
        ),
      )
    }

    function parseDiagnosticText(raw) {
      const shaMatch = raw.match(/\b([a-f0-9]{64})\b/i)
      const sha256 = shaMatch ? shaMatch[1] : null
      const urlRegex = /https?:\/\/[^\s,)]+/g
      const segments = []
      let lastIndex = 0
      let match
      while ((match = urlRegex.exec(raw)) !== null) {
        const href = match[0].replace(/[.;:]+$/, '')
        if (match.index > lastIndex) segments.push({ type: 'text', value: raw.slice(lastIndex, match.index) })
        const fileName = href.split('/').pop() || href
        segments.push({ type: 'link', href, label: fileName.length > 42 ? `${fileName.slice(0, 39)}…` : fileName })
        lastIndex = match.index + href.length
      }
      if (lastIndex < raw.length) segments.push({ type: 'text', value: raw.slice(lastIndex) })
      return { segments, sha256 }
    }

    function renderDiagnosticSegments(segments) {
      return segments.map((seg, index) => {
        if (seg.type === 'link') {
          return h('a', {
            key: `link-${index}`,
            className: 'rea-inline-link',
            href: seg.href,
            target: '_blank',
            rel: 'noopener noreferrer',
            title: seg.href,
          }, `${seg.label} ↗`)
        }
        // Collapse long 64-char SHA-256 inline since we surface a dedicated copyable SHA-256 row below
        const compact = seg.value.replace(/\b([a-f0-9]{8})[a-f0-9]{48}([a-f0-9]{8})\b/gi, '$1…$2')
        return compact
      })
    }

    function engineMeta(engine) {
      const { id, available, checked, configured } = engine
      const needsCheck = Boolean(checked && configured && !available)
      const state = available ? 'ready' : needsCheck ? 'attention' : 'idle'
      const tone = available ? 'ready' : needsCheck ? 'attention' : configured ? 'info' : 'idle'
      const status = available ? '可用'
        : needsCheck ? '需检查'
          : configured ? '已配置，待验证'
            : checked ? '未配置'
              : '待验证'
      return { id, state, tone, status, needsCheck }
    }

    function EnvVarEditor({ variable, busy, onSave }) {
      const { name: varName, set, value, fromHostEnv } = variable
      const savedValue = value ?? ''
      const [draft, setDraft] = React.useState(savedValue)
      React.useEffect(() => { setDraft(savedValue) }, [savedValue])
      const trimmed = draft.trim()
      const canSave = !busy && trimmed.length > 0 && trimmed !== savedValue
      const placeholder = fromHostEnv
        ? '已由宿主环境变量设置（可填写绝对路径覆盖）'
        : (ENV_PLACEHOLDERS[varName] ?? `填写 ${varName} 的绝对路径`)

      const submit = (event) => {
        event?.preventDefault?.()
        if (canSave) return onSave(varName, trimmed)
      }

      return h('li', { className: 'rea-env-row' },
        h('div', { className: 'rea-env-head' },
          h('div', { className: 'rea-env-main' },
            h(StateDot, { state: set ? 'done' : 'idle', size: 7 }),
            h('code', { className: 'rea-env-code', dir: 'ltr' }, varName),
            h('span', { className: 'rea-env-state', 'data-set': String(Boolean(set)) }, set ? '已设置' : '未设置'),
          ),
          h(CopyButton, { text: varName, label: '复制变量', ariaLabel: `复制环境变量 ${varName}` }),
        ),
        h('form', { className: 'rea-env-edit', onSubmit: submit },
          h('input', {
            type: 'text',
            className: 'rea-path-input',
            dir: 'ltr',
            value: draft,
            placeholder,
            disabled: busy,
            'aria-label': `${varName} 路径`,
            onChange: (event) => setDraft(event?.target?.value ?? ''),
          }),
          h(Button, {
            type: 'button',
            variant: 'outline',
            size: 'sm',
            disabled: !canSave,
            'aria-label': `保存 ${varName}`,
            onClick: submit,
          }, '保存并检测'),
          savedValue && h(Button, {
            type: 'button',
            variant: 'ghost',
            size: 'sm',
            disabled: busy,
            'aria-label': `清除 ${varName}`,
            onClick: () => { setDraft(''); return onSave(varName, '') },
          }, '清除'),
        ),
      )
    }

    function EngineRow({ engine, expanded, onToggle, pending, feedback, run, dismissFeedback }) {
      const detailId = React.useId()
      const { id, available, variables, checks, version, canInstall, installCommand } = engine
      const provider = providers[id] ?? { name: id, description: '可选分析引擎。' }
      const { state, tone, status } = engineMeta(engine)
      const mark = state === 'ready' ? '✓' : state === 'attention' ? '!' : '−'
      const busy = Boolean(pending)
      const installOp = `engine-install:${id}`
      const envOp = `engine-env:${id}`
      const installing = pending === installOp
      const savingEnv = pending === envOp
      const rowFeedback = feedback && (feedback.operation === installOp || feedback.operation === envOp) ? feedback : null

      const failedHints = [...new Set(
        (checks ?? [])
          .filter(({ ok }) => !ok)
          .map(({ detail, remediation }) => remediation || detail)
          .filter(Boolean),
      )]
      const passedDetails = [...new Set(
        (checks ?? [])
          .filter(({ ok, detail }) => ok && detail)
          .map(({ detail }) => detail),
      )]
      const parsedHints = failedHints.map(parseDiagnosticText)
      const hashes = [...new Set(parsedHints.map((item) => item.sha256).filter(Boolean))]

      const links = [
        provider.href && { key: 'download', href: provider.href, text: provider.label, label: provider.label },
        ...(provider.extraLinks ?? []),
      ].filter(Boolean)

      const saveEnv = (varName, nextValue) => run({ action: 'set-env', values: { [varName]: nextValue } }, envOp)
      const install = () => run({ action: 'install-engine', engine: id }, installOp)

      return h('li', { className: 'rea-engine-item' },
        h('button', {
          type: 'button',
          className: 'rea-engine-trigger',
          'aria-expanded': expanded,
          'aria-controls': detailId,
          onClick: onToggle,
        },
          h('div', { className: 'rea-engine-left' },
            h('span', { className: 'rea-engine-mark', 'data-state': state, 'aria-hidden': true }, mark),
            h('div', { className: 'rea-engine-text' },
              h('div', { className: 'rea-engine-title-row' },
                h('span', { className: 'rea-label' }, provider.name),
                version && h('span', { className: 'rea-version-pill', dir: 'ltr' }, version),
                provider.dep && h('span', { className: 'rea-engine-dep' }, provider.dep),
              ),
              provider.description && h('div', { className: 'rea-engine-desc' }, provider.description),
            ),
          ),
          h('div', { className: 'rea-engine-right' },
            h('span', { className: 'rea-badge', 'data-tone': tone }, status),
            h(Chevron, { open: expanded }),
          ),
        ),
        expanded && h('div', { id: detailId, className: 'rea-engine-detail' },
          provider.setup && h('div', { className: 'rea-detail-block' },
            h('div', { className: 'rea-detail-label' }, '配置说明'),
            h('p', { className: 'rea-detail-guide' }, provider.setup),
          ),
          variables?.length > 0 && h('div', { className: 'rea-detail-block' },
            h('div', { className: 'rea-detail-label' }, '环境变量与路径配置'),
            h('ul', { className: 'rea-list rea-env-list', 'aria-label': `${provider.name} 环境变量` },
              variables.map((variable) => h(EnvVarEditor, {
                key: variable.name,
                variable,
                busy,
                onSave: saveEnv,
              })),
            ),
          ),
          (installing || savingEnv) && h('div', { role: 'status', className: 'rea-muted' },
            h(Status, { state: 'ongoing' },
              installing
                ? `正在执行 ${installCommand || 'Homebrew 安装'}（可能需要几分钟）…`
                : operationMeta(envOp)?.pending,
            ),
          ),
          rowFeedback && h(Feedback, { feedback: rowFeedback, onDismiss: dismissFeedback }),
          available
            ? h('div', { className: 'rea-diag-box', 'data-tone': 'ready' },
              h('p', null, '本机检测通过，在启用 REA 的会话中可直接调用此引擎。'),
              passedDetails.length > 0 && h('div', { className: 'rea-path-code', dir: 'ltr' }, passedDetails.join(' · ')),
            )
            : parsedHints.length > 0 && h('div', { className: 'rea-detail-block' },
              h('div', { className: 'rea-detail-label' }, state === 'attention' ? '异常诊断（rea doctor）' : '检测详情（rea doctor）'),
              h('div', { className: 'rea-diag-box', 'data-tone': state },
                parsedHints.map((item, idx) => h('p', { key: idx, dir: 'ltr' }, renderDiagnosticSegments(item.segments))),
                hashes.map((hash) => h('div', { key: hash, className: 'rea-hash-row' },
                  h('span', { className: 'rea-hash-val', dir: 'ltr', title: hash }, `SHA-256: ${hash}`),
                  h(CopyButton, { text: hash, label: '复制 SHA-256', ariaLabel: '复制 SHA-256 校验值' }),
                )),
              ),
            ),
          (canInstall && !available || links.length > 0) && h('div', { className: 'rea-detail-actions' },
            canInstall && !available && h(Button, {
              variant: 'primary',
              size: 'sm',
              disabled: busy,
              title: installCommand || undefined,
              onClick: install,
            }, installing ? '安装中…' : `一键安装 ${provider.name}`),
            links.map((link) => h(DownloadLink, { key: link.key, href: link.href, label: link.label }, link.text)),
          ),
        ),
      )
    }

    function Environment({ state, pending, feedback, load, run, dismissFeedback }) {
      const [toggled, setToggled] = React.useState({})
      const checking = pending === 'load'
      const checkFailure = feedback?.operation === 'load' ? feedback : null
      const checkedAt = state.checkedAt && new Date(state.checkedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })

      const rawEngines = [...(state.engines ?? [])]
      const javaHome = rawEngines.flatMap(({ variables }) => variables ?? []).find(({ name }) => name === 'JAVA_HOME')
      if (!rawEngines.some(({ id }) => id === 'java')) {
        rawEngines.push({
          id: 'java',
          configured: javaHome?.set === true,
          variables: javaHome ? [javaHome] : [{ name: 'JAVA_HOME', set: false }],
        })
      }

      const engineMap = new Map(rawEngines.map((engine) => [engine.id, engine]))
      const knownIds = new Set(ENGINE_GROUPS.flatMap((g) => g.engines))
      const extraEngines = rawEngines.filter((engine) => !knownIds.has(engine.id))

      const counts = rawEngines.reduce((acc, engine) => {
        const meta = engineMeta(engine)
        acc.all += 1
        acc[meta.state] += 1
        return acc
      }, { all: 0, ready: 0, attention: 0, idle: 0 })

      const groups = [
        ...ENGINE_GROUPS.map((group) => ({
          id: group.id,
          title: group.title,
          items: group.engines.map((id) => engineMap.get(id)).filter(Boolean),
        })),
        ...(extraEngines.length > 0 ? [{
          id: 'other',
          title: '其他引擎',
          items: extraEngines,
        }] : []),
      ].filter((group) => group.items.length > 0)

      const isExpanded = (engine) => {
        if (Object.hasOwn(toggled, engine.id)) return toggled[engine.id]
        return engineMeta(engine).state === 'attention'
      }
      const toggleEngine = (engine) => {
        const current = isExpanded(engine)
        setToggled((prev) => ({ ...prev, [engine.id]: !current }))
      }

      const metaParts = [
        `可用 ${counts.ready} / ${counts.all}`,
        counts.attention > 0 ? `需检查 ${counts.attention}` : null,
        checkedAt ? `上次检测 ${checkedAt}` : null,
        '点击条目展开配置与详情',
      ].filter(Boolean)

      return h(Section, {
        title: '分析引擎与依赖',
        meta: h('span', { className: 'rea-muted' }, checking ? '正在重新检测本机状态…' : metaParts.join(' · ')),
        actions: h(Button, {
          variant: 'ghost', size: 'sm', icon: h(IconRefreshOutlineRegular, { size: 14 }),
          disabled: Boolean(pending), onClick: () => load(true),
        }, checking ? '检测中…' : '重新检测'),
      },
        h('div', { className: 'rea-group' },
          checkFailure && h('div', { className: 'rea-content' }, h(Feedback, { feedback: checkFailure })),
          groups.map((group, groupIndex) => h('div', { key: group.id },
            h('div', { className: groupIndex === 0 && !checkFailure ? 'rea-subhead' : 'rea-subhead rea-divider' },
              h('span', null, group.title),
              h('span', null, `${group.items.length} 项`),
            ),
            h('ul', { className: 'rea-list', 'aria-label': group.title },
              group.items.map((engine) => h(EngineRow, {
                key: engine.id,
                engine,
                expanded: isExpanded(engine),
                onToggle: () => toggleEngine(engine),
                pending,
                feedback,
                run,
                dismissFeedback,
              })),
            ),
          )),
        ),
      )
    }

    function UsageGuide() {
      const [open, setOpen] = React.useState(false)
      const bodyId = React.useId()
      const examples = [
        '用 REA 查看 <应用路径> 的 Electron 入口模块和 preload 脚本。',
        '用 REA 列出 <文件路径> 中 .NET 程序集的公开类型和入口点。',
      ]
      return h('section', null,
        h('div', { className: 'rea-group' },
          h('div', { className: 'rea-disclosure-bar' },
            h('button', {
              type: 'button',
              className: 'rea-disclosure-main',
              'aria-expanded': open,
              'aria-controls': bodyId,
              onClick: () => setOpen((v) => !v),
            },
              h('div', { className: 'rea-label' }, 'REA 会话示例'),
              h('p', { className: 'rea-muted' }, '开启 REA 后可直接发给助手的逆向分析提示词模板'),
            ),
            h('div', { className: 'rea-disclosure-right' },
              h(DownloadLink, { href: 'https://github.com/morluto/rea', plain: true }, 'REA 文档'),
              h('button', {
                type: 'button',
                className: 'rea-disclosure-chevron-btn',
                'aria-hidden': true,
                tabIndex: -1,
                onClick: () => setOpen((v) => !v),
              }, h(Chevron, { open })),
            ),
          ),
          open && h('div', { id: bodyId, className: 'rea-content rea-divider rea-stack' },
            examples.map((prompt) => h('div', { key: prompt, className: 'rea-prompt-card' },
              h('div', { className: 'rea-prompt-text' },
                h('span', { className: 'rea-prompt-quote', 'aria-hidden': true }, '›'),
                h('span', null, prompt),
              ),
              h(CopyButton, { text: prompt, ariaLabel: `复制示例：${prompt}` }),
            )),
            h('p', { className: 'rea-muted' }, '仅在本次会话临时使用时，可调用 rea_gate 并将 remember 设为 false。'),
          ),
        ),
      )
    }

    function AdvancedDiagnostics({ state }) {
      const [open, setOpen] = React.useState(false)
      const [diagnostic, setDiagnostic] = React.useState(null)
      const bodyId = React.useId()
      const checkModule = async () => {
        setDiagnostic('checking')
        setDiagnostic((await call('diagnose'))?.graph ?? 'unavailable')
      }
      const configPath = state.registration?.path

      return h('section', null,
        h('div', { className: 'rea-group' },
          h('button', {
            type: 'button',
            className: 'rea-disclosure-trigger',
            'aria-expanded': open,
            'aria-controls': bodyId,
            onClick: () => setOpen((v) => !v),
          },
            h('div', null,
              h('div', { className: 'rea-label' }, '高级诊断'),
              h('p', { className: 'rea-muted' }, '查看 DSH 配置文件路径与宿主客户端模块图状态'),
            ),
            h(Chevron, { open }),
          ),
          open && h('div', { id: bodyId, className: 'rea-divider' },
            configPath && h('div', { className: 'rea-row rea-setting-row' },
              h('div', { className: 'rea-setting-info' },
                h('div', { className: 'rea-label' }, 'DSH 注册配置路径'),
                h('div', { className: 'rea-path-code', dir: 'ltr' }, configPath),
              ),
              h('div', { className: 'rea-actions rea-setting-actions' },
                h(CopyButton, { text: configPath, label: '复制路径', ariaLabel: '复制 DSH 配置路径' }),
              ),
            ),
            h('div', { className: 'rea-row rea-setting-row' },
              h('div', { className: 'rea-setting-info' },
                h('div', { className: 'rea-label' }, '插件诊断'),
                h('div', { role: 'status', className: 'rea-muted' },
                  !diagnostic ? '检查宿主是否已发布面板模块。'
                    : diagnostic === 'checking' ? '正在检查模块图…'
                      : diagnostic === 'unavailable' ? '无法读取模块图，请重试。'
                        : diagnostic.selfPresent ? `模块已加入图（${diagnostic.rev}）` : '模块尚未加入图。',
                ),
              ),
              h('div', { className: 'rea-actions rea-setting-actions' },
                h(Button, {
                  variant: 'outline', size: 'sm', disabled: diagnostic === 'checking', onClick: checkModule,
                }, diagnostic === 'checking' ? '检查中…' : '检查模块图'),
              ),
            ),
          ),
        ),
      )
    }

    function GateControls() {
      const data = useGate()
      const { state, feedback, pending, load } = data
      return h('div', { className: 'rea-gate rea-gate-controls' },
        h('style', null, CSS),
        state ? [
          h(Lifecycle, { ...data, key: 'lifecycle' }),
          h(SessionDefaults, { ...data, key: 'session' }),
          h(Environment, { ...data, key: 'environment' }),
          h(UsageGuide, { key: 'usage' }),
          h(AdvancedDiagnostics, { state, key: 'diagnostics' }),
        ] : h(Section, { title: '运行状态与更新' },
          h('div', { className: 'rea-group rea-row rea-setting-row' },
            pending ? h('div', { role: 'status' }, h(Status, { state: 'ongoing' }, '正在读取本机状态…'))
              : h(Feedback, { feedback: feedback ?? { error: true, title: '无法读取本机状态，请重试。' } }),
            !pending && h(Button, { variant: 'outline', size: 'sm', onClick: () => load(true) }, '重试'),
          ),
        ),
      )
    }

    function ReaPanel() {
      return h('div', { className: 'rea-gate rea-gate-page' },
        h('div', { className: 'rea-gate-page-inner' },
          h('header', { className: 'rea-page-head' },
            h('div', { className: 'rea-logo' }, h(ReaIcon, { size: 18 })),
            h('div', null,
              h('h1', null, 'REA 管理'),
              h('p', { className: 'rea-muted rea-page-sub' }, '管理本机 REA 集成、工作区门控偏好与可选分析引擎'),
            ),
          ),
          h(GateControls),
        ),
      )
    }

    function ReaPluginConfig({ view }) {
      return view === 'page' ? h(GateControls) : null
    }

    function ReaChip(props) {
      const sessionId = props?.sessionId ?? props?.session?.id ?? props?.session?.sessionId ?? props?.binding?.sessionId
      if (!sessionId) return null
      return h(SessionGate, { key: sessionId, sessionId })
    }

    function SessionGate({ sessionId }) {
      const [state, setState] = React.useState(null)
      const [busy, setBusy] = React.useState(false)
      const [message, setMessage] = React.useState('')

      React.useEffect(() => {
        let current = true
        let stopped = false
        let inflight = false
        let timer = null
        const path = `state?session=${encodeURIComponent(sessionId)}`
        // The gate also changes from the panel and from the `rea_gate` tool. The
        // chip must not keep showing a decision another surface already reversed.
        const read = async (full = false) => {
          if (inflight) return null
          inflight = true
          const next = await call(full ? path : `${path}&checks=0`)
          inflight = false
          if (current && next && next.ok !== false) setState(next)
          return next
        }
        const schedule = () => {
          timer = setTimeout(async () => {
            if (stopped) return
            await read()
            if (!stopped) schedule()
          }, 5_000)
          timer?.unref?.()
        }
        void read().then((next) => {
          if (current && next?.installed === false) void read(true)
          if (!stopped) schedule()
        })
        return () => {
          current = false
          stopped = true
          if (timer) clearTimeout(timer)
        }
      }, [sessionId])

      if (!state) return null

      const installed = state.installed !== false
      const open = state.open === true
      const toggle = async () => {
        if (busy) return
        setBusy(true)
        setMessage('')
        const body = installed ? { session: sessionId, open: !open } : { session: sessionId, action: 'install' }
        const next = await post(body)
        if (typeof next?.installed === 'boolean') setState(next)
        if (!next || next.ok === false) setMessage(next?.message || '无法切换 REA')
        setBusy(false)
      }

      return h(Pill, {
        active: installed && open,
        onClick: toggle,
        disabled: busy,
        title: message || (state.sessionKnown ? `本会话可见 ${state.tools} 个 REA 工具` : state.workspace) || 'REA',
        'aria-pressed': installed ? open : undefined,
      }, h(StateDot, { state: busy ? 'ongoing' : installed && open ? 'done' : 'idle', size: 8 }),
      installed ? (open ? 'REA 开' : 'REA 关') : 'REA 未安装')
    }

    function ReaIcon(props) {
      const size = typeof props?.size === 'number' ? props.size : 16
      return h(
        'svg',
        { width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': true, fill: 'none' },
        h('rect', { x: 3.5, y: 4.5, width: 3, height: 15, rx: 1.5, fill: 'currentColor', opacity: 0.5 }),
        h('rect', { x: 8.5, y: 4.5, width: 3, height: 15, rx: 1.5, fill: 'currentColor', opacity: 0.75 }),
        h('circle', { cx: 17, cy: 12, r: 4, fill: 'currentColor' }),
      )
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('main', () =>
          ctx.slots.register({ name: 'main', key: PANEL_ID }, ReaPanel),
        )
        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register(
            { name: 'sidebar.panellist', id: PANEL_ID, order: 20, label: () => 'REA' },
            ReaIcon,
          ),
        )
        ctx.slots.inject('plugins.bundle.config', () =>
          ctx.slots.register({ name: 'plugins.bundle.config', key: 'dsh-rea-gate' }, ReaPluginConfig),
        )
        // `conversation.header` is a single slot with no registration options: writing
        // there replaces the shipped navigation container. The chip belongs to the
        // session-scoped action list, which also supplies the `sessionId` prop.
        ctx.slots.inject('conversation.session.header.actions', () =>
          ctx.slots.register(
            { name: 'conversation.session.header.actions', id: PANEL_ID, order: 40, label: () => 'REA' },
            ReaChip,
          ),
        )
      },
    }
  },
})
