const express = require('express');
const router = express.Router();
const { authenticateJWT } = require('../auth/jwtMiddleware');
const proposals = require('../services/proposalService');
const { ServiceError } = require('../services/serviceError');

// Every route needs a signed-in user; what they may see or decide is checked in the service.
router.use(authenticateJWT);

const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    if (err instanceof ServiceError) return res.status(err.status).json({ error: err.message });
    console.error('[proposals]', err);
    res.status(500).json({ error: 'Proposal request failed' });
  }
};

// POST /api/proposals - raise a proposal. Retrying with the same Idempotency-Key returns the original.
router.post('/', handle(async (req, res) => {
  const body = { ...req.body, idempotency_key: req.get('Idempotency-Key') || req.body?.idempotency_key };
  const { proposal, duplicate, auto_approved } = await proposals.create(req.user, body);
  res.status(duplicate ? 200 : 201).json({ proposal, duplicate, auto_approved: !!auto_approved });
}));

// GET /api/proposals?status=pending
router.get('/', handle(async (req, res) => {
  res.json({ proposals: await proposals.list(req.user, { status: req.query.status }) });
}));

router.get('/:id', handle(async (req, res) => {
  res.json({ proposal: await proposals.get(req.user, req.params.id) });
}));

router.post('/:id/approve', handle(async (req, res) => {
  res.json({ proposal: await proposals.approve(req.user, req.params.id, { note: req.body?.note }) });
}));

router.post('/:id/reject', handle(async (req, res) => {
  res.json({ proposal: await proposals.reject(req.user, req.params.id, { note: req.body?.note }) });
}));

router.post('/:id/cancel', handle(async (req, res) => {
  res.json({ proposal: await proposals.cancel(req.user, req.params.id) });
}));

module.exports = router;
