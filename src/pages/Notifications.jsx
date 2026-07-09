import React, { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { getCategoryDetails } from '../utils/categoryHelper';
import { BellOff, CheckCheck, Calendar, ChevronRight, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('notifications_log')
        .select(`
          id,
          type,
          sent_at,
          read,
          item_id,
          items (
            item_name,
            category
          )
        `)
        .eq('user_id', user.id)
        .order('sent_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (err) {
      console.error('Error fetching notifications:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id, currentReadState) => {
    if (currentReadState) return; // already read

    try {
      const { error } = await supabase
        .from('notifications_log')
        .update({ read: true })
        .eq('id', id);

      if (error) throw error;

      // Update state locally
      setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (err) {
      console.error('Error marking notification as read:', err.message);
    }
  };

  const handleMarkAllRead = async () => {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
    if (unreadIds.length === 0) return;

    setMarkingAll(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('notifications_log')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);

      if (error) throw error;

      setNotifications(notifications.map(n => ({ ...n, read: true })));
    } catch (err) {
      console.error('Error marking all as read:', err.message);
    } finally {
      setMarkingAll(false);
    }
  };

  const getNotificationText = (notif) => {
    const itemName = notif.items ? notif.items.item_name : 'an asset';
    if (notif.type === 'warranty_expiring') {
      return {
        title: 'Warranty expiring soon',
        body: `The warranty coverage for "${itemName}" is nearing its expiration date. Check coverage details to prepare any claims.`,
        colorClass: 'text-amber-600',
        bgClass: 'bg-amber-500/10'
      };
    } else if (notif.type === 'service_due') {
      return {
        title: 'Service Maintenance Due',
        body: `Your scheduled service for "${itemName}" is due. Please perform the check and update the logs.`,
        colorClass: 'text-indigo-600',
        bgClass: 'bg-indigo-500/10'
      };
    }
    return {
      title: 'Reminder Alert',
      body: `Notification for "${itemName}" requires your attention.`,
      colorClass: 'text-slate-600',
      bgClass: 'bg-slate-500/10'
    };
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="pb-24 pt-4 px-4 max-w-lg mx-auto animate-fade-in">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <span>Notifications</span>
            {unreadCount > 0 && (
              <span className="text-xs bg-primary-600 text-white px-2 py-0.5 rounded-full font-bold">
                {unreadCount} new
              </span>
            )}
          </h1>
          <p className="text-xs text-slate-500">Stay updated on coverage & schedules</p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            disabled={markingAll}
            className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-500 font-bold border border-slate-100 bg-white shadow-sm px-3 py-1.5 rounded-xl cursor-pointer disabled:opacity-50"
          >
            {markingAll ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <>
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark all read</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Loader */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(n => (
            <div key={n} className="bg-white border border-slate-100 rounded-2xl p-4 h-24 animate-pulse-subtle"></div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        /* Empty State */
        <div className="bg-white border border-slate-100 rounded-3xl p-8 text-center flex flex-col items-center shadow-sm">
          <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
            <BellOff className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-sm font-bold text-slate-950">All caught up</h3>
          <p className="text-xs text-slate-500 max-w-xs mt-1.5 leading-relaxed">
            No warranty or service reminders to show. We'll alert you here when coverages are expiring or services are due.
          </p>
        </div>
      ) : (
        /* Notifications List */
        <div className="space-y-2.5">
          {notifications.map((notif) => {
            const config = getNotificationText(notif);
            const catDetails = getCategoryDetails(notif.items?.category);
            const Icon = catDetails.icon;

            return (
              <div
                key={notif.id}
                onClick={() => handleMarkAsRead(notif.id, notif.read)}
                className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer flex gap-3 relative ${
                  notif.read 
                    ? 'bg-white border-slate-100 opacity-75' 
                    : 'bg-slate-50 border-primary-100/60 shadow-sm shadow-primary-500/5'
                }`}
              >
                {/* Visual Unread dot */}
                {!notif.read && (
                  <span className="absolute top-4 right-4 w-2 h-2 bg-primary-600 rounded-full"></span>
                )}

                {/* Category Icon */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${catDetails.color}`}>
                  <Icon className="w-5 h-5" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-1 pr-4">
                    <h3 className={`text-xs font-bold text-slate-900 ${!notif.read ? 'text-slate-950 font-extrabold' : ''}`}>
                      {config.title}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {config.body}
                  </p>
                  
                  <div className="flex items-center justify-between mt-3 text-[10px] text-slate-400 font-semibold">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(notif.sent_at).toLocaleString()}
                    </span>

                    {notif.item_id && (
                      <Link
                        to={`/item/${notif.item_id}`}
                        onClick={(e) => e.stopPropagation()} // avoid parent click trigger
                        className="text-primary-600 hover:text-primary-500 font-bold flex items-center gap-0.5"
                      >
                        <span>View Asset</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
