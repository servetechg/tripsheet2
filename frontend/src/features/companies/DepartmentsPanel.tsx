import { useState, useMemo } from 'react';
import { G, RADIUS } from '@/lib/theme';
import { Btn, Inp, Modal, Pill, Icons } from '@/components/ui';
import { companiesApi } from '@/lib/api';
import { notify } from '@/components/feedback/Toast';

export interface DepartmentItem {
  id: string;
  name: string;
  code: string;
  companyId?: string;
  createdAt?: string;
}

interface DepartmentsPanelProps {
  companyId: string;
  departments: DepartmentItem[];
  canManage?: boolean;
  onReload: () => Promise<void> | void;
}

function getDepartmentMeta(name: string, code: string): { icon: keyof typeof Icons; color: string; desc: string } {
  const n = `${name} ${code}`.toLowerCase();
  if (n.includes('account') || n.includes('finan') || n.includes('billing')) {
    return {
      icon: 'accounting',
      color: '#34D399',
      desc: 'Invoicing, billing, payroll, settlements & financial records',
    };
  }
  if (n.includes('dispatch') || n.includes('load')) {
    return {
      icon: 'dispatch',
      color: '#3D8CFF',
      desc: 'Load planning, scheduling, carrier dispatch & tracking',
    };
  }
  if (n.includes('fleet') || n.includes('maint') || n.includes('repair')) {
    return {
      icon: 'assets',
      color: '#FBBF24',
      desc: 'Vehicle maintenance, equipment repairs, inspections & assets',
    };
  }
  if (n.includes('safe') || n.includes('complian') || n.includes('audit')) {
    return {
      icon: 'completed',
      color: '#38BDF8',
      desc: 'Regulatory compliance, safety audits, DOT & cross-border policies',
    };
  }
  if (n.includes('hr') || n.includes('human') || n.includes('people') || n.includes('recruit')) {
    return {
      icon: 'user',
      color: '#EC4899',
      desc: 'Staff onboarding, driver recruiting, personnel files & contracts',
    };
  }
  if (n.includes('op') || n.includes('logist')) {
    return {
      icon: 'running',
      color: '#A78BFA',
      desc: 'Day-to-day operations, terminal routing & partner execution',
    };
  }
  return {
    icon: 'companies',
    color: '#818CF8',
    desc: 'General administrative operations and organizational governance',
  };
}

export function DepartmentsPanel({
  companyId,
  departments,
  canManage = true,
  onReload,
}: DepartmentsPanelProps) {
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<DepartmentItem | null>(null);
  const [deptName, setDeptName] = useState('');
  const [deptCode, setDeptCode] = useState('');
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return departments;
    const q = search.toLowerCase();
    return departments.filter(
      (d) =>
        d.name.toLowerCase().includes(q) || d.code.toLowerCase().includes(q),
    );
  }, [departments, search]);

  const openCreate = () => {
    setEditingDept(null);
    setDeptName('');
    setDeptCode('');
    setModalOpen(true);
  };

  const openEdit = (d: DepartmentItem) => {
    setEditingDept(d);
    setDeptName(d.name);
    setDeptCode(d.code);
    setModalOpen(true);
  };

  const handleNameChange = (val: string) => {
    setDeptName(val);
    if (!editingDept) {
      const generated = val.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
      setDeptCode(generated);
    }
  };

  const handleSave = async () => {
    if (!deptName.trim()) {
      notify('Department name is required', 'error');
      return;
    }
    setBusy(true);
    try {
      const cleanCode = deptCode.trim().toLowerCase().replace(/[^a-z0-9]/g, '') || deptName.slice(0, 8).toLowerCase();
      await companiesApi.saveDepartment(companyId, {
        ...(editingDept ? { id: editingDept.id } : {}),
        name: deptName.trim(),
        code: cleanCode,
      });
      await onReload();
      notify(editingDept ? 'Department updated' : 'Department added');
      setModalOpen(false);
    } catch (err: any) {
      notify(err?.message || 'Failed to save department', 'error');
    } finally {
      setBusy(false);
    }
  };

  const copyCode = (code: string) => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(code);
      notify(`Copied code "${code}"`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header & Overview Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12,
        }}
      >
        <div
          style={{
            background: G.card2,
            border: `1px solid ${G.border}`,
            borderRadius: RADIUS.md,
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div
              style={{
                color: G.muted,
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Total Departments
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: G.text,
                marginTop: 4,
              }}
            >
              {departments.length}
            </div>
          </div>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: RADIUS.md,
              background: 'rgba(61, 140, 255, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: G.gold,
            }}
          >
            {Icons.companies({ size: 20, color: G.gold })}
          </div>
        </div>

        <div
          style={{
            background: G.card2,
            border: `1px solid ${G.border}`,
            borderRadius: RADIUS.md,
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div
              style={{
                color: G.muted,
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Operations & Logistics
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: G.info,
                marginTop: 4,
              }}
            >
              {
                departments.filter((d) => {
                  const n = `${d.name} ${d.code}`.toLowerCase();
                  return (
                    n.includes('dispatch') ||
                    n.includes('fleet') ||
                    n.includes('op') ||
                    n.includes('maint')
                  );
                }).length
              }
            </div>
          </div>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: RADIUS.md,
              background: 'rgba(56, 189, 248, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: G.info,
            }}
          >
            {Icons.dispatch({ size: 20, color: G.info })}
          </div>
        </div>

        <div
          style={{
            background: G.card2,
            border: `1px solid ${G.border}`,
            borderRadius: RADIUS.md,
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div
              style={{
                color: G.muted,
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Finance & Compliance
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: G.success,
                marginTop: 4,
              }}
            >
              {
                departments.filter((d) => {
                  const n = `${d.name} ${d.code}`.toLowerCase();
                  return (
                    n.includes('account') ||
                    n.includes('safe') ||
                    n.includes('complian')
                  );
                }).length
              }
            </div>
          </div>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: RADIUS.md,
              background: 'rgba(52, 211, 153, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: G.success,
            }}
          >
            {Icons.accounting({ size: 20, color: G.success })}
          </div>
        </div>
      </div>

      {/* Action and Search Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          background: G.card2,
          padding: '12px 14px',
          borderRadius: RADIUS.md,
          border: `1px solid ${G.border}`,
        }}
      >
        <div style={{ flex: 1, minWidth: 240, maxWidth: 360 }}>
          <Inp
            placeholder="Search departments by name or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 12, color: G.muted }}>
            Showing {filtered.length} of {departments.length}
          </div>

          {canManage && (
            <Btn
              size="sm"
              onClick={openCreate}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 16px',
              }}
            >
              {Icons.plus({ size: 14, color: '#fff' })}
              Add department
            </Btn>
          )}
        </div>
      </div>

      {/* Department Cards Grid */}
      {filtered.length === 0 ? (
        <div
          style={{
            padding: '48px 16px',
            textAlign: 'center',
            background: G.card,
            borderRadius: RADIUS.lg,
            border: `1px solid ${G.border}`,
            color: G.muted,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: G.card2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: G.muted,
              }}
            >
              {Icons.companies({ size: 22, color: G.muted })}
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: G.text }}>
              No departments found
            </div>
            <div style={{ fontSize: 12 }}>
              {search
                ? `No departments match your filter "${search}".`
                : 'No departments configured for this company yet.'}
            </div>
            {search && (
              <Btn
                size="sm"
                variant="ghost"
                onClick={() => setSearch('')}
                style={{ marginTop: 6 }}
              >
                Clear search
              </Btn>
            )}
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 14,
          }}
        >
          {filtered.map((d) => {
            const meta = getDepartmentMeta(d.name, d.code);
            const IconComp = Icons[meta.icon] || Icons.companies;

            return (
              <div
                key={d.id}
                className="ts-table-row"
                style={{
                  background: G.card,
                  border: `1px solid ${G.border}`,
                  borderRadius: RADIUS.lg,
                  padding: '16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 12,
                  transition: 'border-color .15s ease, transform .15s ease',
                  boxShadow: G.shadow,
                }}
              >
                <div>
                  {/* Top line: Icon + Title + Edit */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: 10,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: RADIUS.md,
                          background: `${meta.color}18`,
                          border: `1px solid ${meta.color}44`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: meta.color,
                          flexShrink: 0,
                        }}
                      >
                        <IconComp size={20} color={meta.color} />
                      </div>
                      <div>
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: G.text,
                            lineHeight: 1.25,
                          }}
                        >
                          {d.name}
                        </div>
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            marginTop: 4,
                          }}
                        >
                          <span
                            style={{
                              fontFamily:
                                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                              fontSize: 11,
                              color: G.gold,
                              background: G.goldBg,
                              padding: '1px 6px',
                              borderRadius: 4,
                              border: `1px solid ${G.gold}33`,
                              fontWeight: 600,
                            }}
                          >
                            {d.code}
                          </span>
                          <button
                            type="button"
                            onClick={() => copyCode(d.code)}
                            title="Copy department code"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              color: G.muted,
                              padding: 2,
                              display: 'inline-flex',
                              alignItems: 'center',
                              borderRadius: 3,
                            }}
                          >
                            <svg
                              width="11"
                              height="11"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <rect
                                x="9"
                                y="9"
                                width="13"
                                height="13"
                                rx="2"
                                ry="2"
                              />
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>

                    {canManage && (
                      <button
                        type="button"
                        onClick={() => openEdit(d)}
                        title="Edit department"
                        style={{
                          background: 'transparent',
                          border: `1px solid ${G.border}`,
                          borderRadius: RADIUS.sm,
                          padding: '4px 8px',
                          color: G.muted2,
                          cursor: 'pointer',
                          fontSize: 11,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          transition: 'all .15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = G.gold;
                          e.currentTarget.style.color = G.text;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = G.border;
                          e.currentTarget.style.color = G.muted2;
                        }}
                      >
                        {Icons.edit({ size: 12, color: 'currentColor' })}
                        Edit
                      </button>
                    )}
                  </div>

                  {/* Description */}
                  <div
                    style={{
                      fontSize: 12,
                      color: G.muted,
                      lineHeight: 1.4,
                      marginTop: 10,
                    }}
                  >
                    {meta.desc}
                  </div>
                </div>

                {/* Footer Tag */}
                <div
                  style={{
                    paddingTop: 10,
                    borderTop: `1px solid ${G.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: 11,
                    color: G.muted,
                  }}
                >
                  <span>Organizational Unit</span>
                  <Pill small color={meta.color}>
                    Active
                  </Pill>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Department Modal */}
      {modalOpen && (
        <Modal
          open
          title={editingDept ? 'Edit department' : 'Add department'}
          onClose={() => setModalOpen(false)}
          maxWidth={460}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 13, color: G.muted }}>
              Departments organize staff assignments, operational routing, and
              company reporting permissions.
            </div>

            <Inp
              label="Department Name *"
              placeholder="e.g. Dispatch & Tracking"
              value={deptName}
              onChange={(e) => handleNameChange(e.target.value)}
              autoFocus
            />

            <div>
              <Inp
                label="Department Code (slug) *"
                placeholder="e.g. dispatch"
                value={deptCode}
                onChange={(e) => setDeptCode(e.target.value)}
              />
              <div
                style={{
                  fontSize: 11,
                  color: G.muted,
                  marginTop: 4,
                }}
              >
                Unique identifier used for reporting and tenant system routing.
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
                marginTop: 8,
              }}
            >
              <Btn
                variant="outline"
                disabled={busy}
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </Btn>
              <Btn disabled={busy} onClick={() => void handleSave()}>
                {busy ? 'Saving...' : editingDept ? 'Save changes' : 'Add department'}
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
