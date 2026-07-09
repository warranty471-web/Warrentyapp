import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../utils/supabaseClient';
import { getCategoryDetails } from '../utils/categoryHelper';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ChevronLeft, Edit2, Trash2, Calendar, IndianRupee, Tag, Info, AlertTriangle, CheckCircle, ShieldCheck, Hammer, FileDown, Loader2 } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function ItemDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [receiptUrl, setReceiptUrl] = useState('');
  const [showImageZoom, setShowImageZoom] = useState(false);
  const [completingService, setCompletingService] = useState(false);

  const fetchItemData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Fetch item
      const { data: itemData, error: itemError } = await supabase
        .from('items')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (itemError) throw itemError;
      setItem(itemData);

      // 2. Load receipt signed URL if it exists
      if (itemData.receipt_image_url) {
        const { data: signedData, error: signedError } = await supabase.storage
          .from('receipts')
          .createSignedUrl(itemData.receipt_image_url, 3600); // 1 hour validity
        
        if (!signedError && signedData) {
          setReceiptUrl(signedData.signedUrl);
        }
      }

      // 3. Fetch service schedules if any
      const { data: serviceData, error: serviceError } = await supabase
        .from('service_schedules')
        .select('*')
        .eq('item_id', id)
        .maybeSingle();

      if (!serviceError) {
        setService(serviceData);
      }
    } catch (err) {
      console.error('Error fetching item details:', err.message);
      alert('Failed to load item.');
      navigate('/');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    fetchItemData();
  }, [fetchItemData]);

  const handleDelete = async () => {
    const confirmed = window.confirm('Are you sure you want to delete this item? This will also remove any related service schedules.');
    if (!confirmed) return;

    try {
      // If there's an image in storage, delete it as well
      if (item.receipt_image_url) {
        await supabase.storage.from('receipts').remove([item.receipt_image_url]);
      }

      const { error } = await supabase
        .from('items')
        .delete()
        .eq('id', id);

      if (error) throw error;

      navigate('/');
    } catch (err) {
      alert(`Error deleting item: ${err.message}`);
    }
  };

  const handleLogServiceDone = async () => {
    if (!service) return;
    setCompletingService(true);

    try {
      const today = new Date().toISOString().split('T')[0];
      const nextDateObj = new Date();
      nextDateObj.setMonth(nextDateObj.getMonth() + parseInt(service.frequency_months));
      const nextServiceDate = nextDateObj.toISOString().split('T')[0];

      const { error } = await supabase
        .from('service_schedules')
        .update({
          last_service_date: today,
          next_service_date: nextServiceDate
        })
        .eq('id', service.id);

      if (error) throw error;

      // Update local state
      setService({
        ...service,
        last_service_date: today,
        next_service_date: nextServiceDate
      });

      confetti({
        particleCount: 50,
        spread: 40,
        colors: ['#8b5cf6', '#10b981', '#3b82f6']
      });

      alert('Service marked as complete! Next schedule has been updated.');
    } catch (err) {
      alert(`Error updating service log: ${err.message}`);
    } finally {
      setCompletingService(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center gap-2">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
        <span className="text-slate-500 text-sm font-semibold">Loading details...</span>
      </div>
    );
  }

  if (!item) return null;

  // Calculate Expiry Details
  const today = new Date();
  today.setHours(0,0,0,0);
  const expiry = new Date(item.warranty_expiry_date);
  expiry.setHours(0,0,0,0);
  const diffTime = expiry - today;
  const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let statusText = '';
  let statusBanner = '';
  let statusIcon = null;

  if (daysLeft < 0) {
    statusText = 'Expired';
    statusBanner = 'bg-rose-50 border-rose-100 text-rose-700';
    statusIcon = <AlertTriangle className="w-5 h-5 text-rose-500" />;
  } else if (daysLeft < 15) {
    statusText = `Expiring soon (${daysLeft} days left)`;
    statusBanner = 'bg-rose-50 border-rose-100 text-rose-700';
    statusIcon = <AlertTriangle className="w-5 h-5 text-rose-500 animate-pulse" />;
  } else if (daysLeft <= 60) {
    statusText = `Active Coverage (${daysLeft} days left)`;
    statusBanner = 'bg-amber-50 border-amber-100 text-amber-800';
    statusIcon = <AlertTriangle className="w-5 h-5 text-amber-500" />;
  } else {
    statusText = `Active Coverage (${daysLeft} days left)`;
    statusBanner = 'bg-emerald-50 border-emerald-100 text-emerald-800';
    statusIcon = <ShieldCheck className="w-5 h-5 text-emerald-600" />;
  }

  const catDetails = getCategoryDetails(item.category);

  return (
    <div className="pb-24 pt-4 px-4 max-w-lg mx-auto animate-fade-in">
      
      {/* Header Navigation */}
      <div className="flex items-center justify-between mb-6">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center shadow-sm tap-bounce"
        >
          <ChevronLeft className="w-5 h-5 text-slate-700" />
        </button>

        <div className="flex gap-2">
          <Link
            to={`/edit/${item.id}`}
            className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center shadow-sm text-slate-600 hover:text-primary-600 tap-bounce"
          >
            <Edit2 className="w-4 h-4" />
          </Link>
          <button
            onClick={handleDelete}
            className="w-10 h-10 rounded-xl bg-white border border-rose-50 flex items-center justify-center shadow-sm text-rose-600 hover:text-rose-500 tap-bounce cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Warranty Status Banner */}
      <div className={`p-4 border rounded-2xl flex items-center gap-3 mb-6 shadow-sm ${statusBanner}`}>
        {statusIcon}
        <div>
          <h2 className="text-sm font-bold">{statusText}</h2>
          <p className="text-[11px] opacity-80 mt-0.5">Expires: {new Date(item.warranty_expiry_date).toLocaleDateString()}</p>
        </div>
      </div>

      {/* Main Info Card */}
      <div className="bg-white border border-slate-150 rounded-3xl p-5 shadow-sm space-y-5 mb-5">
        
        {/* Title and Category */}
        <div className="flex items-center gap-3.5 pb-4 border-b border-slate-50">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${catDetails.color}`}>
            <catDetails.icon className="w-5.5 h-5.5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-slate-900 truncate">{item.item_name}</h1>
            <span className="inline-block text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full mt-1">
              {item.category}
            </span>
          </div>
        </div>

        {/* Form Grid */}
        <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
          
          {/* Brand */}
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Brand</span>
            <span className="font-semibold text-slate-700 flex items-center gap-1">
              <Tag className="w-3.5 h-3.5 text-slate-400" />
              {item.brand || '—'}
            </span>
          </div>

          {/* Price */}
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Purchase Price</span>
            <span className="font-semibold text-slate-700 flex items-center gap-0.5">
              <IndianRupee className="w-3.5 h-3.5 text-slate-400" />
              {item.purchase_price ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(item.purchase_price) : '—'}
            </span>
          </div>

          {/* Purchase Date */}
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Purchase Date</span>
            <span className="font-semibold text-slate-700 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              {new Date(item.purchase_date).toLocaleDateString()}
            </span>
          </div>

          {/* Warranty Duration */}
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Warranty Period</span>
            <span className="font-semibold text-slate-700 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
              {item.warranty_period_months} Months
            </span>
          </div>

          {/* Store */}
          <div className="flex flex-col col-span-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Purchased From</span>
            <span className="font-semibold text-slate-700 truncate">
              {item.seller_store || '—'}
            </span>
          </div>
        </div>

        {/* Notes */}
        {item.notes && (
          <div className="pt-4 border-t border-slate-50 flex gap-2 text-xs">
            <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <div className="text-slate-600 leading-relaxed">
              <p className="font-bold text-[10px] uppercase tracking-wider text-slate-400 mb-1">Notes</p>
              {item.notes}
            </div>
          </div>
        )}
      </div>

      {/* Service Schedule Section */}
      {service && (
        <div className="bg-white border border-slate-150 rounded-3xl p-5 shadow-sm space-y-4 mb-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Hammer className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Service schedule</h2>
              <p className="text-[10px] text-slate-400">Recurring maintenance checks</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs pt-2 border-t border-slate-50">
            <div>
              <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Service Task</span>
              <span className="font-bold text-slate-800">{service.service_type}</span>
            </div>
            <div>
              <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Frequency</span>
              <span className="font-bold text-slate-800">Every {service.frequency_months} Months</span>
            </div>
            <div>
              <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Last Done</span>
              <span className="font-bold text-slate-600">
                {service.last_service_date ? new Date(service.last_service_date).toLocaleDateString() : 'Never logged'}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Next Service Due</span>
              <span className="font-bold text-primary-600">
                {new Date(service.next_service_date).toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* Action Log Done */}
          <button
            onClick={handleLogServiceDone}
            disabled={completingService}
            className="w-full py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
          >
            {completingService ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                <span>Mark Service as Complete Today</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Receipt Preview Section */}
      {receiptUrl && (
        <div className="bg-white border border-slate-150 rounded-3xl p-5 shadow-sm">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">Receipt Document</span>
          <div 
            onClick={() => setShowImageZoom(true)}
            className="border border-slate-100 rounded-2xl overflow-hidden cursor-pointer relative group max-h-[220px]"
          >
            {receiptUrl.includes('.pdf') ? (
              <div className="p-8 text-center flex flex-col items-center justify-center bg-slate-50 min-h-[140px]">
                <FileDown className="w-10 h-10 text-slate-400 mb-2" />
                <span className="text-xs font-semibold text-slate-700">PDF Receipt Loaded</span>
                <span className="text-[10px] text-slate-400 mt-1">Tap to download / view full document</span>
              </div>
            ) : (
              <>
                <img
                  src={receiptUrl}
                  alt="Receipt Preview"
                  className="w-full object-cover max-h-[220px]"
                />
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="bg-black/60 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl backdrop-blur-sm">Tap to Zoom</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Image Zoom Modal */}
      {showImageZoom && receiptUrl && (
        <div 
          onClick={() => setShowImageZoom(false)}
          className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in"
        >
          <button 
            onClick={() => setShowImageZoom(false)}
            className="absolute top-6 right-6 text-white/80 hover:text-white font-bold text-sm bg-white/10 px-3.5 py-2 rounded-xl backdrop-blur-sm shadow-md"
          >
            Close
          </button>
          
          {receiptUrl.includes('.pdf') ? (
            <div className="bg-white rounded-3xl p-6 text-center max-w-sm" onClick={e => e.stopPropagation()}>
              <FileDown className="w-12 h-12 text-primary-600 mx-auto mb-3" />
              <h3 className="font-bold text-slate-900 mb-1">Download PDF Receipt</h3>
              <p className="text-slate-500 text-xs mb-4">View the PDF receipt document in a new window.</p>
              <a 
                href={receiptUrl} 
                target="_blank" 
                rel="noreferrer"
                className="inline-block px-5 py-2.5 bg-primary-600 hover:bg-primary-500 text-white font-bold text-sm rounded-xl"
              >
                Open PDF File
              </a>
            </div>
          ) : (
            <img
              src={receiptUrl}
              alt="Zoomed Receipt"
              className="max-w-full max-h-[85vh] object-contain rounded-lg animate-scale-up"
              onClick={e => e.stopPropagation()}
            />
          )}
        </div>
      )}

    </div>
  );
}
