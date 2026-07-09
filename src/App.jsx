import React, { useEffect, useState, useCallback } from 'react';
import { HashRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { supabase } from './utils/supabaseClient';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import AddEditItem from './pages/AddEditItem';
import ItemDetail from './pages/ItemDetail';
import Notifications from './pages/Notifications';
import ProfileSettings from './pages/ProfileSettings';
import { Shield, Home, Bell, User, PlusCircle, Loader2 } from 'lucide-react';

// Bottom Navigation Wrapper Component
function MainLayout({ children, unreadCount }) {
  const location = useLocation();
  const currentPath = location.pathname;

  // Paths that display the persistent bottom navigation bar
  const showNav = ['/', '/notifications', '/profile'].includes(currentPath);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      
      {/* App Main View */}
      <div className="flex-1 w-full max-w-lg mx-auto bg-slate-50">
        {children}
      </div>

      {/* Floating Bottom Nav Bar */}
      {showNav && (
        <nav className="fixed bottom-0 left-0 right-0 h-20 bg-white/90 backdrop-blur-lg border-t border-slate-100 flex items-center justify-around px-6 z-40 pb-2 shadow-2xl max-w-lg mx-auto">
          {/* Dashboard Tab */}
          <Link
            to="/"
            className={`flex flex-col items-center justify-center w-12 h-12 rounded-2xl transition-all ${
              currentPath === '/' ? 'text-primary-600 bg-primary-50/50 scale-105' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Home className="w-5.5 h-5.5" />
            <span className="text-[10px] font-bold mt-1">Home</span>
          </Link>

          {/* Add Item Tab (Prominent Middle Button) */}
          <Link
            to="/add"
            className="flex flex-col items-center justify-center w-14 h-14 bg-gradient-to-tr from-primary-600 to-indigo-600 rounded-full text-white shadow-lg shadow-primary-500/20 active:scale-95 transition-all -translate-y-4 border-4 border-slate-50"
          >
            <PlusCircle className="w-6 h-6" />
          </Link>

          {/* Notifications Tab */}
          <Link
            to="/notifications"
            className={`flex flex-col items-center justify-center w-12 h-12 rounded-2xl transition-all relative ${
              currentPath === '/notifications' ? 'text-primary-600 bg-primary-50/50 scale-105' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Bell className="w-5.5 h-5.5" />
            <span className="text-[10px] font-bold mt-1">Reminders</span>
            
            {/* Unread Red Badge */}
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border border-white animate-pulse-subtle">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>

          {/* Profile Tab */}
          <Link
            to="/profile"
            className={`flex flex-col items-center justify-center w-12 h-12 rounded-2xl transition-all ${
              currentPath === '/profile' ? 'text-primary-600 bg-primary-50/50 scale-105' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <User className="w-5.5 h-5.5" />
            <span className="text-[10px] font-bold mt-1">Profile</span>
          </Link>
        </nav>
      )}

    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  // Auto-verify and create profile if missing (e.g. user existed before migration)
  const ensureProfileExists = useCallback(async (user) => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      if (!data && !error) {
        const defaultName = user.user_metadata?.full_name || user.user_metadata?.name || 'New User';
        const defaultPhone = user.user_metadata?.phone || '';
        await supabase
          .from('profiles')
          .insert({
            id: user.id,
            full_name: defaultName,
            phone: defaultPhone,
            email_reminders_enabled: true
          });
        console.log('Profile created successfully on-demand for user:', user.id);
      }
    } catch (e) {
      console.warn('Error verifying or creating profile:', e);
    }
  }, []);

  // Fetch unread count for notifications log badge
  const fetchUnreadCount = useCallback(async (userId) => {
    try {
      const targetUserId = userId || session?.user?.id;
      if (!targetUserId) return;

      const { count, error } = await supabase
        .from('notifications_log')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', targetUserId)
        .eq('read', false);

      if (!error) {
        setUnreadNotifications(count || 0);
      }
    } catch (e) {
      console.warn('Error fetching unread notification counts:', e);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    // 1. Fetch current active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoadingAuth(false);
      if (session?.user) {
        ensureProfileExists(session.user);
        fetchUnreadCount(session.user.id);
      }
    });

    // 2. Listen to authentication state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoadingAuth(false);
      if (session?.user) {
        ensureProfileExists(session.user);
        fetchUnreadCount(session.user.id);
      } else {
        setUnreadNotifications(0);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchUnreadCount, ensureProfileExists]);

  // Real-time subscription to notification table updates
  useEffect(() => {
    if (!session?.user?.id) return;

    const channel = supabase
      .channel('realtime_notifications')
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'notifications_log',
          filter: `user_id=eq.${session.user.id}`
        },
        () => {
          fetchUnreadCount(session.user.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id, fetchUnreadCount]);

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-primary-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-primary-500/20">
          <Shield className="w-7 h-7 text-white" />
        </div>
        <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold">
          <Loader2 className="w-4 h-4 animate-spin text-primary-500" />
          <span>Securing session...</span>
        </div>
      </div>
    );
  }

  return (
    <HashRouter>
      <Routes>
        {/* Auth Screen Routing */}
        <Route 
          path="/auth" 
          element={!session ? <Auth /> : <Navigate to="/" replace />} 
        />

        {/* Protected App Views */}
        <Route
          path="/*"
          element={
            session ? (
              <MainLayout unreadCount={unreadNotifications}>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/add" element={<AddEditItem />} />
                  <Route path="/edit/:id" element={<AddEditItem />} />
                  <Route path="/item/:id" element={<ItemDetail />} />
                  <Route path="/notifications" element={<Notifications />} />
                  <Route path="/profile" element={<ProfileSettings />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </MainLayout>
            ) : (
              <Navigate to="/auth" replace />
            )
          }
        />
      </Routes>
    </HashRouter>
  );
}
