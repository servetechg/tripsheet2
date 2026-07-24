import { useState } from 'react';
import { G, page } from '@/lib/theme';
import { Btn, Inp, Sel, G2, Icons } from '@/components/ui';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { DRIVER_DOC_TYPES, PAY_TYPES } from '@/lib/docTypes';
import { DocUploadModal } from '@/features/documents/DocUploadModal';
import { uid } from '@/lib/uid';

type Profile = {
  name: string;
  email: string;
  password: string;
  phone: string;
  dob: string;
  licenseNo: string;
  citizenship: string;
  address: string;
  emergencyName: string;
  emergencyPhone: string;
  fastCard: string;
  notes: string;
};

const emptyProfile = (): Profile => ({
  name: '',
  email: '',
  password: '',
  phone: '',
  dob: '',
  licenseNo: '',
  citizenship: 'CA',
  address: '',
  emergencyName: '',
  emergencyPhone: '',
  fastCard: '',
  notes: '',
});

/**
 * Invite onboarding wizard.
 * Steps are inlined (not nested components) so inputs keep focus while typing.
 */
export function DriverOnboarding({ invite: _invite, company, onComplete }: any) {
  const TOTAL = 4;
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [docs, setDocs] = useState<any[]>([]);
  const [contract, setContract] = useState<any>({
    signedByDriver: false,
    signedByAdmin: false,
  });
  const [err, setErr] = useState('');
  const [profileErr, setProfileErr] = useState('');
  const [uploading, setUploading] = useState<any>(null);

  const upd = (k: keyof Profile, v: string) =>
    setProfile((x) => ({ ...x, [k]: v }));

  const updContract = (k: string, v: unknown) =>
    setContract((x: any) => ({ ...x, [k]: v }));

  const saveDoc = (typeId: string, fileData: any) => {
    setDocs((p) => {
      const ex = p.findIndex((d) => d.type === typeId);
      const newDoc = {
        id: uid(),
        type: typeId,
        fileName: fileData.name,
        fileSize: fileData.size,
        fileType: fileData.fileType,
        fileData: fileData.data,
        uploadedAt: new Date().toLocaleDateString('en-CA'),
        expiryDate: fileData.expiry || '',
        notes: fileData.notes || '',
        status: 'uploaded',
      };
      if (ex >= 0) {
        const n = [...p];
        n[ex] = newDoc;
        return n;
      }
      return [...p, newDoc];
    });
  };

  const goProfileNext = () => {
    if (!profile.name || !profile.email || !profile.password) {
      setProfileErr('Name, email and password are required.');
      return;
    }
    setProfileErr('');
    setStep(3);
  };

  const finish = async () => {
    if (!contract?.signedByDriver) {
      setErr('Please sign the contract before submitting.');
      return;
    }
    setErr('');
    try {
      await onComplete(profile, docs, contract);
      setStep(5);
    } catch (e: any) {
      const raw = e?.message ?? e?.body?.message;
      const msg = Array.isArray(raw)
        ? raw.join(', ')
        : typeof raw === 'string'
          ? raw
          : 'Failed to submit application.';
      setErr(msg);
    }
  };

  const required = DRIVER_DOC_TYPES.filter((t) => t.required);
  const optional = DRIVER_DOC_TYPES.filter((t) => !t.required);
  const getDoc = (typeId: string) => docs.find((d) => d.type === typeId);
  const uploaded = DRIVER_DOC_TYPES.filter((t) => getDoc(t.id)).length;
  const missingRequired = required.filter((t) => !getDoc(t.id)).length;

  return (
    <div style={{ ...page() }}>
      <div
        style={{
          background: G.card,
          borderBottom: `2px solid ${G.gold}`,
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <BrandLogo variant="full" height={26} style={{ maxWidth: 150 }} />
          <div style={{ fontSize: 10, letterSpacing: 2, color: G.muted }}>
            DRIVER ONBOARDING
          </div>
        </div>
        {step < 5 && (
          <div style={{ fontSize: 11, color: G.muted }}>
            Step {Math.max(1, step - 1)} of {TOTAL}
          </div>
        )}
      </div>

      {step > 1 && step < 5 && (
        <div style={{ height: 3, background: G.border }}>
          <div
            style={{
              height: '100%',
              background: G.gold,
              width: `${((step - 1) / TOTAL) * 100}%`,
              transition: 'width .3s',
            }}
          />
        </div>
      )}

      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        {step === 1 && (
          <div style={{ textAlign: 'center', padding: '40px 24px' }}>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
              {Icons.drivers({ size: 48, color: G.gold })}
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 900,
                color: G.white,
                marginBottom: 8,
              }}
            >
              Welcome to{' '}
              <span style={{ color: G.gold }}>{company.name}</span>
            </div>
            <div
              style={{
                fontSize: 13,
                color: G.muted,
                marginBottom: 32,
                lineHeight: 1.8,
              }}
            >
              You've been invited to join as a driver.
              <br />
              This will take about 5 minutes to complete.
              <br />
              You'll fill in your profile, upload your documents, and sign your
              employment contract.
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                maxWidth: 300,
                margin: '0 auto',
                marginBottom: 32,
              }}
            >
              {(
                [
                  ['1', 'Fill your profile', Icons.driver],
                  ['2', 'Upload your documents', Icons.docs],
                  ['3', 'Review & sign contract', Icons.contract],
                ] as const
              ).map(([n, l, Icon]) => (
                <div
                  key={n}
                  style={{
                    background: G.card,
                    border: `1px solid ${G.border}`,
                    borderRadius: 10,
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: G.gold,
                      color: G.onGold,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 900,
                      fontSize: 13,
                      flexShrink: 0,
                    }}
                  >
                    {n}
                  </div>
                  <span
                    style={{
                      fontSize: 13,
                      color: G.text,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    {Icon({ size: 16, color: G.muted })}
                    {l}
                  </span>
                </div>
              ))}
            </div>
            <Btn
              onClick={() => setStep(2)}
              style={{ padding: '14px 40px', fontSize: 14 }}
            >
              GET STARTED →
            </Btn>
          </div>
        )}

        {step === 2 && (
          <div style={{ padding: '24px 20px' }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: G.white,
                marginBottom: 4,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              {Icons.driver({ size: 16, color: G.white })}
              Your Profile
            </div>
            <div style={{ fontSize: 11, color: G.muted, marginBottom: 20 }}>
              Fill in your personal details. This creates your login account.
            </div>
            {profileErr && (
              <div
                style={{
                  background: G.errTint,
                  border: `1px solid ${G.danger}44`,
                  borderRadius: 8,
                  padding: '10px',
                  fontSize: 12,
                  color: G.errText,
                  marginBottom: 12,
                }}
              >
                {profileErr}
              </div>
            )}

            <div
              style={{
                fontSize: 10,
                letterSpacing: 2,
                color: G.info,
                marginBottom: 10,
                paddingBottom: 6,
                borderBottom: `1px solid ${G.border}`,
              }}
            >
              LOGIN DETAILS
            </div>
            <G2 cols={2}>
              <Inp
                label="Full Name *"
                value={profile.name}
                onChange={(e) => upd('name', e.target.value)}
                placeholder="Your full legal name"
                autoComplete="name"
              />
              <Inp
                label="Email *"
                value={profile.email}
                onChange={(e) => upd('email', e.target.value)}
                placeholder="your@email.com"
                type="email"
                autoComplete="email"
              />
            </G2>
            <Inp
              label="Password * (for app login)"
              value={profile.password}
              onChange={(e) => upd('password', e.target.value)}
              placeholder="Choose a secure password"
              type="password"
              autoComplete="new-password"
            />

            <div
              style={{
                fontSize: 10,
                letterSpacing: 2,
                color: G.gold,
                marginBottom: 10,
                paddingBottom: 6,
                borderBottom: `1px solid ${G.border}`,
              }}
            >
              PERSONAL DETAILS
            </div>
            <G2 cols={2}>
              <Inp
                label="Phone"
                value={profile.phone}
                onChange={(e) => upd('phone', e.target.value)}
                placeholder="+1 (403) 000-0000"
              />
              <Inp
                label="Date of Birth"
                value={profile.dob}
                onChange={(e) => upd('dob', e.target.value)}
                type="date"
              />
            </G2>
            <G2 cols={2}>
              <Inp
                label="Driver's License No."
                value={profile.licenseNo}
                onChange={(e) => upd('licenseNo', e.target.value)}
                placeholder="e.g. AB-123456"
              />
              <Sel
                label="Citizenship"
                value={profile.citizenship}
                onChange={(e) => upd('citizenship', e.target.value)}
              >
                {['CA', 'US', 'IN', 'MX', 'Other'].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Sel>
            </G2>
            <Inp
              label="Home Address"
              value={profile.address}
              onChange={(e) => upd('address', e.target.value)}
              placeholder="Full address"
            />
            <Inp
              label="FAST Card # (if you have one)"
              value={profile.fastCard}
              onChange={(e) => upd('fastCard', e.target.value)}
              placeholder="Optional"
            />

            <div
              style={{
                fontSize: 10,
                letterSpacing: 2,
                color: G.muted,
                marginBottom: 10,
                paddingBottom: 6,
                borderBottom: `1px solid ${G.border}`,
              }}
            >
              EMERGENCY CONTACT
            </div>
            <G2 cols={2}>
              <Inp
                label="Emergency Contact Name"
                value={profile.emergencyName}
                onChange={(e) => upd('emergencyName', e.target.value)}
                placeholder="Full name"
              />
              <Inp
                label="Emergency Phone"
                value={profile.emergencyPhone}
                onChange={(e) => upd('emergencyPhone', e.target.value)}
                placeholder="+1 (403) 000-0000"
              />
            </G2>

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <Btn variant="outline" onClick={() => setStep(1)}>
                ← BACK
              </Btn>
              <Btn onClick={goProfileNext} style={{ flex: 1, padding: 14 }}>
                NEXT: UPLOAD DOCUMENTS →
              </Btn>
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={{ padding: '24px 20px' }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: G.white,
                marginBottom: 4,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              {Icons.docs({ size: 16, color: G.white })}
              Upload Documents
            </div>
            <div style={{ fontSize: 11, color: G.muted, marginBottom: 4 }}>
              Upload clear photos or PDFs of your documents.
            </div>
            <div style={{ fontSize: 11, color: G.gold, marginBottom: 20 }}>
              {uploaded} uploaded · {missingRequired} required missing
            </div>

            <div
              style={{
                fontSize: 10,
                letterSpacing: 2,
                color: G.danger,
                marginBottom: 10,
                paddingBottom: 6,
                borderBottom: `1px solid ${G.border}`,
              }}
            >
              REQUIRED DOCUMENTS *
            </div>
            {required.map((docType) => {
              const doc = getDoc(docType.id);
              return (
                <div
                  key={docType.id}
                  style={{
                    background: G.card,
                    border: `1px solid ${doc ? G.success + '66' : G.danger + '44'}`,
                    borderRadius: 10,
                    padding: '12px 16px',
                    marginBottom: 8,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {Icons.docs({ size: 20, color: G.muted })}
                    <div>
                      <div
                        style={{ fontSize: 13, fontWeight: 600, color: G.text }}
                      >
                        {docType.label}
                      </div>
                      {doc && (
                        <div
                          style={{
                            fontSize: 10,
                            color: G.success,
                            marginTop: 1,
                          }}
                        >
                          ✓ {doc.fileName}
                        </div>
                      )}
                      {!doc && (
                        <div
                          style={{
                            fontSize: 10,
                            color: G.danger,
                            marginTop: 1,
                          }}
                        >
                          Required — not uploaded
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUploading(docType)}
                    style={{
                      background: doc ? G.card2 : G.gold,
                      color: doc ? '#aaa' : '#000',
                      border: doc ? `1px solid ${G.border2}` : 'none',
                      borderRadius: 7,
                      padding: '7px 14px',
                      fontSize: 11,
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    {Icons.upload({
                      size: 16,
                      color: doc ? G.muted : G.onGold,
                    })}
                    {doc ? 'REPLACE' : 'UPLOAD'}
                  </button>
                </div>
              );
            })}

            <div
              style={{
                fontSize: 10,
                letterSpacing: 2,
                color: G.muted,
                marginBottom: 10,
                marginTop: 16,
                paddingBottom: 6,
                borderBottom: `1px solid ${G.border}`,
              }}
            >
              OPTIONAL DOCUMENTS
            </div>
            {optional.map((docType) => {
              const doc = getDoc(docType.id);
              return (
                <div
                  key={docType.id}
                  style={{
                    background: G.card,
                    border: `1px solid ${doc ? G.success + '44' : G.border}`,
                    borderRadius: 10,
                    padding: '12px 16px',
                    marginBottom: 8,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {Icons.docs({ size: 18, color: G.muted })}
                    <div>
                      <div
                        style={{
                          fontSize: 12,
                          color: doc ? G.text : G.muted,
                        }}
                      >
                        {docType.label}
                      </div>
                      {doc && (
                        <div style={{ fontSize: 10, color: G.success }}>
                          ✓ {doc.fileName}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUploading(docType)}
                    style={{
                      background: 'transparent',
                      border: `1px solid ${doc ? G.success : G.border2}`,
                      color: doc ? G.success : G.muted,
                      borderRadius: 7,
                      padding: '6px 12px',
                      fontSize: 11,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    {Icons.upload({ size: 16, color: doc ? G.success : G.muted })}
                    {doc ? 'REPLACE' : 'UPLOAD'}
                  </button>
                </div>
              );
            })}

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <Btn variant="outline" onClick={() => setStep(2)}>
                ← BACK
              </Btn>
              <Btn onClick={() => setStep(4)} style={{ flex: 1, padding: 14 }}>
                NEXT: REVIEW CONTRACT →
              </Btn>
            </div>

            {uploading && (
              <DocUploadModal
                docType={uploading}
                onUpload={(typeId, fileData) => {
                  saveDoc(typeId, fileData);
                  setUploading(null);
                }}
                onClose={() => setUploading(null)}
              />
            )}
          </div>
        )}

        {step === 4 && (
          <div style={{ padding: '24px 20px' }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: G.white,
                marginBottom: 4,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              {Icons.contract({ size: 16, color: G.white })}
              Employment Contract
            </div>
            <div style={{ fontSize: 11, color: G.muted, marginBottom: 20 }}>
              Review your employment terms set by {company.name} and sign below.
            </div>

            {contract.payType ? (
              <div
                style={{
                  background: G.card2,
                  border: `1px solid ${G.gold}44`,
                  borderRadius: 12,
                  padding: 18,
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    letterSpacing: 2,
                    color: G.gold,
                    marginBottom: 14,
                  }}
                >
                  YOUR EMPLOYMENT TERMS
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 10,
                  }}
                >
                  {(
                    [
                      [
                        'Pay Structure',
                        PAY_TYPES.find((p) => p.id === contract.payType)
                          ?.label || '—',
                      ],
                      [
                        'Base Rate',
                        `${contract.payUnit || 'CAD'} ${contract.payRate || '—'} ${
                          PAY_TYPES.find((p) => p.id === contract.payType)
                            ?.unit || ''
                        }`,
                      ],
                      [
                        'Detention',
                        contract.detentionRate
                          ? `${contract.payUnit} ${contract.detentionRate}/hr after 2hrs free`
                          : '—',
                      ],
                      [
                        'Wait Time',
                        contract.waitRate
                          ? `${contract.payUnit} ${contract.waitRate}/hr`
                          : '—',
                      ],
                      [
                        'Vacation Pay',
                        contract.vacationPct
                          ? `${contract.vacationPct}%`
                          : '4%',
                      ],
                      [
                        'Probation',
                        contract.trialDays
                          ? `${contract.trialDays} days`
                          : '90 days',
                      ],
                      [
                        'Notice',
                        contract.noticeDays
                          ? `${contract.noticeDays} days`
                          : '14 days',
                      ],
                      ['Benefits', contract.benefits || '—'],
                    ] as const
                  ).map(([k, v]) => (
                    <div
                      key={k}
                      style={{
                        background: G.card,
                        borderRadius: 8,
                        padding: '10px 12px',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 9,
                          color: G.muted,
                          letterSpacing: 2,
                          textTransform: 'uppercase',
                        }}
                      >
                        {k}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: G.text,
                          marginTop: 3,
                        }}
                      >
                        {v}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div
                style={{
                  background: G.card2,
                  border: `1px solid ${G.gold}33`,
                  borderRadius: 12,
                  padding: 20,
                  marginBottom: 16,
                  textAlign: 'center',
                }}
              >
                <div style={{ marginBottom: 8 }}>
                  {Icons.pending({ size: 24, color: G.gold })}
                </div>
                <div style={{ fontSize: 13, color: G.muted }}>
                  Your employer hasn't set contract terms yet.
                </div>
                <div
                  style={{ fontSize: 11, color: G.muted, marginTop: 4 }}
                >
                  You can still sign to confirm your agreement to standard
                  terms.
                </div>
              </div>
            )}

            <div
              style={{
                background: G.inset,
                border: `1px solid ${G.border}`,
                borderRadius: 10,
                padding: 14,
                marginBottom: 16,
                fontSize: 11,
                color: G.muted,
                lineHeight: 1.8,
              }}
            >
              <div
                style={{ color: G.text, fontWeight: 700, marginBottom: 6 }}
              >
                STANDARD TERMS
              </div>
              I agree to operate all vehicles safely and in compliance with all
              federal/provincial regulations including HOS, ELD, and border
              crossing requirements.
            </div>

            <div
              role="button"
              tabIndex={0}
              onClick={() =>
                updContract('signedByDriver', !contract.signedByDriver)
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  updContract('signedByDriver', !contract.signedByDriver);
                }
              }}
              style={{
                background: contract.signedByDriver
                  ? `${G.success}22`
                  : G.card2,
                border: `2px solid ${
                  contract.signedByDriver ? G.success : G.border2
                }`,
                borderRadius: 12,
                padding: '18px',
                cursor: 'pointer',
                textAlign: 'center',
                marginBottom: 16,
              }}
            >
              {contract.signedByDriver ? (
                <>
                  <div>{Icons.completed({ size: 28, color: G.success })}</div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      color: G.success,
                      marginTop: 6,
                    }}
                  >
                    SIGNED BY {(profile.name || 'DRIVER').toUpperCase()}
                  </div>
                  <div
                    style={{ fontSize: 11, color: G.muted, marginTop: 4 }}
                  >
                    Tap to unsign
                  </div>
                </>
              ) : (
                <>
                  <div>{Icons.contract({ size: 28, color: G.muted })}</div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      color: G.muted,
                      marginTop: 6,
                    }}
                  >
                    TAP TO SIGN CONTRACT
                  </div>
                  <div
                    style={{ fontSize: 11, color: G.muted, marginTop: 4 }}
                  >
                    As {profile.name || 'Driver'} ·{' '}
                    {new Date().toLocaleDateString('en-CA')}
                  </div>
                </>
              )}
            </div>

            {err && (
              <div
                style={{
                  background: G.errTint,
                  border: `1px solid ${G.danger}44`,
                  borderRadius: 8,
                  padding: '10px',
                  fontSize: 12,
                  color: G.errText,
                  marginBottom: 12,
                }}
              >
                {err}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <Btn variant="outline" onClick={() => setStep(3)}>
                ← BACK
              </Btn>
              <Btn
                onClick={() => void finish()}
                style={{
                  flex: 1,
                  padding: 14,
                  opacity: contract.signedByDriver ? 1 : 0.5,
                }}
              >
                SUBMIT APPLICATION
              </Btn>
            </div>
          </div>
        )}

        {step === 5 && (
          <div style={{ textAlign: 'center', padding: '40px 24px' }}>
            <div style={{ marginBottom: 16 }}>
              {Icons.completed({ size: 56, color: G.success })}
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 900,
                color: G.success,
                marginBottom: 8,
              }}
            >
              Application Submitted!
            </div>
            <div
              style={{
                fontSize: 13,
                color: G.muted,
                marginBottom: 24,
                lineHeight: 1.8,
              }}
            >
              Your profile, documents, and signed contract have been sent to{' '}
              <strong style={{ color: G.white }}>{company.name}</strong>.
              <br />
              You can now sign in with:{' '}
              <span style={{ color: G.gold }}>{profile.email}</span>
            </div>
            <div
              style={{
                background: G.card,
                border: `1px solid ${G.border}`,
                borderRadius: 12,
                padding: 16,
                maxWidth: 300,
                margin: '0 auto',
                fontSize: 11,
                color: G.muted,
                lineHeight: 2,
              }}
            >
              <div>✓ Profile saved</div>
              <div>
                ✓ {docs.length} document{docs.length !== 1 ? 's' : ''} uploaded
              </div>
              <div>✓ Contract signed</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
