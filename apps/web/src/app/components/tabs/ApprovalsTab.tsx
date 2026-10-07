'use client';

import React, { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import TabPane from './TabPane';
import ApprovalBillDrawer from '../modals/ApprovalBillDrawer';
import { useShop } from '../../ShopContext';

// The approvals list lives in page.tsx because the sidebar shows the pending count.
interface ApprovalsTabProps {
  approvals: any[];
  fetchApprovals: () => void;
}

export default function ApprovalsTab({ approvals, fetchApprovals }: ApprovalsTabProps) {
  const { API_BASE, secureFetch, user } = useShop();

  const [approvalFilter, setApprovalFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [selectedApprovalBill, setSelectedApprovalBill] = useState<any | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState<{ [approvalId: string]: string }>({});

  // Poll the queue while this tab is open
  useEffect(() => {
    fetchApprovals();
    const interval = setInterval(fetchApprovals, 5000); // 5s refresh
    return () => clearInterval(interval);
  }, []);

  const handleActionApproval = async (approvalId: string, action: 'APPROVE' | 'REJECT') => {
    const reason = rejectionReasonInput[approvalId] || '';
    if (action === 'REJECT' && !reason.trim()) {
      alert('Please enter a rejection reason.');
      return;
    }

    try {
      const res = await secureFetch(`${API_BASE}/billing/approvals/${approvalId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          userId: user?.userId,
          reason,
        }),
      });

      if (res.ok) {
        fetchApprovals();
        setRejectionReasonInput(prev => ({ ...prev, [approvalId]: '' }));
      } else {
        const err = await res.json();
        alert(err.message || 'Action failed.');
      }
    } catch (err) {
      alert('Network error processing approval action.');
    }
  };

  return (
    <TabPane className="flex-1 flex flex-col p-6 overflow-hidden h-full space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Approval Center</h2>
          <p className="text-xs text-neutral-400 mt-1">Review, approve, or reject pricing overrides and credit limit breaches.</p>
        </div>
        <div className="flex gap-2">
          {(['PENDING', 'APPROVED', 'REJECTED'] as const).map(f => (
            <button
              key={f}
              onClick={() => setApprovalFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                approvalFilter === f ? 'bg-white text-neutral-950' : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Approval List */}
      <div className="flex-1 overflow-y-auto space-y-4">
        {approvals.filter(a => a.status === approvalFilter).length === 0 ? (
          <div className="bg-neutral-900/20 border border-neutral-800/60 p-12 rounded-xl text-center">
            <p className="text-sm text-neutral-500">No {approvalFilter.toLowerCase()} requests found.</p>
          </div>
        ) : (
          approvals
            .filter(a => a.status === approvalFilter)
            .map(a => {
              const details = a.actionDetails ? JSON.parse(a.actionDetails) : {};
              const isOwnerReq = details.requiredRole === 'OWNER';
              return (
                <div key={a.id} className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 flex justify-between items-start gap-6 hover:border-neutral-700 transition-colors">
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                        isOwnerReq ? 'bg-red-950 text-red-400 border border-red-900/40' : 'bg-amber-950 text-amber-400 border border-amber-900/40'
                      }`}>
                        {isOwnerReq ? 'Owner Level' : 'Manager Level'}
                      </span>
                      <span className="text-xs text-neutral-500 font-mono">
                        Request ID: {a.id.slice(0, 8)}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-white">
                        Bill #{a.bill?.billNumber || 'Draft Bill'}
                      </h4>
                      <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        {a.description}
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-4 bg-neutral-950/40 border border-neutral-850 p-3 rounded-lg text-xs">
                      <div>
                        <span className="text-neutral-500 block">Requested By</span>
                        <span className="text-white font-medium">{a.requester?.fullName || 'Cashier'}</span>
                      </div>
                      <div>
                        <span className="text-neutral-500 block">Requester Role</span>
                        <span className="text-white font-medium uppercase tracking-wider">{a.requester?.role}</span>
                      </div>
                      <div>
                        <span className="text-neutral-500 block">Timestamp</span>
                        <span className="text-white font-medium">{new Date(a.createdAt).toLocaleString()}</span>
                      </div>
                    </div>

                    {a.status === 'PENDING' && (
                      <div className="flex items-center gap-2 pt-2">
                        <input
                          type="text"
                          placeholder="Provide reason for approval or rejection"
                          value={rejectionReasonInput[a.id] || ''}
                          onChange={e => setRejectionReasonInput({ ...rejectionReasonInput, [a.id]: e.target.value })}
                          className="bg-neutral-950 border border-neutral-850 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none flex-1"
                        />
                        <button
                          onClick={() => handleActionApproval(a.id, 'APPROVE')}
                          className="bg-green-600 hover:bg-green-500 text-white text-xs font-semibold px-4 py-1.5 rounded-lg cursor-pointer transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleActionApproval(a.id, 'REJECT')}
                          className="bg-red-600 hover:bg-red-500 text-white text-xs font-semibold px-4 py-1.5 rounded-lg cursor-pointer transition-colors"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => setSelectedApprovalBill(a.bill)}
                          className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold px-4 py-1.5 rounded-lg cursor-pointer transition-colors"
                        >
                          View Bill
                        </button>
                      </div>
                    )}

                    {a.status !== 'PENDING' && (
                      <div className="pt-2 text-xs text-neutral-400">
                        <span className="text-neutral-500 font-medium">Processed By:</span> {a.approver?.fullName || 'System'} | <span className="text-neutral-500 font-medium">Reason/Note:</span> {details.reason || 'N/A'}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
        )}
      </div>

      {/* Side drawer to view bill details inside Approval Center */}
      <ApprovalBillDrawer selectedApprovalBill={selectedApprovalBill} setSelectedApprovalBill={setSelectedApprovalBill} />
    </TabPane>
  );
}
