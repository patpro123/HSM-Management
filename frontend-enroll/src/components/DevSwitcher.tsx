import React, { useState } from 'react';
import { API_BASE_URL } from '../config';

type DevProfile = 'admin' | 'teacher' | 'student';

interface DevSwitcherProps {
  currentProfile: DevProfile;
  currentOverride: { email: string; name: string } | null;
  onSwitched: (newUser: any) => void;
}

const ROLE_STYLES: Record<DevProfile, string> = {
  admin:   'bg-purple-700 hover:bg-purple-800',
  teacher: 'bg-blue-700 hover:bg-blue-800',
  student: 'bg-emerald-700 hover:bg-emerald-800',
};

const DevSwitcher: React.FC<DevSwitcherProps> = ({ currentProfile, currentOverride, onSwitched }) => {
  const [expanded, setExpanded] = useState(false);
  const [userRef, setUserRef] = useState('');
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const switchProfile = async (profile: DevProfile) => {
    setSwitching(true);
    setError(null);
    try {
      const body: Record<string, string> = { profile };
      if (userRef.trim()) body.userRef = userRef.trim();

      const switchRes = await fetch(`${API_BASE_URL}/api/dev/switch-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await switchRes.json();
      if (!switchRes.ok) {
        setError(data.error || 'Switch failed');
        return;
      }

      // Use the resolved user returned directly from the switch response
      if (data.user) {
        onSwitched(data.user);
        setExpanded(false);
      }
    } catch (e) {
      setError('Network error');
    } finally {
      setSwitching(false);
    }
  };

  const pillLabel = currentOverride
    ? `${currentProfile}: ${currentOverride.email}`
    : `DEV: ${currentProfile}`;

  return (
    <div className="fixed bottom-4 left-4 z-50 font-mono text-xs select-none">
      <div className="flex flex-col items-start gap-2">
        {expanded && (
          <div className="bg-gray-950 text-white rounded-xl p-3 shadow-2xl border border-gray-700 w-64">
            <div className="text-gray-400 font-semibold mb-2 uppercase tracking-wider text-[10px]">Dev Profile</div>

            {/* Role buttons */}
            <div className="flex gap-1 mb-3">
              {(['admin', 'teacher', 'student'] as DevProfile[]).map(p => (
                <button
                  key={p}
                  onClick={() => switchProfile(p)}
                  disabled={switching}
                  className={`flex-1 py-1 rounded-md text-white capitalize ${ROLE_STYLES[p]} disabled:opacity-40 transition-opacity`}
                >
                  {switching ? '…' : p}
                </button>
              ))}
            </div>

            {/* Email / UUID input */}
            <div className="text-gray-500 mb-1 text-[10px] uppercase tracking-wider">Email or UUID (optional)</div>
            <input
              type="text"
              placeholder="user@email.com or UUID"
              value={userRef}
              onChange={e => { setUserRef(e.target.value); setError(null); }}
              onKeyDown={e => { if (e.key === 'Enter') switchProfile(currentProfile); }}
              className="w-full bg-gray-800 border border-gray-600 rounded-md px-2 py-1 text-white text-xs placeholder-gray-600 focus:outline-none focus:border-gray-400"
            />
            <div className="text-gray-600 mt-1 text-[10px]">
              Blank = default dev user · Works for provisioned emails too
            </div>

            {error && <div className="text-red-400 mt-2 text-[10px] break-all">{error}</div>}

            {currentOverride && (
              <div className="mt-2 pt-2 border-t border-gray-800 text-gray-500 text-[10px] break-all">
                As: {currentOverride.name} ({currentOverride.email})
              </div>
            )}
          </div>
        )}

        {/* Pill toggle */}
        <button
          onClick={() => setExpanded(v => !v)}
          className={`${ROLE_STYLES[currentProfile]} text-white px-3 py-1 rounded-full shadow-lg flex items-center gap-2 transition-all max-w-xs truncate`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-white opacity-75 animate-pulse flex-shrink-0" />
          <span className="truncate">{pillLabel}</span>
        </button>
      </div>
    </div>
  );
};

export default DevSwitcher;
