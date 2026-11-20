# Playground flow constants (live snapshot)

Verified from public bundles on https://smartfunction.io/playground  
(`playground-*.js`, `ComparisonView-*.js`) — refresh when the live build changes.

## Stages (hero)
1. pick a process  
2. arrange your steps  
3. make it smarter  
4. turn it into a project  

## Templates (`y` in ComparisonView bundle)
| id | name | summary |
|----|------|---------|
| `sales-follow-up` | Sales follow-up | Enquiries are answered by hand and follow-ups depend on memory. |
| `enquiry-handling` | Customer enquiry handling | A small team triages enquiries and quotes by hand. |
| `onboarding` | Staff or customer onboarding | Checklists, documents and approvals spread across email. |
| `internal-approvals` | Internal approvals | Requests, reviews and sign-off happen in email threads. |
| `blank` | Blank canvas | Start from nothing and build your own process. |

## Step kinds
`manual` · `automated` · `approval` · `decision`

## Client validation before analysis (`M(workflow)`)
Blocking errors:
- 0 nodes → `Add your first step to get started.`
- 1 node → `Add at least one more step so there is a process to improve.`
- Any unnamed node → `Every step needs a name.`
- 0 edges → `Connect your steps so we can follow the order of work.`

Soft notes (non-blocking):
- Orphan nodes when some edges exist → `N step(s) are not connected to the rest of the flow.`

Hard caps (observed):
- Max connections ≈ 20 (`That is the maximum number of connections for one process.`)

## Analysis product promises (keep)
- One full analysis free · no account needed · no invented savings or guarantees
- Loading: looks for manual work, duplicated data, disconnected steps
- Second analysis: name + email gate; “we will only contact you about this process”

## Conversion paths
- **A · Talk it through** → call request (availability; nothing booked until reply)
- **B · Send it over** → project form (goal, systems, requirements, budget band, timescale, next step, privacy ack)

## App id
`6afb374c91d1c9194f9d6554`
