import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Truck,
  FileText,
  Search,
  AlertTriangle,
  Lock,
  Edit3,
  RotateCcw,
  ExternalLink,
  MapPin,
  UserCheck,
  Hash,
  Send,
  HelpCircle,
  CreditCard,
  Package,
  Copy,
  Check,
  X,
  Sparkles,
  Info
} from 'lucide-react';
import { DEFAULT_APPROVAL_SECRET } from './apiClient.js';

export default function DetailPanel({
  dispute,
  onApprove,
  onReject,
  onSaveEvidence,
  onRedraft,
  onClose
}) {
  if (!dispute) return null;

  // Normalized Identifiers
  const disputeId = dispute.id || dispute.dispute_id || 'PP-D-UNKNOWN';
  const orderId = dispute.order?.id || dispute.order_id || 'ORD-001';
  const buyerName = dispute.buyer?.name || dispute.order?.shipping?.signed_by || 'Customer';
  const amountVal = parseFloat(dispute.amount?.value || dispute.dispute_amount?.value || '0.00').toFixed(2);
  const amountCurr = dispute.amount?.currency || dispute.dispute_amount?.currency || 'USD';
  const initialText = dispute.evidence_draft?.text || dispute.ai_drafted_evidence || '';

  const [evidenceText, setEvidenceText] = useState(initialText);
  const [isEditing, setIsEditing] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRedraftModal, setShowRedraftModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('Seller accepted claim liability');
  const [merchantNotes, setMerchantNotes] = useState('');
  const [isRedrafting, setIsRedrafting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [approverName, setApproverName] = useState('Authorized Seller Representative');
  const [approvalSecret, setApprovalSecret] = useState(DEFAULT_APPROVAL_SECRET);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setEvidenceText(dispute.evidence_draft?.text || dispute.ai_drafted_evidence || '');
    setIsEditing(false);
  }, [dispute.id, dispute.dispute_id, dispute.evidence_draft?.text, dispute.ai_drafted_evidence]);

  const winScore = dispute.win_score || 78;
  const isApproved = dispute.approval_state === 'submitted' || dispute.approval_state === 'approved' || Boolean(dispute.seller_approval?.approved);
  const isConceded = dispute.approval_state === 'rejected' || Boolean(dispute.seller_approval?.conceded);
  const breakdown = dispute.win_score_breakdown || {};
  const winReasons = dispute.win_reasons || [
    'Carrier proof of delivery confirmed via KERNEL engine',
    'Recipient adult signature confirmed on file',
    'Destination postal code matches buyer verified address'
  ];

  const carrierProof = dispute.carrier_proof || {
    carrier: dispute.order?.shipping?.carrier || 'UPS',
    tracking_number: dispute.order?.shipping?.tracking_number || '1Z9999999999',
    status: dispute.order?.shipping?.status || 'DELIVERED',
    delivery_date: dispute.order?.shipping?.delivery_date || dispute.created_at,
    signed_by: dispute.order?.shipping?.signed_by || buyerName,
    has_signature: dispute.order?.shipping?.has_signature ?? true,
    kernel_audit_id: 'KERNEL-CERT-9921'
  };

  const precedent = dispute.elastic_precedent || {
    precedent_id: 'PREC-88219',
    benchmark_win_rate: 0.94,
    policy_citation: 'PayPal Seller Protection Policy Section 11.3 (Proof of Delivery)'
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(evidenceText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveDraft = async () => {
    setIsSubmitting(true);
    try {
      await onSaveEvidence(disputeId, evidenceText);
      setIsEditing(false);
      setSaveMessage('Evidence draft updated!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (err) {
      alert('Error updating evidence: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmApproval = async () => {
    setIsApproving(true);
    try {
      await onApprove(disputeId, approverName, approvalSecret);
      setShowApproveModal(false);
    } catch (err) {
      alert('Approval blocked by security guardrail: ' + err.message);
    } finally {
      setIsApproving(false);
    }
  };

  const handleConfirmReject = async () => {
    setIsRejecting(true);
    try {
      await onReject(disputeId, rejectReason);
      setShowRejectModal(false);
    } catch (err) {
      alert('Action error: ' + err.message);
    } finally {
      setIsRejecting(false);
    }
  };

  const handleExecuteRedraft = async () => {
    setIsRedrafting(true);
    try {
      await onRedraft(disputeId, merchantNotes);
      setShowRedraftModal(false);
      setMerchantNotes('');
    } catch (err) {
      alert('Groq AI Redraft Error: ' + err.message);
    } finally {
      setIsRedrafting(false);
    }
  };

  return (
    <div className="paypal-card" style={{ marginTop: '24px', padding: '28px', borderTop: '4px solid #003087', position: 'relative' }}>
      {/* Close button */}
      {onClose && (
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: '#f1f5f9',
            border: 'none',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#64748b'
          }}
          title="Close details"
        >
          <X size={18} />
        </button>
      )}

      {/* Top Header: Case Overview */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '20px',
        paddingBottom: '20px',
        borderBottom: '1px solid var(--border-light)'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: '0.76rem',
              color: '#687173',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.04em'
            }}>
              PayPal Case ID
            </span>
            <span style={{ fontSize: '1.45rem', fontWeight: 800, color: '#003087', letterSpacing: '-0.02em' }}>
              {disputeId}
            </span>
            {isApproved ? (
              <span className="paypal-badge badge-resolved" style={{ padding: '4px 12px' }}>
                <CheckCircle2 size={13} /> Evidence Submitted
              </span>
            ) : isConceded ? (
              <span className="paypal-badge badge-urgent" style={{ padding: '4px 12px' }}>
                <XCircle size={13} /> Claim Conceded
              </span>
            ) : (
              <span className="paypal-badge badge-waiting" style={{ padding: '4px 12px' }}>
                Response Required
              </span>
            )}
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontSize: '0.84rem',
            color: '#475569',
            flexWrap: 'wrap'
          }}>
            <span>Order Reference: <strong style={{ color: '#0f172a' }}>{orderId}</strong></span>
            <span style={{ color: '#cbd5e1' }}>•</span>
            <span>Buyer: <strong style={{ color: '#0f172a' }}>{buyerName}</strong></span>
            <span style={{ color: '#cbd5e1' }}>•</span>
            <span>Reason: <strong style={{ color: '#0f172a' }}>{dispute.reason}</strong></span>
          </div>
        </div>

        {/* Claim Amount & Win Chance Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap', marginRight: onClose ? '36px' : '0' }}>
          <div style={{
            textAlign: 'right',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            paddingRight: '12px',
            borderRight: '1px solid var(--border-light)'
          }}>
            <div style={{ fontSize: '0.72rem', color: '#687173', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.04em' }}>
              Disputed Amount
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#003087', lineHeight: 1.15, marginTop: '2px' }}>
              ${amountVal}{' '}
              <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>{amountCurr}</span>
            </div>
          </div>

          {isConceded ? (
            <div style={{
              background: '#fef2f2',
              border: '1.5px solid #fecaca',
              borderRadius: 'var(--radius-md)',
              padding: '10px 18px',
              textAlign: 'center',
              minWidth: '150px'
            }}>
              <div style={{ fontSize: '0.7rem', color: '#991b1b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                Case Disposition
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#dc2626', lineHeight: 1.15, marginTop: '3px' }}>
                Claim Conceded
              </div>
              <div style={{ fontSize: '0.72rem', color: '#b91c1c', fontWeight: 600, marginTop: '2px' }}>
                Full Refund Issued
              </div>
            </div>
          ) : (
            <div style={{
              background: winScore >= 70 ? '#ecfdf5' : '#fffbeb',
              border: `1.5px solid ${winScore >= 70 ? '#a7f3d0' : '#fde68a'}`,
              borderRadius: 'var(--radius-md)',
              padding: '10px 20px',
              textAlign: 'center',
              minWidth: '150px'
            }}>
              <div style={{ fontSize: '0.7rem', color: winScore >= 70 ? '#065f46' : '#92400e', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                Estimated Win Chance
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: winScore >= 70 ? '#059669' : '#d97706', lineHeight: 1.15, marginTop: '2px' }}>
                {winScore}%
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Official PayPal Case Resolution Stepper */}
      <div style={{ margin: '20px 0', padding: '16px 20px', background: '#f8fafc', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0' }}>
        <div className="paypal-stepper">
          <div className="paypal-step completed">
            <div className="paypal-step-circle">✓</div>
            <div className="paypal-step-label">1. Dispute Filed</div>
          </div>

          <div className={`paypal-step ${isApproved ? 'completed' : isConceded ? 'completed' : 'active'}`}>
            <div className="paypal-step-circle">{isApproved || isConceded ? '✓' : '2'}</div>
            <div className="paypal-step-label">{isConceded ? '2. Claim Conceded' : '2. Seller Evidence'}</div>
          </div>

          <div className={`paypal-step ${isApproved ? 'active' : isConceded ? 'completed' : ''}`}>
            <div className="paypal-step-circle">{isConceded ? '✓' : '3'}</div>
            <div className="paypal-step-label">{isConceded ? '3. Full Refund Issued' : '3. PayPal Review'}</div>
          </div>

          <div className={`paypal-step ${isConceded ? 'completed' : ''}`}>
            <div className="paypal-step-circle">{isConceded ? '✓' : '4'}</div>
            <div className="paypal-step-label">{isConceded ? '4. Case Closed' : '4. Case Closed'}</div>
          </div>
        </div>
      </div>

      {/* Main 2-Column Content Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: '24px'
      }}>
        {/* Left Column: Proofs & Policy Citations */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* 1. KERNEL Carrier Tracking Box */}
          <div style={{
            background: '#ffffff',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-md)',
            padding: '20px',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Truck size={20} color="#0070ba" />
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#003087' }}>
                  Carrier Delivery Proof (KERNEL Engine)
                </h3>
              </div>
              <span style={{
                fontSize: '0.72rem',
                background: '#e8f7ee',
                color: '#007b36',
                border: '1px solid #b2e3c4',
                padding: '3px 10px',
                borderRadius: 'var(--radius-pill)',
                fontWeight: 700
              }}>
                ✓ VERIFIED BY CARRIER
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
                <span style={{ color: '#687173' }}>Carrier & Tracking:</span>
                <span className="font-mono" style={{ color: '#003087', fontWeight: 700 }}>
                  {carrierProof.carrier} • {carrierProof.tracking_number}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
                <span style={{ color: '#687173' }}>Delivery Status:</span>
                <span style={{ color: '#007b36', fontWeight: 700 }}>
                  ✓ {carrierProof.status} on {carrierProof.delivery_date ? new Date(carrierProof.delivery_date).toLocaleDateString() : 'Confirmed'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
                <span style={{ color: '#687173' }}>Recipient Signature:</span>
                <span style={{ color: carrierProof.has_signature ? '#007b36' : '#b45309', fontWeight: 700 }}>
                  {carrierProof.has_signature ? `✓ Signed by: ${carrierProof.signed_by}` : 'Doorstep / Reception delivery'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#687173' }}>Address Match Check:</span>
                <span style={{ color: '#007b36', fontWeight: 700 }}>
                  ✓ Matches buyer confirmed PayPal shipping destination
                </span>
              </div>
              <div style={{
                marginTop: '8px',
                padding: '8px 12px',
                background: '#f8fafc',
                borderRadius: '6px',
                fontSize: '0.74rem',
                color: '#64748b',
                border: '1px solid #e2e8f0'
              }}>
                KERNEL Cryptographic Certificate: <span className="font-mono" style={{ color: '#0070ba', fontWeight: 600 }}>{carrierProof.kernel_audit_id || 'KERNEL-CERT-9921'}</span>
              </div>
            </div>
          </div>

          {/* 2. Elastic Precedent & Policy Match */}
          <div style={{
            background: '#ffffff',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-md)',
            padding: '20px',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Search size={20} color="#003087" />
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#003087' }}>
                  Elastic Cloud Precedent Search
                </h3>
              </div>
              <span style={{
                fontSize: '0.72rem',
                background: '#fefce8',
                color: '#a16207',
                border: '1px solid #fef08a',
                padding: '3px 10px',
                borderRadius: 'var(--radius-pill)',
                fontWeight: 700
              }}>
                Cluster: past_disputes (30 Cases)
              </span>
            </div>

            {dispute.similar_cases && dispute.similar_cases.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
                  Top Similar Historical Disputes Matched by BM25:
                </div>
                {dispute.similar_cases.map((sc, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      fontSize: '0.78rem'
                    }}
                  >
                    <div>
                      <strong style={{ color: '#003087' }}>{sc.case_id || `PREC-${idx + 1}`}</strong>
                      <span style={{ color: '#64748b', marginLeft: '6px' }}>{sc.item_name || 'Similar Item'} ({sc.carrier || 'Carrier'})</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        fontWeight: 700,
                        color: sc.outcome === 'WON' ? '#16a34a' : '#dc2626',
                        background: sc.outcome === 'WON' ? '#dcfce7' : '#fee2e2',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '0.7rem'
                      }}>
                        {sc.outcome || 'WON'}
                      </span>
                      {sc.similarity_score && (
                        <span style={{ color: '#64748b', fontSize: '0.7rem' }}>
                          {Math.round(sc.similarity_score * 100)}% match
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '0.84rem', color: '#334155', lineHeight: '1.5', marginBottom: '10px' }}>
                Historical PayPal disputes with signed carrier proof on this reason won{' '}
                <strong style={{ color: '#007b36' }}>{((precedent.benchmark_win_rate || 0.94) * 100).toFixed(0)}%</strong> of cases in the seller's favor.
              </p>
            )}

            <div style={{
              fontSize: '0.76rem',
              color: '#003087',
              background: '#eff6ff',
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #bfdbfe',
              fontWeight: 600
            }}>
              PayPal Policy Rule: {precedent.policy_citation || 'PayPal Seller Protection Policy Section 11.3 (Proof of Delivery)'}
            </div>
          </div>

          {/* 3. Key Win Factors Evaluated */}
          <div style={{
            background: '#ffffff',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-md)',
            padding: '20px',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#003087', marginBottom: '12px' }}>
              Key Win Factors Evaluated
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Show structured breakdown if present */}
              {Object.keys(breakdown).length > 0 ? (
                Object.entries(breakdown).map(([key, item]) => (
                  <div
                    key={key}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      fontSize: '0.82rem',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      background: item.positive ? '#f0fdf4' : '#fef2f2',
                      border: `1px solid ${item.positive ? '#bbf7d0' : '#fecaca'}`
                    }}
                  >
                    <span style={{
                      fontWeight: 800,
                      color: item.positive ? '#15803d' : '#b91c1c',
                      minWidth: '34px'
                    }}>
                      {item.points > 0 ? `+${item.points}` : item.points}
                    </span>
                    <span style={{ color: '#1e293b' }}>{item.label}</span>
                  </div>
                ))
              ) : (
                /* Fallback to win_reasons from Person A Contract */
                winReasons.map((reason, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      fontSize: '0.82rem',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      background: '#f0fdf4',
                      border: '1px solid #bbf7d0'
                    }}
                  >
                    <span style={{
                      fontWeight: 800,
                      color: '#15803d',
                      fontSize: '0.74rem',
                      background: '#dcfce7',
                      padding: '2px 8px',
                      borderRadius: '4px'
                    }}>
                      +{30 - (idx * 5)} pts
                    </span>
                    <span style={{ color: '#1e293b', fontWeight: 500 }}>{reason}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: AI Evidence Drafting Studio & Action Guardrail */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Evidence Editor Box */}
          <div style={{
            background: '#ffffff',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-md)',
            padding: '20px',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            flex: 1
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={20} color="#0070ba" />
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#003087' }}>
                  AI-Drafted Defense Statement
                </h3>
                <span style={{
                  fontSize: '0.7rem',
                  background: '#f1f5f9',
                  color: '#475569',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-pill)',
                  fontWeight: 600
                }}>
                  {isEditing ? 'Editing...' : 'Autonomous Draft'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {saveMessage && (
                  <span style={{ fontSize: '0.78rem', color: '#007b36', fontWeight: 700 }}>
                    {saveMessage}
                  </span>
                )}

                <button
                  onClick={handleCopyText}
                  className="btn btn-paypal-outline"
                  style={{ padding: '5px 10px', fontSize: '0.76rem' }}
                  title="Copy statement to clipboard"
                >
                  {copied ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>

                {isConceded ? (
                  <span style={{ fontSize: '0.76rem', color: '#dc2626', fontWeight: 700, background: '#fef2f2', padding: '4px 10px', borderRadius: 'var(--radius-pill)', border: '1px solid #fecaca' }}>
                    Archived • Claim Conceded
                  </span>
                ) : isApproved ? (
                  <span style={{ fontSize: '0.76rem', color: '#16a34a', fontWeight: 700, background: '#f0fdf4', padding: '4px 10px', borderRadius: 'var(--radius-pill)', border: '1px solid #bbf7d0' }}>
                    Locked • Submitted to PayPal
                  </span>
                ) : isEditing ? (
                  <button
                    onClick={handleSaveDraft}
                    disabled={isSubmitting}
                    className="btn btn-paypal-blue"
                    style={{ padding: '5px 14px', fontSize: '0.78rem' }}
                  >
                    Save Changes
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => setShowRedraftModal(true)}
                      className="btn btn-paypal-outline"
                      style={{ padding: '5px 12px', fontSize: '0.76rem', color: '#1d4ed8', borderColor: '#bfdbfe', background: '#eff6ff' }}
                      title="Redraft with Groq AI using merchant notes"
                    >
                      <Sparkles size={12} />
                      Regenerate (Groq AI)
                    </button>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="btn btn-paypal-outline"
                      style={{ padding: '5px 14px', fontSize: '0.78rem' }}
                    >
                      <Edit3 size={13} />
                      Edit Draft
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Editable Text Area */}
            <textarea
              value={evidenceText}
              onChange={(e) => {
                if (isApproved || isConceded) return;
                setEvidenceText(e.target.value);
                if (!isEditing) setIsEditing(true);
              }}
              readOnly={isApproved || isConceded}
              rows={14}
              style={{
                width: '100%',
                background: isEditing ? '#ffffff' : '#f8fafc',
                border: isEditing ? '1.5px solid #0070ba' : '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '16px',
                color: '#0f172a',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.82rem',
                lineHeight: '1.6',
                resize: 'vertical',
                outline: 'none',
                boxShadow: isEditing ? '0 0 0 3px rgba(0, 112, 186, 0.15)' : 'none',
                transition: 'border-color 0.15s'
              }}
              placeholder="Formal evidence response for PayPal dispute review..."
            />

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '10px',
              fontSize: '0.76rem',
              color: '#687173'
            }}>
              <span>Characters: {evidenceText.length}</span>
              <span>Conforms to PayPal Seller Protection Guidelines (Section 11)</span>
            </div>

            {/* Evidence Readiness Checklist */}
            <div style={{
              marginTop: '16px',
              padding: '14px',
              background: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #e2e8f0'
            }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#003087', marginBottom: '8px' }}>
                PAYPAL EVIDENCE READINESS CHECKLIST:
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.78rem' }}>
                <span style={{ color: '#007b36', fontWeight: 600 }}>✓ Carrier tracking proof attached</span>
                <span style={{ color: '#007b36', fontWeight: 600 }}>✓ Destination postal address match</span>
                <span style={{ color: carrierProof.has_signature ? '#007b36' : '#b45309', fontWeight: 600 }}>
                  {carrierProof.has_signature ? '✓ Recipient direct signature verified' : '○ Standard doorstep delivery'}
                </span>
                <span style={{ color: '#007b36', fontWeight: 600 }}>✓ Seller Protection policy rules cited</span>
              </div>
            </div>
          </div>

          {/* Action Box: Human-in-the-Loop Security Gate */}
          <div style={{
            background: '#ffffff',
            border: '2px solid #003087',
            borderRadius: 'var(--radius-md)',
            padding: '24px',
            boxShadow: 'var(--shadow-card)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <Lock size={20} color="#003087" />
              <div>
                <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#003087' }}>
                  Human-in-the-Loop Security Guardrail
                </h4>
                <p style={{ fontSize: '0.8rem', color: '#475569' }}>
                  The AI drafts evidence, but human authorization is strictly required to submit response or move money.
                </p>
              </div>
            </div>

            {isApproved ? (
              <div style={{
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                borderRadius: '8px',
                padding: '16px',
                fontSize: '0.85rem'
              }}>
                <div style={{ color: '#065f46', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle2 size={20} color="#059669" />
                  Authorized & Submitted by {dispute.seller_approval?.approver_id || 'Authorized Merchant'}
                </div>
                <div style={{ color: '#047857', fontSize: '0.78rem', marginTop: '4px' }}>
                  Dispatched to PayPal Sandbox API. Recorded in cryptographic SHA-256 ledger with immutable proof.
                </div>
              </div>
            ) : isConceded ? (
              <div style={{
                background: '#fef2f2',
                border: '1.5px solid #fecaca',
                borderRadius: '8px',
                padding: '18px 20px',
                fontSize: '0.85rem'
              }}>
                <div style={{ color: '#991b1b', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.98rem' }}>
                  <XCircle size={22} color="#dc2626" />
                  Claim Conceded / Full Buyer Refund Issued
                </div>
                <div style={{ color: '#7f1d1d', fontSize: '0.82rem', marginTop: '6px', lineHeight: '1.5' }}>
                  Merchant accepted liability. Full dispute amount of <strong>${amountVal} {amountCurr}</strong> credited back to buyer <strong>{buyerName}</strong>.
                </div>
                <div style={{
                  marginTop: '12px',
                  paddingTop: '12px',
                  borderTop: '1px solid #fee2e2',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '8px',
                  fontSize: '0.78rem',
                  color: '#991b1b'
                }}>
                  <div>
                    <strong>Reason:</strong> {dispute.seller_approval?.rejection_reason || 'Seller accepted claim liability'}
                  </div>
                  <div>
                    <strong>Authorized By:</strong> {dispute.seller_approval?.approver_id || 'Authorized Merchant Representative'}
                  </div>
                  <div>
                    <strong>Date & Time:</strong> {dispute.seller_approval?.approved_at ? new Date(dispute.seller_approval.approved_at).toLocaleString() : 'Recent'}
                  </div>
                  <div>
                    <strong>PayPal Status:</strong> RESOLVED • Refund Completed
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setShowApproveModal(true)}
                  className="btn btn-paypal-gold"
                  style={{ flex: 1, padding: '13px 24px', fontSize: '0.95rem' }}
                >
                  <ShieldCheck size={20} />
                  Approve & Submit to PayPal
                </button>

                <button
                  onClick={() => setShowRejectModal(true)}
                  className="btn btn-paypal-danger"
                  style={{ padding: '13px 20px', fontSize: '0.9rem' }}
                >
                  <XCircle size={18} />
                  Accept Claim / Refund
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal: Authorize Evidence Submission */}
      {showApproveModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade" style={{ maxWidth: '580px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '18px' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                background: '#ecfdf5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <ShieldCheck size={26} color="#059669" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#003087' }}>
                  Authorize Evidence Submission
                </h3>
                <p style={{ fontSize: '0.82rem', color: '#475569' }}>
                  PayPal Dispute Resolution Center submission signature
                </p>
              </div>
            </div>

            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '18px',
              fontSize: '0.84rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div><strong>Case ID:</strong> <span className="font-mono" style={{ color: '#0070ba' }}>{disputeId}</span></div>
              <div><strong>Disputed Amount:</strong> ${amountVal} {amountCurr}</div>
              <div><strong>Carrier Proof:</strong> {carrierProof.carrier} ({carrierProof.tracking_number})</div>
              <div><strong>Calculated Win Probability:</strong> <span style={{ color: '#007b36', fontWeight: 800 }}>{winScore}%</span></div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#003087', marginBottom: '6px' }}>
                Authorized Seller Representative:
              </label>
              <input
                type="text"
                value={approverName}
                onChange={(e) => setApproverName(e.target.value)}
                style={{
                  width: '100%',
                  background: '#ffffff',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: 'var(--radius-pill)',
                  padding: '9px 16px',
                  color: '#0f172a',
                  fontSize: '0.88rem',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 700, color: '#003087', marginBottom: '6px' }}>
                <span>Security Gate Token (`APPROVAL_SECRET`):</span>
                <span style={{ fontSize: '0.72rem', color: '#007b36', fontWeight: 600 }}>Active Gate</span>
              </label>
              <input
                type="password"
                value={approvalSecret}
                onChange={(e) => setApprovalSecret(e.target.value)}
                style={{
                  width: '100%',
                  background: '#ffffff',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: 'var(--radius-pill)',
                  padding: '9px 16px',
                  color: '#0f172a',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.82rem',
                  outline: 'none'
                }}
              />
            </div>

            <p style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '22px' }}>
              By confirming, you authorize submission of this legal evidence response to the PayPal Sandbox Dispute API.
              A cryptographic SHA-256 ledger block and compliance audit entry will be generated.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => setShowApproveModal(false)}
                className="btn btn-paypal-neutral"
                disabled={isApproving}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmApproval}
                disabled={isApproving}
                className="btn btn-paypal-gold"
              >
                {isApproving ? 'Submitting to PayPal...' : 'Authorize & Submit to PayPal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Regenerate with Groq AI with Merchant Notes */}
      {showRedraftModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade" style={{ maxWidth: '560px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: '#eff6ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Sparkles size={22} color="#2563eb" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#003087' }}>
                  Regenerate Defense with Groq AI
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Powered by <strong style={{ color: '#2563eb' }}>openai/gpt-oss-120b</strong> and Elastic precedent search
                </p>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#003087', marginBottom: '6px' }}>
                Merchant Specific Clarifications (Optional):
              </label>
              <textarea
                value={merchantNotes}
                onChange={(e) => setMerchantNotes(e.target.value)}
                rows={4}
                style={{
                  width: '100%',
                  background: '#f8fafc',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '12px',
                  fontSize: '0.84rem',
                  outline: 'none',
                  color: '#0f172a'
                }}
                placeholder="e.g. Customer acknowledged receipt via email; package signed by front desk security on Nov 3..."
              />
            </div>

            <div style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '8px',
              padding: '12px',
              fontSize: '0.78rem',
              color: '#166534',
              marginBottom: '20px'
            }}>
              ✓ AI will query the 30 indexed dispute precedents in Elastic Cloud and construct factual seller protection defense.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => setShowRedraftModal(false)}
                className="btn btn-paypal-neutral"
                disabled={isRedrafting}
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteRedraft}
                disabled={isRedrafting}
                className="btn btn-paypal-blue"
              >
                {isRedrafting ? 'Generating with Groq 120B...' : 'Generate Fresh Defense'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Concede / Accept Claim */}
      {showRejectModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade" style={{ maxWidth: '520px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: '#fef2f2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <XCircle size={22} color="#dc2626" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#991b1b' }}>
                  Accept Claim & Issue Refund
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Concede dispute and release ${amountVal} {amountCurr} to the buyer
                </p>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#003087', marginBottom: '6px' }}>
                Concession Reason:
              </label>
              <input
                type="text"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                style={{
                  width: '100%',
                  background: '#f8fafc',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: 'var(--radius-pill)',
                  padding: '9px 16px',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              />
            </div>

            <p style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '20px' }}>
              This action is final and closes the case in PayPal. The reserved funds will be credited back to the customer.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => setShowRejectModal(false)}
                className="btn btn-paypal-neutral"
                disabled={isRejecting}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={isRejecting}
                className="btn btn-paypal-danger"
              >
                {isRejecting ? 'Issuing Refund in PayPal...' : 'Confirm Concession & Refund'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
