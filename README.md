# Climatrics_Enterprise

Enterprise Climate Risk, Sustainable Finance and Regulatory Intelligence Platform

## GCB demo prototype (CONFIDENTIAL, under NDA)

A working prototype for the GCB Bank technical demo. All data is synthetic ("Demo Bank Ghana"), and all model parameters are illustrative.

## Run it

```bash
nvm use 24
npm install
npm run build && npx next start -p 3470   # open http://localhost:3470
```

## Deploy to Netlify

`netlify.toml` builds with Node 24. On Netlify, data (datasets, runs, approvals, audit trail) is kept in Netlify Blobs; locally it is kept in `.data/`. Set these environment variables on the site: `SESSION_SECRET_KEY` (a long random string) and `DEMO_PASSWORD_KEY`.

## Sign in

Three demo accounts, one per role: `kofi.mensah@climatrics.demo` (analyst: loads data, runs tests), `ama.owusu@climatrics.demo` (approver) and `yaw.boateng@climatrics.demo` (auditor, read-only). The password is not in the code: set `DEMO_PASSWORD_KEY` in `.env.local` locally (quote it if it contains `#`) or in the host's environment variables, and `SESSION_SECRET_KEY` to fix the session-signing key (otherwise one is generated in `.data/`). Five wrong passwords lock an account for 15 minutes. SSO and MFA are planned for production, not built.

To reset the demo to a clean state (no runs, a fresh audit log), stop the server, delete `.data/` and start it again.

## Where things live

| Path | What |
|---|---|
| `src/lib/params.ts` | **Every model parameter**: hazards, sector sensitivities, NGFS scenario paths, PD/LGD betas, bank capital and liquidity. Swap in the methodology team's values here. |
| `src/lib/portfolio.ts` | Synthetic loan book generator, plus the demo extract with 5 deliberately bad rows |
| `src/lib/ingest.ts` | Validation, exception queue, control-total reconciliation |
| `src/lib/engine.ts` | Physical and transition scores → stressed PD/LGD → IFRS 9 staging and ECL → Monte Carlo VaR/CVaR → ICAAP/ILAAP |
| `src/lib/store.ts` | Datasets, runs, maker-checker, audit log, hashes and reproducibility (JSON file in `.data/`) |

## Demo click-path (matches demo-plan.md)

1. **Overview:** the workflow.
2. **Data:** "Load and validate". Show 600 accepted, 5 rejected with reasons, totals reconciled, and the dataset hash.
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
