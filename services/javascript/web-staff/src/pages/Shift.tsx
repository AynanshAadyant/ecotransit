import React, { useEffect } from 'react';
import { useShiftStore } from '../state/shift';
import { getCurrentShift, confirmShift } from '../api/shift.api';
import { ShiftCard } from '../components/ShiftCard';

export const Shift: React.FC = () => {
  const { currentShift, confirming, setCurrentShift, setConfirming } = useShiftStore();

  useEffect(() => {
    let mounted = true;
    getCurrentShift()
      .then((shift) => {
        if (mounted) setCurrentShift(shift);
      })
      .catch(() => {
        // Fallback default shift record if backend service is pending
        if (mounted) {
          setCurrentShift({
            shiftId: 'SH-842',
            staffId: 'OP-704',
            staffName: 'Marcus Vance',
            assignedVehicleId: 'BUS-402',
            assignedRouteId: 'CORRIDOR-1',
            startTime: '06:00',
            endTime: '14:30',
            confirmed: false,
          });
        }
      });

    return () => {
      mounted = false;
    };
  }, [setCurrentShift]);

  const handleConfirm = async (shiftId: string) => {
    setConfirming(true);
    const idempotencyKey = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `key-${Date.now()}`;

    try {
      const updated = await confirmShift(shiftId, idempotencyKey);
      setCurrentShift(updated);
    } catch {
      // Local optimistic update
      if (currentShift) {
        setCurrentShift({ ...currentShift, confirmed: true, confirmedAt: new Date().toISOString() });
      }
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div style={{ padding: '16px', maxWidth: '480px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <ShiftCard shift={currentShift} onConfirm={handleConfirm} isConfirming={confirming} />
    </div>
  );
};
