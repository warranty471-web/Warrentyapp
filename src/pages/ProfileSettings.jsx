import React, { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { User, Phone, Mail, Bell, LogOut, CheckCircle, Loader2 } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function ProfileSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileId, setProfileId] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [emailRemindersEnabled, setEmailRemindersEnabled] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setEmail(user.email);
      setProfileId(user.id);

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        // If profile doesn't exist, create one using user meta data fallbacks
        const defaultName = user.user_metadata?.full_name || user.user_metadata?.name || 'New User';
        const defaultPhone = user.user_metadata?.phone || '';
        
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            full_name: defaultName,
            phone: defaultPhone,
            email_reminders_enabled: true
          })
          .select()
          .single();

        if (!createError && newProfile) {
          setFullName(newProfile.full_name);
          setPhone(newProfile.phone || '');
          setEmailRemindersEnabled(newProfile.email_reminders_enabled);
        }
      } else {
        setFullName(data.full_name);
        setPhone(data.phone || '');
        setEmailRemindersEnabled(data.email_reminders_enabled);
      }
    } catch (err) {
      console.error('Error fetching profile:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          phone: phone || null,
          email_reminders_enabled: emailRemindersEnabled
        })
        .eq('id', profileId);

      if (error) throw error;

      confetti({
        particleCount: 30,
        spread: 30,
        colors: ['#8b5cf6']
      });

      alert('Profile updated successfully!');
    } catch (err) {
      alert(`Error updating profile: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleLogOut = async () => {
    const confirmed = window.confirm('Are you sure you want to log out?');
    if (!confirmed) return;
    
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (err) {
      alert(`Error signing out: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center gap-2">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
        <span className="text-slate-500 text-sm font-semibold">Loading settings...</span>
      </div>
    );
  }

  return (
    <div className="pb-24 pt-4 px-4 max-w-lg mx-auto animate-fade-in">
      
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Profile & Settings</h1>
        <p className="text-xs text-slate-500">Manage account information & preferences</p>
      </div>

      <form onSubmit={handleUpdate} className="space-y-4">
        
        {/* Contact Info Card */}
        <div className="bg-white border border-slate-150 rounded-3xl p-5 shadow-sm space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Personal Details</h2>

          {/* Email (Read Only) */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Registered Email</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
              <input
                type="email"
                disabled
                value={email}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-150 text-slate-400 rounded-xl text-sm cursor-not-allowed"
              />
            </div>
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Full Name *</label>
            <div className="relative">
              <User className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Doe"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-900 rounded-xl focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-sm"
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Phone Number</label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 012-3456"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-900 rounded-xl focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Preferences Card */}
        <div className="bg-white border border-slate-150 rounded-3xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center text-primary-600 shrink-0">
                <Bell className="w-4.5 h-4.5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Email Reminders</h2>
                <p className="text-[10px] text-slate-500 mt-0.5">Receive alerts when warranties are expiring (30d and 7d)</p>
              </div>
            </div>

            {/* Toggle Switch */}
            <button
              type="button"
              onClick={() => setEmailRemindersEnabled(!emailRemindersEnabled)}
              className={`w-12 h-6.5 rounded-full p-1 transition-all duration-200 flex items-center shrink-0 cursor-pointer ${
                emailRemindersEnabled ? 'bg-primary-600 justify-end' : 'bg-slate-200 justify-start'
              }`}
            >
              <div className="w-4.5 h-4.5 bg-white rounded-full shadow-sm"></div>
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          {/* Save Profile Button */}
          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-primary-600 text-white font-semibold rounded-2xl hover:bg-primary-500 transition-all flex items-center justify-center gap-2 tap-bounce disabled:opacity-75 disabled:active:scale-100 cursor-pointer shadow-lg shadow-primary-600/10"
          >
            {saving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <CheckCircle className="w-4.5 h-4.5" />
                <span>Save Changes</span>
              </>
            )}
          </button>

          {/* Log Out Button */}
          <button
            type="button"
            onClick={handleLogOut}
            className="w-full py-3 bg-rose-50 border border-rose-100 hover:bg-rose-100/50 text-rose-700 font-semibold rounded-2xl transition-all flex items-center justify-center gap-2 tap-bounce cursor-pointer"
          >
            <LogOut className="w-4.5 h-4.5" />
            <span>Sign Out</span>
          </button>
        </div>

      </form>
    </div>
  );
}
