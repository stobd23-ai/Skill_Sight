
ALTER TABLE external_candidates ADD COLUMN IF NOT EXISTS submission_source text DEFAULT 'manager_manual';
ALTER TABLE external_candidates ADD COLUMN IF NOT EXISTS candidate_email text;
ALTER TABLE external_candidates ADD COLUMN IF NOT EXISTS candidate_message text;
ALTER TABLE external_candidates ADD COLUMN IF NOT EXISTS submitted_at timestamptz;
ALTER TABLE external_candidates ADD COLUMN IF NOT EXISTS manager_notified boolean DEFAULT false;
ALTER TABLE external_candidates ADD COLUMN IF NOT EXISTS manager_decision text DEFAULT 'pending';
ALTER TABLE external_candidates ADD COLUMN IF NOT EXISTS manager_decision_at timestamptz;
ALTER TABLE external_candidates ADD COLUMN IF NOT EXISTS manager_decision_note text;

CREATE TABLE IF NOT EXISTS open_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid REFERENCES roles(id) ON DELETE CASCADE,
  is_accepting boolean DEFAULT true,
  public_description text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE open_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access" ON open_applications FOR ALL TO public USING (true) WITH CHECK (true);

INSERT INTO open_applications (role_id, is_accepting, public_description)
SELECT id, true,
  'BMW Group is seeking candidates for this role as part of our Neue Klasse transformation. Apply below to begin your skills assessment.'
FROM roles
ON CONFLICT DO NOTHING;
