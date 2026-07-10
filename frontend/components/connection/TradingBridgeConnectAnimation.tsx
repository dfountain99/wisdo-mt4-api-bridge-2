import { LaunchConnectionAnimation } from './LaunchConnectionAnimation';

type TradingBridgeConnectAnimationProps = {
  open: boolean;
  onFinish?: () => void;
};

export function TradingBridgeConnectAnimation({ open, onFinish }: TradingBridgeConnectAnimationProps) {
  return (
    <LaunchConnectionAnimation
      open={open}
      steps={[
        'Connecting',
        'Authenticating',
        'Connecting trading bridge',
        'Syncing membership',
        'Checking subscription',
        'Launching dashboard',
        'Command Center Online',
      ]}
      checkMembership={async () => {
        const response = await fetch('/api/deadshot/me');
        const json = await response.json();
        return json.membership;
      }}
      onFinish={() => onFinish?.()}
      onSkip={() => onFinish?.()}
    />
  );
}
