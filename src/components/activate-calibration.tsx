'use client';

import { useActionState } from 'react';
import { activateCalibrationAction } from '@/app/actions';
import type { CalibrationSettings } from '@/lib/calibration';
import { btnClass } from './ui';

export function ActivateCalibration({ settings }: { settings: CalibrationSettings }) {
  const [state, action, pending] = useActionState(activateCalibrationAction, null);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      {Object.entries(settings).map(([key, value]) => <input key={key} type="hidden" name={key} value={value} />)}
      <button className={btnClass} disabled={pending}>{pending ? 'Activating…' : 'Activate for new stress tests'}</button>
      {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
    </form>
  );
}
