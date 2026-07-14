import  { useState } from 'react';
import VoiceApp from '../voice/VoiceApp';
import BottomTabBar, { TabKey } from './BottomTabBar';
import InventoryApp from '../inventory/InventoryApp';

export default function AppShell() {
  const [tab, setTab] = useState<TabKey>('inventory');

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
        <InventoryApp onOpenVoice={() => setTab('voice')} />
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
