import {createContext, useContext} from 'react';
import {formatTime} from '@/community/lib/zmanim';
import {formatCountdown, type ZmanAlert} from './zmanAlerts';

export const DeadlineContext=createContext<ZmanAlert[]>([]);
export const useDeadlines=()=>useContext(DeadlineContext);
export function DeadlineCard({alert}:{alert:ZmanAlert}) {
  return <div className="tv-deadline-panel" data-testid="prayer-deadline" data-event={alert.event} dir="rtl">
    <span>הזמן מתקרב</span><strong>{alert.label}</strong>
    <b className="tv-deadline-digits" dir="ltr">{formatCountdown(alert.secondsLeft)}</b>
    <span>בשעה {formatTime(alert.at)}</span>
  </div>;
}
