import React, { useState, useEffect } from 'react';
import Navbar from './Navbar.jsx';
import DisputeGrid from './DisputeGrid.jsx';
import DetailPanel from './DetailPanel.jsx';
import DeadlineTimeline from './DeadlineTimeline.jsx';
import RestockChannel3 from './RestockChannel3.jsx';
import AuditTrailModal from './AuditTrailModal.jsx';
import SimulateDisputeModal from './SimulateDisputeModal.jsx';
import { initialMockDisputes } from './initialMockData.js';
import { api, normalizeDispute } from './apiClient.js';

export default function App() {
  const [activeTab, setActiveTab] = useState('disputes'); // 'disputes' | 'timeline' | 'restock'
  const [disputes, setDisputes] = useState(initialMockDisputes.map(normalizeDispute));
  const [selectedDispute, setSelectedDispute] = useState(initialMockDisputes.map(normalizeDispute)[0]);
  const [isMockMode, setIsMockMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Modals
  const [showSimulateModal, setShowSimulateModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Fetch disputes on initial load or mode change
  useEffect(() => {
    loadDisputes();
  }, [isMockMode]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4500);
  };

  const loadDisputes = async () => {
    if (isMockMode) {
      const list = initialMockDisputes.map(normalizeDispute);
      setDisputes(list);
      if (!selectedDispute) setSelectedDispute(list[0]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await api.getDisputes();
      if (res.disputes && res.disputes.length > 0) {
        setDisputes(res.disputes);
        setSelectedDispute(prev => {
          if (!prev) return res.disputes[0];
          const prevId = prev.id || prev.dispute_id;
          const matched = res.disputes.find(d => (d.id === prevId || d.dispute_id === prevId));
          return matched || res.disputes[0];
        });
      }
    } catch (err) {
      console.warn('Backend API unavailable, using mock data:', err);
      const list = initialMockDisputes.map(normalizeDispute);
      setDisputes(list);
      if (!selectedDispute) setSelectedDispute(list[0]);
    } finally {
      setLoading(false);
    }
  };

  // Sync fresh disputes from PayPal Sandbox
  const handleSyncPayPal = async () => {
    try {
      setIsSyncing(true);
      const res = await api.syncDisputes();
      if (res.disputes && res.disputes.length > 0) {
        setDisputes(res.disputes);
        setSelectedDispute(res.disputes[0]);
        showToast(`Synchronized ${res.disputes.length} active disputes from PayPal Sandbox!`);
      } else {
        showToast(`PayPal Sandbox checked: disputes are up to date.`);
      }
    } catch (err) {
      showToast(`Sync failed: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle 1-Click Human Approval
  const handleApprove = async (disputeId, approverName, approvalSecret) => {
    try {
      const res = await api.approveDispute(disputeId, approverName, approvalSecret);
      if (res.dispute) {
        setDisputes(prev => prev.map(d => ((d.id === disputeId || d.dispute_id === disputeId) ? res.dispute : d)));
        setSelectedDispute(res.dispute);
        showToast(`Dispute ${disputeId} approved & submitted with audit hash ${res.audit?.hash?.substring(0, 8)}...`);
      }
    } catch (err) {
      alert('Approval failed: ' + err.message);
    }
  };

  // Handle Reject/Concede Claim
  const handleReject = async (disputeId, reason) => {
    try {
      const res = await api.rejectDispute(disputeId, reason);
      if (res.dispute) {
        setDisputes(prev => prev.map(d => ((d.id === disputeId || d.dispute_id === disputeId) ? res.dispute : d)));
        setSelectedDispute(res.dispute);
        showToast(`Dispute ${disputeId} claim conceded.`);
      }
    } catch (err) {
      alert('Action failed: ' + err.message);
    }
  };

  // Handle Evidence Save
  const handleSaveEvidence = async (disputeId, text) => {
    try {
      const res = await api.updateEvidence(disputeId, text);
      if (res.dispute) {
        setDisputes(prev => prev.map(d => ((d.id === disputeId || d.dispute_id === disputeId) ? res.dispute : d)));
        setSelectedDispute(res.dispute);
        showToast('Evidence statement saved.');
      }
    } catch (err) {
      alert('Save error: ' + err.message);
    }
  };

  // Handle Redraft Evidence with Groq AI
  const handleRedraft = async (disputeId, notes = '') => {
    try {
      showToast('Analyzing Elastic precedents & generating fresh draft with Groq AI...');
      const res = await api.redraftEvidence(disputeId, notes);
      if (res.dispute) {
        setDisputes(prev => prev.map(d => ((d.id === disputeId || d.dispute_id === disputeId) ? res.dispute : d)));
        setSelectedDispute(res.dispute);
        showToast('Fresh Groq AI defense response generated!');
      }
    } catch (err) {
      alert('Redraft error: ' + err.message);
    }
  };

  // Handle New Dispute Simulated
  const handleSimulated = (newDispute) => {
    const normalized = normalizeDispute(newDispute);
    setDisputes(prev => [normalized, ...prev]);
    setSelectedDispute(normalized);
    setActiveTab('disputes');
    showToast(`Incoming dispute ${normalized.id || normalized.dispute_id} analyzed! Win score: ${normalized.win_score}%`);
  };

  const pendingCount = disputes.filter(d => (
    d.status === 'WAITING_FOR_SELLER_RESPONSE' || 
    d.status === 'PENDING_REVIEW' || 
    d.approval_state === 'pending'
  )).length;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f5f7fa' }}>
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        pendingCount={pendingCount}
        onOpenSimulate={() => setShowSimulateModal(true)}
        onOpenAudit={() => setShowAuditModal(true)}
        onSync={handleSyncPayPal}
        isSyncing={isSyncing}
        isMockMode={isMockMode}
        setIsMockMode={setIsMockMode}
      />

      {/* PayPal Style Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '80px',
          right: '32px',
          zIndex: 2000,
          background: '#003087',
          color: '#ffffff',
          boxShadow: '0 10px 25px rgba(0, 48, 135, 0.35)',
          borderRadius: 'var(--radius-pill)',
          padding: '12px 24px',
          fontSize: '0.88rem',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }} className="animate-fade">
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4ade80' }} />
          {toastMessage}
        </div>
      )}

      {/* Main Content Area */}
      <main style={{ flex: 1, maxWidth: '1440px', width: '100%', margin: '0 auto', padding: '0 32px 48px 32px' }}>
        {activeTab === 'disputes' && (
          <div>
            {/* AG Grid Dispute Table */}
            <DisputeGrid
              disputes={disputes}
              selectedDispute={selectedDispute}
              onSelectDispute={(d) => setSelectedDispute(d)}
            />

            {/* Case Detail Panel & Evidence Studio */}
            {selectedDispute && (
              <DetailPanel
                dispute={selectedDispute}
                onApprove={handleApprove}
                onReject={handleReject}
                onSaveEvidence={handleSaveEvidence}
                onRedraft={handleRedraft}
                onClose={() => setSelectedDispute(null)}
              />
            )}
          </div>
        )}

        {activeTab === 'timeline' && (
          <DeadlineTimeline
            disputes={disputes}
            onSelectDispute={(d) => {
              setSelectedDispute(d);
              setActiveTab('disputes');
            }}
          />
        )}

        {activeTab === 'restock' && (
          <RestockChannel3 />
        )}
      </main>

      {/* Modals */}
      {showSimulateModal && (
        <SimulateDisputeModal
          onClose={() => setShowSimulateModal(false)}
          onSimulated={handleSimulated}
        />
      )}

      {showAuditModal && (
        <AuditTrailModal
          disputeId={selectedDispute?.id || selectedDispute?.dispute_id}
          onClose={() => setShowAuditModal(false)}
        />
      )}

      {/* Official PayPal Style Footer */}
      <footer style={{
        background: '#ffffff',
        borderTop: '1px solid var(--border-light)',
        padding: '24px 32px',
        fontSize: '0.8rem',
        color: '#687173'
      }}>
        <div style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '20px', fontWeight: 600, color: '#0070ba' }}>
            <span style={{ cursor: 'pointer' }}>Help & Contact</span>
            <span style={{ cursor: 'pointer' }}>Security</span>
            <span style={{ cursor: 'pointer' }}>Seller Protection</span>
            <span style={{ cursor: 'pointer' }}>Legal</span>
            <span style={{ cursor: 'pointer' }}>Privacy</span>
          </div>

          <div>
            © 2026 PayPal AI Dispute Copilot • Powered by PayPal Sandbox REST API, Groq (openai/gpt-oss-120b), Elastic Cloud, KERNEL & AG Grid
          </div>
        </div>
      </footer>
    </div>
  );
}
