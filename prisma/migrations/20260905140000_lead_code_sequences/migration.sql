-- Lead v2.1 B03 — concurrency-safe lead codes (additive only).
-- Sequence table + advisory-lock helper. Lead.leadCode UNIQUE already exists.

CREATE TABLE IF NOT EXISTS lead_code_sequences (
  city_code TEXT NOT NULL,
  day DATE NOT NULL,
  last_used_number INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (city_code, day)
);

CREATE OR REPLACE FUNCTION next_lead_code(p_city_code TEXT, p_day DATE)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_lock_key BIGINT;
  v_next INT;
BEGIN
  v_lock_key := hashtext(p_city_code || ':' || p_day::text)::BIGINT;
  PERFORM pg_advisory_xact_lock(v_lock_key);
  INSERT INTO lead_code_sequences (city_code, day, last_used_number)
    VALUES (p_city_code, p_day, 1)
  ON CONFLICT (city_code, day)
    DO UPDATE SET last_used_number = lead_code_sequences.last_used_number + 1,
                  updated_at = now()
  RETURNING last_used_number INTO v_next;
  RETURN format('LED-%s-%s-%s',
                upper(p_city_code),
                to_char(p_day, 'YYYYMMDD'),
                lpad(v_next::text, 4, '0'));
END
$$;

-- Idempotent: unique index already created in 20260902120000_lead_management.
CREATE UNIQUE INDEX IF NOT EXISTS "Lead_leadCode_key" ON "Lead"("leadCode");
