'use client';

import { formatAgo, formatTime } from '@bliss/shared/format';
import { Badge } from '@bliss/ui/components/badge';
import { Button } from '@bliss/ui/components/button';
import { Switch, TextField } from '@bliss/ui/components/fields';
import { ICON_STROKE } from '@bliss/ui/components/icon';
import { useNow } from '@bliss/ui/hooks';
import { cx } from '@bliss/ui/lib/cx';
import { staffPhoto } from '@/lib/pos/staff-photos';
import {
  IconAlertCircle,
  IconBattery,
  IconBatteryCharging,
  IconCheck,
  IconDeviceTablet,
  IconEdit,
  IconLogout,
  IconMapPin,
  IconRefresh,
  IconSun,
  IconDeviceMobileVibration,
  IconChevronDown,
  IconX,
} from '@tabler/icons-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { META, getMeta, posDb, setMeta } from '@/lib/pos/db';
import { useOutlet, useZonesAndTables } from '@/lib/pos/queries';
import { bindDevice, unbindDevice, useDevice, useSession, signOut } from '@/lib/pos/session';
import { SettingsCard } from './settings-card';

const ROUTING_TARGETS = [
  { value: 'bar-main', label: 'Main Bar Service (Default)' },
  { value: 'bar-terrace', label: 'Terrace Dispense Bar' },
  { value: 'cocktail-station', label: 'Cocktail & Spirits Well' },
  { value: 'kitchen-pass', label: 'Kitchen Expediter Pass' },
  { value: 'screen-only', label: 'Direct to Counter Screen (Paperless)' },
];

interface StationDropdownOption {
  value: string;
  label: string;
}

interface StationDropdownProps {
  label?: string;
  helper?: string;
  value: string;
  options: readonly StationDropdownOption[];
  onChange: (value: string) => void;
  className?: string;
}

/**
 * Tactile frosted-glass select dropdown for Floor Station console.
 * Replaces native OS select to guarantee crisp dark-mode rendering,
 * rounded corners, and consistent touch ergonomics across devices.
 */
function StationDropdown({
  label,
  helper,
  value,
  options,
  onChange,
  className,
}: StationDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className={cx('relative flex flex-col gap-8', className)}>
      {label ? (
        <label className="text-body-sm text-ink-subtle font-medium">{label}</label>
      ) : null}

      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className={cx(
            'flex w-full items-center justify-between gap-12 rounded-md px-16 py-12 text-left transition-all cursor-pointer select-none',
            'bg-raised/80 hover:bg-raised border border-rule-raised/40 hover:border-accent/50 shadow-sm',
            open && 'border-accent ring-1 ring-accent/30',
          )}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span className="text-body-sm font-medium text-ink truncate">
            {selectedOption?.label ?? 'Select option'}
          </span>
          <IconChevronDown
            size={16}
            stroke={ICON_STROKE}
            className={cx(
              'text-ink-subtle shrink-0 transition-transform duration-200',
              open && 'rotate-180 text-accent',
            )}
          />
        </button>

        {open ? (
          <div
            role="listbox"
            className="absolute left-0 right-0 top-full mt-8 z-50 rounded-lg bg-raised/95 backdrop-blur-xl border border-rule-raised/50 shadow-lift py-6 px-4 flex flex-col gap-2 max-h-[260px] overflow-y-auto animate-in fade-in zoom-in-95 duration-150"
          >
            {options.map((o) => {
              const isSelected = o.value === value;
              return (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={cx(
                    'flex items-center justify-between px-16 py-12 rounded-md text-body-sm font-medium transition-colors text-left cursor-pointer',
                    isSelected
                      ? 'bg-accent/15 text-accent-text'
                      : 'text-ink-muted hover:text-ink hover:bg-control-hover',
                  )}
                >
                  <span className="truncate">{o.label}</span>
                  {isSelected ? (
                    <IconCheck
                      size={16}
                      stroke={ICON_STROKE}
                      className="text-accent-text shrink-0 ml-8"
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {helper ? (
        <span className="text-body-sm text-ink-subtle leading-relaxed mt-2">{helper}</span>
      ) : null}
    </div>
  );
}

/**
 * Production-grade Tablet Station & Hardware Management console card.
 * Full CRUD capabilities:
 * - Device Binding & Switching
 * - Custom Station Alias / Nickname (Create, Edit, Delete)
 * - Preferred Floor Service Zone assignment
 * - Order Ticket Routing Destination
 * - Screen Keep-Awake (Screen Wake Lock API)
 * - Tactile Haptic Vibration preference
 * - Active Waiter Session & Quick Handover
 * - Safe Hardware Unbind guard
 */
export function TabletStationCard() {
  const router = useRouter();
  const device = useDevice();
  const session = useSession();
  const outlet = useOutlet();
  const places = useZonesAndTables();
  const now = useNow(10_000);

  const devices = useLiveQuery(() => posDb().devices.toArray(), []);
  const nickname = useLiveQuery(() => getMeta<string>(META.deviceNickname), []);
  const preferredZone = useLiveQuery(() => getMeta<string>(META.preferredZone), []);
  const ticketTarget = useLiveQuery(() => getMeta<string>(META.ticketTarget), []);
  const keepAwake = useLiveQuery(() => getMeta<boolean>(META.screenKeepAwake), []);
  const haptics = useLiveQuery(() => getMeta<boolean>(META.hapticsEnabled), []);

  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState('');
  const [showUnbindModal, setShowUnbindModal] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [isCharging, setIsCharging] = useState(false);
  const [dimensions, setDimensions] = useState({ w: 0, h: 0 });

  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const tz = outlet?.timezone ?? 'Africa/Nairobi';
  const photoUrl = session?.displayName ? staffPhoto(session.displayName) : null;
  const initials = session?.displayName
    ? session.displayName
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? '')
        .join('')
    : '';

  // Screen resolution telemetry
  useEffect(() => {
    const updateDim = () => setDimensions({ w: window.innerWidth, h: window.innerHeight });
    updateDim();
    window.addEventListener('resize', updateDim);
    return () => window.removeEventListener('resize', updateDim);
  }, []);

  // Web Battery API telemetry if available
  useEffect(() => {
    type BatteryManager = {
      level: number;
      charging: boolean;
      addEventListener: (type: string, listener: () => void) => void;
      removeEventListener: (type: string, listener: () => void) => void;
    };
    interface NavigatorWithBattery extends Navigator {
      getBattery?: () => Promise<BatteryManager>;
    }
    const nav = navigator as NavigatorWithBattery;
    if (typeof nav.getBattery === 'function') {
      let bRef: BatteryManager | null = null;
      nav.getBattery().then((battery) => {
        bRef = battery;
        setBatteryLevel(Math.round(battery.level * 100));
        setIsCharging(battery.charging);
        const update = () => {
          setBatteryLevel(Math.round(battery.level * 100));
          setIsCharging(battery.charging);
        };
        battery.addEventListener('levelchange', update);
        battery.addEventListener('chargingchange', update);
      }).catch(() => {
        // Battery API blocked or unsupported
      });
      return () => {
        if (bRef) {
          bRef.removeEventListener('levelchange', () => {});
          bRef.removeEventListener('chargingchange', () => {});
        }
      };
    }
  }, []);

  // Screen Wake Lock controller
  useEffect(() => {
    if (!keepAwake) {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
      return;
    }

    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
        }
      } catch {
        // WakeLock request failed or disallowed
      }
    };

    void requestWakeLock();

    const handleVisibilityChange = () => {
      if (wakeLockRef.current !== null && document.visibilityState === 'visible') {
        void requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, [keepAwake]);

  // Nickname CRUD handlers
  const handleStartEditNickname = () => {
    setNicknameDraft(nickname ?? '');
    setIsEditingNickname(true);
  };

  const handleSaveNickname = async () => {
    const trimmed = nicknameDraft.trim();
    await setMeta(META.deviceNickname, trimmed || null);
    setIsEditingNickname(false);
  };

  const handleClearNickname = async () => {
    await setMeta(META.deviceNickname, null);
    setNicknameDraft('');
    setIsEditingNickname(false);
  };

  // Hardware binding CRUD
  const handleSelectDevice = async (deviceId: string) => {
    const target = devices?.find((d) => d.id === deviceId);
    if (target) {
      await bindDevice({ id: target.id, label: target.label });
    }
  };

  const handleConfirmUnbind = async () => {
    await unbindDevice();
    setShowUnbindModal(false);
  };

  // Preferred Zone CRUD
  const handleSelectZone = async (zoneId: string) => {
    await setMeta(META.preferredZone, zoneId === 'all' ? null : zoneId);
  };

  // Routing target CRUD
  const handleSelectTicketTarget = async (target: string) => {
    await setMeta(META.ticketTarget, target);
  };

  // Haptic feedback toggle
  const handleToggleHaptics = async (enabled: boolean) => {
    await setMeta(META.hapticsEnabled, enabled);
    if (enabled && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(15);
    }
  };

  // Sign out handler
  const handleSignOut = async () => {
    await signOut();
    router.push('/floor/sign-in');
  };

  const floorDevices = (devices ?? []).filter((d) => d.kind === 'floor');
  const zonesList = [{ id: 'all', name: 'All floor zones' }, ...(places?.zones ?? [])];

  return (
    <SettingsCard
      icon={IconDeviceTablet}
      title="This tablet"
      subtitle="Hardware terminal identity, station alias & floor routing"
      tone={device ? 'accent' : 'attention'}
      badge={
        device ? (
          <Badge tone="served" className="!rounded-dot px-8 py-2 font-mono text-micro shadow-sm">
            Active terminal
          </Badge>
        ) : (
          <Badge tone="attention" className="!rounded-dot px-8 py-2 font-mono text-micro shadow-sm">
            Unbound tablet
          </Badge>
        )
      }
    >
      <div className="flex flex-col gap-24">
        {/* ── Block 1: Hardware Binding & Station Alias (CRUD) ────────── */}
        <div className="rounded-lg bg-sunken/60 border border-rule-raised/20 p-20 flex flex-col gap-24">
          <div className="flex flex-col tablet:flex-row tablet:items-center justify-between gap-16">
            <div className="flex items-center gap-8 min-w-0">
              <span className="text-body-sm font-medium text-ink-subtle">
                Hardware terminal
              </span>
              <Badge tone="neutral" className="!rounded-dot px-6 py-px font-mono text-micro">
                {device?.label ?? 'None'}
              </Badge>
            </div>

            {/* Device Switcher Dropdown */}
            <div className="w-full tablet:w-[220px]">
              <StationDropdown
                value={device?.id ?? ''}
                onChange={(val) => void handleSelectDevice(val)}
                options={floorDevices.map((d) => ({
                  value: d.id,
                  label: `${d.label} ${d.id === device?.id ? '(Current)' : ''}`,
                }))}
              />
            </div>
          </div>

          {/* Station Operational Nickname / Alias CRUD */}
          <div className="flex flex-col gap-12">
            <div className="flex items-center justify-between gap-8">
              <span className="text-body-sm font-medium text-ink">
                Station nickname / operational alias
              </span>
              {!isEditingNickname ? (
                <button
                  type="button"
                  onClick={handleStartEditNickname}
                  className="inline-flex items-center gap-6 text-body-sm font-medium text-accent hover:underline cursor-pointer"
                >
                  <IconEdit size={16} stroke={ICON_STROKE} />
                  <span>{nickname ? 'Edit alias' : 'Set alias'}</span>
                </button>
              ) : null}
            </div>

            {isEditingNickname ? (
              <div className="flex items-center gap-8">
                <div className="flex-1">
                  <TextField
                    label="Station alias"
                    hideLabel
                    value={nicknameDraft}
                    onChange={(e) => setNicknameDraft(e.target.value)}
                    placeholder="e.g. Patio Handheld 1, Station A South"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleSaveNickname();
                      if (e.key === 'Escape') setIsEditingNickname(false);
                    }}
                  />
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  icon={IconCheck}
                  onClick={() => void handleSaveNickname()}
                  className="!rounded-dot px-12"
                >
                  Save
                </Button>
                {nickname ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleClearNickname()}
                    className="!rounded-dot px-12 text-stop hover:bg-stop/10"
                  >
                    Clear
                  </Button>
                ) : null}
                <Button
                  variant="secondary"
                  size="sm"
                  icon={IconX}
                  onClick={() => setIsEditingNickname(false)}
                  className="!rounded-dot px-8"
                />
              </div>
            ) : (
              <div className="flex items-center justify-between gap-12 bg-raised/50 border border-rule-raised/20 rounded-md p-16">
                <span className="text-body-sm text-ink truncate font-medium">
                  {nickname ? nickname : 'No station alias set (tap edit to assign)'}
                </span>
                {nickname ? (
                  <Badge tone="accent" className="!rounded-dot px-6 py-px font-mono text-micro shrink-0">
                    Named Station
                  </Badge>
                ) : null}
              </div>
            )}
          </div>
        </div>

        {/* ── Block 2: Service Zone & Kitchen/Bar Routing (CRUD) ──────── */}
        <div className="rounded-lg bg-sunken/60 border border-rule-raised/20 p-20 flex flex-col gap-24">
          <div className="flex items-center gap-8">
            <IconMapPin size={20} stroke={ICON_STROKE} className="text-ink-subtle" />
            <span className="text-body font-medium text-ink">
              Service zone & order ticket routing
            </span>
          </div>

          <div className="grid grid-cols-1 tablet:grid-cols-2 gap-20">
            {/* Preferred Zone Selector */}
            <StationDropdown
              label="Assigned service zone"
              helper="Filters tabs & tables to this tablet's service section"
              value={preferredZone ?? 'all'}
              onChange={(val) => void handleSelectZone(val)}
              options={zonesList.map((z) => ({
                value: z.id,
                label: z.name,
              }))}
            />

            {/* Ticket Print Target Selector */}
            <StationDropdown
              label="Fired drinks & tickets route"
              helper="Target dispense printer or screen for orders"
              value={ticketTarget ?? 'bar-main'}
              onChange={(val) => void handleSelectTicketTarget(val)}
              options={ROUTING_TARGETS}
            />
          </div>
        </div>

        {/* ── Block 3: Signed-In Operator & Quick Actions ─────────────── */}
        <div className="rounded-lg bg-sunken/60 border border-rule-raised/20 p-20 flex flex-col tablet:flex-row tablet:items-center justify-between gap-20">
          <div className="flex items-center gap-12 min-w-0">
            <div
              aria-hidden="true"
              className="flex size-[40px] items-center justify-center overflow-hidden rounded-dot border border-accent/40 bg-accent-wash text-body-sm font-medium text-accent-text select-none shrink-0 shadow-sm"
            >
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoUrl}
                  alt={session?.displayName ?? ''}
                  className="h-full w-full object-cover"
                />
              ) : (
                initials
              )}
            </div>

            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-8 flex-wrap">
                <span className="text-body font-medium text-ink truncate">
                  {session?.displayName ?? 'No Operator Signed In'}
                </span>
                <Badge tone="neutral" className="!rounded-dot px-8 py-px font-mono text-micro">
                  {session?.roleKey === 'supervisor' ? 'Supervisor' : 'Floor Waiter'}
                </Badge>
              </div>
              <span className="font-mono text-micro text-ink-subtle mt-2 truncate">
                {session?.signedInAt
                  ? `Active on shift since ${formatTime(session.signedInAt, tz)} (${formatAgo(now - session.signedInAt)})`
                  : 'Requires PIN sign-in'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-8 shrink-0 flex-wrap">
            <Button
              variant="secondary"
              size="sm"
              icon={IconRefresh}
              onClick={() => router.push('/floor/sign-in')}
              className="!rounded-dot px-16 text-body-sm font-medium border border-rule-raised/40 hover:border-accent/40"
            >
              Switch operator
            </Button>

            <Button
              variant="ghost"
              size="sm"
              icon={IconLogout}
              onClick={() => void handleSignOut()}
              className="!rounded-dot px-12 text-stop hover:bg-stop/10 border border-stop/20 hover:border-stop/40 text-body-sm font-medium"
            >
              Sign out
            </Button>
          </div>
        </div>

        {/* ── Block 4: Hardware Experience & Display Preferences ─────── */}
        <div className="rounded-lg bg-sunken/60 border border-rule-raised/20 p-20 flex flex-col gap-24">
          <div className="flex items-center justify-between gap-16">
            <div className="flex flex-col gap-4 min-w-0">
              <div className="flex items-center gap-8">
                <IconDeviceMobileVibration size={20} stroke={ICON_STROKE} className="text-ink-subtle" />
                <span className="text-body font-medium text-ink">
                  Tactile haptic tap feedback
                </span>
              </div>
              <span className="text-body-sm text-ink-subtle pl-28 leading-relaxed">
                Vibrates subtly on order button presses, seat assignments and bill items.
              </span>
            </div>
            <div className="shrink-0">
              <Switch
                label=""
                checked={Boolean(haptics)}
                onChange={(v) => void handleToggleHaptics(v)}
              />
            </div>
          </div>

          {/* Device Power & Resolution Telemetry */}
          <div className="flex items-center justify-between gap-12 flex-wrap font-mono text-micro text-ink-subtle pt-6 pl-28">
            <div className="flex items-center gap-6">
              {isCharging ? (
                <IconBatteryCharging size={14} stroke={ICON_STROKE} className="text-served" />
              ) : (
                <IconBattery size={14} stroke={ICON_STROKE} className="text-ink-subtle" />
              )}
              <span>
                {batteryLevel !== null
                  ? `${batteryLevel}% ${isCharging ? '(Charging)' : '(Battery)'}`
                  : 'AC Connected · Power Stable'}
              </span>
            </div>
          </div>
        </div>

        {/* ── Block 5: Hardware De-Registration / Unbind Guard ────────── */}
        <div className="flex items-center justify-between gap-12 px-8 pt-4">
          <span className="font-mono text-micro text-ink-disabled">
            Station enrolled in Cool Bliss Spot cluster
          </span>
          <button
            type="button"
            onClick={() => setShowUnbindModal(true)}
            className="text-body-sm font-medium text-ink-subtle hover:text-stop transition-colors cursor-pointer"
          >
            Unbind hardware registration...
          </button>
        </div>

        {/* Confirmation modal for hardware unbind */}
        {showUnbindModal ? (
          <div className="rounded-lg border border-stop/40 bg-stop/10 p-16 tablet:p-20 flex flex-col gap-12 text-stop">
            <div className="flex items-start gap-12">
              <IconAlertCircle size={20} stroke={ICON_STROKE} className="shrink-0 mt-0.5 text-stop" />
              <div className="flex flex-col gap-4 min-w-0">
                <span className="text-body font-medium text-stop">
                  Unbind {device?.label ?? 'this tablet'} from Floor?
                </span>
                <p className="font-mono text-micro text-stop/90 leading-relaxed">
                  This disconnects the tablet identity from the floor station. You will need to re-bind or enroll the device again in Console.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-8 pt-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowUnbindModal(false)}
                className="!rounded-dot px-12 text-body-sm font-medium"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => void handleConfirmUnbind()}
                className="!rounded-dot px-16 text-body-sm font-medium bg-stop text-page hover:brightness-110"
              >
                Confirm unbind
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </SettingsCard>
  );
}
