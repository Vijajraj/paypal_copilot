import React from 'react';
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  DollarSign,
  ChevronRight,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';

export default function DeadlineTimeline({ disputes, onSelectDispute }) {
  const now = Date.now();

  const processed = (disputes || []).map(d => {
    const isResolved = d.status === 'RESOLVED' || d.approval_state === 'submitted' || d.approval_state === 'rejected' || d.seller_approval?.approved;
    const dueStr = d.respond_by || d.seller_response_due_date || new Date(Date.now() + 48 * 3600 * 1000).toISOString();
    const dueTime = new Date(dueStr).getTime();
    const diffHours = Math.round((dueTime - now) / (1000 * 60 * 60));

    let urgency = 'normal';
    if (isResolved) urgency = 'resolved';
    else if (diffHours <= 24) urgency = 'urgent';
    else if (diffHours <= 72) urgency = 'warning';

    const caseId = d.id || d.dispute_id;
    const amountVal = parseFloat(d.amount?.value || d.dispute_amount?.value || '0').toFixed(2);
    const amountCurr = d.amount?.currency || d.dispute_amount?.currency || 'USD';
    const buyerName = d.buyer?.name || d.order?.shipping?.signed_by || 'Customer';
    const orderId = d.order?.id || d.order_id || 'ORD-001';

    return {
      ...d,
      caseId,
      amountVal,
      amountCurr,
      buyerName,
      orderId,
      dueStr,
      diffHours,
      urgency,
      isResolved
    };
  });

  const sorted = [...processed].sort((a, b) => {
    if (a.isResolved && !b.isResolved) return 1;
    if (!a.isResolved && b.isResolved) return -1;
    return a.diffHours - b.diffHours;
  });

  const urgentCount = sorted.filter(d => d.urgency === 'urgent').length;
  const warningCount = sorted.filter(d => d.urgency === 'warning').length;
  const totalAtRisk = sorted
    .filter(d => !d.isResolved)
    .reduce((acc, d) => acc + parseFloat(d.amountVal || 0), 0);

  return (
    <section role="region" aria-label="Response Deadline Radar" className="paypal-card" style={{ padding: '28px', borderTop: '4px solid #003087' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '24px',
        borderBottom: '1px solid var(--border-light)',
        paddingBottom: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#003087' }}>
              Response Deadline Radar
            </h2>
            <span style={{
              background: '#e6f2ff',
              color: '#005ea6',
              fontSize: '0.74rem',
              fontWeight: 700,
              padding: '3px 10px',
              borderRadius: 'var(--radius-pill)',
              border: '1px solid #b8dcff'
            }}>
              LIVE SCHEDULE
            </span>
          </div>
          <p style={{ fontSize: '0.84rem', color: '#475569', marginTop: '4px' }}>
            Chronological timeline of PayPal response deadlines. Urgent cases (&lt; 24 hours) require immediate merchant action.
          </p>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{
            background: '#fdf2f2',
            border: '1px solid #fecdca',
            borderRadius: 'var(--radius-md)',
            padding: '8px 16px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '0.7rem', color: '#d92d20', fontWeight: 800, textTransform: 'uppercase' }}>
              Urgent (&lt; 24h)
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#d92d20' }}>
              {urgentCount}
            </div>
          </div>

          <div style={{
            background: '#fff8e6',
            border: '1px solid #ffe399',
            borderRadius: 'var(--radius-md)',
            padding: '8px 16px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '0.7rem', color: '#946300', fontWeight: 800, textTransform: 'uppercase' }}>
              Warning (&lt; 3d)
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#946300' }}>
              {warningCount}
            </div>
          </div>

          <div style={{
            background: '#f8fafc',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-md)',
            padding: '8px 16px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>
              Funds At Risk
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#003087' }}>
              ${totalAtRisk.toFixed(2)} USD
            </div>
          </div>
        </div>
      </div>

      {/* Visual Timeline Track */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {sorted.map(dispute => {
          let borderHighlight = 'var(--border-light)';
          let bgHighlight = '#ffffff';

          if (dispute.urgency === 'urgent') {
            borderHighlight = '#fecdca';
            bgHighlight = '#fffbfa';
          } else if (dispute.urgency === 'warning') {
            borderHighlight = '#ffe399';
            bgHighlight = '#fffdf5';
          } else if (dispute.urgency === 'resolved') {
            borderHighlight = '#b2e3c4';
            bgHighlight = '#f9fefb';
          }

          const totalWindowHours = 240;
          const remainingPct = dispute.isResolved ? 100 : Math.max(5, Math.min(100, (dispute.diffHours / totalWindowHours) * 100));

          return (
            <div
              key={dispute.caseId}
              role="button"
              tabIndex="0"
              aria-label={`Case ${dispute.caseId}, Reason: ${dispute.reason}, Due in ${dispute.diffHours} hours, Amount $${dispute.amountVal} ${dispute.amountCurr}`}
              onClick={() => onSelectDispute(dispute)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectDispute(dispute);
                }
              }}
              style={{
                background: bgHighlight,
                border: `1.5px solid ${borderHighlight}`,
                borderRadius: 'var(--radius-md)',
                padding: '16px 20px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '16px',
                boxShadow: 'var(--shadow-sm)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#0070ba';
                e.currentTarget.style.boxShadow = 'var(--shadow-card)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = borderHighlight;
                e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
              }}
            >
              {/* Left Info: ID, Reason & Amount */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: '280px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: dispute.urgency === 'urgent' ? '#fee2e2' : dispute.isResolved ? '#dcfce7' : '#e0f2fe',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {dispute.urgency === 'urgent' ? (
                    <AlertTriangle size={20} color="#dc2626" />
                  ) : dispute.isResolved ? (
                    <CheckCircle2 size={20} color="#16a34a" />
                  ) : (
                    <Clock size={20} color="#0284c7" />
                  )}
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 800, color: '#003087', fontSize: '0.95rem' }}>
                      {dispute.caseId}
                    </span>
                    <span style={{
                      fontSize: '0.72rem',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-pill)',
                      fontWeight: 600,
                      background: '#f1f5f9',
                      color: '#475569'
                    }}>
                      Order {dispute.orderId}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#687173', marginTop: '2px' }}>
                    {dispute.reason} • Buyer: <strong style={{ color: '#1e293b' }}>{dispute.buyerName}</strong>
                  </div>
                </div>
              </div>

              {/* Center Timeline Gauge Bar */}
              <div style={{ flex: 1, minWidth: '240px', maxWidth: '420px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '6px' }}>
                  <span style={{ color: '#687173' }}>
                    Deadline: <strong>{new Date(dispute.dueStr).toLocaleDateString()} ({new Date(dispute.dueStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})</strong>
                  </span>
                  <span style={{
                    fontWeight: 700,
                    color: dispute.urgency === 'urgent' ? '#dc2626' : dispute.urgency === 'warning' ? '#d97706' : '#16a34a'
                  }}>
                    {dispute.isResolved ? 'Resolved' : dispute.diffHours <= 0 ? 'Overdue' : `${dispute.diffHours} hours remaining`}
                  </span>
                </div>

                <div style={{
                  height: '8px',
                  background: '#e2e8f0',
                  borderRadius: '999px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${remainingPct}%`,
                    height: '100%',
                    background: dispute.isResolved ? '#10b981' : dispute.urgency === 'urgent' ? '#ef4444' : dispute.urgency === 'warning' ? '#f59e0b' : '#0284c7',
                    borderRadius: '999px',
                    transition: 'width 0.3s'
                  }} />
                </div>
              </div>

              {/* Right: Amount & Action Link */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#003087' }}>
                    ${dispute.amountVal}{' '}
                    <span style={{ fontSize: '0.74rem', color: '#64748b' }}>{dispute.amountCurr}</span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: dispute.win_score >= 70 ? '#059669' : '#d97706', fontWeight: 700 }}>
                    {dispute.win_score}% win probability
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  color: '#0070ba',
                  fontWeight: 700,
                  fontSize: '0.82rem'
                }}>
                  Review
                  <ArrowRight size={14} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
