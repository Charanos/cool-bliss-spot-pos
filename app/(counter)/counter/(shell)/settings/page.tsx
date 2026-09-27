'use client';

import { Button } from '@bliss/ui/components/button';
import { IconKeyboard } from '@tabler/icons-react';
import { useState } from 'react';
import { Panel, StationSettings } from '@/app/_pos/station-settings';
import { ShortcutsSheet } from '../../_components/shortcuts';

/** The Counter's settings: the station's own, and its keyboard, which lives here rather than in the top bar. */
export default function CounterSettingsPage() {
  const [keys, setKeys] = useState(false);
  return (
    <>
      <StationSettings
        surface="counter"
        extra={
          <Panel title="Keyboard" id="settings-keys">
            <p className="text-body-sm text-ink-muted">Letters move between the views, P pours the oldest ticket, and amounts can be typed. Press ? anywhere for the list.</p>
            <div>
              <Button variant="secondary" icon={IconKeyboard} onClick={() => setKeys(true)}>
                Every key
              </Button>
            </div>
          </Panel>
        }
      />
      <ShortcutsSheet open={keys} onClose={() => setKeys(false)} />
    </>
  );
}
