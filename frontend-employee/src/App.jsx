import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle2,
  ShieldAlert,
  Check,
  Building2,
  Lock,
  Sparkles,
  Loader2,
} from 'lucide-react';

const rawApiUrl = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
const API_BASE = rawApiUrl
  ? (rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl}/api`)
  : '/api';

const INITIAL_STATE = {
  first_name: '',
  middle_name: '',
  last_name: '',
  father_name: '',
  mother_name: '',
  date_of_birth: '',
  interview_date: '',
  primary_email: '',
  secondary_email: '',
  country_code: '+91',
  primary_phone: '',
  secondary_phone: '',
  house_no: '',
  street: '',
  village: '',
  town: '',
  city: '',
  state: '',
  pincode: '',
  landmark: '',
  full_address: '',
};

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const uid = params.get('uid');

  const [checking, setChecking] = useState(true);
  const [linkError, setLinkError] = useState('');
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);

  const [form, setForm] = useState(INITIAL_STATE);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submittedOk, setSubmittedOk] = useState(false);
  const [agreedDeclaration, setAgreedDeclaration] = useState(false);

  useEffect(() => {
    if (!uid) {
      setLinkError(
        'This onboarding portal requires a personal verification link. Please open the link sent to your registered email address by APPLYUS PRIVATE LIMITED.'
      );
      setChecking(false);
      return;
    }

    fetch(`${API_BASE}/candidates/form/${encodeURIComponent(uid)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.valid) throw new Error(data.error || 'Unable to verify onboarding link.');
        return data;
      })
      .then((data) => {
        if (data.submitted) {
          setAlreadySubmitted(true);
        }
      })
      .catch((err) => setLinkError(err.message))
      .finally(() => setChecking(false));
  }, [uid]);

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const PHONE_REGEX = /^\d{10}$/;

  const primaryEmailInvalid = Boolean(
    form.primary_email.trim() && !EMAIL_REGEX.test(form.primary_email.trim())
  );
  const secondaryEmailInvalid = Boolean(
    form.secondary_email.trim() && !EMAIL_REGEX.test(form.secondary_email.trim())
  );
  const primaryPhoneInvalid = Boolean(
    form.primary_phone.trim() && !PHONE_REGEX.test(form.primary_phone.trim())
  );
  const secondaryPhoneInvalid = Boolean(
    form.secondary_phone.trim() && !PHONE_REGEX.test(form.secondary_phone.trim())
  );

  const emailsMatch = Boolean(
    form.secondary_email.trim() &&
    form.secondary_email.trim().toLowerCase() === form.primary_email.trim().toLowerCase()
  );

  const phonesMatch = Boolean(
    form.secondary_phone.trim() &&
    form.primary_phone.trim() &&
    form.secondary_phone.trim() === form.primary_phone.trim()
  );

  const hasValidationErrors =
    primaryEmailInvalid ||
    secondaryEmailInvalid ||
    primaryPhoneInvalid ||
    secondaryPhoneInvalid ||
    emailsMatch ||
    phonesMatch;

  const sectionStatus = useMemo(() => {
    const s1 = Boolean(
      form.first_name.trim() &&
      form.last_name.trim() &&
      form.father_name.trim() &&
      form.mother_name.trim() &&
      form.date_of_birth &&
      form.interview_date
    );
    const s2 = Boolean(
      EMAIL_REGEX.test(form.primary_email.trim()) &&
      form.country_code.trim() &&
      PHONE_REGEX.test(form.primary_phone.trim()) &&
      !secondaryEmailInvalid &&
      !secondaryPhoneInvalid &&
      !emailsMatch &&
      !phonesMatch
    );
    const s3 = Boolean(
      form.city.trim() && form.state.trim() && form.pincode.trim() && form.full_address.trim()
    );
    return { s1, s2, s3 };
  }, [
    form,
    secondaryEmailInvalid,
    secondaryPhoneInvalid,
    emailsMatch,
    phonesMatch,
  ]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'primary_phone' || name === 'secondary_phone') {
      const digitsOnly = value.replace(/\D/g, '').slice(0, 10);
      setForm((prev) => ({ ...prev, [name]: digitsOnly }));
      return;
    }
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const composeAddress = () => {
    const parts = [
      form.house_no.trim() && `H.No: ${form.house_no.trim()}`,
      form.street.trim() && `Street: ${form.street.trim()}`,
      form.village.trim() && `Village: ${form.village.trim()}`,
      form.town.trim() && `Town: ${form.town.trim()}`,
      form.city.trim() && `City: ${form.city.trim()}`,
      form.state.trim() && `State: ${form.state.trim()}`,
      form.pincode.trim() && `Pincode: ${form.pincode.trim()}`,
      form.landmark.trim() && `Landmark: ${form.landmark.trim()}`,
    ].filter(Boolean);
    setForm((prev) => ({ ...prev, full_address: parts.join(', ') }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');

    if (emailsMatch) {
      setSubmitError('Primary and secondary emails should be different.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (phonesMatch) {
      setSubmitError('Primary and secondary phone numbers should be different.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setSubmitting(true);
    try {
        const res = await fetch(`${API_BASE}/candidates/form/${encodeURIComponent(uid)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        const data = await res.json().catch(() => ({}));
        if(!res.ok || !data.success) throw new Error(data.error || 'Submission failed. Please check all required fields.');
      setSubmittedOk(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setSubmitError(err.message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-[#202124] flex flex-col font-sans">
      {/* Top Enterprise Header */}
      <header className="bg-white border-b border-[#dadce0] sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/applyus-logo.jpg"
              alt="APPLYUS PRIVATE LIMITED"
              className="w-9 h-9 rounded-lg object-cover shrink-0 border border-[#dadce0]"
            />
            <div className="min-w-0">
              <p className="text-sm sm:text-base font-semibold tracking-tight text-[#202124] truncate">
                APPLYUS PRIVATE LIMITED
              </p>
              <p className="text-xs text-[#5f6368] truncate">Candidate Onboarding & Verification</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        {checking ? (
          <div className="max-w-lg mx-auto bg-white rounded-xl border border-[#dadce0] p-10 text-center">
            <Loader2 className="w-7 h-7 text-[#0b57d0] animate-spin mx-auto mb-3" />
            <p className="text-sm font-medium text-[#202124]">Verifying your onboarding session</p>
            <p className="text-xs text-[#5f6368] mt-1">Please wait a moment...</p>
          </div>
        ) : linkError ? (
          <div className="max-w-lg mx-auto bg-white rounded-xl border border-[#dadce0] p-8">
            <div className="w-11 h-11 rounded-full bg-red-50 text-red-600 flex items-center justify-center mb-4">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h1 className="text-lg font-semibold text-[#202124]">Access Restricted</h1>
            <p className="text-sm text-[#5f6368] mt-2 leading-relaxed">{linkError}</p>
          </div>
        ) : alreadySubmitted || submittedOk ? (
          <div className="max-w-xl mx-auto bg-white rounded-xl border border-[#dadce0] p-8 sm:p-10">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mb-5">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold text-[#202124]">
              Onboarding Information Recorded
            </h1>
            <p className="text-sm text-[#5f6368] mt-2 leading-relaxed">
              Thank you. Your personal, contact, and address details have been securely submitted to{' '}
              <span className="font-medium text-[#202124]">APPLYUS PRIVATE LIMITED</span>.
            </p>
            <p className="text-xs text-[#5f6368] mt-5">
              Our HR team will review your submission and send your official Offer Letter and agreements to your primary email.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
            {/* Left Sidebar (Progress & Instructions) */}
            <aside className="lg:col-span-4 lg:sticky lg:top-24 space-y-4">
              <div className="bg-white rounded-xl border border-[#dadce0] p-5 sm:p-6">
                <h1 className="text-lg font-semibold text-[#202124]">Employee Information Form</h1>
                <p className="text-xs text-[#5f6368] mt-1.5 leading-relaxed">
                  Complete all required fields accurately. These details are used directly in your Offer Letter, Joining Letter, and statutory records.
                </p>

                <div className="mt-6 space-y-3 border-t border-[#e8eaed] pt-5">
                  <StepItem number="1" title="Personal & Family Details" done={sectionStatus.s1} />
                  <StepItem number="2" title="Contact Information" done={sectionStatus.s2} />
                  <StepItem number="3" title="Residential Address" done={sectionStatus.s3} />
                </div>
              </div>

              <div className="bg-white rounded-xl border border-[#dadce0] p-4 flex items-start gap-3">
                <Lock className="w-4 h-4 text-[#5f6368] shrink-0 mt-0.5" />
                <p className="text-xs text-[#5f6368] leading-relaxed">
                  This is a single-use, tracked onboarding link issued exclusively for you. Do not forward or share this URL.
                </p>
              </div>
            </aside>

            {/* Right Main Form */}
            <form onSubmit={handleSubmit} className="lg:col-span-8 space-y-5">
              {submitError && (
                <div
                  role="alert"
                  className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm"
                >
                  {submitError}
                </div>
              )}

              {/* Card 1: Personal & Family Information */}
              <section className="bg-white rounded-xl border border-[#dadce0] p-5 sm:p-6">
                <SectionHeader
                  step="01"
                  title="Personal & Family Information"
                  subtitle="Enter your legal name as per government ID (Aadhaar / PAN / Passport)."
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-5">
                  <Field
                    label="First Name"
                    name="first_name"
                    value={form.first_name}
                    onChange={handleChange}
                    required
                    autoComplete="given-name"
                  />
                  <Field
                    label="Middle Name"
                    name="middle_name"
                    value={form.middle_name}
                    onChange={handleChange}
                    autoComplete="additional-name"
                  />
                  <Field
                    label="Last Name"
                    name="last_name"
                    value={form.last_name}
                    onChange={handleChange}
                    required
                    autoComplete="family-name"
                  />
                  <Field
                    label="Father's Name"
                    name="father_name"
                    value={form.father_name}
                    onChange={handleChange}
                    required
                  />
                  <Field
                    label="Mother's Name"
                    name="mother_name"
                    value={form.mother_name}
                    onChange={handleChange}
                    required
                  />
                  <Field
                    label="Date of Birth"
                    name="date_of_birth"
                    type="date"
                    value={form.date_of_birth}
                    onChange={handleChange}
                    required
                    autoComplete="bday"
                  />
                  <Field
                    label="Date of Interview Done"
                    name="interview_date"
                    type="date"
                    value={form.interview_date}
                    onChange={handleChange}
                    required
                  />
                </div>
              </section>

              {/* Card 2: Contact Information */}
              <section className="bg-white rounded-xl border border-[#dadce0] p-5 sm:p-6">
                <SectionHeader
                  step="02"
                  title="Contact Information"
                  subtitle="Your primary email and phone number will receive official Offer & Joining Letters."
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
                  <Field
                    label="Primary Email"
                    name="primary_email"
                    type="email"
                    value={form.primary_email}
                    onChange={handleChange}
                    required
                    autoComplete="email"
                    invalid={emailsMatch || primaryEmailInvalid}
                    error={primaryEmailInvalid ? 'Enter a valid email (e.g. name@gmail.com)' : ''}
                  />
                  <Field
                    label="Secondary Email"
                    name="secondary_email"
                    type="email"
                    value={form.secondary_email}
                    onChange={handleChange}
                    placeholder="Optional"
                    invalid={emailsMatch || secondaryEmailInvalid}
                    error={
                      secondaryEmailInvalid
                        ? 'Enter a valid email (e.g. name@gmail.com)'
                        : emailsMatch
                          ? 'Primary and secondary emails should be different'
                          : ''
                    }
                  />
                  <div className="grid grid-cols-12 gap-3">
                    <div className="col-span-4">
                      <Field
                        label="Code"
                        name="country_code"
                        value={form.country_code}
                        onChange={handleChange}
                        required
                      />
                    </div>
                    <div className="col-span-8">
                      <Field
                        label="Primary Phone"
                        name="primary_phone"
                        type="tel"
                        inputMode="numeric"
                        maxLength={10}
                        value={form.primary_phone}
                        onChange={handleChange}
                        required
                        autoComplete="tel-national"
                        placeholder="10-digit number"
                        invalid={phonesMatch || primaryPhoneInvalid}
                        error={primaryPhoneInvalid ? 'Phone number must be 10 digits' : ''}
                      />
                    </div>
                  </div>
                  <Field
                    label="Secondary Phone"
                    name="secondary_phone"
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={form.secondary_phone}
                    onChange={handleChange}
                    placeholder="Optional (10-digit number)"
                    invalid={phonesMatch || secondaryPhoneInvalid}
                    error={
                      secondaryPhoneInvalid
                        ? 'Phone number must be 10 digits'
                        : phonesMatch
                          ? 'Primary and secondary phone numbers should be different'
                          : ''
                    }
                  />
                </div>
              </section>

              {/* Card 3: Residential Address */}
              <section className="bg-white rounded-xl border border-[#dadce0] p-5 sm:p-6">
                <SectionHeader
                  step="03"
                  title="Residential Address"
                  subtitle="Provide your permanent or current correspondence address."
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-5">
                  <Field label="H.No:" name="house_no" value={form.house_no} onChange={handleChange} />
                  <Field label="Street" name="street" value={form.street} onChange={handleChange} />
                  <Field label="Village" name="village" value={form.village} onChange={handleChange} />
                  <Field label="Town" name="town" value={form.town} onChange={handleChange} />
                  <Field label="City" name="city" value={form.city} onChange={handleChange} required />
                  <Field label="State" name="state" value={form.state} onChange={handleChange} required />
                  <Field label="Pincode" name="pincode" value={form.pincode} onChange={handleChange} required />
                  <Field label="Landmark" name="landmark" value={form.landmark} onChange={handleChange} />
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={composeAddress}
                      className="w-full h-10 inline-flex items-center justify-center gap-1.5 px-3 rounded-lg border border-[#dadce0] bg-[#f8f9fa] hover:bg-[#f1f3f4] text-xs font-medium text-[#0b57d0] transition"
                    >
                      <Sparkles className="w-3.5 h-3.5 shrink-0" />
                      Auto-fill Written Address
                    </button>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-xs font-medium text-[#3c4043] mb-1.5">
                    Full Address in Written <span className="text-red-600">*</span>
                  </label>
                  <textarea
                    name="full_address"
                    rows={3}
                    required
                    value={form.full_address}
                    onChange={handleChange}
                    placeholder="Enter your complete postal address as it should appear on your Offer Letter..."
                    className="w-full rounded-lg border border-[#dadce0] bg-white px-3.5 py-2.5 text-sm text-[#202124] placeholder:text-[#80868b] focus:outline-none focus:border-[#0b57d0] focus:ring-2 focus:ring-[#0b57d0]/20 transition"
                  />
                </div>
              </section>

              {/* Submit Bar */}
              <div className="bg-white rounded-xl border border-[#dadce0] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={agreedDeclaration}
                    onChange={(e) => setAgreedDeclaration(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-[#dadce0] text-[#0b57d0] focus:ring-[#0b57d0]"
                  />
                  <span className="text-xs text-[#5f6368] leading-relaxed">
                    By submitting this, you confirm that all details provided above are accurate & genuine.
                  </span>
                </label>
                <button
                  type="submit"
                  disabled={submitting || hasValidationErrors || !agreedDeclaration}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-[#0b57d0] hover:bg-[#0842a0] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition shrink-0"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {submitting ? 'Submitting...' : 'Submit Information'}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>

      <footer className="border-t border-[#dadce0] bg-white mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#5f6368]">
          <span>© {new Date().getFullYear()} APPLYUS PRIVATE LIMITED. All rights reserved.</span>
          <span>Confidential Onboarding Portal</span>
        </div>
      </footer>
    </div>
  );
}

function SectionHeader({ step, title, subtitle }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#0b57d0]">
          Section {step}
        </span>
      </div>
      <h2 className="text-base font-semibold text-[#202124] mt-0.5">{title}</h2>
      {subtitle && <p className="text-xs text-[#5f6368] mt-0.5">{subtitle}</p>}
    </div>
  );
}

function StepItem({ number, title, done }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`w-6 h-6 rounded-full text-xs font-semibold flex items-center justify-center shrink-0 transition ${done
          ? 'bg-emerald-600 text-white'
          : 'bg-[#f1f3f4] text-[#5f6368] border border-[#dadce0]'
          }`}
      >
        {done ? <Check className="w-3.5 h-3.5" /> : number}
      </div>
      <span className={`text-xs font-medium ${done ? 'text-[#202124]' : 'text-[#5f6368]'}`}>
        {title}
      </span>
    </div>
  );
}

function Field({ label, required = false, invalid = false, error = '', ...props }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[#3c4043] mb-1.5">
        {label} {required && <span className="text-red-600">*</span>}
      </label>
      <input
        {...props}
        required={required}
        className={`w-full h-10 rounded-lg border bg-white px-3 text-sm text-[#202124] placeholder:text-[#80868b] focus:outline-none focus:ring-2 transition ${invalid || error
          ? 'border-red-500 focus:border-red-600 focus:ring-red-500/20'
          : 'border-[#dadce0] focus:border-[#0b57d0] focus:ring-[#0b57d0]/20'
          }`}
      />
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
