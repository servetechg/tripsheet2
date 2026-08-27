import { useEffect, useState } from 'react';
import { G } from '@/lib/theme';
import { Btn, Card, Inp, Sel, SectionTitle } from '@/components/ui';
import { notify } from '@/components/feedback/Toast';
import { blank } from '@/lib/format';
import { messagesApi, commentsApi, notificationsApi, auditApi } from '@/lib/api';

export function MessagesTab({
  company,
  drivers,
  loads,
  adminUser,
  apiEnabled,
}: any) {
  const [msgs, setMsgs] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [loadId, setLoadId] = useState('');
  const [f, setF] = useState({
    toUserId: '',
    body: '',
    threadType: 'driver',
  });
  const [c, setC] = useState({ body: '' });
  const [smsTo, setSmsTo] = useState('');
  const [smsBody, setSmsBody] = useState('');
  const [loadErr, setLoadErr] = useState('');

  const refresh = async () => {
    if (!apiEnabled) return;
    try {
      setLoadErr('');
      const m = await messagesApi.list(company.id);
      setMsgs(m);
      if (loadId) {
        const cm = await commentsApi.list(company.id, 'load', loadId);
        setComments(cm);
      }
    } catch (e: any) {
      setLoadErr(
        e?.message ||
          'Messages could not be loaded. The notification service may be offline — run npm run start:dev in /backend.',
      );
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company.id, apiEnabled, loadId]);

  const send = async () => {
    if (blank(f.body)) {
      notify('Message body required', 'error');
      return;
    }
    const to = drivers.find((d: any) => d.id === f.toUserId);
    try {
      await messagesApi.create({
        companyId: company.id,
        threadType: f.threadType,
        fromUserId: adminUser?.id,
        fromName: adminUser?.name,
        toUserId: f.toUserId || null,
        toName: to?.name || '',
        loadId: loadId || null,
        body: f.body,
      });
      await auditApi.create({
        companyId: company.id,
        actorId: adminUser?.id,
        actorName: adminUser?.name,
        action: 'message.send',
        entityType: 'message',
        entityId: f.toUserId || '',
      });
      setF({ ...f, body: '' });
      notify('Message sent');
      await refresh();
    } catch (e: any) {
      notify(e?.message || 'Send failed', 'error');
    }
  };

  const addComment = async () => {
    if (!loadId || blank(c.body)) {
      notify('Select a load and enter a comment', 'error');
      return;
    }
    try {
      await commentsApi.create({
        companyId: company.id,
        entityType: 'load',
        entityId: loadId,
        userId: adminUser?.id,
        userName: adminUser?.name,
        body: c.body,
      });
      setC({ body: '' });
      await refresh();
    } catch (e: any) {
      notify(e?.message || 'Comment failed', 'error');
    }
  };

  const sendSms = async () => {
    if (blank(smsTo) || blank(smsBody)) {
      notify('SMS to and body required', 'error');
      return;
    }
    try {
      await notificationsApi.sendSms({
        to: smsTo,
        body: smsBody,
        companyId: company.id,
        meta: { type: 'manual' },
      });
      notify('SMS queued');
      setSmsBody('');
    } catch (e: any) {
      notify(e?.message || 'SMS failed', 'error');
    }
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <SectionTitle>Communication</SectionTitle>
      {loadErr ? (
        <div
          style={{
            background: G.errTint,
            border: `1px solid ${G.danger}44`,
            borderRadius: 10,
            padding: '12px 14px',
            fontSize: 13,
            color: G.errText,
          }}
        >
          {loadErr}
        </div>
      ) : null}
      <Card>
        <SectionTitle>Driver / internal messages</SectionTitle>
        <Sel
          label="To driver"
          value={f.toUserId}
          onChange={(e: any) => setF({ ...f, toUserId: e.target.value })}
        >
          <option value="">— select —</option>
          {drivers.map((d: any) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Sel>
        <Sel
          label="Thread"
          value={f.threadType}
          onChange={(e: any) => setF({ ...f, threadType: e.target.value })}
        >
          <option value="driver">Driver</option>
          <option value="internal">Internal</option>
          <option value="customer">Customer</option>
        </Sel>
        <Inp
          label="Message"
          value={f.body}
          onChange={(e: any) => setF({ ...f, body: e.target.value })}
        />
        <Btn onClick={() => void send()}>Send message</Btn>
        <div style={{ marginTop: 12 }}>
          {msgs.slice(0, 30).map((m) => (
            <div
              key={m.id}
              style={{
                borderTop: `1px solid ${G.border}`,
                padding: '8px 0',
                fontSize: 13,
              }}
            >
              <strong>{m.fromName}</strong> → {m.toName || m.threadType}: {m.body}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle>Load comments</SectionTitle>
        <Sel
          label="Load"
          value={loadId}
          onChange={(e: any) => setLoadId(e.target.value)}
        >
          <option value="">— select —</option>
          {loads.map((l: any) => (
            <option key={l.id} value={l.id}>
              {l.tripNo || l.id.slice(0, 8)} · {l.origin} → {l.destination}
            </option>
          ))}
        </Sel>
        <Inp
          label="Comment"
          value={c.body}
          onChange={(e: any) => setC({ body: e.target.value })}
        />
        <Btn onClick={() => void addComment()}>Add comment</Btn>
        {comments.map((cm) => (
          <div key={cm.id} style={{ fontSize: 13, padding: '6px 0' }}>
            <strong>{cm.userName}</strong>: {cm.body}
          </div>
        ))}
      </Card>

      <Card>
        <SectionTitle>Customer / manual SMS</SectionTitle>
        <Inp
          label="To phone"
          value={smsTo}
          onChange={(e: any) => setSmsTo(e.target.value)}
          placeholder="+1..."
        />
        <Inp
          label="Body"
          value={smsBody}
          onChange={(e: any) => setSmsBody(e.target.value)}
        />
        <Btn onClick={() => void sendSms()}>Send SMS</Btn>
      </Card>
    </div>
  );
}
