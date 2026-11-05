# Cadence backend hardening (workflow preserved)

**Date:** 5 Nov 2026 (Europe/London)  
**App:** `6a7338f6106b1962aa31c00a`  
**Code:** `cadence/` in this repo

## Goal

Improve the Cadence **backend** without changing the current product workflow (Home → wizard → recommendation + draft → Save → History → Archive).

## Changes

1. **Owner-scoped persistence** via `owner_email` on `CommunicationDecision` and three functions: `save-decision`, `list-decisions`, `archive-decision`.
2. **Server-side recommendation** via `generate-recommendation` (same scoring rules + InvokeLLM prompts as production).
3. **Intake sanitisation** before prompts / storage (length caps, control-char strip).
4. **Branding fix** in Layout footer: Cadence (not CommDecide), current year.
5. **Login gate copy** now states what Cadence does (audit P1).

## Explicitly unchanged

- Page set: Home, NewDecision, History
- Recommendation enum: `meeting` | `email` | `async_message`
- Scoring weights / rationale strings (ported from production bundle)
- LLM prompt structure per channel
- Nav labels and primary CTAs

## Deploy note

This repo holds the reconstructed Cadence source with backend functions. Publishing to https://cadence.base44.app still needs Base44 credentials (`BASE44_API_TOKEN` or `npx base44 login`) and an entity-permission lockdown so clients cannot bypass the new functions.
