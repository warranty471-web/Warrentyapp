import React, { useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { Mail, Lock, User, Eye, EyeOff, ShieldCheck, ArrowRight, Loader2 } from 'lucide-react';

export default function Auth() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setInfoMsg('');

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              phone: phone
            }
          }
        });
        if (error) throw error;
        
        if (data.user && data.session === null) {
          setInfoMsg('Registration successful! Please check your email to verify your account.');
        } else {
          setInfoMsg('Account created successfully! Logging you in...');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (err) {
      setErrorMsg(err.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMsg('');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (err) {
      setErrorMsg(err.message || 'Failed to initialize Google Login.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 bg-gradient-to-tr from-slate-900 via-slate-950 to-primary-950">
      
      {/* App Branding */}
      <div className="flex flex-col items-center mb-8 animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-primary-500/30 mb-3">
          <ShieldCheck className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          Warranty<span className="text-primary-400">Keep</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">Keep your assets covered and serviced</p>
      </div>

      {/* Auth Card */}
      <div className="w-full max-w-md bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl shadow-2xl p-6 md:p-8 animate-slide-up">
        
        {/* Tab Selector */}
        <div className="flex bg-slate-950/80 p-1 rounded-xl mb-6">
          <button
            onClick={() => { setIsSignUp(false); setErrorMsg(''); setInfoMsg(''); }}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${
              !isSignUp ? 'bg-primary-600 text-white shadow-md shadow-primary-600/10' : 'text-slate-400 hover:text-white'
            }`}
          >
            Log In
          </button>
          <button
            onClick={() => { setIsSignUp(true); setErrorMsg(''); setInfoMsg(''); }}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${
              isSignUp ? 'bg-primary-600 text-white shadow-md shadow-primary-600/10' : 'text-slate-400 hover:text-white'
            }`}
          >
            Sign Up
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-rose-500 rounded-full shrink-0"></span>
            <span>{errorMsg}</span>
          </div>
        )}

        {infoMsg && (
          <div className="mb-4 p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full shrink-0"></span>
            <span>{infoMsg}</span>
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          {isSignUp && (
            <>
              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950/40 border border-slate-800 text-white placeholder-slate-600 rounded-xl focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-sm transition-all"
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Phone Number (Optional)</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (555) 019-2834"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950/40 border border-slate-800 text-white placeholder-slate-600 rounded-xl focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-sm transition-all"
                  />
                </div>
              </div>
            </>
          )}

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950/40 border border-slate-800 text-white placeholder-slate-600 rounded-xl focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-sm transition-all"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-2.5 bg-slate-950/40 border border-slate-800 text-white placeholder-slate-600 rounded-xl focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-sm transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-slate-500 hover:text-slate-300"
              >
                {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-primary-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-primary-500 hover:to-indigo-500 transition-all flex items-center justify-center gap-2 tap-bounce disabled:opacity-75 disabled:active:scale-100 mt-2 cursor-pointer"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <span>{isSignUp ? 'Create Account' : 'Log In'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-6 flex items-center">
          <div className="flex-grow border-t border-slate-800"></div>
          <span className="flex-shrink mx-4 text-slate-600 text-xs font-semibold uppercase tracking-wider">or</span>
          <div className="flex-grow border-t border-slate-800"></div>
        </div>

        {/* Google Login Button */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          className="w-full py-2.5 bg-slate-950/80 border border-slate-800/80 text-white hover:bg-slate-950 font-medium rounded-xl transition-all flex items-center justify-center gap-3 tap-bounce cursor-pointer"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#EA4335"
              d="M12.24 10.285V14.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.859-3.578-7.859-8s3.53-8 7.859-8c2.46 0 4.105 1.025 5.047 1.926l3.227-3.1c-2.073-1.933-4.957-3.11-8.274-3.11-6.63 0-12 5.37-12 12s5.37 12 12 12c6.926 0 11.52-4.869 11.52-11.726 0-.788-.085-1.39-.188-1.99H12.24z"
            />
          </svg>
          <span className="text-sm">Continue with Google</span>
        </button>

        {/* Security & Trust Footer */}
        <div className="mt-8 pt-5 border-t border-slate-900 flex flex-col items-center gap-1.5 text-slate-500 text-[10px] sm:text-xs">
          <div className="flex items-center gap-1 font-medium text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Bank-Grade Document Protection</span>
          </div>
          <p className="text-center text-slate-600 px-2 leading-relaxed">
            All receipts and invoices are encrypted and stored in private, user-isolated folders. No other users can ever view your files.
          </p>
        </div>

      </div>
    </div>
  );
}
