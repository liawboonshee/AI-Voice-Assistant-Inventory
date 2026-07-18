import  { useEffect, useRef, useState } from 'react';
import VoiceApp from '../voice/VoiceApp';
import BottomTabBar, { TabKey } from './BottomTabBar';
import InventoryApp from '../inventory/InventoryApp';
import PinLockScreen, { hasInventoryPin } from '../security/PinLockScreen';

export default function AppShell() {
  const [tab, setTab] = useState<TabKey>('inventory');
  const [unlocked, setUnlocked] = useState(false);
  const hiddenAt = useRef<number | null>(null);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt.current = Date.now();
        return;
      }
      if (hiddenAt.current && Date.now() - hiddenAt.current >= 60_000 && hasInventoryPin()) {
        setUnlocked(false);
      }
      hiddenAt.current = null;
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  if (!unlocked) {
    return <PinLockScreen onUnlock={() => setUnlocked(true)} />;
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        paddingBottom:
          tab === 'voice' ? 'calc(56px + env(safe-area-inset-bottom))' : 0,
      }}
    >
      {tab === 'voice' ? (
        <VoiceApp />
      ) : (
        <InventoryApp onLock={() => setUnlocked(false)} onOpenVoice={() => setTab('voice')} />
      )}

      {tab === 'voice' && (
        <BottomTabBar
          active={tab}
          onChange={setTab}
        />
      )}
    </div>
  );
}
