type CommandCenterOnlineToastProps = {
  show: boolean;
  tradeCopyUnlocked: boolean;
};

export function CommandCenterOnlineToast({ show, tradeCopyUnlocked }: CommandCenterOnlineToastProps) {
  if (!show) return null;
  return (
    <div className="fixed bottom-5 right-5 z-[900] rounded-2xl border border-emerald-400/30 bg-[#0b1018]/95 p-4 text-white shadow-2xl backdrop-blur-xl">
      <strong>Command Center Online</strong>
      <p className="mt-1 text-sm text-slate-400">
        {tradeCopyUnlocked
          ? 'Active membership confirmed. Copier controls are unlocked.'
          : 'Dashboard opened. Copier controls remain locked until backend checks pass.'}
      </p>
    </div>
  );
}
