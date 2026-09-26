import { useEffect } from 'react';
import { useTreeStore } from './store/useTreeStore';
import { AppHeader } from './components/AppHeader';
import { Toolbar } from './components/Toolbar';
import { TreeCanvas } from './components/TreeCanvas';
import { DirectoryView } from './components/DirectoryView';
import { ProfilePanel } from './components/ProfilePanel';
import { PersonForm } from './components/PersonForm';
import { ArchiveForm } from './components/ArchiveForm';
import { DocumentViewer } from './components/DocumentViewer';
import { InviteModal } from './components/InviteModal';
import { NewTreeModal } from './components/NewTreeModal';
import { NoticeToast } from './components/NoticeToast';
import { PlusMenu } from './components/PlusMenu';
import { SignInScreen } from './components/SignInScreen';
import { CreateTreeScreen } from './components/CreateTreeScreen';
import { AddMemberDialog } from './components/AddMemberDialog';
import { DeleteConfirmDialog } from './components/DeleteConfirmDialog';

function App() {
  const view = useTreeStore(s => s.view);
  const session = useTreeStore(s => s.session);
  const authReady = useTreeStore(s => s.authReady);
  const initAuth = useTreeStore(s => s.initAuth);
  const setWinW = useTreeStore(s => s.setWinW);
  const winW = useTreeStore(s => s.winW);

  useEffect(() => { void initAuth(); }, [initAuth]);

  useEffect(() => {
    const onResize = () => setWinW(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [setWinW]);

  // Esc closes the topmost overlay.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const s = useTreeStore.getState();
      if (s.viewerRecord) return s.closeViewer();
      if (s.confirmDeleteId) return s.cancelDelete();
      if (s.archiveForm) return s.closeArchiveForm();
      if (s.form) return s.closeForm();
      if (s.addDialog) return s.closeAddDialog();
      if (s.inviteOpen) return s.setInviteOpen(false);
      if (s.newTreeOpen) return s.setNewTreeOpen(false);
      if (s.panel) return s.closePanel();
      s.closeAllMenus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!authReady) {
    return <div style={{ height: '100vh', background: '#F7F5F2' }} />;
  }
  if (!session) return <SignInScreen />;
  // Signed in, but no archive yet — first run.
  if (!session.treeId) return <CreateTreeScreen />;

  const isMobile = winW < 640;
  const gutter = isMobile ? 12 : 20;

  return (
    <div style={{
      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      color: '#1C1917', height: '100vh',
      display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#F7F5F2',
    }}>
      <AppHeader />
      <Toolbar />

      {view === 'tree' && (
        <div style={{
          flexShrink: 0, display: 'flex', alignItems: 'center', gap: 22,
          padding: `9px ${gutter}px`, height: 38, boxSizing: 'border-box',
          background: 'rgba(255,253,251,.82)', borderBottom: '1px solid #EFE9E2',
          backdropFilter: 'blur(6px)', zIndex: 10, position: 'relative',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, fontWeight: 600, color: '#57534E', whiteSpace: 'nowrap' }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#38BDF8' }} />
            Males (Soft Blue)
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, fontWeight: 600, color: '#57534E', whiteSpace: 'nowrap' }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#F472B6' }} />
            Females (Pale Pink)
          </span>
          {!isMobile && (
            <span style={{ fontSize: 11.5, color: '#A8A29E', whiteSpace: 'nowrap' }}>
              Click a connecting line to highlight that branch · Ctrl + scroll to zoom
            </span>
          )}
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {view === 'tree' ? <TreeCanvas /> : <DirectoryView />}
      </div>

      <ProfilePanel />
      <PersonForm />
      <ArchiveForm />
      <AddMemberDialog />
      <DeleteConfirmDialog />
      <DocumentViewer />
      <InviteModal />
      <NewTreeModal />
      <PlusMenu />
      <NoticeToast />
    </div>
  );
}

export default App;
