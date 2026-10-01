import { useRef, useState } from 'react';
import { MembersTab } from './MembersTab';
import { useTreeStore } from '../store/useTreeStore';
import type { Role } from '../types';

const ROLE_COPY: Record<Role, { title: string; body: string }> = {
  admin: { title: 'Admin', body: 'Add, edit and delete members, upload archives, import data.' },
  viewer: { title: 'Viewer', body: 'Browse the tree and profiles, and export to PDF or Excel.' },
};

export function InviteModal() {
  const inviteOpen = useTreeStore(s => s.inviteOpen);
  const inviteRole = useTreeStore(s => s.inviteRole);
  const copied = useTreeStore(s => s.copied);
  const isAdmin = useTreeStore(s => s.isAdmin());
  const trees = useTreeStore(s => s.trees);
  const activeTreeId = useTreeStore(s => s.activeTreeId);
  const setInviteOpen = useTreeStore(s => s.setInviteOpen);
  const setInviteRole = useTreeStore(s => s.setInviteRole);
  const setCopied = useTreeStore(s => s.setCopied);
  const inviteUrl = useTreeStore(s => s.inviteUrl);
  const invites = useTreeStore(s => s.invites);
  const creatingInvite = useTreeStore(s => s.creatingInvite);
  const inviteError = useTreeStore(s => s.inviteError);
  const createInviteLink = useTreeStore(s => s.createInviteLink);
  const revokeInviteToken = useTreeStore(s => s.revokeInviteToken);

  const inputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<'invite' | 'members'>('invite');

  if (!inviteOpen) return null;

  const treeName = trees.find(t => t.id === activeTreeId)?.name ?? 'family';
  const url = inviteUrl();

  const copy = () => {
    navigator.clipboard.writeText(url).catch(() => {
      // Clipboard API needs a secure context; fall back to selecting the field.
      inputRef.current?.select();
      document.execCommand?.('copy');
    });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      onClick={() => setInviteOpen(false)}
      style={{
        position: 'fixed', inset: 0, zIndex: 86,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3vh 16px',
        background: 'rgba(28,25,23,.42)', backdropFilter: 'blur(3px)',
      }}
    >
      <div
        role="dialog"
        aria-label="Family access"
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(520px, 96vw)', maxHeight: '92vh', overflowY: 'auto', background: '#FFFDFB', borderRadius: 20,
          boxShadow: '0 26px 60px rgba(28,25,23,.26)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '18px 22px 0' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.015em' }}>Family access</div>
            <div style={{ fontSize: 12.5, color: '#6B635C', marginTop: 3, lineHeight: 1.45 }}>
              {tab === 'invite'
                ? `Share a link with family. They sign in with Google to join the ${treeName} Family Tree.`
                : `Everyone who can see the ${treeName} Family Tree.`}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setInviteOpen(false)}
            aria-label="Close"
            style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid #E7E2DC', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#57534E', flexShrink: 0 }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <div role="tablist" style={{ display: 'flex', gap: 4, padding: '14px 22px 0', borderBottom: '1px solid #EFE9E2' }}>
          {([['invite', 'Invite links'], ['members', 'Members']] as const).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} style={{
              padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 13, fontWeight: 700, color: tab === id ? '#C2410C' : '#78716C',
              borderBottom: `2px solid ${tab === id ? '#C2410C' : 'transparent'}`, marginBottom: -1,
            }}>{label}</button>
          ))}
        </div>

        {tab === 'members' ? <MembersTab /> : (
        <div style={{ padding: '18px 22px 20px' }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.13em', color: '#78716C', marginBottom: 9 }}>
            INVITE AS
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 9 }}>
            {(['admin', 'viewer'] as const).map(r => {
              const on = inviteRole === r;
              // Viewers can invite viewers, but only admins can mint admins.
              const locked = r === 'admin' && !isAdmin;
              return (
                <button
                  key={r}
                  type="button"
                  disabled={locked}
                  onClick={() => setInviteRole(r)}
                  style={{
                    textAlign: 'left', padding: 12, borderRadius: 13,
                    border: `1.5px solid ${on ? '#C2410C' : '#E7E2DC'}`,
                    background: on ? '#FEF6F1' : '#fff',
                    cursor: locked ? 'not-allowed' : 'pointer',
                    opacity: locked ? 0.5 : 1,
                    fontFamily: 'inherit',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                      border: `${on ? 5 : 1.5}px solid ${on ? '#C2410C' : '#D6CFC7'}`,
                      background: '#fff', boxSizing: 'border-box',
                    }} />
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: on ? '#9A3412' : '#292524' }}>
                      {ROLE_COPY[r].title}
                    </span>
                  </span>
                  <span style={{ display: 'block', fontSize: 11.5, color: '#6B635C', marginTop: 6, lineHeight: 1.45 }}>
                    {ROLE_COPY[r].body}
                  </span>
                </button>
              );
            })}
          </div>

          {!isAdmin && (
            <div style={{ fontSize: 11.5, color: '#92400E', marginTop: 9 }}>
              Only tree admins can invite other admins.
            </div>
          )}

          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.13em', color: '#78716C', margin: '18px 0 9px' }}>
            INVITE LINK
          </div>

          {url ? (
            <>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  ref={inputRef}
                  readOnly
                  value={url}
                  onFocus={e => e.currentTarget.select()}
                  style={{
                    flex: 1, minWidth: 0, boxSizing: 'border-box', padding: '10px 12px',
                    borderRadius: 10, border: '1px solid #E7E2DC', background: '#F5F1EC',
                    fontSize: 12, color: '#44403C', outline: 'none',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  }}
                />
                <button
                  type="button"
                  onClick={copy}
                  style={{
                    flexShrink: 0, padding: '10px 16px', borderRadius: 10, border: 'none',
                    background: copied ? '#15803D' : '#1C1917', color: '#fff',
                    fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  {copied ? 'Copied' : 'Copy link'}
                </button>
              </div>
              <div style={{ fontSize: 11.5, color: '#A8A29E', marginTop: 9, lineHeight: 1.45 }}>
                No email is sent. Anyone with this link can join as{' '}
                {inviteRole === 'admin' ? 'an admin' : 'a viewer'} until you revoke it.
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={creatingInvite}
                onClick={() => void createInviteLink()}
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '11px 16px',
                  borderRadius: 10, border: 'none',
                  background: creatingInvite ? '#A8A29E' : '#1C1917', color: '#fff',
                  fontSize: 12.5, fontWeight: 700,
                  cursor: creatingInvite ? 'default' : 'pointer', fontFamily: 'inherit',
                }}
              >
                {creatingInvite ? 'Creating…' : `Create ${inviteRole} invite link`}
              </button>
              <div style={{ fontSize: 11.5, color: '#A8A29E', marginTop: 9, lineHeight: 1.45 }}>
                The link is recorded so it can be revoked later. Changing the role above
                needs a new link — the role is fixed when the link is created.
              </div>
            </>
          )}

          {inviteError && (
            <div style={{ marginTop: 9, fontSize: 12, fontWeight: 600, color: '#B91C1C' }}>
              {inviteError}
            </div>
          )}

          {invites.length > 0 && (
            <>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.13em', color: '#78716C', margin: '20px 0 8px' }}>
                EXISTING LINKS
              </div>
              <div style={{ maxHeight: 168, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {invites.map(i => {
                  const revoked = !!i.revokedAt;
                  return (
                    <div
                      key={i.token}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 10px', borderRadius: 10,
                        border: '1px solid #EFE9E2', background: revoked ? '#FAF8F5' : '#fff',
                        opacity: revoked ? 0.6 : 1,
                      }}
                    >
                      <span style={{
                        flexShrink: 0, padding: '2px 7px', borderRadius: 99,
                        background: i.role === 'admin' ? '#FEF6F1' : '#F0EDE9',
                        color: i.role === 'admin' ? '#9A3412' : '#57534E',
                        fontSize: 10, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase',
                      }}>{i.role}</span>
                      <span style={{
                        flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        fontSize: 11.5, color: '#78716C',
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                        textDecoration: revoked ? 'line-through' : 'none',
                      }}>{i.token}</span>
                      {revoked ? (
                        <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, color: '#A8A29E' }}>Revoked</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void revokeInviteToken(i.token)}
                          style={{
                            flexShrink: 0, padding: '5px 10px', borderRadius: 8,
                            border: '1px solid #E7E2DC', background: '#fff',
                            fontSize: 11, fontWeight: 700, color: '#B91C1C',
                            cursor: 'pointer', fontFamily: 'inherit',
                          }}
                        >Revoke</button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
        )}
      </div>
    </div>
  );
}
