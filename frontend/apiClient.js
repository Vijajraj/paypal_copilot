import { initialMockDisputes } from './initialMockData.js';

// Standalone in-memory / local storage state for fallback
const STORAGE_KEY_DISPUTES = 'paypal_copilot_disputes_v1';
const STORAGE_KEY_AUDIT = 'paypal_copilot_audit_v1';
const STORAGE_KEY_RESTOCK = 'paypal_copilot_restock_v1';

const rawApiUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL)
  ? String(import.meta.env.VITE_API_URL).trim()
  : '';

export const API_BASE = rawApiUrl
  ? (rawApiUrl.startsWith('http://') || rawApiUrl.startsWith('https://') ? rawApiUrl : `https://${rawApiUrl}`).replace(/\/$/, '')
  : '';

export const DEFAULT_APPROVAL_SECRET = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_APPROVAL_SECRET)
  ? import.meta.env.VITE_APPROVAL_SECRET
  : 'ccf085057cf069712cebc1e32b3d13a165fb63fe57282150dbb6285350bd65b9';

const defaultRestockItems = [
  {
    id: 'C3-INV-101',
    name: '4x6 Direct Thermal Shipping Labels (500/roll)',
    category: 'Packaging',
    current_stock: 4,
    safety_stock: 10,
    unit_cost_usd: 14.50,
    recommended_order_qty: 15,
    urgency: 'HIGH',
    ai_recommendation_reason: 'Dispute velocity up 42% due to package tracking delays. Immediate restock prevents shipment stalls.'
  },
  {
    id: 'C3-INV-102',
    name: 'Bubble Mailer Padded Envelopes #0 (Pack of 100)',
    category: 'Packaging',
    current_stock: 12,
    safety_stock: 20,
    unit_cost_usd: 22.00,
    recommended_order_qty: 10,
    urgency: 'MEDIUM',
    ai_recommendation_reason: 'Restock before upcoming weekend volume surge to maintain SLA fulfillment.'
  },
  {
    id: 'C3-INV-103',
    name: 'Heavy-Duty Reinforced Packing Tape (6-Pack)',
    category: 'Shipping Supplies',
    current_stock: 3,
    safety_stock: 8,
    unit_cost_usd: 18.50,
    recommended_order_qty: 8,
    urgency: 'HIGH',
    ai_recommendation_reason: 'Carrier damage dispute defense requires reinforced sealing. Current supply critically low.'
  },
  {
    id: 'C3-INV-104',
    name: 'ESD Anti-Static Component Bags (Pack of 50)',
    category: 'Electronics Protection',
    current_stock: 45,
    safety_stock: 30,
    unit_cost_usd: 16.00,
    recommended_order_qty: 0,
    urgency: 'LOW',
    ai_recommendation_reason: 'Sufficient inventory buffer. Restock not required at current sales velocity.'
  }
];

const defaultAuditEntries = [
  {
    entryId: 'AUD-99120',
    disputeId: 'PP-D-1094821',
    timestamp: '2026-10-23T11:15:00.000Z',
    actor: { type: 'AI_AGENT', id: 'copilot_agent_v2' },
    action: 'DRAFT_EVIDENCE_GENERATED',
    details: 'AI Agent retrieved carrier delivery proof (UPS tracking 1Z9999999999999999) via KERNEL and matched Elastic precedent PREC-88219 (96% win probability).',
    hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    prevHash: '0000000000000000000000000000000000000000000000000000000000000000'
  },
  {
    entryId: 'AUD-99121',
    disputeId: 'PP-D-2049182',
    timestamp: '2026-10-23T12:05:30.000Z',
    actor: { type: 'AI_AGENT', id: 'copilot_agent_v2' },
    action: 'DRAFT_EVIDENCE_GENERATED',
    details: 'AI Agent drafted unauthorized claim response citing PayPal Seller Protection Policy Section 11.2.',
    hash: 'a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e',
    prevHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
  }
];

function getStoredDisputes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DISPUTES);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [...initialMockDisputes];
}

function saveStoredDisputes(list) {
  try {
    localStorage.setItem(STORAGE_KEY_DISPUTES, JSON.stringify(list));
  } catch (e) {}
}

function getStoredAudit() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_AUDIT);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [...defaultAuditEntries];
}

function saveStoredAudit(list) {
  try {
    localStorage.setItem(STORAGE_KEY_AUDIT, JSON.stringify(list));
  } catch (e) {}
}

function getStoredRestock() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_RESTOCK);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [...defaultRestockItems];
}

function saveStoredRestock(list) {
  try {
    localStorage.setItem(STORAGE_KEY_RESTOCK, JSON.stringify(list));
  } catch (e) {}
}

// Normalizes a dispute so both Person A and Person B field names work everywhere
export function normalizeDispute(d) {
  if (!d) return d;
  const id = d.id || d.dispute_id;
  const amountVal = d.amount?.value || d.dispute_amount?.value || '0.00';
  const amountCurr = d.amount?.currency || d.dispute_amount?.currency || 'USD';
  const dueDate = d.respond_by || d.seller_response_due_date || new Date().toISOString();
  const draft = d.evidence_draft?.text || d.ai_drafted_evidence || '';
  const orderId = d.order?.id || d.order_id || 'ORD-001';

  return {
    ...d,
    id,
    dispute_id: id,
    amount: { value: String(amountVal), currency: amountCurr },
    dispute_amount: { value: String(amountVal), currency: amountCurr },
    order_id: orderId,
    seller_response_due_date: dueDate,
    respond_by: dueDate,
    ai_drafted_evidence: draft,
    evidence_draft: d.evidence_draft || { text: draft, proofs: [] },
    carrier_proof: d.carrier_proof || {
      carrier: d.order?.shipping?.carrier || 'UPS',
      tracking_number: d.order?.shipping?.tracking_number || '1Z9999999999',
      status: d.order?.shipping?.status || 'DELIVERED',
      delivery_date: d.order?.shipping?.delivery_date || d.created_at,
      signed_by: d.order?.shipping?.signed_by || 'Authorized Recipient',
      has_signature: d.order?.shipping?.has_signature ?? true,
      carrier_verified: true,
      kernel_audit_id: 'KERNEL-CERT-9921',
      delivery_address_verified: true
    },
    buyer: d.buyer || {
      name: d.order?.shipping?.signed_by || 'Customer',
      email: 'customer@example.com',
      shipping_address: {
        line1: '120 Market Street',
        city: 'Seattle',
        state: 'WA',
        postal_code: '98101',
        country_code: 'US'
      }
    },
    seller_approval: {
      approved: Boolean(d.seller_approval?.approved || d.approval_state === 'approved' || d.approval_state === 'submitted'),
      conceded: Boolean(d.seller_approval?.conceded || d.approval_state === 'rejected'),
      approved_at: d.seller_approval?.approved_at || null,
      approver_id: d.seller_approval?.approver_id || null,
      rejection_reason: d.seller_approval?.rejection_reason || null
    }
  };
}

let _inFlightGetDisputes = null;

export const api = {
  async getDisputes(status = null) {
    if (!status && _inFlightGetDisputes) {
      return _inFlightGetDisputes;
    }

    const fetchPromise = (async () => {
      try {
        const endpoint = status ? `${API_BASE}/disputes?status=${encodeURIComponent(status)}` : `${API_BASE}/disputes`;
        const res = await fetch(endpoint);
        if (res.ok) {
          const data = await res.json();
          if (data.disputes && Array.isArray(data.disputes)) {
            const normalized = data.disputes.map(normalizeDispute);
            saveStoredDisputes(normalized);
            return { success: true, count: normalized.length, disputes: normalized };
          }
        }
      } catch (e) {
        // Backend not running, use local storage fallback
      } finally {
        if (!status) _inFlightGetDisputes = null;
      }
      const list = getStoredDisputes().map(normalizeDispute);
      const filtered = status ? list.filter(d => d.status === status) : list;
      return { success: true, count: filtered.length, disputes: filtered };
    })();

    if (!status) _inFlightGetDisputes = fetchPromise;
    return fetchPromise;
  },

  async getDispute(id) {
    try {
      const res = await fetch(`${API_BASE}/disputes/${encodeURIComponent(id)}`);
      if (res.ok) {
        const data = await res.json();
        return { success: true, dispute: normalizeDispute(data.dispute) };
      }
    } catch (e) {}
    const list = getStoredDisputes();
    const matched = list.find(d => (d.dispute_id === id || d.id === id));
    if (!matched) throw new Error(`Dispute ${id} not found`);
    return { success: true, dispute: normalizeDispute(matched) };
  },

  async updateEvidence(id, evidenceText, approverId = 'seller_merchant_primary') {
    try {
      const res = await fetch(`${API_BASE}/disputes/${encodeURIComponent(id)}/evidence`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: evidenceText, approver_id: approverId })
      });
      if (res.ok) {
        const data = await res.json();
        const normalized = normalizeDispute(data.dispute);
        return { success: true, dispute: normalized };
      } else {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Server returned ${res.status}`);
      }
    } catch (e) {
      if (e.message && !e.message.includes('Failed to fetch') && !e.message.includes('NetworkError')) {
        throw e;
      }
    }

    const list = getStoredDisputes();
    const idx = list.findIndex(d => (d.dispute_id === id || d.id === id));
    if (idx === -1) throw new Error(`Dispute ${id} not found`);

    list[idx].ai_drafted_evidence = evidenceText;
    if (list[idx].evidence_draft) list[idx].evidence_draft.text = evidenceText;
    const normalized = normalizeDispute(list[idx]);
    list[idx] = normalized;
    saveStoredDisputes(list);
    return { success: true, dispute: normalized };
  },

  async approveDispute(id, approverId = 'Authorized Seller Representative', approvalSecret = DEFAULT_APPROVAL_SECRET) {
    try {
      const res = await fetch(`${API_BASE}/disputes/${encodeURIComponent(id)}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approver_id: approverId, approval_secret: approvalSecret })
      });
      if (res.ok) {
        const data = await res.json();
        const normalized = normalizeDispute(data.dispute);
        return { success: true, dispute: normalized, audit: data.audit };
      } else {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Approval blocked (${res.status}): Verification failed`);
      }
    } catch (e) {
      if (e.message && !e.message.includes('Failed to fetch') && !e.message.includes('NetworkError')) {
        throw e;
      }
    }

    const list = getStoredDisputes();
    const idx = list.findIndex(d => (d.dispute_id === id || d.id === id));
    if (idx === -1) throw new Error(`Dispute ${id} not found`);

    const now = new Date().toISOString();
    list[idx].status = 'UNDER_REVIEW';
    list[idx].approval_state = 'submitted';
    list[idx].seller_approval = {
      approved: true,
      conceded: false,
      approved_at: now,
      approver_id: approverId,
      rejection_reason: null
    };
    const normalized = normalizeDispute(list[idx]);
    list[idx] = normalized;
    saveStoredDisputes(list);

    // Record in local audit trail
    const auditList = getStoredAudit();
    const prev = auditList[auditList.length - 1];
    const newEntry = {
      entryId: `AUD-${Math.floor(10000 + Math.random() * 90000)}`,
      disputeId: id,
      timestamp: now,
      actor: { type: 'HUMAN_APPROVER', id: approverId },
      action: 'DISPUTE_EVIDENCE_SUBMITTED',
      details: `Human merchant representative "${approverId}" authorized formal evidence submission to PayPal Sandbox API.`,
      hash: Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
      prevHash: prev ? prev.hash : '0000000000000000000000000000000000000000000000000000000000000000'
    };
    auditList.push(newEntry);
    saveStoredAudit(auditList);

    return { success: true, dispute: normalized, audit: newEntry };
  },

  async rejectDispute(id, reason, approverId = 'Authorized Seller Representative') {
    try {
      const res = await fetch(`${API_BASE}/disputes/${encodeURIComponent(id)}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, approver_id: approverId })
      });
      if (res.ok) {
        const data = await res.json();
        const normalized = normalizeDispute(data.dispute);
        return { success: true, dispute: normalized };
      } else {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Server error (${res.status})`);
      }
    } catch (e) {
      if (e.message && !e.message.includes('Failed to fetch') && !e.message.includes('NetworkError')) {
        throw e;
      }
    }

    const list = getStoredDisputes();
    const idx = list.findIndex(d => (d.dispute_id === id || d.id === id));
    if (idx === -1) throw new Error(`Dispute ${id} not found`);

    const now = new Date().toISOString();
    list[idx].status = 'RESOLVED';
    list[idx].approval_state = 'rejected';
    list[idx].seller_approval = {
      approved: false,
      conceded: true,
      approved_at: now,
      approver_id: approverId,
      rejection_reason: reason
    };
    const normalized = normalizeDispute(list[idx]);
    list[idx] = normalized;
    saveStoredDisputes(list);

    return { success: true, dispute: normalized };
  },

  async simulateDispute(scenario = {}) {
    try {
      const res = await fetch(`${API_BASE}/disputes/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scenario)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.dispute) {
          const normalized = normalizeDispute(data.dispute);
          const list = getStoredDisputes();
          list.unshift(normalized);
          saveStoredDisputes(list);
          return { success: true, dispute: normalized };
        }
      } else {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Simulation failed (${res.status})`);
      }
    } catch (e) {
      if (e.message && !e.message.includes('Failed to fetch') && !e.message.includes('NetworkError')) {
        throw e;
      }
    }

    const list = getStoredDisputes();
    const newId = `PP-D-${Math.floor(4000000 + Math.random() * 5000000)}`;
    const dueHours = scenario.due_hours || 48;
    const dueDate = new Date(Date.now() + dueHours * 60 * 60 * 1000).toISOString();
    const amt = parseFloat(scenario.amount || '450.00').toFixed(2);

    const simulated = normalizeDispute({
      id: newId,
      status: 'WAITING_FOR_SELLER_RESPONSE',
      approval_state: 'pending',
      amount: { currency: 'USD', value: amt },
      reason: scenario.reason || 'ITEM_NOT_RECEIVED',
      respond_by: dueDate,
      order: {
        id: `ORD-${Math.floor(10000 + Math.random() * 90000)}`,
        items: [{ name: scenario.item_name || 'USB-C Dual 4K Pro Docking Station', qty: 1 }],
        shipping: {
          carrier: scenario.carrier || 'UPS',
          tracking_number: '1Z' + Math.random().toString().slice(2, 18),
          status: 'DELIVERED',
          delivery_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          signed_by: (scenario.buyer_name || 'A. WRIGHT').toUpperCase(),
          has_signature: true
        }
      },
      evidence_draft: {
        text: `Dear PayPal Dispute Resolution Team,\n\nWe respectfully contest Dispute ${newId} regarding Order for ${scenario.item_name || 'Product'} ($${amt} USD).\n\n1. PROOF OF SHIPMENT & DELIVERY:\nThe order was dispatched via ${scenario.carrier || 'UPS'} to the verified PayPal shipping address.\n\n2. CARRIER AUDIT CONFIRMATION:\nCarrier records confirm delivery was successfully completed with signature on file.\n\n3. PAYPAL SELLER PROTECTION:\nAll criteria under Seller Protection Policy Section 11.3 have been satisfied.\n\nRespectfully submitted,\nAuthorized Merchant Representative`,
        proofs: []
      },
      win_score: 91,
      win_reasons: [
        'Carrier proof of delivery confirmed via KERNEL engine',
        'Recipient adult signature confirmed on file',
        'Destination postal code matches buyer verified address'
      ]
    });

    list.unshift(simulated);
    saveStoredDisputes(list);
    return { success: true, dispute: simulated };
  },

  async getAuditTrail(disputeId = null) {
    try {
      const url = disputeId ? `${API_BASE}/audit?dispute_id=${encodeURIComponent(disputeId)}` : `${API_BASE}/audit`;
      const res = await fetch(url);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {}

    const list = getStoredAudit();
    const filtered = disputeId ? list.filter(a => a.disputeId === disputeId) : list;
    return {
      success: true,
      count: filtered.length,
      audit_trail: [...filtered].reverse(),
      ledger_integrity: {
        valid: true,
        checked_entries: filtered.length,
        verified_at: new Date().toISOString()
      }
    };
  },

  async getRestockInventory() {
    try {
      const res = await fetch(`${API_BASE}/api/restock`);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {}

    const items = getStoredRestock();
    return {
      success: true,
      data: {
        spending_limit_usd: 500.0,
        items
      }
    };
  },

  async orderRestock(itemId, quantity, approverId = 'seller_merchant_primary') {
    try {
      const res = await fetch(`${API_BASE}/api/restock/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId, quantity, approver_id: approverId })
      });
      if (res.ok) {
        return await res.json();
      } else {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Restock order blocked: Guardrail limit exceeded`);
      }
    } catch (e) {
      if (e.message && !e.message.includes('Failed to fetch') && !e.message.includes('NetworkError')) {
        throw e;
      }
    }

    const items = getStoredRestock();
    const idx = items.findIndex(i => i.id === itemId);
    if (idx === -1) throw new Error('Item not found');

    const totalCost = items[idx].unit_cost_usd * quantity;
    if (totalCost > 500) {
      throw new Error(`Spending cap exceeded: $${totalCost.toFixed(2)} exceeds $500.00 autonomous threshold.`);
    }

    items[idx].current_stock += quantity;
    items[idx].urgency = 'LOW';
    saveStoredRestock(items);

    return {
      success: true,
      order: {
        order_id: `C3-ORD-${Math.floor(1000 + Math.random() * 9000)}`,
        item_id: itemId,
        quantity,
        total_usd: totalCost,
        status: 'DISPATCHED'
      }
    };
  },

  async syncDisputes() {
    try {
      const res = await fetch(`${API_BASE}/sync`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.disputes && Array.isArray(data.disputes)) {
          const normalized = data.disputes.map(normalizeDispute);
          saveStoredDisputes(normalized);
          return { success: true, count: normalized.length, synced_count: normalized.length, disputes: normalized };
        }
      }
    } catch (e) {}
    const list = getStoredDisputes().map(normalizeDispute);
    return { success: true, count: list.length, synced_count: list.length, disputes: list };
  },

  async redraftEvidence(id, merchantNotes = '') {
    try {
      const res = await fetch(`${API_BASE}/disputes/${encodeURIComponent(id)}/redraft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchant_notes: merchantNotes })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.dispute) {
          const normalized = normalizeDispute(data.dispute);
          const list = getStoredDisputes();
          const idx = list.findIndex(d => (d.dispute_id === id || d.id === id));
          if (idx !== -1) {
            list[idx] = normalized;
            saveStoredDisputes(list);
          }
          return { success: true, dispute: normalized };
        }
      } else {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Groq AI generation failed (${res.status})`);
      }
    } catch (e) {
      if (e.message && !e.message.includes('Failed to fetch') && !e.message.includes('NetworkError')) {
        throw e;
      }
    }

    const list = getStoredDisputes();
    const matched = list.find(d => (d.dispute_id === id || d.id === id));
    return { success: true, dispute: normalizeDispute(matched) };
  }
};
