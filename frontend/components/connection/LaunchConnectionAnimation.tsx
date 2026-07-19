import { useEffect, useMemo, useState } from 'react';

export type ConnectionStep =
  | 'Connecting'
  | 'Authenticating'
  | 'Syncing membership'
  | 'Checking subscription'
  | 'Connecting Discord'
  | 'Connecting trading bridge'
  | 'Launching dashboard'
  | 'Command Center Online';

export type MembershipCheck = {
  role: 'guest' | 'free_user' | 'culture_coin_member_active' | 'culture_coin_member_inactive' | 'admin';
  tradeCopyUnlocked: boolean;
  canCopyTrades: boolean;
  source?: string;
};

const DEFAULT_STEPS: ConnectionStep[] = [
  'Connecting',
  'Authenticating',
  'Syncing membership',
  'Checking subscription',
  'Connecting Discord',
  'Connecting trading bridge',
  'Launching dashboard',
  'Command Center Online',
];

type LaunchConnectionAnimationProps = {
  open: boolean;
  onFinish?: (membership?: MembershipCheck) => void;
  onSkip?: () => void;
  checkMembership?: () => Promise<MembershipCheck>;
  steps?: ConnectionStep[];
};

export function LaunchConnectionAnimation({
  open,
  onFinish,
  onSkip,
  checkMembership,
  steps = DEFAULT_STEPS,
}: LaunchConnectionAnimationProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [membership, setMembership] = useState<MembershipCheck | undefined>();
  const reducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  useEffect(() => {
    if (!open) return;
    if (reducedMotion) {
      checkMembership?.().then(onFinish).catch(() => onFinish?.());
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function run() {
      let checked: MembershipCheck | undefined;
      for (let i = 0; i < steps.length; i += 1) {
        if (cancelled) return;
        setActiveIndex(i);
        if (steps[i] === 'Checking subscription' && checkMembership) {
          checked = await Promise.race([
            checkMembership(),
            new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 4200)),
          ]).catch(() => undefined);
          if (checked) setMembership(checked);
        }
        await new Promise((resolve) => {
          timer = setTimeout(resolve, i === steps.length - 1 ? 650 : 360);
        });
      }
      if (!cancelled) onFinish?.(checked);
    }

    run();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [open, reducedMotion, checkMembership, onFinish, steps]);

  if (!open || reducedMotion) return null;

  return (
    <div className="fixed inset-0 z-[999] grid place-items-center bg-[#05070b]/95 backdrop-blur-xl">
      <button
        type="button"
        onClick={onSkip}
        className="absolute right-4 top-4 rounded-xl border border-white/15 px-4 py-2 text-sm font-bold text-white/80"
      >
        Skip
      </button>
      <div className="w-[min(680px,calc(100vw-28px))] rounded-[28px] border border-[#f5c542]/30 bg-[#0b1018]/90 p-7 shadow-2xl">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#39ff88]">Command Launch Sequence</p>
        <h2 className="mt-3 text-3xl font-black tracking-tight text-white">{steps[activeIndex]}...</h2>
        <p className="mt-2 text-sm text-slate-400">
          {membership?.tradeCopyUnlocked
            ? 'Membership confirmed. Copier controls can unlock.'
            : 'Access will reflect the real backend membership check.'}
        </p>
        <div className="relative mt-5 h-44 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
          <div className="culture-command-ship" />
        </div>
        <ConnectionStatusStepper steps={steps} activeIndex={activeIndex} />
      </div>
    </div>
  );
}

export function ConnectionStatusStepper({ steps, activeIndex }: { steps: string[]; activeIndex: number }) {
  return (
    <div className="mt-5 grid gap-2">
      {steps.map((step, index) => (
        <div key={step} className={`flex items-center gap-3 text-sm ${index <= activeIndex ? 'text-emerald-200' : 'text-slate-500'}`}>
          <span className={`h-3 w-3 rounded-full ${index <= activeIndex ? 'bg-[#39ff88] shadow-[0_0_16px_#39ff88]' : 'bg-slate-700'}`} />
          {step}
        </div>
      ))}
    </div>
  );
}
