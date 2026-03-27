-- CORE TABLES
CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE,
  department text,
  job_title text,
  tenure_years numeric DEFAULT 0,
  performance_score numeric DEFAULT 0.5,
  learning_agility numeric DEFAULT 0.5,
  training_history jsonb DEFAULT '[]',
  past_performance_reviews jsonb DEFAULT '[]',
  avatar_initials text,
  avatar_color text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.skills_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  category text,
  difficulty integer DEFAULT 2,
  description text,
  is_future_skill boolean DEFAULT false,
  strategic_priority integer DEFAULT 3
);

CREATE TABLE public.employee_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  skill_name text NOT NULL,
  proficiency integer DEFAULT 0,
  source text DEFAULT 'hr_system',
  evidence text,
  confidence text DEFAULT 'medium',
  updated_at timestamptz DEFAULT now(),
  UNIQUE(employee_id, skill_name)
);

CREATE TABLE public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  department text,
  description text,
  required_skills jsonb DEFAULT '{}',
  strategic_weights jsonb DEFAULT '{}',
  headcount_needed integer DEFAULT 1,
  is_open boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  target_role_id uuid REFERENCES public.roles(id),
  interview_type text DEFAULT 'employee',
  interviewer_name text,
  interviewer_title text,
  status text DEFAULT 'pending',
  conversation_history jsonb DEFAULT '[]',
  questions_asked integer DEFAULT 0,
  extracted_skills jsonb DEFAULT '{}',
  unexpected_skills jsonb DEFAULT '[]',
  insufficient_evidence jsonb DEFAULT '[]',
  potential_indicators jsonb DEFAULT '[]',
  concerns jsonb DEFAULT '[]',
  learning_agility_observed numeric,
  leadership_potential_observed numeric,
  manager_confidence_score numeric,
  hidden_role_suggestion text,
  interview_notes text,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE public.algorithm_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  role_id uuid REFERENCES public.roles(id),
  employee_interview_id uuid REFERENCES public.interviews(id),
  manager_interview_id uuid REFERENCES public.interviews(id),
  cosine_similarity numeric,
  jaccard_binary numeric,
  jaccard_weighted numeric,
  normalized_gap_score numeric,
  overall_readiness numeric,
  gap_analysis jsonb,
  tfidf_rarity jsonb,
  upskilling_paths jsonb,
  ahp_data jsonb,
  manager_readiness_adjustment numeric DEFAULT 0,
  final_readiness numeric,
  computed_at timestamptz DEFAULT now()
);

CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  role_id uuid REFERENCES public.roles(id),
  algorithm_result_id uuid REFERENCES public.algorithm_results(id),
  report_markdown text,
  generated_at timestamptz DEFAULT now()
);

CREATE TABLE public.bootcamps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  target_role_id uuid REFERENCES public.roles(id),
  algorithm_result_id uuid REFERENCES public.algorithm_results(id),
  title text,
  total_duration_weeks integer,
  hours_per_week numeric DEFAULT 5,
  modules jsonb DEFAULT '[]',
  milestones jsonb DEFAULT '[]',
  expected_outcomes jsonb DEFAULT '[]',
  status text DEFAULT 'not_started',
  generated_at timestamptz DEFAULT now()
);

CREATE TABLE public.bootcamp_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bootcamp_id uuid REFERENCES public.bootcamps(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES public.employees(id),
  module_index integer,
  status text DEFAULT 'not_started',
  completed_at timestamptz,
  notes text
);

CREATE TABLE public.strategy_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  document_type text,
  raw_text text,
  extracted_future_skills jsonb DEFAULT '[]',
  extracted_initiatives jsonb DEFAULT '[]',
  time_horizon text,
  summary text,
  is_active boolean DEFAULT true,
  uploaded_at timestamptz DEFAULT now(),
  processed boolean DEFAULT false
);

CREATE TABLE public.reorg_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid REFERENCES public.roles(id),
  employee_id uuid REFERENCES public.employees(id),
  cosine_similarity numeric,
  readiness_percent numeric,
  immediate_readiness boolean DEFAULT false,
  transfer_type text,
  gaps_remaining jsonb,
  weeks_to_full_readiness integer,
  department_from text,
  department_to text,
  computed_at timestamptz DEFAULT now(),
  UNIQUE(role_id, employee_id)
);

-- RLS - Allow public access for hackathon demo
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skills_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.algorithm_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bootcamps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bootcamp_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strategy_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reorg_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access" ON public.employees FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.skills_catalog FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.employee_skills FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.roles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.interviews FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.algorithm_results FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.reports FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.bootcamps FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.bootcamp_progress FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.strategy_documents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.reorg_matches FOR ALL USING (true) WITH CHECK (true);