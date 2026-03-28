CREATE TABLE public.external_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  role_id uuid REFERENCES public.roles(id),
  status text DEFAULT 'invited',
  interview_worthy boolean DEFAULT false,
  worthy_score numeric,
  worthy_reasoning text,
  not_worthy_reasons jsonb DEFAULT '[]'::jsonb,
  access_code text UNIQUE,
  code_expires_at timestamptz,
  code_used_at timestamptz,
  interview_id uuid REFERENCES public.interviews(id),
  interview_skills jsonb DEFAULT '{}'::jsonb,
  interview_notes text,
  full_algorithm_results jsonb DEFAULT '{}'::jsonb,
  full_three_layer_score numeric,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.external_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access" ON public.external_candidates FOR ALL TO public USING (true) WITH CHECK (true);