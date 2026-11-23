---
name: stress-simulation
description: Orchestrate the 20-installer / 400-installation simulation without expanding product features.
---

# Stress simulation

Use `launch-readiness/simulation/` scripts only.

## Dataset

- Prefix every synthetic identity with `QA-LAUNCH-2026`.
- Generate ≥420 unique serial/PIN pairs (400 + buffer).
- Mark chargers/demo flags appropriately so rewards cannot pay if policy requires.

## Stages

1. One full installer journey.
2. Five concurrent.
3. Ten concurrent.
4. Twenty concurrent + repeated registration/upload bursts.
5. Staggered realistic behaviour (wrong PIN, duplicate, interrupted upload, relogin).

## Verification

For each accepted install: auth, serial/PIN, ownership, photo URL, installer history, admin visibility, redeemed status, wallet delta, no duplicate.

Compare execution logs to backend counts. A UI success without a backend row is a failure.

Stop automatically if error rate or latency indicates platform instability.
