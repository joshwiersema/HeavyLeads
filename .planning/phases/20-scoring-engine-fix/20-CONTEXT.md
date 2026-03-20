# Phase 20: Scoring Engine Fix - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix the scoring engine so leads produce meaningfully different scores (std dev > 15 across 1000+ leads). Root cause: most leads have null estimatedValue, low-confidence all-industry tagging, and same-batch freshness. Fix enrichment inputs AND scoring algorithm. Remove legacy scoring system. Verify industry routing (HVAC→HVAC, solar→solar).

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure algorithmic phase. Key constraints from research:

**Scoring root cause (from ARCHITECTURE.md and PITFALLS.md):**
- Two scoring systems coexist: `src/lib/leads/scoring.ts` (old) and `src/lib/scoring/engine.ts` (new). Delete the old one.
- Distance dimension: works correctly when leads have coordinates and org has HQ set
- Relevance dimension: flat 5/30 because all-industry low-confidence tagging gives +5 "Industry match uncertain" to everyone. Fix: use keyword-to-projectType matching for 0-15 range
- Value dimension: flat 10/20 because most leads have null estimatedValue. Fix: estimate value from projectType lookup table (e.g., "New Commercial" → $500K-2M, "Residential Remodel" → $20K-100K)
- Freshness dimension: flat 15/15 because all permits from same batch get same freshness. Fix: use source-type-specific decay curves (storm alerts decay in hours, bids in days, permits in weeks)
- Urgency dimension: flat 5/10 because all permits get base 5. Fix: add deadline-based urgency for bids, severity for storms

**Value estimation lookup table (from STACK.md):**
Create a projectType → estimatedValue range mapping:
- New Commercial Construction → $500K - $5M
- New Residential → $150K - $500K
- Commercial Remodel/Renovation → $100K - $1M
- Residential Remodel → $20K - $100K
- Demolition → $50K - $500K
- Roofing → $5K - $50K
- HVAC → $3K - $30K
- Electrical → $2K - $20K
- Solar Installation → $10K - $50K
- Pool Construction → $30K - $100K
- Foundation → $10K - $50K
- Plumbing → $2K - $15K

**Industry routing verification:**
- HVAC permits (keyword match: hvac, heating, cooling, etc.) must score higher for HVAC accounts
- Solar permits must score higher for solar accounts
- The relevance dimension must differentiate, not give everyone the same flat score

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/scoring/engine.ts` — scoreLeadForOrg() orchestrator
- `src/lib/scoring/relevance.ts` — scoreRelevance() with industry matching
- `src/lib/scoring/value.ts` — scoreValue() with target range
- `src/lib/scoring/distance.ts` — scoreDistance() (works correctly)
- `src/lib/scoring/freshness.ts` — scoreFreshness()
- `src/lib/scoring/urgency.ts` — scoreUrgency()
- `src/lib/scoring/types.ts` — OrgScoringContext, LeadScoringInput, ScoreDimension
- `src/lib/leads/scoring.ts` — OLD scoring system (DELETE THIS)
- `src/lib/scraper/enrichment.ts` — inferApplicableIndustries(), inferValueTier()

### Established Patterns
- Each dimension returns ScoreDimension { name, score, maxScore, reasons[] }
- engine.ts aggregates all dimensions into ScoringResult { total, dimensions[], matchReasons[] }
- Scores clamped to 0-maxScore per dimension

### Integration Points
- `src/lib/leads/queries.ts` — calls scoreLeadForOrg() at query time
- `src/lib/leads/queries.ts` — also imports old scoreLead() from scoring.ts (MUST remove)

</code_context>

<specifics>
## Specific Ideas

- Score std dev > 15 is the measurable success criterion
- Delete src/lib/leads/scoring.ts entirely
- Remove all imports of scoreLead from queries.ts
- The enrichment improvements (value estimation, tighter industry classification) feed into the scoring fix

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>
