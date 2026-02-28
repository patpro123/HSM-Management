import React, { useState, useEffect, useRef } from 'react';
import { apiGet, apiPut } from '../api';
import ProspectViewerModal from './ProspectViewerModal';

interface Notification {
    id: string;
    type: string;
    title: string;
    message: string;
    is_read: boolean;
    action_link?: string;
    metadata?: any;
    created_at: string;
}

interface NotificationsPanelProps {
    onNavigation?: (path: string) => void;
}

const NotificationsPanel: React.FC<NotificationsPanelProps> = ({ onNavigation }) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [selectedProspect, setSelectedProspect] = useState<any>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const hasAutoOpened = useRef(false);

    const fetchNotifications = async () => {
        try {
            const res = await apiGet('/api/notifications');
            if (res && res.notifications) {
                const notificationsList = res.notifications;
                const unread = notificationsList.filter((n: Notification) => !n.is_read);
                setNotifications(notificationsList);
                setUnreadCount(unread.length);

                // Auto-open on initial load if there are unread notifications
                if (!hasAutoOpened.current) {
                    hasAutoOpened.current = true;
                    if (unread.length > 0) {
                        setIsOpen(true);
                    }
                }
            }
        } catch (err) {
            console.error('Error fetching notifications:', err);
        }
    };

    useEffect(() => {
        // Initial fetch
        fetchNotifications();

        // Connect to SSE stream for real-time push notifications
        const sseUrl = '/api/notifications/stream'; // This will be relative to wherever index is hoisted
        // Using explicit URL block to guarantee it reaches backend-enroll correctly
        const eventSource = new EventSource(sseUrl);

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'CONNECTED') {
                    console.log('SSE Stream Connected for Notifications');
                    return;
                }

                // Real notification arrived!
                console.log('New Push Notification:', data);

                // Construct pseudo-notification object for UI
                const newNotif: Notification = {
                    ...data,
                    is_read: false,
                    id: data.id || `temp-${Date.now()}` // Backend may or may not send ID in pure SSE push
                };

                setNotifications(prev => [newNotif, ...prev]);
                setUnreadCount(prev => prev + 1);

                // Auto-open dropdown on push notification
                setIsOpen(true);
            } catch (err) {
                console.error('Error parsing SSE data', err);
            }
        };

        eventSource.onerror = (error) => {
            console.error('SSE connection error, closing stream.', error);
            eventSource.close();
        };

        return () => {
            eventSource.close();
        };
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        try {
            await apiPut(`/api/notifications/${id}/read`, {});
            // Update local state proactively
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (err) {
            console.error('Failed to mark read', err);
        }
    };

    const handleMarkAllRead = async () => {
        try {
            await apiPut('/api/notifications/read-all', {});
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            setUnreadCount(0);
        } catch (err) {
            console.error('Failed to mark all read', err);
        }
    };

    const handleNotificationClick = async (notif: Notification) => {
        if (!notif.is_read) {
            await handleMarkAsRead(notif.id);
        }
        setIsOpen(false);

        // If it's a prospect notification, open the rich Prospect Modal instead of just jumping tabs
        if (notif.type === 'NEW_PROSPECT' && notif.metadata) {
            setSelectedProspect({
                id: notif.metadata.prospect_id,
                name: notif.title.replace('New Demo Sign-up', '').trim() || notif.message.split(' ')[0],
                phone: notif.metadata.phone,
                email: notif.metadata.email,
                metadata: notif.metadata
            });
            return;
        }

        // Standard notification handling via App.tsx callback
        if (notif.action_link && onNavigation) {
            if (notif.action_link.includes('students')) {
                onNavigation('students');
            } else if (notif.action_link.includes('payments')) {
                onNavigation('payments');
            }
        }
    };

    const formatTimeAgo = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (diffInSeconds < 60) return `Just now`;
        const diffInMinutes = Math.floor(diffInSeconds / 60);
        if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
        const diffInHours = Math.floor(diffInMinutes / 60);
        if (diffInHours < 24) return `${diffInHours}h ago`;
        return `${Math.floor(diffInHours / 24)}d ago`;
    };

    return (
        <div className="relative inline-block text-left" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 text-slate-300 hover:text-white transition-colors focus:outline-none"
                aria-label="Notifications"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 text-[10px] font-bold text-white items-center justify-center">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="origin-top-right absolute right-0 mt-2 w-80 md:w-96 rounded-xl shadow-2xl bg-white ring-1 ring-black ring-opacity-5 z-50 overflow-hidden transform transition-all">
                    {/* ... (rest of the dropdown is unchanged) ... */}
                    <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                        <h3 className="text-sm font-bold text-slate-800">Notifications</h3>
                        {unreadCount > 0 && (
                            <button
                                onClick={handleMarkAllRead}
                                className="text-xs text-orange-600 hover:text-orange-800 font-semibold"
                            >
                                Mark all read
                            </button>
                        )}
                    </div>

                    <div className="max-h-96 overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="px-4 py-8 text-center text-sm text-slate-500">
                                You're all caught up!
                            </div>
                        ) : (
                            <ul className="divide-y divide-slate-100">
                                {notifications.map((notif) => (
                                    <li
                                        key={notif.id}
                                        onClick={() => handleNotificationClick(notif)}
                                        className={`p-4 hover:bg-slate-50 cursor-pointer transition ${!notif.is_read ? 'bg-orange-50/30' : ''}`}
                                    >
                                        <div className="flex gap-3">
                                            <div className={`mt-1 h-3 w-3 rounded-full flex-shrink-0 ${!notif.is_read ? 'bg-orange-500' : 'bg-transparent'}`} />
                                            <div className="flex-1">
                                                <div className="flex justify-between items-start mb-1">
                                                    <p className={`text-sm ${!notif.is_read ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
                                                        {notif.title}
                                                    </p>
                                                    <p className="text-xs text-slate-400 whitespace-nowrap ml-2">
                                                        {formatTimeAgo(notif.created_at)}
                                                    </p>
                                                </div>
                                                <p className="text-sm text-slate-600 line-clamp-2">
                                                    {notif.message}
                                                </p>

                                                {notif.type === 'NEW_PROSPECT' && notif.metadata && (
                                                    <div className="mt-2 text-xs text-slate-500 flex items-center gap-2">
                                                        <span>📞 {notif.metadata.phone || 'N/A'}</span>
                                                    </div>
                                                )}

                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div className="bg-slate-50 px-4 py-2 border-t border-slate-200 text-center">
                        <a href="#" className="text-xs text-slate-500 hover:text-slate-800 font-medium transition cursor-default">
                            Notification Center
                        </a>
                    </div>
                </div>
            )}

            {/* Prospect Details Modal overlay */}
            {selectedProspect && (
                <ProspectViewerModal
                    prospect={selectedProspect}
                    onClose={() => setSelectedProspect(null)}
                    onConvert={() => {
                        setSelectedProspect(null);
                        if (onNavigation) onNavigation('students');
                    }}
                />
            )}
        </div>
    );
};

export default NotificationsPanel;
