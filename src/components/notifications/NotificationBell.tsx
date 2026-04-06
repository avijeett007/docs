'use client';

import { useState, useEffect, useRef } from 'react';
import { FiBell, FiX, FiExternalLink, FiCheck } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error' | 'migration';
  priority: number;
  actionUrl?: string;
  actionText?: string;
  createdAt: string;
  isViewed: boolean;
}

interface NotificationBellProps {
  userId: string;
  userType: 'partner' | 'customer';
}

export default function NotificationBell({ userId, userType }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/notifications?userType=${userType}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem(userType === 'partner' ? 'partner_token' : 'customer_token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  // Mark notification as viewed
  const markAsViewed = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}/view?userType=${userType}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem(userType === 'partner' ? 'partner_token' : 'customer_token')}`
        }
      });

      if (response.ok) {
        setNotifications(prev => 
          prev.map(n => 
            n.id === notificationId ? { ...n, isViewed: true } : n
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking notification as viewed:', error);
    }
  };

  // Mark all as viewed
  const markAllAsViewed = async () => {
    try {
      const response = await fetch(`/api/notifications/mark-all-viewed?userType=${userType}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem(userType === 'partner' ? 'partner_token' : 'customer_token')}`
        }
      });

      if (response.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, isViewed: true })));
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error marking all notifications as viewed:', error);
    }
  };

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch notifications on mount
  useEffect(() => {
    fetchNotifications();
    
    // Poll for new notifications every 5 minutes
    const interval = setInterval(fetchNotifications, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [userId, userType]);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'warning':
        return '⚠️';
      case 'error':
        return '❌';
      case 'success':
        return '✅';
      case 'migration':
        return '🔄';
      default:
        return 'ℹ️';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'warning':
        return 'border-l-amber-500 bg-amber-50';
      case 'error':
        return 'border-l-red-500 bg-red-50';
      case 'success':
        return 'border-l-green-500 bg-green-50';
      case 'migration':
        return 'border-l-blue-500 bg-blue-50';
      default:
        return 'border-l-gray-500 bg-gray-50';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Icon */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 transition-colors"
      >
        <FiBell className="w-6 h-6" />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </motion.span>
        )}
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-96 overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Notifications</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsViewed}
                    className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    <FiCheck className="w-3 h-3" />
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FiX className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="max-h-80 overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center text-gray-500">
                  Loading notifications...
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <FiBell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No notifications yet</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`
                        p-4 hover:bg-gray-50 transition-colors cursor-pointer border-l-4
                        ${getNotificationColor(notification.type)}
                        ${!notification.isViewed ? 'bg-blue-50' : ''}
                      `}
                      onClick={() => {
                        if (!notification.isViewed) {
                          markAsViewed(notification.id);
                        }
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-lg flex-shrink-0 mt-0.5">
                          {getNotificationIcon(notification.type)}
                        </span>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className={`
                              text-sm font-medium text-gray-900 
                              ${!notification.isViewed ? 'font-semibold' : ''}
                            `}>
                              {notification.title}
                            </h4>
                            {!notification.isViewed && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1"></div>
                            )}
                          </div>
                          
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                            {notification.message}
                          </p>
                          
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-gray-500">
                              {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                            </span>
                            
                            {notification.actionUrl && notification.actionText && (
                              <a
                                href={notification.actionUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {notification.actionText}
                                <FiExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
