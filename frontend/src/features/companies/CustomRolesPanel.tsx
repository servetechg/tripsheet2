import { useEffect, useMemo, useState } from 'react';
import { G } from '@/lib/theme';
import { Btn, Card, Inp, Sel, Divider, SectionTitle, G2 } from '@/components/ui';
import {
  authApi,
  companiesApi,
  type CustomRoleDto,
} from '@/lib/api';
import { notify } from '@/components/feedback/Toast';
import { useCan } from '@/lib/permissions';
import { CUSTOM_ROLE_BASE_ROLES, ROLE_LABELS } from '@tripsheet/shared';

type Perm = { code: string; module: string; name: string; description: string };
type SysRole = {
  code: string;
  name: string;
  description: string;
  permissions?: string[];
};

export function CustomRolesPanel({ companyId }: { companyId: string }) {
  const { can } = useCan();
  const canWrite = can('users.assign_role');
  const [roles, setRoles] = useState<CustomRoleDto[]>([]);
  const [catalog, setCatalog] = useState<Perm[]>([]);
  const [templates, setTemplates] = useState<SysRole[]>([]);
  const [selectedId, setSelectedId] = useState<string | 'new'>('new');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [baseRole, setBaseRole] = useState<string>('dispatcher');
  const [cloneFrom, setCloneFrom] = useState('');
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const [list, perms, sys] = await Promise.all([
        companiesApi.listCustomRoles(companyId),
        authApi.listPermissions(),
        authApi.listRoles(),
      ]);
      setRoles(list || []);
      setCatalog((perms || []).filter((p) => p.code !== 'company.delete'));
      setTemplates((sys || []).filter((r) => r.code !== 'company_owner'));
    } catch (err: any) {
      notify(err?.message || 'Failed to load roles', 'error');
    }
  };

  useEffect(() => {
    void load();
  }, [companyId]);

  const selected = roles.find((r) => r.id === selectedId);

  useEffect(() => {
    if (selectedId === 'new') {
      setName('');
      setDescription('');
      setBaseRole('dispatcher');
      setCloneFrom('');
      setChecked(new Set());
      return;
    }
    if (!selected) return;
    setName(selected.name);
    setDescription(selected.description || '');
    setBaseRole(selected.baseRole);
    setCloneFrom('');
    setChecked(new Set(selected.permissions || []));
  }, [selectedId, selected?.id]);

  const modules = useMemo(() => {
    const map = new Map<string, Perm[]>();
    for (const p of catalog) {
      const list = map.get(p.module) || [];
      list.push(p);
      map.set(p.module, list);
    }
    return [...map.entries()];
  }, [catalog]);

  const applyClone = (code: string) => {
    setCloneFrom(code);
    const tpl = templates.find((t) => t.code === code);
    if (!tpl?.permissions) return;
    setChecked(
      new Set(tpl.permissions.filter((c) => c !== 'company.delete')),
    );
    if (!name.trim()) {
      setName(`${tpl.name} (custom)`);
    }
    if (CUSTOM_ROLE_BASE_ROLES.includes(code as (typeof CUSTOM_ROLE_BASE_ROLES)[number])) {
      setBaseRole(code);
    }
  };

  const toggle = (code: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const toggleModule = (mod: string, on: boolean) => {
    const codes = catalog.filter((p) => p.module === mod).map((p) => p.code);
    setChecked((prev) => {
      const next = new Set(prev);
      for (const c of codes) {
        if (on) next.add(c);
        else next.delete(c);
      }
      return next;
    });
  };

  const save = async () => {
    if (!name.trim()) {
      notify('Role name is required', 'error');
      return;
    }
    setBusy(true);
    try {
      const permissions = [...checked];
      if (selectedId === 'new') {
        const created = await companiesApi.createCustomRole(companyId, {
          name: name.trim(),
          description: description.trim(),
          baseRole,
          permissions,
        });
        notify(`Created ${created.name}`);
        await load();
        setSelectedId(created.id);
      } else {
        await companiesApi.updateCustomRole(companyId, selectedId, {
          name: name.trim(),
          description: description.trim(),
          permissions,
        });
        notify('Role updated — assigned users pick up grants on next login');
        await load();
      }
    } catch (err: any) {
      notify(err?.message || 'Save failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (selectedId === 'new') return;
    if (!window.confirm('Delete this custom role? Assigned users keep their system base role until reassigned.')) {
      return;
    }
    setBusy(true);
    try {
      await companiesApi.deleteCustomRole(companyId, selectedId);
      notify('Custom role deleted');
      setSelectedId('new');
      await load();
    } catch (err: any) {
      notify(err?.message || 'Delete failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 16 }}>
      <Card>
        <SectionTitle>Custom roles</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button
            type="button"
            onClick={() => setSelectedId('new')}
            style={{
              textAlign: 'left',
              padding: '8px 10px',
              borderRadius: 8,
              border:
                selectedId === 'new'
                  ? `1px solid ${G.gold}`
                  : `1px solid ${G.border}`,
                background: selectedId === 'new' ? G.goldBg : 'transparent',
              color: G.text,
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            + New role
          </button>
          {roles.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setSelectedId(r.id)}
              style={{
                textAlign: 'left',
                padding: '8px 10px',
                borderRadius: 8,
                border:
                  selectedId === r.id
                    ? `1px solid ${G.gold}`
                    : `1px solid ${G.border}`,
                background: selectedId === r.id ? G.goldBg : 'transparent',
                color: G.text,
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              <div>{r.name}</div>
              <div style={{ color: G.muted, fontSize: 11 }}>
                {ROLE_LABELS[r.baseRole as keyof typeof ROLE_LABELS] ||
                  r.baseRole}{' '}
                · {r.permissions?.length || 0} grants
              </div>
            </button>
          ))}
          {roles.length === 0 && (
            <div style={{ color: G.muted, fontSize: 12, padding: 8 }}>
              No custom roles yet. Compose one from the catalog.
            </div>
          )}
        </div>
      </Card>

      <Card>
        <SectionTitle>
          {selectedId === 'new' ? 'Compose role' : selected?.name || 'Role'}
        </SectionTitle>
        <div style={{ color: G.muted, fontSize: 13, marginBottom: 16 }}>
          Custom roles live on this company&apos;s tenant database. Routing
          (staff vs driver) follows the base system role. Permission grants
          replace the template — they are not unioned. Company delete cannot be
          granted. Assigned users must sign in again to refresh the JWT.
        </div>
        <G2 cols={2}>
          <Inp
            label="Name"
            value={name}
            disabled={!canWrite}
            onChange={(e) => setName(e.target.value)}
          />
          <Sel
            label="Base role (routing)"
            value={baseRole}
            disabled={!canWrite || selectedId !== 'new'}
            onChange={(e) => setBaseRole(e.target.value)}
          >
            {CUSTOM_ROLE_BASE_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r as keyof typeof ROLE_LABELS] || r}
              </option>
            ))}
          </Sel>
        </G2>
        <div style={{ marginTop: 12 }}>
          <Inp
            label="Description"
            value={description}
            disabled={!canWrite}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        {canWrite && (
          <div style={{ marginTop: 12 }}>
            <Sel
              label="Start from system template"
              value={cloneFrom}
              onChange={(e) => applyClone(e.target.value)}
            >
              <option value="">— choose a template —</option>
              {templates.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.name}
                </option>
              ))}
            </Sel>
          </div>
        )}
        <Divider />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {modules.map(([mod, perms]) => {
            const allOn = perms.every((p) => checked.has(p.code));
            return (
              <div key={mod}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: 8,
                    textTransform: 'capitalize',
                  }}
                >
                  <input
                    type="checkbox"
                    disabled={!canWrite}
                    checked={allOn}
                    onChange={(e) => toggleModule(mod, e.target.checked)}
                  />
                  {mod}
                </label>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 6,
                    paddingLeft: 8,
                  }}
                >
                  {perms.map((p) => (
                    <label
                      key={p.code}
                      style={{
                        display: 'flex',
                        gap: 8,
                        fontSize: 12,
                        color: G.text,
                        alignItems: 'flex-start',
                      }}
                    >
                      <input
                        type="checkbox"
                        disabled={!canWrite}
                        checked={checked.has(p.code)}
                        onChange={() => toggle(p.code)}
                        style={{ marginTop: 2 }}
                      />
                      <span>
                        {p.name}
                        <span style={{ color: G.muted }}> · {p.code}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        {canWrite && (
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <Btn disabled={busy} onClick={() => void save()}>
              {selectedId === 'new' ? 'Create role' : 'Save grants'}
            </Btn>
            {selectedId !== 'new' && (
              <Btn
                variant="danger"
                disabled={busy}
                onClick={() => void remove()}
              >
                Delete
              </Btn>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
