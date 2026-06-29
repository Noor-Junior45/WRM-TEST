import React, { useState, useEffect } from 'react';
import { Customer, Sale, Payment, CartItem } from '../types';
import { Card, Button, Input, Badge } from '../components/UI';
import { 
  Store, MapPin, Phone, Mail, User, Clock, CheckCircle2, 
  ExternalLink, ChevronDown, ChevronUp, AlertCircle, Sparkles, 
  CreditCard, Clipboard, Smartphone, QrCode, FileText, Check, ArrowLeft, Receipt
} from 'lucide-react';

interface CustomerPortalData {
  customer: Customer;
  sales: Sale[];
  settings: {
    storeName: string;
    storeAddress: string;
    storePhone: string;
    storeEmail?: string;
    logo?: string;
    currencySymbol: string;
    upiId?: string;
  };
}

export const CustomerPortal: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [portalData, setPortalData] = useState<CustomerPortalData | null>(null);
  
  // Update state
  const [email, setEmail] = useState('');
  const [location, setLocation] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState<string | null>(null);

  // UPI payment state
  const [paymentAmount, setPaymentAmount] = useState('');
  const [showQR, setShowQR] = useState(false);
  const [copiedUPI, setCopiedUPI] = useState(false);
  const [expandedSale, setExpandedSale] = useState<string | null>(null);

  // Manual payment report state
  const [txnRef, setTxnRef] = useState('');
  const [txnAmount, setTxnAmount] = useState('');
  const [txnNote, setTxnNote] = useState('');
  const [isSubmittingTxn, setIsSubmittingTxn] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);

  useEffect(() => {
    fetchCustomerData();
  }, []);

  const fetchCustomerData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Parse customer ID from path /c/:id
      const pathParts = window.location.pathname.split('/');
      const customerId = pathParts[pathParts.length - 1].replace('.html', '');
      
      if (!customerId) {
        throw new Error('No customer identifier provided in the URL.');
      }

      const res = await fetch(`/api/storage?publicCustomerId=${customerId}`);
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('Customer account or store link could not be verified.');
        }
        throw new Error('Failed to retrieve customer information. Please try again.');
      }

      const data: CustomerPortalData = await res.json();
      setPortalData(data);
      
      // Initialize edit form
      setEmail(data.customer.email || '');
      setLocation(data.customer.location || '');
      
      // Prefill payment amount with total outstanding dues
      const dues = data.customer.totalDues || 0;
      setPaymentAmount(dues > 0 ? dues.toString() : '');
      setTxnAmount(dues > 0 ? dues.toString() : '');

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred while loading your portal.');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!portalData) return;
    
    setIsUpdating(true);
    setUpdateSuccess(null);
    
    try {
      const res = await fetch('/api/storage?publicCustomerUpdate=true', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerId: portalData.customer.id,
          email,
          location,
        }),
      });

      if (!res.ok) throw new Error('Failed to submit verification request.');
      
      setUpdateSuccess('Verification request submitted successfully! Your store manager will review and apply these updates soon.');
      
      // Update local state temporarily to reflect submission
      setPortalData({
        ...portalData,
        customer: {
          ...portalData.customer,
          pendingUpdates: {
            email,
            location,
            timestamp: new Date().toISOString()
          }
        }
      });
    } catch (err: any) {
      alert(err.message || 'Error submitting request');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleReportPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!portalData || !txnAmount || !txnRef) return;

    setIsSubmittingTxn(true);
    try {
      // Build payment submission details
      const noteContent = `Paid via UPI. Ref: ${txnRef}. Amt: ${portalData.settings.currencySymbol}${txnAmount}. ${txnNote ? `Note: ${txnNote}` : ''}`;
      
      // Since they are requesting a balance settle/payment audit, we can submit this under the location/profile updates
      // or as a pending updates note that the store manager can review!
      const res = await fetch('/api/storage?publicCustomerUpdate=true', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerId: portalData.customer.id,
          email: portalData.customer.email || email,
          location: `[PAYMENT REPORTED: Ref ${txnRef}, Amt ${txnAmount}] ${portalData.customer.location || location}`,
        }),
      });

      if (!res.ok) throw new Error('Submission failed');

      setReportSuccess(true);
      setTxnRef('');
      setTxnNote('');
    } catch (err) {
      alert('Error submitting payment notification.');
    } finally {
      setIsSubmittingTxn(false);
    }
  };

  const copyUPIToClipboard = () => {
    if (!portalData?.settings.upiId) return;
    navigator.clipboard.writeText(portalData.settings.upiId);
    setCopiedUPI(true);
    setTimeout(() => setCopiedUPI(false), 2000);
  };

  const toggleSaleExpand = (saleId: string) => {
    setExpandedSale(expandedSale === saleId ? null : saleId);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-full border-4 border-indigo-600/25 border-t-indigo-600 animate-spin mb-4"></div>
        <p className="text-sm font-bold text-slate-600 font-mono tracking-wider animate-pulse">VERIFYING PORTAL LINK...</p>
      </div>
    );
  }

  if (error || !portalData) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-red-50 border border-red-100 rounded-full flex items-center justify-center text-red-500 mb-4 shadow-sm">
          <AlertCircle size={32} />
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">Access Denied</h1>
        <p className="text-sm text-slate-500 max-w-md mb-6">{error || 'This public customer dashboard link is invalid or has expired.'}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-sm hover:bg-indigo-700 transition-all"
        >
          Retry
        </button>
      </div>
    );
  }

  const { customer, sales, settings } = portalData;
  const currencySymbol = settings.currencySymbol || '₹';
  const hasDues = (customer.totalDues || 0) > 0;

  // Build dynamic UPI Deep Link for mobile redirection
  const upiPayableAmount = parseFloat(paymentAmount) || 0;
  const upiLink = settings.upiId 
    ? `upi://pay?pa=${settings.upiId}&pn=${encodeURIComponent(settings.storeName)}&am=${upiPayableAmount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Dues payment for ${customer.name}`)}`
    : '';

  // Google charts / server API for QR code
  const qrCodeUrl = settings.upiId
    ? `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiLink)}`
    : '';

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20 text-slate-800">
      {/* Premium Top Store Banner */}
      <div className="bg-white border-b border-slate-100 py-6 px-4 md:px-8 shadow-sm">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {settings.logo ? (
              <div className="w-14 h-14 rounded-xl border border-slate-100 bg-white p-2 flex items-center justify-center overflow-hidden shrink-0">
                <img src={settings.logo} alt="Store Logo" className="max-w-full max-h-full object-contain" />
              </div>
            ) : (
              <div className="w-14 h-14 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                <Store size={28} />
              </div>
            )}
            <div>
              <h1 className="text-lg font-black text-slate-900 tracking-tight">{settings.storeName}</h1>
              <p className="text-xs text-indigo-600 font-bold tracking-wide uppercase mt-0.5">Secure Customer Dashboard</p>
            </div>
          </div>
          <div className="flex flex-col gap-1 text-xs text-slate-400 font-medium md:text-right border-t border-slate-50 pt-2 md:border-0 md:pt-0">
            {settings.storePhone && <span className="flex items-center md:justify-end gap-1"><Phone size={12}/> {settings.storePhone}</span>}
            {settings.storeEmail && <span className="flex items-center md:justify-end gap-1"><Mail size={12}/> {settings.storeEmail}</span>}
            {settings.storeAddress && <span className="flex items-center md:justify-end gap-1"><MapPin size={12}/> {settings.storeAddress}</span>}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 md:px-6 mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Hand: Financial and Account Cards */}
        <div className="md:col-span-1 space-y-6">
          {/* Dues & Limit Overview */}
          <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-6 -mt-6"></div>
            <span className="text-[10px] uppercase font-black text-slate-300 tracking-[0.15em] block mb-1">Outstanding Balance</span>
            <div className="text-3xl font-black tracking-tight mb-4 flex items-baseline gap-1">
              <span>{currencySymbol}</span>
              <span>{(customer.totalDues || 0).toLocaleString()}</span>
            </div>
            
            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/10 text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5">Total Spent</span>
                <strong className="font-bold text-green-400">{currencySymbol}{customer.totalSpent.toLocaleString()}</strong>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Total Purchases</span>
                <strong className="font-bold text-blue-400">{customer.visitCount} orders</strong>
              </div>
            </div>
          </div>

          {/* UPI Instant Checkout Module */}
          {hasDues && settings.upiId ? (
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center">
                  <CreditCard size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Settle Balance via UPI</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">No Fees • Instant</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase font-black text-slate-400 block">Payment Amount ({currencySymbol})</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">{currencySymbol}</span>
                  <input
                    type="number"
                    max={customer.totalDues}
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full py-2.5 pl-8 pr-4 bg-slate-50 border border-slate-100 rounded-xl font-bold text-sm outline-none focus:border-indigo-500 text-slate-800 transition-colors"
                    placeholder="Enter amount"
                  />
                </div>
              </div>

              {/* Mobile Deep Link Button */}
              <a
                href={upiLink}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md shadow-indigo-500/10 flex items-center justify-center gap-2 cursor-pointer md:hidden"
              >
                <Smartphone size={14} />
                Pay via UPI App
              </a>

              {/* Toggle QR Code for desktops */}
              <button
                onClick={() => setShowQR(!showQR)}
                className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <QrCode size={14} />
                {showQR ? 'Hide QR Code' : 'Scan to Pay'}
              </button>

              {showQR && (
                <div className="space-y-4 pt-3 border-t border-slate-100 text-center animate-in fade-in duration-300">
                  <div className="bg-white p-3 rounded-2xl border border-slate-100 inline-block shadow-sm">
                    {qrCodeUrl ? (
                      <img src={qrCodeUrl} alt="UPI Payment QR Code" className="w-44 h-44 object-contain mx-auto" />
                    ) : (
                      <div className="w-44 h-44 bg-slate-100 flex items-center justify-center text-slate-400">Loading QR...</div>
                    )}
                  </div>
                  <div className="space-y-1 text-center">
                    <p className="text-[11px] font-bold text-slate-600">Scan using any UPI App</p>
                    <p className="text-[9px] text-slate-400 font-medium">GPay, PhonePe, Paytm, or BHIM</p>
                  </div>
                  
                  <div className="bg-violet-50/50 p-2.5 rounded-xl border border-violet-100/30 flex items-center justify-between text-xs font-medium text-slate-600">
                    <span className="truncate pr-2 font-mono text-[10px] text-violet-700">{settings.upiId}</span>
                    <button 
                      onClick={copyUPIToClipboard} 
                      className="text-[10px] font-bold text-violet-600 hover:text-violet-700 uppercase cursor-pointer shrink-0"
                    >
                      {copiedUPI ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : hasDues ? (
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex gap-3 text-amber-800">
              <AlertCircle className="shrink-0 text-amber-600 mt-0.5" size={18} />
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wide">UPI Inactive</h4>
                <p className="text-[10px] mt-0.5 leading-relaxed font-medium">To clear your balance, please get in touch with the store administrator or pay cash at the store.</p>
              </div>
            </div>
          ) : null}

          {/* Report Payment Form */}
          {hasDues && (
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Receipt className="text-indigo-600" size={16} />
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Report Payment Completed</h4>
              </div>

              {reportSuccess ? (
                <div className="bg-emerald-50 text-emerald-800 p-4 rounded-xl border border-emerald-100 text-center space-y-2 animate-in zoom-in-95">
                  <CheckCircle2 className="text-emerald-600 mx-auto" size={24} />
                  <div className="text-xs font-bold">Verification Request Sent!</div>
                  <p className="text-[10px] leading-relaxed text-emerald-600">We have notified the merchant with your reference number. They will verify and settle your account.</p>
                  <button 
                    onClick={() => setReportSuccess(false)} 
                    className="text-[10px] font-bold underline uppercase tracking-wider text-emerald-700 hover:text-emerald-800"
                  >
                    Report another
                  </button>
                </div>
              ) : (
                <form onSubmit={handleReportPayment} className="space-y-3">
                  <div>
                    <label className="text-[9px] uppercase font-black text-slate-400 block mb-1">Transaction Ref / UTR No.*</label>
                    <Input
                      required
                      value={txnRef}
                      onChange={(e) => setTxnRef(e.target.value)}
                      placeholder="e.g. 12-digit UPI Ref"
                      className="!py-1.5 !px-3 text-xs bg-slate-50"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] uppercase font-black text-slate-400 block mb-1">Amount Paid ({currencySymbol})*</label>
                    <Input
                      required
                      type="number"
                      value={txnAmount}
                      onChange={(e) => setTxnAmount(e.target.value)}
                      placeholder="Amount paid"
                      className="!py-1.5 !px-3 text-xs bg-slate-50"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] uppercase font-black text-slate-400 block mb-1">Optional Comment / Note</label>
                    <Input
                      value={txnNote}
                      onChange={(e) => setTxnNote(e.target.value)}
                      placeholder="e.g. Paid via Google Pay"
                      className="!py-1.5 !px-3 text-xs bg-slate-50"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={isSubmittingTxn}
                    className="w-full !py-2 text-xs font-bold uppercase tracking-wider"
                  >
                    {isSubmittingTxn ? 'Submitting...' : 'Submit Payment Info'}
                  </Button>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Right Hand: Personal details request edit + Past purchase orders */}
        <div className="md:col-span-2 space-y-6">
          
          {/* Profile Details Edit Card */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
            <div className="flex justify-between items-start mb-4 border-b border-slate-50 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-black">
                  {customer.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">{customer.name}</h3>
                  <p className="text-[10px] text-slate-400 font-medium">Customer ID: {customer.id.slice(0, 8).toUpperCase()}</p>
                </div>
              </div>
              <Badge variant="indigo" className="text-[10px] font-bold uppercase py-0.5 px-2">Active</Badge>
            </div>

            {updateSuccess && (
              <div className="mb-4 bg-emerald-50 text-emerald-800 p-3 rounded-xl border border-emerald-100 text-xs font-medium flex gap-2 animate-in slide-in-from-top-2">
                <CheckCircle2 className="shrink-0 text-emerald-600 mt-0.5" size={16} />
                <span>{updateSuccess}</span>
              </div>
            )}

            {customer.pendingUpdates && !updateSuccess && (
              <div className="mb-4 bg-amber-50 text-amber-800 p-3.5 rounded-xl border border-amber-100 text-xs flex gap-2 animate-in slide-in-from-top-2">
                <Clock className="shrink-0 text-amber-600 mt-0.5" size={16} />
                <div>
                  <strong className="font-bold block">Pending Verification Request</strong>
                  <p className="text-[10px] leading-relaxed text-amber-700/80 mt-0.5">You requested an update for Email or Shipping Address on {new Date(customer.pendingUpdates.timestamp).toLocaleDateString()}. The store manager will review and apply this shortly.</p>
                </div>
              </div>
            )}

            <form onSubmit={handleRequestUpdate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-black text-slate-400 block mb-1">Registered Name</label>
                  <div className="py-2.5 px-3 bg-slate-50/80 border border-slate-100 rounded-xl text-xs font-bold text-slate-500 flex items-center gap-2">
                    <User size={13} /> {customer.name}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-black text-slate-400 block mb-1">Registered Mobile</label>
                  <div className="py-2.5 px-3 bg-slate-50/80 border border-slate-100 rounded-xl text-xs font-bold text-slate-500 flex items-center gap-2">
                    <Phone size={13} /> {customer.phone}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="text-[10px] uppercase font-black text-indigo-900/60 block mb-1">Your Email</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="!py-2.5 !px-3.5 text-xs"
                    placeholder="Enter email address"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-black text-indigo-900/60 block mb-1">Your Shipping Address</label>
                  <Input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="!py-2.5 !px-3.5 text-xs"
                    placeholder="Enter shipping address"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  disabled={isUpdating}
                  className="!py-2.5 !px-5 text-xs font-bold uppercase tracking-wider flex items-center gap-2"
                >
                  {isUpdating ? 'Submitting Request...' : 'Request Info Update'}
                </Button>
              </div>
            </form>
          </div>

          {/* Past Purchase Records */}
          <div className="space-y-3">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Purchase & Billing Records</h3>
            
            {sales.length > 0 ? (
              <div className="space-y-3">
                {sales.map((sale) => {
                  const isExpanded = expandedSale === sale.id;
                  const formattedDate = new Date(sale.timestamp).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  });
                  const saleDues = sale.total - (sale.amountPaid || 0);

                  return (
                    <div 
                      key={sale.id}
                      className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm hover:border-indigo-100/80 transition-all"
                    >
                      {/* Accordion Header */}
                      <div 
                        onClick={() => toggleSaleExpand(sale.id)}
                        className="p-4 flex items-center justify-between gap-4 cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-500 border border-slate-100">
                            <FileText size={20} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-black text-slate-900">Invoice #{sale.id.slice(0, 6).toUpperCase()}</span>
                              {saleDues > 0 ? (
                                <Badge variant="danger" className="text-[9px] uppercase tracking-wide font-black py-0 px-1.5">Unpaid</Badge>
                              ) : (
                                <Badge variant="success" className="text-[9px] uppercase tracking-wide font-black py-0 px-1.5">Fully Paid</Badge>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 block">{formattedDate}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-right">
                          <div>
                            <div className="text-sm font-black text-slate-900">{currencySymbol}{sale.total.toLocaleString()}</div>
                            <span className="text-[9px] text-indigo-500 font-bold uppercase">{sale.items.length} items</span>
                          </div>
                          <div className="text-slate-400">
                            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                          </div>
                        </div>
                      </div>

                      {/* Accordion Content */}
                      {isExpanded && (
                        <div className="px-4 pb-4 border-t border-slate-50 pt-3 space-y-4 bg-slate-50/30">
                          {/* Invoice itemized list */}
                          <div className="space-y-1.5">
                            <span className="text-[9px] uppercase font-black text-slate-400 tracking-wider">Itemized Summary</span>
                            <div className="bg-white rounded-xl border border-slate-100/80 divide-y divide-slate-50 overflow-hidden">
                              {sale.items.map((item: CartItem, idx) => (
                                <div key={idx} className="p-3 flex justify-between items-center text-xs">
                                  <div>
                                    <div className="font-bold text-slate-800">{item.name}</div>
                                    <div className="text-[10px] text-slate-400 mt-0.5">{item.quantity} {item.unit} × {currencySymbol}{(item.customPrice || item.sellPrice).toLocaleString()}</div>
                                  </div>
                                  <div className="font-black text-slate-900">{currencySymbol}{((item.customPrice || item.sellPrice) * item.quantity).toLocaleString()}</div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Payment split details */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <span className="text-[9px] uppercase font-black text-slate-400 tracking-wider">Order Audit</span>
                              <div className="bg-white p-3 rounded-xl border border-slate-100/80 text-xs space-y-2">
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Subtotal:</span>
                                  <span className="font-medium">{currencySymbol}{sale.subtotal.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Tax/Vat:</span>
                                  <span className="font-medium">{currencySymbol}{sale.tax.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between border-t border-slate-50 pt-1.5 font-bold text-slate-900">
                                  <span>Total Order:</span>
                                  <span>{currencySymbol}{sale.total.toLocaleString()}</span>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <span className="text-[9px] uppercase font-black text-slate-400 tracking-wider">Ledger & Settlement</span>
                              <div className="bg-white p-3 rounded-xl border border-slate-100/80 text-xs space-y-2">
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Amount Paid:</span>
                                  <span className="font-bold text-emerald-600">{currencySymbol}{(sale.amountPaid || 0).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between border-t border-slate-50 pt-1.5">
                                  <span className="text-slate-500">Outstanding:</span>
                                  <span className={`font-black ${saleDues > 0 ? 'text-red-600' : 'text-slate-500'}`}>{currencySymbol}{saleDues.toLocaleString()}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Actions on this sale */}
                          <div className="flex justify-end gap-2">
                            <a
                              href={`/invoice/${sale.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                            >
                              <ExternalLink size={13} />
                              View Digital Invoice PDF
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-8 border border-slate-100 text-center">
                <FileText className="text-slate-300 mx-auto mb-2" size={32} />
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">No transaction records found.</p>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
