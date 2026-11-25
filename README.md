# Climatrics_Enterprise

Enterprise Climate Risk, Sustainable Finance and Regulatory Intelligence Platform

## GCB demo prototype (CONFIDENTIAL, under NDA)

A working prototype for the GCB Bank technical demo. All data is synthetic ("Demo Bank Ghana"), and all model parameters are illustrative.

## Run it

```bash
nvm use 24
npm ci
npm run demo:setup
npm run build && npm start -- -p 3470   # open http://localhost:3470
```

## CI/CD

`.github/workflows/ci-cd.yml` runs on every push and pull request to `main`: install, lint, type-check and build. When that passes on `main`, it deploys to Netlify production with the Netlify CLI. The deploy needs two repository secrets (Settings → Secrets and variables → Actions): `NETLIFY_AUTH_TOKEN` (Netlify → User settings → Applications → Personal access tokens) and `NETLIFY_SITE_ID` (Netlify → Project configuration → General → Project ID). Without them the deploy step is skipped with a warning and CI still runs. If Netlify's own Git builds are also on, turn them off (Project configuration → Build & deploy → Stop builds) so each push deploys once.

## Deploy to Netlify

`netlify.toml` builds with Node 24. On Netlify, data (datasets, runs, approvals, audit trail) is kept in Netlify Blobs; locally it is kept in `.data/`. Set these environment variables on the site: `SESSION_SECRET_KEY` (a long random string) and `DEMO_PASSWORD_KEY`.

## Sign in

Three demo accounts, one per role: `kofi.mensah@climatrics.demo` (analyst: loads data, runs tests), `ama.owusu@climatrics.demo` (approver) and `yaw.boateng@climatrics.demo` (auditor, read-only). The password is not in the code: set `DEMO_PASSWORD_KEY` in `.env.local` locally (quote it if it contains `#`) or in the host's environment variables, and `SESSION_SECRET_KEY` to fix the session-signing key (otherwise one is generated in `.data/`). Five wrong passwords lock an account for 15 minutes. Authenticator-app MFA is enabled by default. The local setup command creates an ignored `.env.local` with a generated password, a signing key and `MFA_MODE=off` for private rehearsal. Read `DEMO_PASSWORD_KEY` from that file to sign in. Remove `MFA_MODE=off` and restart to rehearse authenticator enrollment. Production SSO is planned.

To reset the demo to a clean state (no runs, a fresh audit log), stop the server, delete `.data/` and start it again.

## Where things live

| Path | What |
|---|---|
| `src/lib/params.ts` | **Every model parameter**: hazards, sector sensitivities, NGFS scenario paths, PD/LGD betas, bank capital and liquidity. Swap in the methodology team's values here. |
| `src/lib/portfolio.ts` | Synthetic loan book generator, plus the demo extract with 5 deliberately bad rows |
| `src/lib/ingest.ts` | Validation, exception queue, control-total reconciliation |
| `src/lib/engine.ts` | Physical and transition scores → stressed PD/LGD → IFRS 9 staging and ECL → Monte Carlo VaR/CVaR → ICAAP/ILAAP |
| `src/lib/store.ts` | Datasets, runs, maker-checker, audit log, hashes and reproducibility (JSON file in `.data/`) |

## Demo click-path

Open **Demo walkthrough** from the sidebar for a guided flow with links to the active dataset and latest stress run.

1. **Overview:** the workflow.
2. **Data:** "Load and validate". Show 1,000 accepted, 5 rejected with reasons, totals reconciled, and the dataset hash.
3. **Portfolio:** exposure by sector, region, collateral and maturity, plus concentration.
4. **Physical risk:** the map. Switch the hazard layers. Dashed outlines mark lower-confidence locations.
5. **Transition risk:** sector sensitivity, readiness and the engagement watch-list.
6. **Stress test:** as Kofi (analyst), run Current Policies 2050, bottom-up. Walk the results:
   - sector impact
   - the migration matrix
   - staging
   - the loss distribution
   - the "Explain" panel for the top borrower
7. **ICAAP & ILAAP:** the capital bridge and the breach of the minimum, then LCR under climate outflows. Compare against a Net Zero 2030 run.
8. **Governance:**
   - As Kofi, submit the run. It shows "waiting for an approver", and Kofi has no Approve button.
   - Switch to Ama (approver). Her Overview shows "1 run awaiting your approval". She can approve but not run tests (separation of duties).
   - Click "Re-run and verify" to show the identical hash.
   - Switch to Yaw (auditor). A read-only banner appears, there are no action buttons, and his Overview shows the audit activity.
9. **Reports:** the regulatory pack. Print or save it as PDF. Export the audit CSV from Governance.
10. **Architecture:** layers, the production technology stack, security controls, integrations and the 12-month plan.

Tip: run Net Zero 2050 @ 2030 and Delayed Transition @ 2040 before the call, so "All scenarios side by side" on the ICAAP page is already populated.

## Engine I sustainable finance demo

Open **Sustainability screening** and select Volta Agro Processing to see the synthetic GHS 80m facility split between GHS 20m of rooftop solar and GHS 60m of other proceeds. Run the assessment to show the enhanced due diligence referral, pending solar allocation, potential NDC and SDG contributions, and actions for the permit and wastewater findings.

Use **Revise and re-screen** to record updated answers and synthetic evidence in a new assessment. Submit as Kofi, then sign in as Ama and select the individual documents verified during review. Aligned exposure is calculated from current approved activity allocations that pass the applicable rules. Review outcomes and evidence lineage are available from the facility report.

Open **Portfolio screening** to see the consolidated four-framework breakdown, decision guidance and action queue. Use **Save portfolio screening** for a repeatable snapshot with a JSON report. The Board dashboard links to the action queue by management action. The rules and evidence are illustrative. GCB’s approved ESMS criteria and verified production framework mappings are required before production use.

## Engine II borrower physical risk

**Physical risk & GIS** uses the active loan extract and the latest Engine I assessment for each facility. Set the optional transition risk score (1–5) in the Engine I questionnaire and attach its source assessment as evidence. On independent approval, the reviewer selects that evidence as verified. Draft, returned, escalated and unverified scores are unavailable for Engine II aggregation.

The CSV accepts optional `borrowerId` for grouping facilities and separate `facilityLat`, `facilityLon`, `facilityRegion`, `facilityLocationRef` and `collateralLat`, `collateralLon`, `collateralRegion`, `collateralLocationRef` columns. For either location, provide the four values together. The reference identifies the bank’s verification record. Legacy coordinates support indicative scoring; records without a borrower ID are shown individually. The model applies national CCKP signals to regional hazard proxies. Engine II multiplies hazard intensity, normalized financial exposure and vulnerability for each site hazard. Exposure uses facility EAD or pledged collateral value divided by an illustrative GHS 100m reference and capped at 1. The profile shows all three inputs in the risk calculation, following the IPCC AR6 WGII risk framework.

Overall scores require verified locations, an approved evidenced transition score across the borrower’s facilities, and a GCB policy reference supplied through `GCB_CLIMATE_AGGREGATION_REFERENCE`. Set `GCB_CLIMATE_AGGREGATION_METHOD` to `max` or `weighted` as specified in the approved policy. For `weighted`, set `GCB_CLIMATE_PHYSICAL_WEIGHT` to a number strictly between 0 and 1; the remaining weight applies to transition risk. The deployment owner is responsible for configuring the approved method and reference. The demo has no GCB policy configured and displays overall scores as pending.

## Engine III annual scenario and ECL demo

**Scenario analysis** runs three NGFS Phase V pathways over their GCB demonstration windows: Net Zero 2050 (2027–2030), Delayed Transition (2031–2035), and Current Policies (2036–2050). The annual projections interpolate the five-year NiGEM and GCAM source points and use Ghana calibration and CCKP physical proxies. The GDP reference is at most five years back and no earlier than the 2025 start of the source data.

New runs use stage-based discounted ECL. Stage 1 captures defaults possible within 12 months, Stage 2 uses default probabilities across remaining maturity, and Stage 3 uses an impaired-exposure LGD shortfall. The demo uses flat conditional annual PD, a straight-line exposure schedule and a lending-rate proxy for the effective interest rate. It reports conditional stress results on a fixed loan snapshot. The results require production data, validated cash-flow and recovery schedules, effective interest rates and common-date scenario probabilities to support an IFRS 9 allowance.

Review the saved run for borrower and portfolio projections across all three windows. **ICAAP** and **ILAAP** are separate downstream views of the selected run. Legacy runs retain their one-year ECL method.
