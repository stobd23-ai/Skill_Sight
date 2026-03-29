# SkillSight

   Constructor GenAI Hackathon 2026 - Multi-Agent and Decision Systems 

   Track 1: BMW — AI for People & Leadership Strategy

   Built in 72 hours by Constructor University Bremen

---

## The Problem

---

BMW makes thousands of hiring decisions every year based on instinct and a little bit more than a scan of a resume, which leads to more often than not to the hiring of the fastest mediocre worker available.

Meanwhile the hiring managers are drawning in thousands of aplications from people who were never really a fit for the role to begin with, while the people who could genuinely be the perfect pick are allready employed but off the radar.

Because of this, the organisation ends up using a large amount of money, people and resources it did not need to waste on someone who should have never been an external hire in the first place.  

**BMW doesn't have a talent shortage. It has a talent visibility problem.**

---

## What SkillSight Does

- **Finds internal candidates before opening external roles** — the reorg engine scans every employee against every open position using six algorithms simultaneously.
- **Screens external CVs intelligently** — hard-rejects unqualified candidates automatically, flags borderline cases for manager judgment, approves strong matches with full reasoning.
- **Explains every decision** — verdict, confidence level, gap analysis, behavioral evidence, and recruiter summary on every candidate assessment.
- **Scores candidates on three layers** — where they are today, how they think, and where they are going.
- **Surfaces build vs buy decisions** — computes whether developing an internal candidate or hiring externally produces the better outcome.

---

## Live Demo

**URL:** https://projectskillsight.online  

Manager login:  
**Login:** manager@bmw-skillsight.com  
**Password:** SkillSight2026!

Employee login:  
**Login:** rachel.kim@bmw-skillsight.com  
**Password:** SkillSight2026!

More employee logins are automaticly created on the promotion of an external candidate to an official employee and follow the same formula as the already existing employees:  
first_name + . + last_name + @bmw-skillsight.com  

8 pre-assessed external candidates are loaded across all five roles available in the demo. The full internal employee pipeline with interview data is ready. The seed candidates cover the full decision range: strong matches, flagged reviews, and hard rejects. All ready for immediate demonstration.

---

## The Eight Agents

| AI | Role |
|---|---|
| **1. CV Extraction AI** |  Parses the CV. Scores every skill by depth. |
| **2. CV Judgment AI** | Takes that output and decides: builder or participant, trainable gap or critical gap. |
| **3. Employee Interview AI** | Runs a 12-question behavioral interview. Forces specific examples, blocks vague answers. This one is mostly just demo wirthy as a real interview would not be limited to the ammount of questions. |
| **4. Manager Interview AI** | Runs in py observarallel. Extracts what the manager has actualled, not HR data. |
| **5. Skills Extraction AI** | Reads both transcripts. Logs only what was demonstrated with action verbs, nothing else. |
| **6. Capability Inference AI** | Takes those demonstrations and infers how the person thinks. |
| **7. Momentum AI** | Uses the same transcripts to score trajectory: how fast they learn, whether their scope is growing, whether their enthusiasm actually points at this role. |
| **8. Report AI** | Receives everything above. Translates the three-layer score into a 300-word assessment a hiring manager can act on. |

---

## Three-Layer Scoring

Every assessed candidate receives three scores that combine into a unified verdict.

**Technical Match (30–40%)** — Where the candidate is today. Computed from six algorithms run simultaneously against the role's weighted skill catalog.

**Capability Match (30%)** — How the candidate thinks. Inferred from behavioral evidence in interview transcripts, not keyword presence. Identifies systems thinking, failure mode analysis, and cross-domain reasoning patterns.

**Momentum (30–40%)** — Where the candidate is going. Learning velocity, scope trajectory, and motivation alignment scored from interview content. A candidate at 47% technical with 85% momentum is a better long-term bet than someone at 70% technical going nowhere.

When momentum cannot be computed (insufficient interview data), the score blends 50/50 technical and capability rather than penalising with a zero.

---

## The Six Algorithms

| Algorithm | Purpose |
|---|---|
| **Cosine Similarity** | Measures directional alignment between candidate skill vector and role requirement vector. Catches candidates who are pointing in the right direction even with partial coverage. |
| **Jaccard (Binary + Weighted)** | Binary version handles screening pass/fail. Weighted version accounts for skill importance differentials. |
| **Weighted Gap Score** | Identifies which missing skills matter most given role-type-specific weights. Missing AUTOSAR hurts less than missing sensor fusion for an ADAS role. |
| **TF-IDF Rarity** | Weights rare, high-value skills more heavily than common ones. A candidate with CUDA expertise gets more credit than one with Python. |
| **Dijkstra Pathfinding** | Models skill adjacency to identify development paths from current state to role requirements. Powers the Internal Reorg swim lane placement. |
| **AHP Succession Ranking** | Analytic Hierarchy Process with role-type-aware weight matrices. Emerging tech roles weight learning agility at 27%. Technical specialist roles weight domain depth at 32%. Produces mathematically defensible succession rankings. |

---

## Role-Type-Aware Scoring

The same candidate assessed against two different roles gets two different scores — because the weights are different.

| Role Type | Learning Agility | Technical Depth | Domain Knowledge | Leadership |
|---|---|---|---|---|
| emerging_tech | 0.27 | 0.25 | 0.22 | 0.14 |
| technical_specialist | 0.12 | 0.32 | 0.28 | 0.20 |
| cross_functional | 0.10 | 0.13 | 0.24 | 0.32 |

For Neue Klasse EV roles where the skills barely exist in the market, you bet on trajectory. For safety-critical embedded roles, you bet on depth. The system knows the difference.

---

## Verdict Decision Logic

The verdict is computed by a rule-based decision tree, not by the AI. The AI provides reasoning and evidence. The decision tree provides the verdict.

**Hard Reject** — all four must be true: builder verb ratio below 30%, zero measurable impacts, under 2 years experience, no domain signal. One exception and the candidate moves to Flag.

**Strong Match** — domain signal present, ownership demonstrated, experience real, gaps trainable, skill coverage above 55%, builder ratio above 55%. Or: high-potential override (PhD + 4+ years + production-scale metrics).

**Flag** — everything between. The manager decides.

**Confidence** is computed separately from the verdict and written to the database. It is never self-reported by the AI.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React / TypeScript / Tailwind CSS via Lovable |
| Database | Supabase PostgreSQL |
| Auth | Supabase Auth |
| Edge Functions | Supabase Edge Functions (Deno) |
| AI | Claude Sonnet 4.6 — Anthropic API |
| Hosting | namecheap.com |

All AI calls use Claude Sonnet 4.6 exclusively. Every Edge Function uses the Anthropic API format.

---

## Key Pages

| Page | What it does |
|---|---|
| `/dashboard` | KPIs, Critical Hiring Priorities by urgency, Skills Radar |
| `/employees` | Internal and external candidate management. External tab has All / Pending Review / Flagged / Declined |
| `/external-candidate/:id` | Full candidate assessment: verdict, reasoning, ownership signal, evidence analysis, CV viewer |
| `/analysis/:id` | Three-layer assessment for internal employees with expandable score cards |
| `/reorg` | Internal Reorg Engine that splits everyone into : Immediate / Near-Ready / Hidden Match / Develop |
| `/succession` | AHP-ranked succession board with internal and external talent pool candidates |
| `/cv-agent` | CV submission and agent pipeline diagram |
| `/apply` | Public candidate self-submission portal (no auth required) |
| `/roles` | Role management with hiring status and skill weight configuration |

---

## External Candidate Pipeline

Three entry points feed the same pipeline:

1. **Manager CV paste** — CV Agent screens and generates access code for interview
2. **Manager manual entry** — direct pipeline entry
3. **Candidate self-submit** — public `/apply` portal, AI pre-screens before manager sees anything

After assessment, candidates progress: `cv_assessed → invited → interviewing → completed → talent_pool`

Talent pool auto-promotion triggers when: three-layer score ≥ 65% AND momentum ≥ 60% AND capability ≥ 50%.
The apply portal should have been on the main site but because we do not have access to the official recruiting site or the time to make a separete one we just added it to the log in section of the site.

---

## Demo Candidates

19 candidates pre-loaded across five roles. Covers the full decision range:

| Verdict | Count | Examples |
|---|---|---|
| Strong Match | 11 | Marcus Klein (Mobileye/Bosch, TÜV cert) |
| Needs Review | 3 | Daniel Hartmann (strong C++, missing sensor fusion) |
| Hard Reject | 7 | Wes Watson (vague intern) |

---

## What We'd Build Next

**Interviewer calibration** — track which managers approve candidates who later underperform, and adjust their approval weight accordingly.

**Longitudinal momentum tracking** — today momentum is computed from a single interview. With more data points over time, trajectory prediction becomes genuinely predictive rather than inferred.

**Multi-language CV support** — the alias mapping and skill extraction currently assumes English. BMW's candidate pool is global.

**Portable Document Format (.pdf) CV support** — the current apply service is lackluster and needs a complete overhaul  

**Including the active employees databse** -- our current demo has a small employee base and can only add employees by going thought the external candidates first but not everyone that is getting a job needs to necesarily apply (a company merger for example) so the head manager has to be given acces to the employee databse

**Extend web app for other roles** -- instead of just using this for hiring we could also make it keep count of everyone working under a certain brench manager so that he could know if anyone is severily underperfoming with no resonable excuse. Each role could have its own personalised data and functions it uses

---

## Team

Constructor University Bremen 

Team members:  
      -    **Egemen Tas**   
      -    **Sonam Tobden**  
      -    **Denis-Serban-Matei Rosu**

*Built in 72 hours.*
