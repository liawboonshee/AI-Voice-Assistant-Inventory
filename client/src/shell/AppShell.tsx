import  { useState } from 'react';
import VoiceApp from '../voice/VoiceApp';
import BottomTabBar, { TabKey } from './BottomTabBar';
import InventoryApp from '../inventory/InventoryApp';

export default function AppShell() {
  const [tab, setTab] = useState<TabKey>('voice');

  return (
    <div
      style={{
        minHeight: '100vh',
        paddingBottom:
          'calc(56px + env(safe-area-inset-bottom))',
      }}
    >
      <div
        style={{
          display: tab === 'voice' ? 'block' : 'none',
        }}
      >
        <VoiceApp />
      </div>

      <div
        style={{
          display: tab === 'inventory' ? 'block' : 'none',
        }}
      >
        <InventoryPlaceholder />
      </div>

      <BottomTabBar
        active={tab}
        onChange={setTab}
      />
    </div>
  );
}
