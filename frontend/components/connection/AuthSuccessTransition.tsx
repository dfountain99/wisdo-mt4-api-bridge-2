import { useState } from 'react';
import { LaunchConnectionAnimation, MembershipCheck } from './LaunchConnectionAnimation';
import { CommandCenterOnlineToast } from './CommandCenterOnlineToast';

export function AuthSuccessTransition() {
  const [open, setOpen] = useState(true);
  const [toast, setToast] = useState(false);
  const [membership, setMembership] = useState<MembershipCheck | undefined>();

  async function checkMembership(): Promise<MembershipCheck> {
    const response = await fetch('/api/deadshot/me');
    const json = await response.json();
    return json.membership;
  }

  function finish(next?: MembershipCheck) {
    setMembership(next);
    setOpen(false);
    setToast(true);
  }

  return (
    <>
      <LaunchConnectionAnimation
        open={open}
        checkMembership={checkMembership}
        onFinish={finish}
        onSkip={() => setOpen(false)}
      />
      <CommandCenterOnlineToast show={toast} tradeCopyUnlocked={Boolean(membership?.tradeCopyUnlocked)} />
    </>
  );
}
