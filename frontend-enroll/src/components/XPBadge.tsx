import React from 'react';

export const RANKS = [
    { name: 'Rookie',    min: 0,    color: 'slate'  },
    { name: 'Performer', min: 300,  color: 'sky'    },
    { name: 'Artist',    min: 1200, color: 'amber'  },
    { name: 'Maestro',   min: 3500, color: 'orange' },
] as const;

type RankColor = typeof RANKS[number]['color'];

type Rank = { name: string; min: number; color: RankColor };

export function getRankInfo(totalXP: number): { rank: Rank; nextRank: Rank | null; xpToNextRank: number } {
    let currentIndex = 0;
    for (let i = 0; i < RANKS.length; i++) {
        if (totalXP >= RANKS[i].min) currentIndex = i;
    }
    const current: Rank = RANKS[currentIndex];
    const next: Rank | null = RANKS[currentIndex + 1] ?? null;
    return { rank: current, nextRank: next, xpToNextRank: next ? next.min - totalXP : 0 };
}

const RANK_STYLES: Record<RankColor, { pill: string; bar: string; icon: string }> = {
    slate:  { pill: 'bg-slate-100 text-slate-700',   bar: 'bg-slate-400',   icon: '🎵' },
    sky:    { pill: 'bg-sky-100 text-sky-700',        bar: 'bg-sky-500',     icon: '🎼' },
    amber:  { pill: 'bg-amber-100 text-amber-700',    bar: 'bg-amber-500',   icon: '🎸' },
    orange: { pill: 'bg-orange-100 text-orange-700',  bar: 'bg-orange-500',  icon: '🏆' },
};

interface XPBadgeProps {
    totalXP: number;
    compact?: boolean;
}

const XPBadge: React.FC<XPBadgeProps> = ({ totalXP, compact = false }) => {
    const { rank, nextRank, xpToNextRank } = getRankInfo(totalXP);
    const styles = RANK_STYLES[rank.color];

    if (compact) {
        return (
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${styles.pill}`}>
                {styles.icon} {rank.name}
            </span>
        );
    }

    const pct = nextRank
        ? Math.min(100, Math.round(((totalXP - rank.min) / (nextRank.min - rank.min)) * 100))
        : 100;

    return (
        <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-1.5 text-sm font-bold px-3 py-1 rounded-full ${styles.pill}`}>
                {styles.icon} {rank.name}
            </span>
            <div className="flex flex-col min-w-[140px]">
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>{totalXP.toLocaleString()} XP</span>
                    {nextRank && <span>{xpToNextRank} to {nextRank.name}</span>}
                    {!nextRank && <span>Max rank!</span>}
                </div>
                <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-500 ${styles.bar}`}
                        style={{ width: `${pct}%` }}
                    />
                </div>
            </div>
        </div>
    );
};

export default XPBadge;
