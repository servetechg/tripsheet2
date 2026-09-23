import { useEffect, useState } from 'react';
import { G } from '@/lib/theme';
import { Btn, Card, Inp, Sel, SectionTitle } from '@/components/ui';
import { notify } from '@/components/feedback/Toast';
import { blank, formatLoadLabel, humanizeEnum, getApiErrorMessage } from '@/lib/format';
import { messagesApi, commentsApi, notificationsApi, auditApi } from '@/lib/api';
import type { MessagesTabProps } from '@/types/tabs';
import type { CommentDto, MessageDto } from '@/types/dtos';
import { SMS_DISABLED_HINT, useSmsEnabled } from '@/hooks/useSmsEnabled';

export function MessagesTab({
  company,
  drivers,
  loads,
  adminUser,
  apiEnabled,
}: MessagesTabProps) {
  const { smsEnabled } = useSmsEnabled(Boolean(apiEnabled));
  const [msgs, setMsgs] = useState<MessageDto[]>([]);
  const [comments, setComments] = useState<CommentDto[]>([]);
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
      } else {
        setComments([]);
      }
    } catch (e: unknown) {
      setLoadErr(
        getApiErrorMessage(e) ||
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
    const to = drivers.find((d) => d.id === f.toUserId);
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
      setF({ toUserId: '', body: '', threadType: 'driver' });
      notify('Message sent');
      await refresh();
    } catch (e: unknown) {
      notify(getApiErrorMessage(e, 'Send failed'), 'error');
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
      notify('Comment added');
      await refresh();
    } catch (e: unknown) {
      notify(getApiErrorMessage(e, 'Comment failed'), 'error');
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
      setSmsTo('');
      setSmsBody('');
    } catch (e: unknown) {
      notify(getApiErrorMessage(e, 'SMS failed'), 'error');
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
          onChange={(e) => setF({ ...f, toUserId: e.target.value })}
        >
          <option value="">— select —</option>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Sel>
        <Sel
          label="Thread"
          value={f.threadType}
          onChange={(e) => setF({ ...f, threadType: e.target.value })}
        >
          <option value="driver">Driver</option>
          <option value="internal">Internal</option>
          <option value="customer">Customer</option>
        </Sel>
        <Inp
          label="Message"
          value={f.body}
          onChange={(e) => setF({ ...f, body: e.target.value })}
        />
        <Btn onClick={() => void send()}>Send Message</Btn>
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
              <strong>{m.fromName}</strong> → {m.toName || humanizeEnum(m.threadType)}: {m.body}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle>Load Comments</SectionTitle>
        <p
          style={{
            margin: '0 0 12px',
            fontSize: 12,
            color: G.muted,
            lineHeight: 1.45,
          }}
        >
          Internal notes on a trip (dispatch / office). They stay on this load here
          on Messages — they do not go to the driver notification bell. To notify a
          driver, use <strong style={{ color: G.text }}>Driver / internal messages</strong>{' '}
          above.
        </p>
        <Sel
          label="Load"
          value={loadId}
          onChange={(e) => setLoadId(e.target.value)}
        >
          <option value="">— select —</option>
          {loads.map((l) => (
            <option key={l.id} value={l.id}>
              {formatLoadLabel(l)}
            </option>
          ))}
        </Sel>
        <Inp
          label="Comment"
          value={c.body}
          onChange={(e) => setC({ body: e.target.value })}
        />
        <Btn onClick={() => void addComment()}>Add Comment</Btn>
        {!loadId ? (
          <div style={{ fontSize: 13, color: G.muted, marginTop: 12 }}>
            Select a load to view or add comments.
          </div>
        ) : comments.length === 0 ? (
          <div style={{ fontSize: 13, color: G.muted, marginTop: 12 }}>
            No comments on this load yet.
          </div>
        ) : (
          <div style={{ marginTop: 12 }}>
            {comments.map((cm) => (
              <div
                key={cm.id}
                style={{
                  fontSize: 13,
                  padding: '8px 0',
                  borderTop: `1px solid ${G.border}`,
                }}
              >
                <strong>{cm.userName}</strong>: {cm.body}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle>Customer / manual SMS</SectionTitle>
        {!smsEnabled ? (
          <div style={{ fontSize: 13, color: G.muted, marginBottom: 12 }}>
            {SMS_DISABLED_HINT}
          </div>
        ) : null}
        <Inp
          label="To phone"
          phone
          value={smsTo}
          onChange={(e) => setSmsTo(e.target.value)}
          placeholder="(403) 555-0100"
          disabled={!smsEnabled}
        />
        <Inp
          label="Body"
          value={smsBody}
          onChange={(e) => setSmsBody(e.target.value)}
          disabled={!smsEnabled}
        />
        <Btn disabled={!smsEnabled} title={smsEnabled ? undefined : SMS_DISABLED_HINT} onClick={() => void sendSms()}>
          Send SMS
        </Btn>
      </Card>
    </div>
  );
}
