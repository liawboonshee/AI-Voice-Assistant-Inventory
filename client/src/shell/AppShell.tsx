import  { useState } from 'react';
import VoiceApp from '../voice/VoiceApp';
import BottomTabBar, { TabKey } from './BottomTabBar';

function InventoryPlaceholder() {
  return (
    <div
      style={{
        padding: 24,
        paddingBottom: 96,
        textAlign: 'center',
        color: '#374151',
      }}
    >
      <h2 style={{ margin: '32px 0 8px' }}>
        📦 库存宝
      </h2>

      <p style={{ color: '#6b7280', fontSize: 14 }}>
        模块开发中（第 2 步接入进货 / 出货 / 库存 / 客户 / 欠款）。
      </p>
    </div>
  );
}

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
