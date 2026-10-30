-- Migration: 062_agent_proposals
-- Description: Proposal queue for the agent layer. Anything that changes data is first stored
--              here as a pending proposal and only runs once an authorised human approves it.
-- Note: audit rows go to the existing audit_logs table (actions prefixed "proposal.").

CREATE TABLE IF NOT EXISTS agent_proposals (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type      text NOT NULL,
  params           jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary          text NOT NULL,
  is_money         boolean NOT NULL DEFAULT false,
  status           text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'executed', 'rejected', 'cancelled', 'failed')),
  source_channel   text NOT NULL DEFAULT 'manual'
                   CHECK (source_channel IN ('manual', 'chat', 'whatsapp', 'scheduled')),
  source_message   text,
  idempotency_key  text,
  proposed_by      uuid NOT NULL,
  proposed_role    text NOT NULL,
  decided_by       uuid,
  decided_role     text,
  decided_at       timestamptz,
  decision_note    text,
  self_approved    boolean NOT NULL DEFAULT false,
  auto_approved    boolean NOT NULL DEFAULT false,
  result           jsonb,
  error            text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- A retried request with the same key returns the original proposal instead of a second one.
CREATE UNIQUE INDEX IF NOT EXISTS agent_proposals_idempotency_key_idx
  ON agent_proposals (proposed_by, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS agent_proposals_status_created_idx ON agent_proposals (status, created_at DESC);
CREATE INDEX IF NOT EXISTS agent_proposals_proposed_by_idx ON agent_proposals (proposed_by);

COMMENT ON TABLE agent_proposals IS 'Pending, approved and rejected agent actions. Writes run only after human approval.';
COMMENT ON COLUMN agent_proposals.is_money IS 'Copied from the permission registry at proposal time; only Admin may approve';

-- Proposal audit rows can never be edited or removed. Scoped to proposal.* so other
-- audit_logs writers are unaffected.
CREATE OR REPLACE FUNCTION audit_logs_protect_proposal_rows() RETURNS trigger AS $$
BEGIN
  IF OLD.action LIKE 'proposal.%' THEN
    RAISE EXCEPTION 'proposal audit rows are append-only';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_logs_protect_proposal_rows ON audit_logs;
CREATE TRIGGER audit_logs_protect_proposal_rows
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_protect_proposal_rows();
