import React, { useState, useEffect } from 'react';
import {
  History,
  ShieldCheck,
  CheckCircle2,
  X,
  Hash,
  UserCheck,
  Cpu,
  ArrowRight,
  Filter,
  Copy,
  Check,
  ShieldAlert
} from 'lucide-react';
import { api } from './apiClient.js';

export default function AuditTrailModal({ onClose, disputeId }) {
  const [trail, setTrail] = useState([]);
  const [integrity, setIntegrity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterByCase, setFilterByCase] = useState(false);
  const [copiedHash, setCopiedHash] = useState('');

  useEffect(() => {
    loadAudit();
  }, [disputeId, filterByCase]);

  const loadAudit = async () => {
    try {
      setLoading(true);
      const res = await api.getAuditTrail(filterByCase ? disputeId : null);
      setTrail(res.audit_trail || []);
      setIntegrity(res.ledger_integrity || { valid: true });
    } catch (err) {
      console.warn('Failed to fetch audit trail:', err);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(''), 2000);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content animate-fade" style={{ maxWidth: '840px', maxHeight: '90vh' }}>
        {/* Modal Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: '16px',
          borderBottom: '1px solid var(--border-light)',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              background: '#e0f2fe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <History size={22} color="#0070ba" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#003087' }}>
                Cryptographic Audit Ledger
              </h2>
              <p style={{ fontSize: '0.8rem', color: '#475569' }}>
                SHA-256 chained audit entries guaranteeing immutable human-in-the-loop compliance
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {disputeId && (
              <button
                onClick={() => setFilterByCase(!filterByCase)}
                style={{
                  background: filterByCase ? '#003087' : '#f1f5f9',
                  color: filterByCase ? '#ffffff' : '#475569',
                  border: 'none',
                  borderRadius: 'var(--radius-pill)',
                  padding: '5px 12px',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {filterByCase ? `Filtering: ${disputeId}` : 'Show All Entries'}
              </button>
            )}

            <div style={{
              background: integrity?.valid ? '#ecfdf5' : '#fef2f2',
              border: `1.5px solid ${integrity?.valid ? '#a7f3d0' : '#fecaca'}`,
              borderRadius: 'var(--radius-pill)',
              padding: '5px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.74rem',
              color: integrity?.valid ? '#065f46' : '#991b1b',
              fontWeight: 700
            }}>
              <ShieldCheck size={14} color={integrity?.valid ? '#059669' : '#dc2626'} />
              {integrity?.valid ? 'Chain Integrity: 100% Valid' : 'Integrity Mismatch'}
            </div>

            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              <X size={22} />
            </button>
          </div>
        </div>

        {/* Audit Log Entries List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '60vh', overflowY: 'auto', paddingRight: '4px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
              Verifying SHA-256 cryptographic chain...
            </div>
          ) : trail.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
              No audit logs recorded for this criteria.
            </div>
          ) : (
            trail.map((entry) => {
              const actorType = entry.actor?.type || '';
              const isHuman = actorType.includes('HUMAN');
              const isAI = actorType.includes('AI');

              return (
                <div
                  key={entry.entryId}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid var(--border-light)',
                    borderRadius: 'var(--radius-md)',
                    padding: '16px',
                    fontSize: '0.84rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span className="font-mono" style={{ color: '#0070ba', fontWeight: 800, fontSize: '0.88rem' }}>
                        {entry.entryId}
                      </span>
                      <span style={{
                        padding: '3px 10px',
                        borderRadius: 'var(--radius-pill)',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        background: isHuman ? '#ecfdf5' : isAI ? '#eff6ff' : '#f1f5f9',
                        color: isHuman ? '#065f46' : isAI ? '#1e40af' : '#475569',
                        border: `1px solid ${isHuman ? '#a7f3d0' : isAI ? '#bfdbfe' : '#e2e8f0'}`
                      }}>
                        {isHuman ? 'HUMAN SELLER AUTHORIZATION' : isAI ? 'AI COPILOT DRAFT' : actorType}
                      </span>
                      <span style={{
                        fontSize: '0.74rem',
                        color: '#64748b'
                      }}>
                        Dispute: <strong style={{ color: '#0f172a' }}>{entry.disputeId}</strong>
                      </span>
                    </div>

                    <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                      {new Date(entry.timestamp).toLocaleString()}
                    </span>
                  </div>

                  <p style={{ color: '#1e293b', marginBottom: '10px', lineHeight: '1.5' }}>
                    {entry.details}
                  </p>

                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    background: '#ffffff',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    fontSize: '0.72rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ color: '#64748b', minWidth: '85px', fontWeight: 600 }}>SHA-256 Hash:</span>
                        <span className="font-mono" style={{ color: '#003087', fontWeight: 600, wordBreak: 'break-all' }}>
                          {entry.hash}
                        </span>
                      </div>
                      <button
                        onClick={() => copyToClipboard(entry.hash)}
                        style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '2px 6px' }}
                        title="Copy hash"
                      >
                        {copiedHash === entry.hash ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
                      </button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ color: '#64748b', minWidth: '85px', fontWeight: 600 }}>Previous Link:</span>
                      <span className="font-mono" style={{ color: '#64748b', wordBreak: 'break-all' }}>
                        {entry.prevHash}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
