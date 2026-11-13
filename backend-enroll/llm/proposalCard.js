'use strict';

// The chat reply for a raised proposal: a card the frontend draws with Approve / Reject
// buttons when the signed-in user may decide it. The buttons call /api/proposals, which
// re-checks authority, so the flag here only decides what to show.

const { canApprove } = require('../auth/actionPermissions');

function proposalResponse(proposal, user, text) {
  return {
    type: 'proposal',
    text,
    suggestions: ['View approvals'],
    card: {
      proposal: {
        id: proposal.id,
        action_type: proposal.action_type,
        summary: proposal.summary,
        status: proposal.status,
        is_money: proposal.is_money,
        can_decide: proposal.status === 'pending' && canApprove(user.roles, proposal.action_type),
      },
    },
  };
}

module.exports = { proposalResponse };
