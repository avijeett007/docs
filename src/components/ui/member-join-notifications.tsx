import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLiveStats } from '../../context/LiveStatsContext';
import { Users, CheckCircle, Clock } from 'lucide-react';

interface RecentMember {
  name: string;
  type: 'waitlist' | 'partner';
  action: string;
  joinedAt: string;
}

interface MemberJoinNotificationProps {
  member: RecentMember;
  onComplete?: () => void;
}

const MemberJoinNotification: React.FC<MemberJoinNotificationProps> = ({
  member,
  onComplete
}) => {
  const [isDark, setIsDark] = useState(false);

  // Theme detection
  useEffect(() => {
    const checkTheme = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };

    checkTheme();

    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete?.();
    }, 5000); // Show for 5 seconds (longer since only one at a time)

    return () => clearTimeout(timer);
  }, [onComplete]);

  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const joinTime = new Date(dateString);
    const diffInMinutes = Math.floor((now.getTime() - joinTime.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const getIcon = () => {
    if (member.type === 'partner') {
      return <CheckCircle className="w-4 h-4 text-green-400" />;
    }
    return <Users className="w-4 h-4 text-blue-400" />;
  };

  const getBgGradient = () => {
    if (member.type === 'partner') {
      return 'from-green-900/20 to-emerald-900/20 border-green-400/30';
    }
    return 'from-blue-900/20 to-cyan-900/20 border-blue-400/30';
  };

  const getLightBgClasses = () => {
    if (member.type === 'partner') {
      return 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-300/50';
    }
    return 'bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-300/50';
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 300, scale: 0.8 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 300, scale: 0.8 }}
      transition={{ 
        type: "spring", 
        stiffness: 300, 
        damping: 30,
        opacity: { duration: 0.3 }
      }}
      className={`
        ${isDark
          ? `bg-gradient-to-r ${getBgGradient()} backdrop-blur-md border shadow-xl shadow-black/20`
          : `${getLightBgClasses()} backdrop-blur-md border shadow-xl shadow-gray-900/10`
        }
        rounded-xl p-4 max-w-sm w-full
      `}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {getIcon()}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className={`font-semibold text-sm truncate ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}>
              {member.name}
            </p>
            <div className={`flex items-center gap-1 text-xs ${
              isDark ? 'text-gray-400' : 'text-gray-500'
            }`}>
              <Clock className="w-3 h-3" />
              <span>{getTimeAgo(member.joinedAt)}</span>
            </div>
          </div>

          <p className={`text-xs ${
            isDark ? 'text-gray-300' : 'text-gray-600'
          }`}>
            {member.action}
          </p>
          
          {member.type === 'partner' && (
            <div className="mt-2 text-xs text-green-400 font-medium">
              🚀 Ready to scale Voice AI!
            </div>
          )}
        </div>
      </div>
      
      {/* Progress bar */}
      <motion.div
        className={`mt-3 h-1 rounded-full overflow-hidden ${
          isDark ? 'bg-gray-700' : 'bg-gray-200'
        }`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <motion.div
          className={`h-full ${member.type === 'partner' ? 'bg-green-400' : 'bg-blue-400'}`}
          initial={{ width: '100%' }}
          animate={{ width: '0%' }}
          transition={{ duration: 4, ease: "linear" }}
        />
      </motion.div>
    </motion.div>
  );
};

interface LiveMemberNotificationsProps {
  position?: 'top-right' | 'bottom-right' | 'top-left' | 'bottom-left';
  className?: string;
}

export const LiveMemberNotifications: React.FC<LiveMemberNotificationsProps> = ({
  position = 'bottom-right',
  className = ''
}) => {
  const [notifications, setNotifications] = useState<(RecentMember & { id: string })[]>([]);
  const [lastShownIndex, setLastShownIndex] = useState(-1);
  const [isMounted, setIsMounted] = useState(false);
  const { liveStats } = useLiveStats();

  // Get recent members from context
  const recentMembers = liveStats?.recentMembers || [];

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted || recentMembers.length === 0) return;

    // Show notifications one at a time (replace previous notification)
    const showNextNotification = () => {
      const nextIndex = (lastShownIndex + 1) % recentMembers.length;
      const member = recentMembers[nextIndex];

      if (member) {
        const notification = {
          ...member,
          id: `${member.name}-${Date.now()}-${Math.random()}`
        };

        // Replace all notifications with just this one (show only one at a time)
        setNotifications([notification]);
        setLastShownIndex(nextIndex);
      }
    };

    // Show first notification after 3 seconds
    const initialTimer = setTimeout(showNextNotification, 3000);

    // Then show subsequent notifications every 8 seconds (one at a time)
    const interval = setInterval(showNextNotification, 8000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [isMounted, recentMembers, lastShownIndex]);

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const getPositionClasses = () => {
    switch (position) {
      case 'top-right':
        return 'top-4 right-4';
      case 'top-left':
        return 'top-4 left-4';
      case 'bottom-left':
        return 'bottom-4 left-4';
      case 'bottom-right':
      default:
        return 'bottom-4 right-4';
    }
  };

  // Don't render anything until mounted to prevent hydration issues
  if (!isMounted) {
    return null;
  }

  return (
    <div className={`fixed ${getPositionClasses()} z-50 space-y-3 ${className}`}>
      <AnimatePresence mode="popLayout">
        {notifications.map((notification) => (
          <MemberJoinNotification
            key={notification.id}
            member={notification}
            onComplete={() => removeNotification(notification.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};
