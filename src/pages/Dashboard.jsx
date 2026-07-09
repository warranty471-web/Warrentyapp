import React, { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { getCategoryDetails, CATEGORIES } from '../utils/categoryHelper';
import { useNavigate, Link } from 'react-router-dom';
import { Search, Plus, Calendar, Shield, AlertTriangle, XCircle, SearchX, Inbox, ChevronRight } from 'lucide-react';

export default function Dashboard() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const navigate = useNavigate();

  // Statistics
  const [stats, setStats] = useState({
    active: 0,
    expiringSoon: 0,
    expired: 0
  });

  const fetchItems = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('user_id', user.id)
        .order('warranty_expiry_date', { ascending: true });

      if (error) throw error;
      
      setItems(data || []);
      calculateStats(data || []);
    } catch (err) {
      console.error('Error fetching items:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const calculateStats = (itemList) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    
    let active = 0;
    let expiringSoon = 0;
    let expired = 0;

    itemList.forEach(item => {
      const expiry = new Date(item.warranty_expiry_date);
      expiry.setHours(0,0,0,0);
      const diffTime = expiry - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        expired++;
      } else if (diffDays <= 30) {
        expiringSoon++;
      } else {
        active++;
      }
    });

    setStats({ active, expiringSoon, expired });
  };

  const getDaysLeft = (expiryDateStr) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const expiry = new Date(expiryDateStr);
    expiry.setHours(0,0,0,0);
    const diffTime = expiry - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getStatusConfig = (daysLeft) => {
    if (daysLeft < 0) {
      return { 
        text: 'Expired', 
        badgeColor: 'bg-rose-500/10 text-rose-600 border border-rose-500/20', 
        colorClass: 'rose',
        fillColor: 'bg-rose-500'
      };
    } else if (daysLeft < 15) {
      return { 
        text: `${daysLeft} days left`, 
        badgeColor: 'bg-rose-500/10 text-rose-600 border border-rose-500/20', 
        colorClass: 'rose',
        fillColor: 'bg-rose-500'
      };
    } else if (daysLeft <= 60) {
      return { 
        text: `${daysLeft} days left`, 
        badgeColor: 'bg-amber-500/10 text-amber-600 border border-amber-500/20', 
        colorClass: 'amber',
        fillColor: 'bg-amber-500'
      };
    } else {
      return { 
        text: `${daysLeft} days left`, 
        badgeColor: 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20', 
        colorClass: 'emerald',
        fillColor: 'bg-emerald-500'
      };
    }
  };

  // Filter items
  const filteredItems = items.filter(item => {
    const matchesSearch = 
      item.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.brand && item.brand.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.seller_store && item.seller_store.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="pb-24 pt-4 px-4 max-w-lg mx-auto animate-fade-in">
      
      {/* Welcome Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">WarrantyKeep</h1>
          <p className="text-xs text-slate-500">Track coverages and schedules</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center text-center">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-2">
            <Shield className="w-4 h-4 text-emerald-600" />
          </div>
          <span className="text-xl font-bold text-slate-800">{stats.active}</span>
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Active</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center text-center">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <span className="text-xl font-bold text-slate-800">{stats.expiringSoon}</span>
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Expiring 30d</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center text-center">
          <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center mb-2">
            <XCircle className="w-4 h-4 text-rose-600" />
          </div>
          <span className="text-xl font-bold text-slate-800">{stats.expired}</span>
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Expired</span>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative mb-5">
        <Search className="absolute left-3.5 top-3 w-4.5 h-4.5 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search name, brand, store..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 text-slate-900 rounded-xl focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 shadow-sm text-sm"
        />
      </div>

      {/* Categories Horizonal Scroll */}
      <div className="mb-6">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Categories</h2>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          <button
            onClick={() => setSelectedCategory('All')}
            className={`px-4 py-2 text-xs font-semibold rounded-full border transition-all shrink-0 cursor-pointer ${
              selectedCategory === 'All'
                ? 'bg-primary-600 border-primary-600 text-white shadow-sm'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            All Items
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 text-xs font-semibold rounded-full border transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-primary-600 border-primary-600 text-white shadow-sm'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <cat.icon className="w-3.5 h-3.5" />
              <span>{cat.id}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Item List Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">My Items ({filteredItems.length})</h2>
      </div>

      {/* Loader */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(n => (
            <div key={n} className="bg-white border border-slate-100 rounded-2xl p-4 h-24 animate-pulse-subtle">
              <div className="flex gap-3">
                <div className="w-12 h-12 bg-slate-150 rounded-xl"></div>
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-4 bg-slate-150 rounded w-3/4"></div>
                  <div className="h-3 bg-slate-150 rounded w-1/2"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        /* Empty State */
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 text-center flex flex-col items-center mt-6 animate-scale-up">
          <div className="w-20 h-20 rounded-full bg-primary-50 flex items-center justify-center mb-4">
            <Inbox className="w-10 h-10 text-primary-600" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">No items yet</h3>
          <p className="text-sm text-slate-500 max-w-xs mb-6">
            Add your first asset to start tracking its warranty coverage and service schedules.
          </p>
          <button
            onClick={() => navigate('/add')}
            className="px-6 py-3 bg-primary-600 text-white font-semibold rounded-xl shadow-lg shadow-primary-600/10 flex items-center gap-2 hover:bg-primary-500 tap-bounce cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add First Warranty</span>
          </button>
        </div>
      ) : filteredItems.length === 0 ? (
        /* No Search Results */
        <div className="text-center py-12 flex flex-col items-center">
          <SearchX className="w-12 h-12 text-slate-300 mb-3" />
          <p className="text-slate-500 text-sm">No items found matching your filters.</p>
        </div>
      ) : (
        /* Items Grid */
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const daysLeft = getDaysLeft(item.warranty_expiry_date);
            const status = getStatusConfig(daysLeft);
            const catDetails = getCategoryDetails(item.category);
            const Icon = catDetails.icon;

            return (
              <Link
                key={item.id}
                to={`/item/${item.id}`}
                className="block bg-white border border-slate-100 hover:border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 p-4 tap-bounce"
              >
                <div className="flex items-center gap-3">
                  {/* Category Icon */}
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${catDetails.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>

                  {/* Item Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-1">
                      <h3 className="font-bold text-slate-900 text-sm truncate">{item.item_name}</h3>
                      <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    </div>
                    <div className="flex items-center text-xs text-slate-500 mt-1 gap-1">
                      <span>{item.brand || 'No Brand'}</span>
                      <span>•</span>
                      <span className="truncate">{item.seller_store || 'Direct'}</span>
                    </div>
                  </div>
                </div>

                {/* Expiry Progress/Status */}
                <div className="mt-3.5 pt-3.5 border-t border-slate-50 flex items-center justify-between text-xs">
                  <div className="flex items-center text-slate-500 gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Expires: {new Date(item.warranty_expiry_date).toLocaleDateString()}</span>
                  </div>
                  
                  <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full ${status.badgeColor}`}>
                    {status.text}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Floating Add Button */}
      {items.length > 0 && (
        <button
          onClick={() => navigate('/add')}
          className="fixed bottom-24 right-6 w-14 h-14 rounded-full bg-primary-600 text-white flex items-center justify-center shadow-xl shadow-primary-600/30 hover:bg-primary-500 tap-bounce cursor-pointer z-40 border border-primary-500/20"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

    </div>
  );
}
