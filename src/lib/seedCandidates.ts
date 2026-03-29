import { supabase } from "@/integrations/supabase/client";
import { runFullAnalysis, detectRoleType } from "@/lib/algorithms";
import { skillsToVector, skillsToWeights, parseRequiredSkills } from "@/lib/utils";
import { hybridWorthinessDecision } from "@/lib/verdictEngine";
import { computeCvSkillVector } from "@/lib/cvCoverageScore";
import { mapInterviewSkillsToRoleKeys } from "@/lib/interviewSkillMapping";

interface SeedCandidate {
  name: string;
  email: string;
  roleTitle: string;
  cvText: string;
}

const DEMO_CANDIDATES: SeedCandidate[] = [
  // ROLE 1 — ADAS SOFTWARE ENGINEER
  {
    name: "Tyler Ross",
    email: "tyler.ross@skillsight.demo",
    roleTitle: "ADAS Software Engineer",
    cvText: `WORK EXPERIENCE
Junior Web Developer – Freelance (2023)
Built websites for small businesses using WordPress.
Helped clients choose themes and plugins.
Did some JavaScript when needed.

University Project (2022)
Made a self-driving car simulation in Python using a tutorial.
It drove in a straight line most of the time.
Used some OpenCV code I found online.

SKILLS
HTML, CSS, JavaScript, WordPress, Python (beginner),
Self-driving cars (interested), AI (learning about it)

EDUCATION
BSc Computer Science (Year 2, ongoing)`,
  },
  {
    name: "Daniel Hartmann",
    email: "daniel.hartmann@skillsight.demo",
    roleTitle: "ADAS Software Engineer",
    cvText: `WORK EXPERIENCE
Software Engineer – Embedded Vision Systems (2021–Present)
Built C++ pipeline for processing stereo camera data on embedded Linux achieving stable 30 FPS under constrained compute budget.
Reduced frame processing latency by 40% through memory and threading optimisation. Debugged real-time synchronisation issues across camera and IMU sensor streams.

Software Developer – Systems Lab (2019–2021)
Developed tools for sensor log analysis and performance monitoring.
Built Python scripts for data parsing and visualisation.
Processed log datasets up to 3GB per session.

PROJECTS
Stereo Vision Depth Estimation
Implemented depth estimation using classical CV techniques.
Tuned parameters for robustness under varying lighting.

SKILLS
C++, Python, Embedded Linux, Multithreading, OpenCV,
Real-Time Systems, Computer Vision (classical), Sensor Processing

EDUCATION
BSc Electrical Engineering – University of Stuttgart`,
  },
  {
    name: "Marcus Klein",
    email: "marcus.klein@skillsight.demo",
    roleTitle: "ADAS Software Engineer",
    cvText: `WORK EXPERIENCE
Senior Perception Engineer – Mobileye (2020–Present)
Built real-time object detection and tracking pipeline in C++ achieving 22ms end-to-end latency deployed on EyeQ5 chip in production vehicles across 3 OEM programs. Designed multi-sensor fusion architecture combining camera, radar, and lidar across 6 sensor modalities. Led team of 5 engineers through two product generations. Reduced false positive rate by 43% through improved NMS and temporal smoothing deployed in 800k+ vehicles.

Embedded Software Engineer – Bosch ADAS (2017–2020)
Developed AUTOSAR-compliant software components for radar signal processing pipeline. Implemented ISO 26262 ASIL-B requirements for autonomous emergency braking function. Optimised memory footprint by 31% enabling deployment on cost-constrained ECU.
Led root cause analysis for field safety incident — zero recurrence in 18-month post-fix monitoring period.

PROJECTS
Multi-Modal Fusion Framework
Built distributed sensor fusion system synchronising 5 streams with sub-2ms timestamp alignment and automatic failure recovery.

SKILLS
C++, Python, CUDA, ROS2, AUTOSAR, ISO 26262, Sensor Fusion,
Computer Vision, PyTorch, TensorRT, Embedded Linux, Real-Time Systems

EDUCATION
MSc Electrical Engineering – TU Munich

CERTIFICATIONS
ISO 26262 Functional Safety – TÜV Rheinland (2021)`,
  },
  // ROLE 2 — EV BATTERY MODULE LEAD
  {
    name: "Jamie Williams",
    email: "jamie.williams@skillsight.demo",
    roleTitle: "EV Battery Module Lead",
    cvText: `WORK EXPERIENCE
Sales Representative – Electronics Retailer (2021–Present)
Sold consumer electronics and explained product features.
Met monthly sales targets consistently.
Helped train new staff on product knowledge.

Warehouse Operative – Logistics Company (2019–2021)
Picked and packed orders efficiently.
Operated forklift (certified).
Maintained inventory records accurately.

SKILLS
Customer Service, Sales, Microsoft Office, Forklift Operation,
Teamwork, Communication, Punctuality, Stock Management

EDUCATION
High School Diploma`,
  },
  {
    name: "Lukas Brandt",
    email: "lukas.brandt@skillsight.demo",
    roleTitle: "EV Battery Module Lead",
    cvText: `WORK EXPERIENCE
Battery Engineer – Energy Storage Startup (2020–Present)
Designed and tested lithium-ion battery packs for e-bike and light EV applications. Built cell characterisation test rigs measuring capacity, internal resistance, and cycle life.
Reduced pack weight by 12% through optimised cell arrangement and busbar redesign. Managed supplier relationships for cell procurement across 3 vendors.

Research Engineer – University Battery Lab (2018–2020)
Investigated thermal behaviour of NMC cells under fast-charging conditions. Built calorimetry test setup and collected degradation data. Co-authored 2 conference papers on cell aging mechanisms.

SKILLS
Battery Testing, Cell Characterisation, MATLAB, Python,
Thermal Management (basic), BMS (familiar), ISO 26262 (awareness)

EDUCATION
MSc Electrical Engineering (Energy Systems) – RWTH Aachen`,
  },
  {
    name: "Dr. Sofia Reyes",
    email: "sofia.reyes@skillsight.demo",
    roleTitle: "EV Battery Module Lead",
    cvText: `WORK EXPERIENCE
Principal Battery Systems Engineer – Continental AG (2018–Present)
Led thermal system architecture for Gen5 pouch cell modules deployed in 200k+ vehicles across 4 European OEM programs.
Reduced thermal runaway propagation risk by 58% through novel cooling channel geometry validated against UN 38.3 and ISO 26262.
Defined cell configuration, busbar layout, and thermal pathways improving energy density by 21%. Owned full validation lifecycle from cell characterisation through abuse testing sign-off.
Managed cross-functional team of 11 engineers across thermal, mechanical, and safety workstreams with zero programme delays across two product generations.

Senior Battery Engineer – BMW Group (2015–2018)
Developed BMS algorithms for SOC/SOH estimation achieving less than 1.5% error across full battery lifecycle. Integrated electrochemical models into vehicle simulation reducing range prediction error by 14%. Led supplier qualification programme for next-generation cylindrical cells across 6 candidates.

PROJECTS
Next-Gen Module Platform
Designed scalable module architecture supporting 4 vehicle classes.
Achieved 19% manufacturing cost reduction through modularisation.

SKILLS
Battery Systems Engineering, Thermal Management, BMS, Cell Chemistry,
ISO 26262 (TÜV Certified), MATLAB/Simulink, ANSYS Fluent,
Module/Pack Design, Python, UN 38.3, Electrochemistry

EDUCATION
PhD Electrochemical Engineering – RWTH Aachen
MSc Materials Science – KIT Karlsruhe

CERTIFICATIONS
ISO 26262 Functional Safety Engineer – TÜV Süd (2019)
2 patents in battery thermal management systems`,
  },
  // ROLE 3 — AI MANUFACTURING ENGINEER
  {
    name: "Wes Watson",
    email: "wes.watson@skillsight.demo",
    roleTitle: "AI Manufacturing Engineer",
    cvText: `WORK EXPERIENCE
AI Intern – Startup (2023)
Did AI stuff with the team.
Helped with machine learning models.
Worked on some computer vision things.
Used Python sometimes.

Intern – Tech Company (2022)
Helped fix bugs.
Did some testing work.
Learned about software.

SKILLS
Python, AI, Machine Learning, Deep Learning, Computer Vision,
Data Science, Neural Networks, Automation

EDUCATION
BSc Computer Science (Year 2)`,
  },
  {
    name: "Priya Nair",
    email: "priya.nair@skillsight.demo",
    roleTitle: "AI Manufacturing Engineer",
    cvText: `WORK EXPERIENCE
ML Engineer – Siemens Digital Industries (2021–Present)
Built computer vision defect detection system for PCB inspection achieving 94.2% precision deployed in 3 production facilities.
Reduced manual inspection labour by 67% across 2 production lines.
Developed anomaly detection pipeline processing 15,000 images per day using PyTorch and OpenCV on edge GPU hardware.

Data Scientist – Analytics Startup (2019–2021)
Built predictive maintenance models for CNC machines reducing unplanned downtime by 34%. Developed time-series forecasting pipeline for production scheduling. Delivered operational dashboards across 4 manufacturing sites.

SKILLS
Python, PyTorch, OpenCV, Scikit-learn, SQL, Docker, Kubernetes,
Computer Vision, Anomaly Detection, Time-Series Forecasting,
Edge Deployment, MLflow

EDUCATION
MSc Data Science – University of Edinburgh`,
  },
  {
    name: "Aiko Tanaka",
    email: "aiko.tanaka@skillsight.demo",
    roleTitle: "AI Manufacturing Engineer",
    cvText: `WORK EXPERIENCE
Senior AI Engineer – Trumpf Manufacturing AI (2019–Present)
Designed and deployed computer vision quality inspection system across 8 laser cutting production lines achieving 99.1% defect detection rate and reducing scrap rate by 52%. Built real-time inference pipeline in Python and C++ processing 40,000 parts per day on edge hardware with sub-100ms latency. Developed digital twin integration for predictive maintenance reducing unplanned downtime by 61% across 3 facilities. Led team of 6 ML engineers and 2 manufacturing domain experts. Presented ROI case to board resulting in €12M programme expansion.

ML Engineer – Kuka Robotics (2016–2019)
Developed anomaly detection models for robot joint failure prediction achieving 89% recall at 14-day forecast horizon.
Built data pipeline ingesting 2TB daily from 340 robot units.
Reduced emergency maintenance callouts by 44%.

PROJECTS
Automated Visual Inspection Platform
End-to-end platform: data labelling, model training, edge deployment, drift monitoring. Now used across 5 client sites.

SKILLS
Python, PyTorch, C++, OpenCV, TensorRT, Docker, Kubernetes,
Computer Vision, Anomaly Detection, Digital Twin, Edge AI,
MLOps, Time-Series, Manufacturing Process Knowledge

EDUCATION
MSc Robotics and AI – ETH Zurich
BSc Mechanical Engineering – Osaka University`,
  },
  // ROLE 4 — DIGITAL TRANSFORMATION LEAD
  {
    name: "Greg Simon",
    email: "greg.simon@skillsight.demo",
    roleTitle: "Digital Transformation Lead",
    cvText: `WORK EXPERIENCE
Social Media Manager – Small Business (2022–Present)
Managed Instagram and Facebook pages.
Wrote posts and responded to comments.
Grew followers from 200 to 800.

Barista – Coffee Shop (2020–2022)
Made coffee and served customers.
Trained new staff on the espresso machine.
Handled cash and card payments.

SKILLS
Instagram, Facebook, Canva, Microsoft Word, Customer Service,
Communication, Digital Marketing (basic), Leadership

EDUCATION
BA Media Studies – ongoing`,
  },
  {
    name: "Tom Becker",
    email: "tom.becker@skillsight.demo",
    roleTitle: "Digital Transformation Lead",
    cvText: `WORK EXPERIENCE
Digital Transformation Director – Deutsche Telekom (2019–Present)
Led enterprise cloud migration covering 140 applications and 8,000 employees across 12 countries. Delivered €18M cost reduction through platform consolidation. Managed programme budget of €45M and cross-functional team of 35 across 6 workstreams. Drove platform adoption from 23% to 78% through structured change management and executive sponsorship programme.

Senior Programme Manager – McKinsey & Company (2015–2019)
Led digital strategy engagements for industrial and retail clients.
Delivered operating model redesigns averaging 22% efficiency improvement. Facilitated C-suite alignment on technology investment priorities across 8 client engagements over 4 years.

SKILLS
Digital Strategy, Change Management, Programme Management,
Stakeholder Engagement, Agile/SAFe, Business Case Development,
P&L Management, Executive Communication, OKR Frameworks

EDUCATION
MBA – INSEAD
BSc Engineering – TU Berlin`,
  },
  {
    name: "Elena Vasquez",
    email: "elena.vasquez@skillsight.demo",
    roleTitle: "Digital Transformation Lead",
    cvText: `WORK EXPERIENCE
VP Digital Transformation – Volkswagen Group (2018–Present)
Owned and delivered VW Group digital transformation programme spanning 14 markets, 22,000 employees, and €120M investment.
Launched connected vehicle data platform now generating €340M annual recurring revenue. Drove adoption of agile operating model across 8 business units reducing time-to-market by 38%. Built and led transformation office of 42 people across strategy, delivery, change, and data workstreams. Reported directly to Group CTO.
Achieved 94% programme milestone delivery rate across 3 years.

Head of Digital Strategy – Audi AG (2014–2018)
Defined 5-year digital product roadmap adopted by Audi board.
Led €45M investment in customer experience platform deployed across 34 markets. Managed portfolio of 18 concurrent digital initiatives. Delivered 31% improvement in digital customer satisfaction score (NPS +22 points).

SKILLS
Digital Strategy, Executive Stakeholder Management, Change Management, Programme Portfolio Management, P&L Ownership,
Agile/SAFe, Business Case Development, OKRs, Data & AI Literacy,
Automotive Industry, Connected Services, Platform Business Models

EDUCATION
MBA – Harvard Business School
MSc Industrial Engineering – TU Munich`,
  },
  // ROLE 5 — IT DELIVERY MANAGER
  {
    name: "Sam Cooper",
    email: "sam.cooper@skillsight.demo",
    roleTitle: "IT Delivery Manager",
    cvText: `WORK EXPERIENCE
Delivery Driver – Logistics Company (2021–Present)
Delivered packages on time across assigned routes.
Managed daily delivery schedule efficiently.
Communicated with customers about delivery status.

Shop Assistant – Supermarket (2019–2021)
Stocked shelves and assisted customers.
Operated till and handled cash.
Helped with stock deliveries.

SKILLS
Driving Licence (Class B), Customer Service, Punctuality,
Time Management, Microsoft Word, Teamwork

EDUCATION
GCSE Level — 8 subjects`,
  },
  {
    name: "Nina Schulz",
    email: "nina.schulz@skillsight.demo",
    roleTitle: "IT Delivery Manager",
    cvText: `WORK EXPERIENCE
IT Project Manager – Bosch IT (2020–Present)
Managed delivery of ERP integration project across 3 European sites completed on time and 8% under budget. Coordinated cross-functional team of 18 across development, testing, and business change workstreams. Ran daily stand-ups and sprint reviews using Scrum framework. Managed risks and escalated blockers to steering committee weekly.

Junior Project Manager – IT Consulting Firm (2017–2020)
Supported delivery of IT infrastructure rollout for mid-size manufacturing client. Tracked milestones, managed RAID log, prepared steering committee packs. Assisted senior PM on stakeholder communication plan.

SKILLS
Project Management, Scrum, JIRA, Confluence, Stakeholder Management, Risk Management, MS Project, Budget Tracking,
German (native), English (fluent)

EDUCATION
BSc Business Information Systems – University of Mannheim
PMP Certified (2021)`,
  },
  {
    name: "James O'Brien",
    email: "james.obrien@skillsight.demo",
    roleTitle: "IT Delivery Manager",
    cvText: `WORK EXPERIENCE
Head of IT Delivery – BMW CarIT (2017–Present)
Owned delivery of BMW connected services platform across 12 markets serving 4.2M active users. Managed portfolio of 23 concurrent programmes with combined budget of €85M.
Reduced average delivery cycle time by 34% through SAFe implementation across 8 product teams. Achieved 91% on-time delivery rate across 3-year programme portfolio. Built and led delivery organisation of 28 PMs and delivery leads.
Resolved 3 major escalations preventing programme failures valued at €30M+ combined.

Senior IT Programme Manager – Capgemini (2013–2017)
Delivered digital transformation programmes for automotive and manufacturing clients. Led SAP S/4HANA migration for Tier 1 automotive supplier — 14,000 users, 18-month programme, delivered on time and within €2M contingency budget. Managed C-suite stakeholders across client and vendor organisations.

SKILLS
IT Programme Delivery, SAFe/Agile, Stakeholder Management,
Risk & Escalation Management, Budget Ownership, Portfolio Management, Change Management, Vendor Management,
Technical Literacy, OKRs, P&L, Intercultural Leadership

EDUCATION
MSc Information Systems – LMU Munich
BSc Computer Science – University College Dublin
PMP, SAFe Programme Consultant (SPC)

CERTIFICATIONS
SAFe Programme Consultant – Scaled Agile (2018)
PMP – PMI (2014)`,
  },
];

// hybridWorthinessDecision is now imported from @/lib/verdictEngine

export interface SeedProgress {
  current: number;
  total: number;
  currentName: string;
  done: boolean;
  results: { strong: number; flagged: number; rejected: number };
}

export async function seedDemoCandidates(
  onProgress: (p: SeedProgress) => void
): Promise<SeedProgress["results"]> {
  // Fetch all roles
  const { data: allRoles } = await supabase.from("roles").select("*");
  if (!allRoles?.length) throw new Error("No roles found");

  const results = { strong: 0, flagged: 0, rejected: 0 };

  for (let i = 0; i < DEMO_CANDIDATES.length; i++) {
    const candidate = DEMO_CANDIDATES[i];
    onProgress({ current: i + 1, total: 15, currentName: candidate.name, done: false, results });

    const role = allRoles.find(r => r.title === candidate.roleTitle);
    if (!role) {
      console.error(`Role not found: ${candidate.roleTitle}`);
      results.rejected++;
      continue;
    }

    try {
      // Step 1: Parse CV (same as /apply)
      const roleType = detectRoleType(
        skillsToVector(role.required_skills),
        (role.strategic_weights || {}) as Record<string, number>
      );

      const parseResponse = await supabase.functions.invoke("parse-cv", {
        body: {
          cvText: candidate.cvText,
          targetRole: role.title,
          targetRoleType: roleType,
          roleRequirements: skillsToVector(role.required_skills),
        },
      });

      const parsed = parseResponse.data?.parsed;
      const aiJudgment = parseResponse.data?.aiJudgment || null;
      if (!parsed) {
        console.error(`CV parsing failed for ${candidate.name}`);
        results.rejected++;
        continue;
      }

      // Step 2: Run algorithms — build skill vector using role-matching keys
      const parsedRoleSkills = parseRequiredSkills(role.required_skills);
      const roleSkillNames = parsedRoleSkills.map(s => s.name);

      // CV-based skill matching (uses alias table + depth analysis)
      const cvSkillsVector = computeCvSkillVector(candidate.cvText, role.required_skills);

      // parse-cv extracted skills mapped to role display names
      const mappedExtractedSkills = mapInterviewSkillsToRoleKeys(parsed.extracted_skills || {}, roleSkillNames);

      // Merge: take highest proficiency from either source
      const skillsVector: Record<string, number> = {};
      Object.entries(cvSkillsVector).forEach(([k, v]) => {
        skillsVector[k] = Math.max(skillsVector[k] || 0, v);
      });
      Object.entries(mappedExtractedSkills).forEach(([k, v]) => {
        skillsVector[k] = Math.max(skillsVector[k] || 0, v);
      });

      const algorithmInput = {
        employee: {
          id: "external",
          name: candidate.name,
          skills: skillsVector,
          performanceScore: 0.5,
          learningAgility: 0.5,
          tenureYears: parsed.experience_profile?.total_years || 0,
        },
        targetRole: {
          id: role.id,
          title: role.title,
          requiredSkills: skillsToVector(role.required_skills),
          strategicWeights: skillsToWeights(role.required_skills),
        },
        allRoles: allRoles.map((r: any) => ({ requiredSkills: skillsToVector(r.required_skills) })),
      };

      const algoResults = runFullAnalysis(algorithmInput);

      // Step 3: Hybrid verdict (same as /apply)
      const hybrid = hybridWorthinessDecision(
        algoResults.overallReadiness,
        parsed.extracted_skills,
        role,
        parsed.experience_profile,
        aiJudgment,
        candidate.cvText
      );

      let candidateStatus: string;
      if (hybrid.verdict === 'hard_reject') {
        candidateStatus = 'below_threshold';
      } else if (hybrid.verdict === 'flag') {
        candidateStatus = 'flagged_review';
      } else if (hybrid.worthy) {
        candidateStatus = 'pending_manager_review';
      } else {
        candidateStatus = 'below_threshold';
      }

      // Step 4: Insert (same as /apply)
      await supabase.from("external_candidates").insert({
        name: candidate.name,
        email: candidate.email,
        candidate_email: candidate.email,
        role_id: role.id,
        status: candidateStatus,
        interview_worthy: hybrid.worthy,
        worthy_score: hybrid.worthyScore,
        worthy_reasoning: JSON.stringify({
          verdict: hybrid.verdict,
          verdictLabel: hybrid.verdictLabel,
          confidence: hybrid.confidence,
          reasoning: hybrid.reasoning,
          aiReasoning: hybrid.aiReasoning,
          concerns: hybrid.concerns,
          keyStrengths: hybrid.keyStrengths,
          recommendedPreset: hybrid.recommendedPreset,
          recruiterNote: hybrid.recruiterNote,
          builder_verb_ratio: aiJudgment?.builder_verb_ratio ?? null,
          strong_metrics_count: aiJudgment?.strong_metrics_count ?? null,
          medium_metrics_count: aiJudgment?.medium_metrics_count ?? null,
          weak_metrics_count: aiJudgment?.weak_metrics_count ?? null,
          verb_quality_assessment: aiJudgment?.verb_quality_assessment ?? null,
          absence_analysis: aiJudgment?.absence_analysis ?? null,
          domain_gap_classification: hybrid.domainGapClassification,
          seniority_check: hybrid.seniorityCheck,
        }),
        not_worthy_reasons: hybrid.concerns as any,
        submission_source: "candidate_self_submit",
        candidate_message: candidate.cvText,
        submitted_at: new Date().toISOString(),
        manager_notified: false,
        manager_decision: "pending",
        interview_skills: parsed.extracted_skills as any,
        full_algorithm_results: algoResults as any,
      } as any);

      // Track results
      if (hybrid.worthy) results.strong++;
      else if (hybrid.verdict === 'flag') results.flagged++;
      else results.rejected++;

    } catch (err) {
      console.error(`Error processing ${candidate.name}:`, err);
      results.rejected++;
    }
  }

  onProgress({ current: 15, total: 15, currentName: "", done: true, results });
  return results;
}

export async function clearDemoCandidates(): Promise<number> {
  const { data } = await supabase
    .from("external_candidates")
    .select("id, email")
    .like("email", "%@skillsight.demo");
  
  if (!data?.length) return 0;
  
  const ids = data.map(d => d.id);
  await supabase.from("external_candidates").delete().in("id", ids);
  return ids.length;
}
