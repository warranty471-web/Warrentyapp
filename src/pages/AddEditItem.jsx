import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../utils/supabaseClient';
import { CATEGORIES } from '../utils/categoryHelper';
import { useNavigate, useParams } from 'react-router-dom';
import { Camera, IndianRupee, ShoppingBag, FileText, ChevronLeft, Loader2, Sparkles, Lock } from 'lucide-react';
import confetti from 'canvas-confetti';

// Client-side image compressor to prevent Supabase storage limits from filling up
const compressImage = (file, maxWidth = 1200, maxHeight = 1200, quality = 0.7) => {
  return new Promise((resolve) => {
    // If file is not an image (like a PDF), skip compression
    if (!file.type.startsWith('image/')) {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Maintain aspect ratio while resizing
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
  });
};

export default function AddEditItem() {
  const { id } = useParams(); // For Edit mode
  const isEditMode = !!id;
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEditMode);

  // Form Fields - Item
  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState('Electronics');
  const [brand, setBrand] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [warrantyMonths, setWarrantyMonths] = useState(12);
  const [purchasePrice, setPurchasePrice] = useState('');
  const [sellerStore, setSellerStore] = useState('');
  const [notes, setNotes] = useState('');
  
  // Image Upload State
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [existingImageUrl, setExistingImageUrl] = useState('');

  // Service Reminder State
  const [hasServiceReminder, setHasServiceReminder] = useState(false);
  const [serviceType, setServiceType] = useState('AC Service');
  const [frequencyMonths, setFrequencyMonths] = useState(6);
  const [lastServiceDate, setLastServiceDate] = useState('');
  const [nextServiceDate, setNextServiceDate] = useState('');

  // Existing service schedule ID (if in Edit mode)
  const [existingServiceId, setExistingServiceId] = useState(null);

  const fetchItemData = useCallback(async () => {
    try {
      setInitialLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Fetch item
      const { data: item, error: itemError } = await supabase
        .from('items')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (itemError) throw itemError;

      setItemName(item.item_name);
      setCategory(item.category);
      setBrand(item.brand || '');
      setPurchaseDate(item.purchase_date);
      setWarrantyMonths(item.warranty_period_months);
      setPurchasePrice(item.purchase_price || '');
      setSellerStore(item.seller_store || '');
      setNotes(item.notes || '');
      setExistingImageUrl(item.receipt_image_url || '');

      // Load signed URL for image preview if it exists
      if (item.receipt_image_url) {
        const { data: signedData, error: signedError } = await supabase.storage
          .from('receipts')
          .createSignedUrl(item.receipt_image_url, 3600); // 1 hour validity
        if (!signedError && signedData) {
          setImagePreview(signedData.signedUrl);
        }
      }

      // 2. Fetch service schedule if exists
      const { data: service, error: serviceError } = await supabase
        .from('service_schedules')
        .select('*')
        .eq('item_id', id)
        .maybeSingle();

      if (!serviceError && service) {
        setHasServiceReminder(true);
        setExistingServiceId(service.id);
        setServiceType(service.service_type);
        setFrequencyMonths(service.frequency_months);
        setLastServiceDate(service.last_service_date || '');
        setNextServiceDate(service.next_service_date);
      }
    } catch (err) {
      console.error('Error fetching item details:', err.message);
      alert('Failed to load item details.');
      navigate('/');
    } finally {
      setInitialLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    if (isEditMode) {
      fetchItemData();
    }
  }, [isEditMode, fetchItemData]);

  // If frequency_months or lastServiceDate changes, auto-calculate nextServiceDate
  useEffect(() => {
    const baseDateStr = lastServiceDate || purchaseDate;
    if (!baseDateStr || !frequencyMonths) return;

    try {
      const baseDate = new Date(baseDateStr);
      baseDate.setMonth(baseDate.getMonth() + parseInt(frequencyMonths));
      setNextServiceDate(baseDate.toISOString().split('T')[0]);
    } catch {
      // Ignore conversion errors
    }
  }, [frequencyMonths, lastServiceDate, purchaseDate]);

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setLoading(true);
      try {
        const compressed = await compressImage(file);
        setImageFile(compressed);
        setImagePreview(URL.createObjectURL(compressed));
        console.log(`PWA Storage: Compressed from ${(file.size / 1024).toFixed(1)} KB to ${(compressed.size / 1024).toFixed(1)} KB`);
      } catch (err) {
        console.warn("Image compression failed, using original file:", err);
        setImageFile(file);
        setImagePreview(URL.createObjectURL(file));
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let receiptPath = existingImageUrl;

      // 1. Upload receipt image if file is selected
      if (imageFile) {
        // Clean filename, make it unique
        const fileExt = imageFile.name.split('.').pop();
        const filename = `${Date.now()}.${fileExt}`;
        const uploadPath = `${user.id}/${filename}`;

        const { error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(uploadPath, imageFile, {
            cacheControl: '3600',
            upsert: true
          });

        if (uploadError) throw uploadError;
        receiptPath = uploadPath;
      }

      const itemPayload = {
        user_id: user.id,
        item_name: itemName,
        category,
        brand: brand || null,
        purchase_date: purchaseDate,
        warranty_period_months: parseInt(warrantyMonths),
        receipt_image_url: receiptPath || null,
        purchase_price: purchasePrice ? parseFloat(purchasePrice) : null,
        seller_store: sellerStore || null,
        notes: notes || null,
      };

      let itemId = id;

      // 2. Insert or Update Items Table
      if (isEditMode) {
        const { error: updateError } = await supabase
          .from('items')
          .update(itemPayload)
          .eq('id', id);
        
        if (updateError) throw updateError;
      } else {
        const { data: newItem, error: insertError } = await supabase
          .from('items')
          .insert(itemPayload)
          .select('id')
          .single();

        if (insertError) throw insertError;
        itemId = newItem.id;
      }

      // 3. Insert or Update Service Schedules Table
      if (hasServiceReminder) {
        const servicePayload = {
          item_id: itemId,
          service_type: serviceType,
          frequency_months: parseInt(frequencyMonths),
          last_service_date: lastServiceDate || null,
          next_service_date: nextServiceDate,
        };

        if (existingServiceId) {
          const { error: serviceUpdateError } = await supabase
            .from('service_schedules')
            .update(servicePayload)
            .eq('id', existingServiceId);
          if (serviceUpdateError) throw serviceUpdateError;
        } else {
          const { error: serviceInsertError } = await supabase
            .from('service_schedules')
            .insert(servicePayload);
          if (serviceInsertError) throw serviceInsertError;
        }
      } else if (existingServiceId) {
        // If they toggled reminder off, delete the existing schedule
        const { error: serviceDeleteError } = await supabase
          .from('service_schedules')
          .delete()
          .eq('id', existingServiceId);
        if (serviceDeleteError) throw serviceDeleteError;
      }

      // Trigger Confetti Celebration
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.8 }
      });

      navigate(isEditMode ? `/item/${itemId}` : '/');
    } catch (err) {
      alert(`Error saving item: ${err.message}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center gap-2">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
        <span className="text-slate-500 text-sm font-semibold">Loading details...</span>
      </div>
    );
  }

  return (
    <div className="pb-24 pt-4 px-4 max-w-lg mx-auto animate-fade-in">
      
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center shadow-sm tap-bounce"
        >
          <ChevronLeft className="w-5 h-5 text-slate-700" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-900">{isEditMode ? 'Edit Warranty' : 'Add Warranty'}</h1>
          <p className="text-xs text-slate-500">Track and protect your assets</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        
        {/* Receipt Image Upload */}
        <div className="bg-white border border-slate-150 rounded-3xl p-5 shadow-sm">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Receipt Photo</label>
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 hover:border-primary-400 bg-slate-50 rounded-2xl p-4 transition-all relative overflow-hidden group min-h-[160px]">
            {imagePreview ? (
              <>
                <img
                  src={imagePreview}
                  alt="Receipt Preview"
                  className="w-full max-h-[180px] object-contain rounded-lg"
                />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="bg-white/90 text-slate-900 px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md">
                    <Camera className="w-3.5 h-3.5" />
                    Change Receipt
                  </span>
                </div>
              </>
            ) : (
              <div className="text-center flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center mb-2.5">
                  <Camera className="w-5 h-5 text-slate-400" />
                </div>
                <span className="text-xs font-semibold text-slate-600">Take Photo or Upload Receipt</span>
                <span className="text-[10px] text-slate-400 mt-1">JPEG, PNG or PDF (Max 5MB)</span>
              </div>
            )}
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={handleImageChange}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
          </div>
          <p className="text-[10px] text-slate-400 mt-2 flex items-center justify-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>Documents are encrypted and stored in private user-isolated folders.</span>
          </p>
        </div>

        {/* Item Details Form */}
        <div className="bg-white border border-slate-150 rounded-3xl p-5 shadow-sm space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Asset Information</h2>

          {/* Item Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Item Name *</label>
            <input
              type="text"
              required
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="e.g. Smart Washing Machine"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-900 rounded-xl focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Category */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Category *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 text-slate-900 rounded-xl focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-sm"
              >
                {CATEGORIES.map(c => (
                  <option key={c.id} value={c.id}>{c.id}</option>
                ))}
              </select>
            </div>

            {/* Brand */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Brand</label>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="e.g. LG, Samsung"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-900 rounded-xl focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Purchase Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Purchase Date *</label>
              <div className="relative">
                <input
                  type="date"
                  required
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 text-slate-900 rounded-xl focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-sm"
                />
              </div>
            </div>

            {/* Warranty Period in Months */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Warranty (Months) *</label>
              <input
                type="number"
                required
                min="1"
                value={warrantyMonths}
                onChange={(e) => setWarrantyMonths(e.target.value)}
                placeholder="e.g. 12"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-900 rounded-xl focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Purchase Price */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Price (₹)</label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="number"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  placeholder="2999"
                  className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-900 rounded-xl focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-sm"
                />
              </div>
            </div>

            {/* Seller Store */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Seller / Store</label>
              <div className="relative">
                <ShoppingBag className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={sellerStore}
                  onChange={(e) => setSellerStore(e.target.value)}
                  placeholder="Amazon, Best Buy"
                  className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-900 rounded-xl focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Notes / Details</label>
            <div className="relative">
              <FileText className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Serial numbers, customer service numbers, claims website, or extensions..."
                rows="3"
                className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-900 rounded-xl focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Service Schedule Section */}
        <div className="bg-white border border-slate-150 rounded-3xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Service Reminders</h2>
              <p className="text-[10px] text-slate-500 mt-0.5">Automated schedules & notifications</p>
            </div>
            
            {/* Toggle Switch */}
            <button
              type="button"
              onClick={() => setHasServiceReminder(!hasServiceReminder)}
              className={`w-12 h-6.5 rounded-full p-1 transition-all duration-200 flex items-center shrink-0 cursor-pointer ${
                hasServiceReminder ? 'bg-primary-600 justify-end' : 'bg-slate-200 justify-start'
              }`}
            >
              <div className="w-4.5 h-4.5 bg-white rounded-full shadow-sm"></div>
            </button>
          </div>

          {hasServiceReminder && (
            <div className="space-y-4 pt-2 border-t border-slate-50 animate-fade-in">
              {/* Service Type */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Service Type *</label>
                <input
                  type="text"
                  required
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                  placeholder="e.g. AC Filter Clean, Oil Change, Tire Rotation"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-900 rounded-xl focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Frequency */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Frequency (Months) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={frequencyMonths}
                    onChange={(e) => setFrequencyMonths(e.target.value)}
                    placeholder="e.g. 6"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-900 rounded-xl focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-sm"
                  />
                </div>

                {/* Last Service Date */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Last Serviced (Optional)</label>
                  <input
                    type="date"
                    value={lastServiceDate}
                    onChange={(e) => setLastServiceDate(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 text-slate-900 rounded-xl focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-sm"
                  />
                </div>
              </div>

              {/* Next Service Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Auto-Calculated Next Service *</label>
                <input
                  type="date"
                  required
                  value={nextServiceDate}
                  onChange={(e) => setNextServiceDate(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-primary-500 text-slate-900 rounded-xl focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-sm"
                />
              </div>
            </div>
          )}
        </div>

        {/* Save Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-gradient-to-r from-primary-600 to-indigo-600 text-white font-semibold rounded-2xl hover:from-primary-500 hover:to-indigo-500 transition-all flex items-center justify-center gap-2 tap-bounce disabled:opacity-75 disabled:active:scale-100 cursor-pointer shadow-lg shadow-primary-500/10"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Sparkles className="w-4.5 h-4.5" />
              <span>{isEditMode ? 'Update Warranty' : 'Add to Collection'}</span>
            </>
          )}
        </button>

      </form>
    </div>
  );
}
