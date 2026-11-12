import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  ShieldCheck,
  UserPlus,
  Send,
  FileText,
  CheckCircle2,
  Briefcase,
  Upload,
  LogOut,
  Search,
  Eye,
  Download,
  Scale,
  X,
  Copy,
  Loader2,
} from 'lucide-react';
import { api } from './api';

const DEPARTMENTS = [
  'Software Development',
  'Software Testing',
  'Digital Marketing',
  'Sales',
  'Accounting',
  'Finance',
  'Job Application & Automation Operations',
  'Resume & Portfolio Services',
  'Human Resources',
];

export default function App() {
  const [accessKey, setAccessKey] = useState(() => sessionStorage.getItem('applyus_inhouse_key') || '');
  const [keyInput, setKeyInput] = useState('');
  const [authError, setAuthError] = useState('');

  const [candidates, setCandidates] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingOffer, setSendingOffer] = useState(false);
  const [sendingJoining, setSendingJoining] = useState(false);
  const [banner, setBanner] = useState(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [offerModalCand, setOfferModalCand] = useState(null);
  const [joiningModalCand, setJoiningModalCand] = useState(null);
  const [detailModalData, setDetailModalData] = useState(null);

  // Forms
  const [inviteForm, setInviteForm] = useState({
    first_name: '',
    last_name: '',
    primary_email: '',
    country_code: '+91',
    primary_phone: '',
    invited_by: 'Inhouse Admin',
  });

  const [offerForm, setOfferForm] = useState({
    designation: '',
    department: 'Software Development',
    salary_amount: '',
    salary_period: 'annum',
    reporting_manager: '',
    director_name: '',
    offer_acceptance_date: '',
  });

  const [joiningForm, setJoiningForm] = useState({
    joining_date: '',
    place_of_work: 'Hyderabad Office',
    work_address: '',
  });

  const loadCandidates = useCallback(async (key) => {
    setLoading(true);
    try {
      const res = await api.listCandidates(key);
      setCandidates(res.candidates || []);
    } catch (err) {
      setBanner({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (accessKey) loadCandidates(accessKey);
  }, [accessKey, loadCandidates]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      await api.verifyKey(keyInput);
      sessionStorage.setItem('applyus_inhouse_key', keyInput);
      setAccessKey(keyInput);
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('applyus_inhouse_key');
    setAccessKey('');
  };

  const handleCreateRecord = async (e) => {
    e.preventDefault();
    setBanner(null);
    try {
      const res = await api.createInvite(inviteForm, accessKey);
      setShowCreateModal(false);
      setInviteForm({
        first_name: '',
        last_name: '',
        primary_email: '',
        country_code: '+91',
        primary_phone: '',
        invited_by: 'Inhouse Admin',
      });
      setBanner({ type: 'success', text: `Created record ${res.candidate.reference_code} for ${res.candidate.first_name}. Click "Send Form" to send their tracked link.` });
      await loadCandidates(accessKey);
    } catch (err) {
      setBanner({ type: 'error', text: err.message });
    }
  };

  const handleSendForm = async (c) => {
    setBanner(null);
    try {
      const res = await api.sendForm(c.id, accessKey);
      setBanner({
        type: res.sent ? 'success' : 'info',
        text: res.message,
        copyUrl: res.formUrl,
      });
      await loadCandidates(accessKey);
    } catch (err) {
      setBanner({ type: 'error', text: err.message });
    }
  };

  const handleSendOfferBundle = async (e) => {
    e.preventDefault();
    setBanner(null);
    setSendingOffer(true);
    try {
      const res = await api.sendOfferBundle(offerModalCand.id, offerForm, accessKey);
      setOfferModalCand(null);
      setBanner({ type: 'success', text: res.message });
      await loadCandidates(accessKey);
    } catch (err) {
      setBanner({ type: 'error', text: err.message });
    } finally {
      setSendingOffer(false);
    }
  };

  const handleUserAccepted = async (c) => {
    setBanner(null);
    try {
      const res = await api.markAccepted(c.id, accessKey);
      setBanner({ type: 'success', text: `${c.first_name} ${c.last_name} marked as Accepted.` });
      await loadCandidates(accessKey);
    } catch (err) {
      setBanner({ type: 'error', text: err.message });
    }
  };

  const handleSendJoining = async (e) => {
    e.preventDefault();
    setBanner(null);
    setSendingJoining(true);
    try {
      const res = await api.sendJoining(joiningModalCand.id, joiningForm, accessKey);
      setJoiningModalCand(null);
      setBanner({ type: 'success', text: res.message });
      await loadCandidates(accessKey);
    } catch (err) {
      setBanner({ type: 'error', text: err.message });
    } finally {
      setSendingJoining(false);
    }
  };

  const openDetails = async (c) => {
    try {
      const res = await api.getCandidate(c.id, accessKey);
      setDetailModalData(res);
    } catch (err) {
      setBanner({ type: 'error', text: err.message });
    }
  };

  const handleGenerateLegalNotice = async (candId) => {
    try {
      const res = await api.generateSingleDoc(
        { candidate_id: candId, doc_type: 'legal_breach_notice' },
        accessKey
      );
      setBanner({ type: 'success', text: res.message });
      const updated = await api.getCandidate(candId, accessKey);
      setDetailModalData(updated);
    } catch (err) {
      setBanner({ type: 'error', text: err.message });
    }
  };

  const handleLetterheadUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await api.uploadLetterhead(file, accessKey);
      setBanner({ type: 'success', text: res.message });
    } catch (err) {
      setBanner({ type: 'error', text: err.message });
    }
  };

  if (!accessKey) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <img
            src="/applyus-logo.jpg"
            alt="APPLYUS PRIVATE LIMITED"
            className="w-12 h-12 rounded-xl object-cover border border-slate-200 mb-4"
          />
          <h1 className="text-xl font-bold text-slate-900">APPLYUS Inhouse & Authority Portal</h1>
          <p className="text-sm text-slate-500 mt-1">
            Enter your Authority Access Key from <code>.env</code> to manage candidate invites, Offer + Legal forms, and Joining Letters.
          </p>
          <form onSubmit={handleLogin} className="mt-5 space-y-4">
            {authError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {authError}
              </div>
            )}
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="Authority Access Key..."
              required
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl transition"
            >
              Sign In
            </button>
          </form>
        </div>
      </div>
    );
  }

  const filtered = candidates.filter((c) => {
    const q = search.toLowerCase();
    const name = `${c.first_name} ${c.middle_name || ''} ${c.last_name || ''}`.toLowerCase();
    return name.includes(q) || c.primary_email.toLowerCase().includes(q) || c.reference_code.toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/applyus-logo.jpg"
              alt="APPLYUS PRIVATE LIMITED"
              className="w-10 h-10 rounded-xl object-cover border border-slate-200"
            />
            <div>
              <h1 className="text-base font-bold text-slate-900">APPLYUS PRIVATE LIMITED</h1>
              <p className="text-xs text-slate-500">Inhouse Client & Authority Control Portal</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition"
            >
              <UserPlus className="w-4 h-4" />
              Create Candidate Record
            </button>
            <label className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition">
              <Upload className="w-4 h-4" />
              Word Letterhead (.docx)
              <input type="file" accept=".docx" onChange={handleLetterheadUpload} className="hidden" />
            </label>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              <LogOut className="w-4 h-4" /> Lock
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-5">
        {banner && (
          <div
            className={`p-3.5 rounded-xl border text-sm flex flex-wrap items-center justify-between gap-3 ${banner.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-700'
              : banner.type === 'info'
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              }`}
          >
            <div>
              <p>{banner.text}</p>
              {banner.copyUrl && (
                <p className="text-xs font-mono mt-1 break-all">{banner.copyUrl}</p>
              )}
            </div>
            {banner.copyUrl && (
              <button
                onClick={() => navigator.clipboard.writeText(banner.copyUrl)}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 hover:bg-slate-50"
              >
                <Copy className="w-3.5 h-3.5" /> Copy Tracked Link
              </button>
            )}
          </div>
        )}

        {/* Search */}
        <div className="flex items-center justify-between gap-4">
          <div className="relative max-w-sm w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, ref code..."
              className="w-full pl-10 pr-4 py-2 bg-white rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <p className="text-xs text-slate-500">{filtered.length} candidate(s)</p>
        </div>

        {/* Main Candidates Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-4">Candidate</th>
                <th className="py-3.5 px-4">Contact</th>
                <th className="py-3.5 px-4">Form & Link Tracking</th>
                <th className="py-3.5 px-4">Role / Offer</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">Loading candidates...</td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500">
                    No records yet. Click <strong>Create Candidate Record</strong> to invite a new employee.
                  </td>
                </tr>
              )}
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/70">
                  <td className="py-3.5 px-4">
                    <p className="font-semibold text-slate-900">
                      {c.first_name} {c.middle_name} {c.last_name}
                    </p>
                    <p className="text-xs font-mono text-slate-500">{c.reference_code}</p>
                  </td>
                  <td className="py-3.5 px-4">
                    <p className="text-slate-700 text-xs">{c.primary_email}</p>
                    <p className="text-slate-500 text-xs">{c.country_code} {c.primary_phone || '—'}</p>
                  </td>
                  <td className="py-3.5 px-4 text-xs">
                    <span className={`font-semibold ${c.form_submitted ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {c.form_submitted ? 'Form Submitted' : 'Awaiting Form'}
                    </span>
                    <p className="text-slate-500 mt-0.5">
                      Views: <strong>{c.form_access_count || 0}</strong>
                      {c.last_accessed_ip ? ` · IP: ${c.last_accessed_ip}` : ''}
                    </p>
                  </td>
                  <td className="py-3.5 px-4 text-xs text-slate-600">
                    {c.latest_approval ? (
                      <>
                        <p className="font-semibold text-slate-800">{c.latest_approval.designation}</p>
                        <p>{c.latest_approval.department}</p>
                      </>
                    ) : (
                      <span className="text-slate-400">Not set</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="py-3.5 px-4">
                    {(() => {
                      const canSendOffer = ['invited', 'form_sent', 'pending_approval'].includes(c.status);
                      const canMarkAccepted = c.status === 'offer_sent';
                      const canSendJoining = c.status === 'accepted';

                      return (
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleSendForm(c)}
                            disabled={c.form_submitted}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-medium"
                            title="Send tracked onboarding form link (?uid=...)"
                          >
                            <Send className="w-3 h-3" /> Send Form
                          </button>

                          <button
                            onClick={() => {
                              setOfferModalCand(c);
                              if (c.latest_approval) {
                                setOfferForm({
                                  designation: c.latest_approval.designation || '',
                                  department: c.latest_approval.department || 'Software Development',
                                  salary_amount: c.latest_approval.salary_amount || '',
                                  salary_period: c.latest_approval.salary_period || 'annum',
                                  reporting_manager: c.latest_approval.reporting_manager || '',
                                  director_name: c.latest_approval.director_name || '',
                                  offer_acceptance_date: c.latest_approval.offer_acceptance_date?.slice(0, 10) || '',
                                });
                              }
                            }}
                            disabled={!canSendOffer}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-medium"
                            title="Step 1: Generate & Send Offer Letter + Legal Forms"
                          >
                            <FileText className="w-3 h-3" /> Send Offer Letter
                          </button>

                          <button
                            onClick={() => handleUserAccepted(c)}
                            disabled={!canMarkAccepted}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-medium"
                            title="Step 2: Mark User Accepted (enabled after Offer Letter is sent)"
                          >
                            <CheckCircle2 className="w-3 h-3" /> User Accepted
                          </button>

                          <button
                            onClick={() => {
                              setJoiningModalCand(c);
                              setJoiningForm({
                                joining_date: c.latest_approval?.joining_date?.slice(0, 10) || '',
                                place_of_work: c.latest_approval?.place_of_work || 'Hyderabad Office',
                                work_address: c.latest_approval?.work_address || '',
                              });
                            }}
                            disabled={!canSendJoining}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-medium"
                            title="Step 3: Send Joining Letter (enabled after User Accepted)"
                          >
                            <Briefcase className="w-3 h-3" /> Send Joining Letter
                          </button>

                          <button
                            onClick={() => openDetails(c)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium"
                            title="View Candidate Info, PDFs & Link Access Logs"
                          >
                            <Eye className="w-3 h-3" /> View
                          </button>
                        </div>
                      );
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {/* Modal 1: Create Candidate Record */}
      {showCreateModal && (
        <Modal title="Create Candidate Record" onClose={() => setShowCreateModal(false)}>
          <form onSubmit={handleCreateRecord} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input label="First Name *" value={inviteForm.first_name} onChange={(v) => setInviteForm({ ...inviteForm, first_name: v })} required />
              <Input label="Last Name" value={inviteForm.last_name} onChange={(v) => setInviteForm({ ...inviteForm, last_name: v })} />
            </div>
            <Input label="Candidate Email *" type="email" value={inviteForm.primary_email} onChange={(v) => setInviteForm({ ...inviteForm, primary_email: v })} required />
            <div className="grid grid-cols-3 gap-2">
              <Input label="Code" value={inviteForm.country_code} onChange={(v) => setInviteForm({ ...inviteForm, country_code: v })} />
              <div className="col-span-2">
                <Input label="Phone Number" value={inviteForm.primary_phone} onChange={(v) => setInviteForm({ ...inviteForm, primary_phone: v })} />
              </div>
            </div>
            <Input label="Created By (Inhouse Employee)" value={inviteForm.invited_by} onChange={(v) => setInviteForm({ ...inviteForm, invited_by: v })} />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-xs font-semibold text-slate-600">Cancel</button>
              <button type="submit" className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl">Create Record</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal 2: Send Offer Letter */}
      {offerModalCand && (
        <Modal
          title={`Send Offer Letter — ${offerModalCand.first_name} ${offerModalCand.last_name}`}
          onClose={() => setOfferModalCand(null)}
        >
          <p className="text-xs text-slate-500 mb-4">
            Generates and emails the official <strong>Offer of Employment Letter (1 PDF)</strong> to {offerModalCand.primary_email}.
          </p>
          <form onSubmit={handleSendOfferBundle} className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Designation *" value={offerForm.designation} onChange={(v) => setOfferForm({ ...offerForm, designation: v })} required />
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Department *</label>
                <select
                  value={offerForm.department}
                  onChange={(e) => setOfferForm({ ...offerForm, department: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                >
                  {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <Input label="Salary Amount (₹) *" type="number" value={offerForm.salary_amount} onChange={(v) => setOfferForm({ ...offerForm, salary_amount: v })} required />
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Per Annum / Month *</label>
                <select
                  value={offerForm.salary_period}
                  onChange={(e) => setOfferForm({ ...offerForm, salary_period: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="annum">Per Annum</option>
                  <option value="month">Per Month</option>
                </select>
              </div>
              <Input label="Reporting Manager *" value={offerForm.reporting_manager} onChange={(v) => setOfferForm({ ...offerForm, reporting_manager: v })} required />
              <Input label="Director Name *" value={offerForm.director_name} onChange={(v) => setOfferForm({ ...offerForm, director_name: v })} required />
            </div>
            <Input label="Offer Acceptance Deadline" type="date" value={offerForm.offer_acceptance_date} onChange={(v) => setOfferForm({ ...offerForm, offer_acceptance_date: v })} />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={sendingOffer}
                onClick={() => setOfferModalCand(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sendingOffer}
                className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl transition"
              >
                {sendingOffer && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {sendingOffer ? 'Generating & Sending Email...' : 'Generate & Send Offer Letter'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal 3: Send Joining Letter & Legal Documents */}
      {joiningModalCand && (
        <Modal
          title={`Send Joining Letter & Legal Documents — ${joiningModalCand.first_name} ${joiningModalCand.last_name}`}
          onClose={() => setJoiningModalCand(null)}
        >
          <p className="text-xs text-slate-500 mb-4">
            Generates and emails the official <strong>Joining Letter &amp; Company Legal Documents (2 PDFs)</strong> to {joiningModalCand.primary_email}.
          </p>
          <form onSubmit={handleSendJoining} className="space-y-3.5">
            <Input label="Joining Date *" type="date" value={joiningForm.joining_date} onChange={(v) => setJoiningForm({ ...joiningForm, joining_date: v })} required />
            <Input label="Place of Work *" value={joiningForm.place_of_work} onChange={(v) => setJoiningForm({ ...joiningForm, place_of_work: v })} required />
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Full Office Address *</label>
              <textarea
                rows={3}
                required
                value={joiningForm.work_address}
                onChange={(e) => setJoiningForm({ ...joiningForm, work_address: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={sendingJoining}
                onClick={() => setJoiningModalCand(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sendingJoining}
                className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl transition"
              >
                {sendingJoining && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {sendingJoining ? 'Generating & Sending Email...' : 'Generate & Send Joining Letter & Legal Documents'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal 4: Candidate Details, PDFs & Tracked Link Access Logs */}
      {detailModalData && (
        <Modal
          title={`${detailModalData.candidate.first_name} ${detailModalData.candidate.last_name} (${detailModalData.candidate.reference_code})`}
          onClose={() => setDetailModalData(null)}
          wide
        >
          <div className="space-y-5 text-xs">
            <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3.5 rounded-xl">
              <p><strong>Email:</strong> {detailModalData.candidate.primary_email}</p>
              <p><strong>Phone:</strong> {detailModalData.candidate.country_code} {detailModalData.candidate.primary_phone}</p>
              <p><strong>Father:</strong> {detailModalData.candidate.father_name || '—'}</p>
              <p><strong>Mother:</strong> {detailModalData.candidate.mother_name || '—'}</p>
              <p><strong>Date of Birth:</strong> {detailModalData.candidate.date_of_birth ? detailModalData.candidate.date_of_birth.slice(0, 10) : '—'}</p>
              <p><strong>Interview Date:</strong> {detailModalData.candidate.interview_date ? detailModalData.candidate.interview_date.slice(0, 10) : '—'}</p>
              <p className="col-span-2"><strong>Written Address:</strong> {detailModalData.candidate.full_address || '—'}</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-slate-800 uppercase tracking-wider">Generated Documents</h4>
                <button
                  onClick={() => handleGenerateLegalNotice(detailModalData.candidate.id)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-[11px] font-semibold"
                >
                  <Scale className="w-3 h-3" /> Generate Legal Breach Notice
                </button>
              </div>
              {detailModalData.documents?.length === 0 ? (
                <p className="text-slate-400">No documents generated yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {detailModalData.documents.map((d) => (
                    <div key={d.id} className="flex items-center justify-between p-2.5 border border-slate-200 rounded-xl">
                      <div>
                        <span className="font-semibold">{d.ref_number}</span>
                        <span className="ml-2 text-slate-500">{d.doc_type.replace(/_/g, ' ').toUpperCase()}</span>
                      </div>
                      <a
                        href={api.downloadUrl(d.id, accessKey)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600 text-white rounded-lg font-semibold"
                      >
                        <Download className="w-3 h-3" /> PDF
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h4 className="font-bold text-slate-800 uppercase tracking-wider mb-2">
                Tracked Link & Audit Logs (Detects Link Sharing)
              </h4>
              <div className="max-h-44 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                {detailModalData.logs?.map((l) => (
                  <div key={l.id} className="p-2.5 flex items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-800">{l.action}</p>
                      <p className="text-slate-500">Actor/IP: {l.actor}</p>
                    </div>
                    <span className="text-slate-400">{new Date(l.created_at).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, onClose, children, wide = false }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className={`bg-white rounded-2xl w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} max-h-[90vh] flex flex-col overflow-hidden shadow-xl`}>
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm">{title}</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, type = 'text', required = false }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    invited: 'bg-slate-100 text-slate-700',
    form_sent: 'bg-amber-100 text-amber-800',
    pending_approval: 'bg-yellow-100 text-yellow-800',
    offer_sent: 'bg-blue-100 text-blue-800',
    accepted: 'bg-indigo-100 text-indigo-800',
    joined: 'bg-emerald-100 text-emerald-800',
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase ${styles[status] || 'bg-slate-100 text-slate-700'}`}>
      {(status || 'invited').replace(/_/g, ' ')}
    </span>
  );
}

