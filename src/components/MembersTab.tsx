import { useEffect, useState } from 'react';
import { useTreeStore } from '../store/useTreeStore';
import type { Member } from '../types';

function Avatar({ m }: { m: Member }) {
  const [failed, setFailed] = useState(false);
  const initials = (m.name || m.email).split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  if (m.avatarUrl && !failed) {
    // no-referrer: Google profile images can refuse requests that carry one.
    return <img src={m.avatarUrl} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)}
      style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, objectFit: 'cover' }} />;
  }
  return (
    <span style={{
      width: 36, height: 36, borderRadius: '50%', flexShrink: 0, background: '#F0EDE9', color: '#57534E',
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 800,
    }}>{initials}</span>
  );
}

/**
 * Who has access to the tree, for admins. Revoking an invite link stops new
 * people joining with it; removing someone here is what takes access away
 * from a person who already joined.
 */
export function MembersTab() {
  const members = useTreeStore(s => s.members);
  const loading = useTreeStore(s => s.membersLoading);
  const loadMembers = useTreeStore(s => s.loadMembers);
  const setMemberRole = useTreeStore(s => s.setMemberRole);
  const removeMember = useTreeStore(s => s.removeMember);
  const myId = useTreeStore(s => s.session?.user.id);
  // Which row's Remove/Leave is armed; the second click confirms.
  const [armed, setArmed] = useState<string | null>(null);

  useEffect(() => { void loadMembers(); }, [loadMembers]);

  if (loading && !members.length) {
    return <div style={{ padding: '24px 22px', fontSize: 12.5, color: '#A8A29E' }}>Loading members…</div>;
  }

  const admins = members.filter(m => m.role === 'admin').length;

  return (
    <div style={{ padding: '14px 22px 20px' }}>
      <div style={{ fontSize: 12, color: '#78716C', lineHeight: 1.5, marginBottom: 12 }}>
        {members.length} {members.length === 1 ? 'person has' : 'people have'} access · {admins} {admins === 1 ? 'admin' : 'admins'}.
        Removing someone takes their access away immediately; revoking their invite link doesn't.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, maxHeight: '50dvh', overflowY: 'auto' }}>
        {members.map(m => {
          const me = m.userId === myId;
          const isArmed = armed === m.userId;
          return (
            <div key={m.userId} style={{
              display: 'flex', alignItems: 'center', gap: 11, padding: '9px 11px',
              borderRadius: 12, border: '1px solid #EFE9E2', background: '#fff',
            }}>
              <Avatar m={m} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.name}{me ? ' (you)' : ''}
                  </span>
                  {m.isOwner && (
                    <span title="Created this tree. Can't be removed, and is the only one who can delete it." style={{
                      flexShrink: 0, padding: '2px 7px', borderRadius: 99, background: '#FEF6F1', color: '#9A3412',
                      fontSize: 9.5, fontWeight: 800, letterSpacing: '.05em',
                    }}>OWNER</span>
                  )}
                </div>
                <div style={{ fontSize: 11.5, color: '#78716C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.email}</div>
              </div>

              {m.isOwner ? (
                <span style={{ flexShrink: 0, fontSize: 11.5, fontWeight: 700, color: '#A8A29E' }}>Admin</span>
              ) : (
                <>
                  <select
                    value={m.role}
                    aria-label={`Role for ${m.name}`}
                    onChange={e => void setMemberRole(m.userId, e.target.value as Member['role'])}
                    style={{
                      flexShrink: 0, padding: '6px 8px', borderRadius: 8, border: '1px solid #E7E2DC',
                      background: '#fff', fontSize: 12, fontWeight: 600, color: '#44403C', fontFamily: 'inherit',
                    }}
                  >
                    <option value="admin">Admin</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      if (isArmed) { setArmed(null); void removeMember(m.userId); }
                      else setArmed(m.userId);
                    }}
                    onBlur={() => setArmed(a => (a === m.userId ? null : a))}
                    style={{
                      flexShrink: 0, padding: '6px 10px', borderRadius: 8,
                      border: `1px solid ${isArmed ? '#B91C1C' : '#E7E2DC'}`,
                      background: isArmed ? '#B91C1C' : '#fff', color: isArmed ? '#fff' : '#B91C1C',
                      fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                    }}
                  >
                    {isArmed ? (me ? 'Leave?' : 'Remove?') : (me ? 'Leave' : 'Remove')}
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
