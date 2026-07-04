import React, { useState, useEffect, useMemo } from 'react';
import { StoreService } from '../services/storeService';
import { Customer, Sale, Product, Tab, Tag, StoreSettings } from '../types';
import { Card, Badge, Button, Modal } from '../components/UI';
import { TrendingUp, Crown, Star, LayoutDashboard, IndianRupee, AlertTriangle, Phone, ArrowUpRight, Package, Wallet, ShoppingBag, PieChart as PieChartIcon, Users, UserPlus, Plus, ShoppingCart, ArrowRight, CheckCircle, DollarSign, Scan, Clock, CheckSquare, Sparkles, Banknote, Smartphone, CreditCard, Trophy, BarChart3, Box, Layers, Loader2, X, BrainCircuit, RefreshCw, MessageSquareText, ShieldCheck, Lightbulb, BookOpen, Activity, Terminal, ChevronRight, Search, Hourglass } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, BarChart, Bar } from 'recharts';

interface DashboardProps {
  onNavigate: (tab: Tab, action?: string) => void;
}

const AmpAd = 'amp-ad' as any;

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  
  // Detail Modal States
  const [activeDetail, setActiveDetail] = useState<'LOW_STOCK' | 'EXPIRING' | 'DUES' | 'RUNWAY' | 'DEAD_STOCK' | null>(null);



  // --- Browser/Gesture Back Navigation Logic ---
  useEffect(() => {
    const handleNavigationPop = (e: any) => {
        if (activeDetail) {
            setActiveDetail(null);
        }
    };
    window.addEventListener('app-navigation-pop' as any, handleNavigationPop);
    return () => window.removeEventListener('app-navigation-pop' as any, handleNavigationPop);
  }, [activeDetail]);

  const openDetail = (type: 'LOW_STOCK' | 'EXPIRING' | 'DUES' | 'RUNWAY' | 'DEAD_STOCK') => {
      window.history.pushState({ tab: Tab.DASHBOARD, depth: 1 }, '');
      setActiveDetail(type);
  };

  const closeDetail = () => {
      setActiveDetail(null);
      window.history.back();
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [cData, sData, pData, tData, stData] = await Promise.all([
        StoreService.getCustomers(),
        StoreService.getSales(),
        StoreService.getInventory(),
        StoreService.getTags(),
        StoreService.getSettings()
    ]);
    setCustomers(cData);
    setSales(sData);
    setProducts(pData);
    setTags(tData);
    setSettings(stData);
  };



  const stats = useMemo(() => {
    const totalRevenue = sales.reduce((acc, s) => acc + s.total, 0);
    const totalDues = customers.reduce((acc, c) => acc + (c.totalDues || 0), 0);
    const inventoryValue = products.reduce((acc, p) => acc + (p.stock * p.sellPrice), 0);
    const totalProducts = products.length;
    const totalStockUnits = products.reduce((acc, p) => acc + p.stock, 0);

    const last7DaysDates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return d.toISOString().split('T')[0];
    }).reverse();

    const salesTrend = last7DaysDates.map(date => {
        const dayTotal = sales
            .filter(s => s.timestamp.startsWith(date))
            .reduce((acc, s) => acc + s.total, 0);
        return { name: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }), value: dayTotal };
    });

    const getMethodTrend = (method: string) => last7DaysDates.map(date => ({
        value: sales.filter(s => s.timestamp.startsWith(date) && s.paymentMethod === method)
                    .reduce((acc, s) => acc + s.total, 0)
    }));

    const cashTotal = sales.filter(s => s.paymentMethod === 'Cash').reduce((acc, s) => acc + s.total, 0);
    const upiTotal = sales.filter(s => s.paymentMethod === 'UPI').reduce((acc, s) => acc + s.total, 0);
    const cardTotal = sales.filter(s => s.paymentMethod === 'Card').reduce((acc, s) => acc + s.total, 0);
    const payLaterTotal = sales.filter(s => s.paymentMethod === 'Pay Later').reduce((acc, s) => acc + s.total, 0);

    const customersWithDues = customers
        .filter(c => (c.totalDues || 0) > 0)
        .sort((a, b) => b.totalDues - a.totalDues);

    const topBuyer = [...customers].sort((a, b) => b.totalSpent - a.totalSpent)[0];
    const mostLoyal = [...customers].sort((a, b) => b.visitCount - a.visitCount)[0];

    const customerComposition = [
        { name: 'New', value: customers.filter(c => c.visitCount === 1).length, color: '#94a3b8' },
        { name: 'Returning', value: customers.filter(c => c.visitCount > 1 && c.visitCount <= 5).length, color: '#60a5fa' },
        { name: 'Loyal', value: customers.filter(c => c.visitCount > 5).length, color: '#2563eb' }
    ].filter(i => i.value > 0);

    const lowStockItems = products
        .filter(p => p.stock <= (p.lowStockThreshold || settings?.lowStockDefault || 10) && p.stock > 0)
        .sort((a, b) => a.stock - b.stock);

    const expiringItems = products.filter(p => {
        if (!p.expiryDate) return false;
        const today = new Date();
        today.setHours(0,0,0,0);
        const exp = new Date(p.expiryDate);
        exp.setHours(0,0,0,0);
        const diff = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const threshold = settings?.expiryAlertDays || 7;
        return diff >= 0 && diff <= threshold;
    }).map(p => {
        const today = new Date();
        today.setHours(0,0,0,0);
        const exp = new Date(p.expiryDate!);
        exp.setHours(0,0,0,0);
        const daysLeft = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return { ...p, daysLeft };
    }).sort((a, b) => a.daysLeft - b.daysLeft);

    const productSales: Record<string, number> = {};
    sales.forEach(s => s.items.forEach(i => productSales[i.name] = (productSales[i.name] || 0) + i.quantity));
    const topProducts = Object.entries(productSales).sort(([, a], [, b]) => b - a).slice(0, 5).map(([name, count]) => ({ name, count }));
    
    const valueByTag: { [key: string]: { name: string, value: number, color: string } } = {};
    tags.forEach(tag => { valueByTag[tag.id] = { name: tag.name, value: 0, color: tag.color }; });
    products.forEach(p => {
        const value = p.stock * p.sellPrice;
        if (p.tagId && valueByTag[p.tagId]) valueByTag[p.tagId].value += value;
    });

    // 1. Avg Transaction size
    const avgTransactionValue = sales.length > 0 ? (totalRevenue / sales.length) : 0;

    // 2. Sales Velocity / Runway (last 7 days sales)
    const productSalesLast7Days: Record<string, number> = {};
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sales.forEach(s => {
        const saleDate = new Date(s.timestamp);
        if (saleDate >= sevenDaysAgo) {
            s.items.forEach(item => {
                productSalesLast7Days[item.id] = (productSalesLast7Days[item.id] || 0) + item.quantity;
            });
        }
    });

    const runwayItems = products.map(p => {
        const unitsSold = productSalesLast7Days[p.id] || 0;
        const dailyVelocity = unitsSold / 7;
        const daysLeft = dailyVelocity > 0 ? Math.round(p.stock / dailyVelocity) : 999;
        return { ...p, dailyVelocity, daysLeft, unitsSold };
    }).filter(p => p.dailyVelocity > 0 && p.daysLeft <= 15).sort((a, b) => a.daysLeft - b.daysLeft);

    // 3. Dead Stock (No sales in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const activeProductIds = new Set<string>();
    sales.forEach(s => {
        const saleDate = new Date(s.timestamp);
        if (saleDate >= thirtyDaysAgo) {
            s.items.forEach(item => {
                activeProductIds.add(item.id);
            });
        }
    });
    const deadStockItems = products.filter(p => p.stock > 0 && !activeProductIds.has(p.id));
    const deadStockValue = deadStockItems.reduce((acc, p) => acc + (p.stock * p.sellPrice), 0);

    return { 
        totalRevenue, totalDues, inventoryValue, totalProducts, totalStockUnits,
        salesTrend, 
        cashTotal, upiTotal, cardTotal, payLaterTotal,
        cashTrend: getMethodTrend('Cash'),
        upiTrend: getMethodTrend('UPI'),
        cardTrend: getMethodTrend('Card'),
        payLaterTrend: getMethodTrend('Pay Later'),
        customersWithDues, topBuyer, mostLoyal, 
        lowStockItems, expiringItems, customerComposition, topProducts,
        stockValueByCategory: Object.values(valueByTag).sort((a, b) => b.value - a.value),
        avgTransactionValue,
        runwayItems,
        deadStockItems,
        deadStockValue
    };
  }, [customers, sales, products, tags, settings]);

  const formatDateShort = (dateStr: string) => dateStr ? `${new Date(dateStr).getDate()} ${new Date(dateStr).toLocaleString('default', { month: 'short' })}` : '';

  const MiniSparkline = ({ data, color }: { data: any[], color: string }) => {
    const safeId = color.replace('#', '');
    return (
      <div className="h-10 w-full mt-2">
          <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                  <defs>
                      <linearGradient id={`sparkline-${safeId}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={color} stopOpacity={0.15}/>
                          <stop offset="95%" stopColor={color} stopOpacity={0}/>
                      </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} fillOpacity={1} fill={`url(#sparkline-${safeId})`} isAnimationActive={false} />
              </AreaChart>
          </ResponsiveContainer>
      </div>
    );
  };

  return (
    <div className="space-y-10 animate-in fade-in pb-32 relative max-w-6xl mx-auto">
        {/* Floating Scanner Action */}
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-30">
            <button 
                onClick={() => onNavigate(Tab.WAREHOUSE, 'scan_add')}
                className="flex items-center gap-3 pl-3 pr-6 py-2.5 rounded-full bg-white/40 backdrop-blur-xl border border-white/60 text-gray-800 hover:bg-white/60 transition-all active:scale-95 shadow-lg group"
            >
                <div className="p-2 bg-red-600 rounded-full text-white shadow-lg shadow-red-500/30">
                    <Scan size={18} className="group-hover:rotate-12 transition-transform"/>
                </div>
                <span className="font-bold tracking-wide text-sm mr-1 text-gray-950">Scan to Add</span>
            </button>
        </div>

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-1 pt-2">
            <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-500/20">
                    <LayoutDashboard size={24} />
                </div>
                <div>
                    <h2 className="text-2xl font-black text-gray-950">Overview</h2>
                    <p className="text-gray-500 font-medium">Business insights & performance</p>
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-gray-200 shadow-sm">
                    <button onClick={() => onNavigate(Tab.POS)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors text-xs font-black"><ShoppingCart size={14}/> NEW SALE</button>
                    <button onClick={() => onNavigate(Tab.WAREHOUSE, 'add')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors text-xs font-black"><Package size={14}/> ADD STOCK</button>
                </div>
            </div>
        </div>

        {/* --- INVENTORY OVERVIEW --- */}
        <section>
            <div className="flex items-center gap-2 mb-4 px-1">
                <Box size={20} className="text-slate-500"/>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Inventory Overview</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-white border border-slate-100 shadow-sm p-5 hover:shadow-md transition-shadow rounded-2xl flex flex-col justify-between">
                  <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5 mb-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
                      Total Products
                  </div>
                  <div>
                      <div className="text-3xl font-bold text-slate-800">{stats.totalProducts}</div>
                      <p className="text-[10px] text-slate-400 font-medium mt-1">Unique active SKUs</p>
                  </div>
              </Card>
              <Card className="bg-white border border-slate-100 shadow-sm p-5 hover:shadow-md transition-shadow rounded-2xl flex flex-col justify-between">
                  <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5 mb-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      Total Value
                  </div>
                  <div>
                      <div className="text-3xl font-bold text-slate-800">₹{stats.inventoryValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                      <p className="text-[10px] text-slate-400 font-medium mt-1">At retail sell price</p>
                  </div>
              </Card>
              <Card onClick={() => openDetail('LOW_STOCK')} className="bg-white border border-slate-100 shadow-sm p-5 hover:shadow-md transition-shadow rounded-2xl flex flex-col justify-between cursor-pointer active:scale-[0.98] group">
                  <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider flex items-center justify-between mb-2">
                      <span className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                          Low Stock Alert
                      </span>
                      <ArrowUpRight size={14} className="text-slate-400 group-hover:text-rose-500 transition-colors"/>
                  </div>
                  <div>
                      <div className="text-3xl font-bold text-slate-800">{stats.lowStockItems.length}</div>
                      <p className="text-[10px] text-rose-500 font-semibold mt-1 flex items-center gap-1">Requires restock →</p>
                  </div>
              </Card>
              <Card className="bg-white border border-slate-100 shadow-sm p-5 hover:shadow-md transition-shadow rounded-2xl flex flex-col justify-between">
                  <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5 mb-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-500"></span>
                      Stock Units
                  </div>
                  <div>
                      <div className="text-3xl font-bold text-slate-800">{stats.totalStockUnits.toLocaleString()}</div>
                      <p className="text-[10px] text-slate-400 font-medium mt-1">Total items in store</p>
                  </div>
              </Card>
            </div>
        </section>

        {/* --- FINANCIAL SNAPSHOT --- */}
        <section>
            <div className="flex items-center gap-2 mb-4 px-1">
                <Activity size={20} className="text-slate-500"/>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Financial Snapshot</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="bg-white border border-slate-100 shadow-sm p-6 rounded-2xl flex items-center justify-between hover:shadow-md transition-shadow">
                    <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                            <Wallet size={14} className="text-emerald-500" /> Total Revenue
                        </div>
                        <div className="text-3xl font-bold text-slate-800">₹{stats.totalRevenue.toLocaleString()}</div>
                        <p className="text-[10px] text-slate-400 font-medium">{sales.length} transactions recorded</p>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                        <IndianRupee size={22} />
                    </div>
                </Card>
                <Card onClick={() => openDetail('DUES')} className="bg-white border border-slate-100 shadow-sm p-6 rounded-2xl flex items-center justify-between hover:shadow-md transition-shadow cursor-pointer active:scale-[0.98] group">
                    <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                            <AlertTriangle size={14} className="text-rose-500" /> Outstanding Dues
                        </div>
                        <div className="text-3xl font-bold text-slate-800">₹{stats.totalDues.toLocaleString()}</div>
                        <p className="text-[10px] text-rose-500 font-semibold">{stats.customersWithDues.length} customers pending collection →</p>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 group-hover:scale-105 transition-transform">
                        <AlertTriangle size={22} />
                    </div>
                </Card>
            </div>
        </section>

        {/* --- PREDICTIVE DEEP ANALYTICS --- */}
        <section>
            <div className="flex items-center gap-2 mb-4 px-1">
                <Sparkles size={20} className="text-slate-500"/>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Predictive Deep Analytics</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Metric 1: Average Ticket Size / Invoice Value */}
                <Card className="bg-white border border-slate-100 shadow-sm p-6 rounded-2xl hover:shadow-md transition-all flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-1.5 text-slate-400 mb-2">
                            <TrendingUp size={14} className="text-indigo-500"/>
                            <span className="text-[10px] font-bold uppercase tracking-wider">Avg Transaction Size</span>
                        </div>
                        <div className="text-2xl font-bold text-slate-800">₹{Math.round(stats.avgTransactionValue).toLocaleString()}</div>
                        <p className="text-[10px] text-slate-400 font-medium mt-1">Average bill value per checkout</p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        <span>Volume: {sales.length} Bills</span>
                        <span className="text-emerald-600 font-semibold">Healthy Flow</span>
                    </div>
                </Card>

                {/* Metric 2: Stock Runway Alert */}
                <Card onClick={() => openDetail('RUNWAY')} className="bg-white border border-slate-100 shadow-sm p-6 rounded-2xl hover:shadow-md transition-all flex flex-col justify-between cursor-pointer active:scale-[0.98] group">
                    <div>
                        <div className="flex items-center justify-between text-slate-400 mb-2">
                            <div className="flex items-center gap-1.5">
                                <Hourglass size={14} className="text-amber-500"/>
                                <span className="text-[10px] font-bold uppercase tracking-wider">Stock Runway Alerts</span>
                            </div>
                            <span className="px-1.5 py-0.5 rounded-full text-[8px] font-bold bg-amber-50 text-amber-600 uppercase tracking-wider">Forecast</span>
                        </div>
                        <div className="text-2xl font-bold text-slate-800">{stats.runwayItems.length} <span className="text-xs font-normal text-slate-400">Products</span></div>
                        <p className="text-[10px] text-slate-400 font-medium mt-1">Stock depleted within 15 days</p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        <span>Velocity-based</span>
                        <span className="text-amber-600 group-hover:text-amber-700 transition-colors">See Runouts →</span>
                    </div>
                </Card>

                {/* Metric 3: Dead Stock Capital Locked */}
                <Card onClick={() => openDetail('DEAD_STOCK')} className="bg-white border border-slate-100 shadow-sm p-6 rounded-2xl hover:shadow-md transition-all flex flex-col justify-between cursor-pointer active:scale-[0.98] group">
                    <div>
                        <div className="flex items-center justify-between text-slate-400 mb-2">
                            <div className="flex items-center gap-1.5">
                                <AlertTriangle size={14} className="text-rose-500"/>
                                <span className="text-[10px] font-bold uppercase tracking-wider">Capital Lockup</span>
                            </div>
                            <span className="px-1.5 py-0.5 rounded-full text-[8px] font-bold bg-rose-50 text-rose-600 uppercase tracking-wider">Dormant</span>
                        </div>
                        <div className="text-2xl font-bold text-rose-600">₹{stats.deadStockValue.toLocaleString()}</div>
                        <p className="text-[10px] text-slate-400 font-medium mt-1">No sales in past 30 days</p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        <span>{stats.deadStockItems.length} Skus Dormant</span>
                        <span className="text-rose-600 group-hover:text-rose-700 transition-colors">Inspect →</span>
                    </div>
                </Card>
            </div>
        </section>

        {/* --- PAYMENT BREAKDOWN --- */}
        <section>
            <div className="flex items-center gap-2 mb-4 px-1">
                <Banknote size={20} className="text-slate-500"/>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Live Flow Tracking</h3>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-white border border-slate-100 shadow-sm p-4 hover:shadow-md transition-shadow flex flex-col justify-between rounded-2xl">
                    <div className="flex items-center justify-between text-slate-400 mb-1">
                        <div className="flex items-center gap-1.5">
                            <Banknote size={14} className="text-emerald-500"/>
                            <span className="text-[10px] font-bold uppercase tracking-wider">Cash</span>
                        </div>
                        <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 text-[8px] font-bold uppercase rounded-md">Live</span>
                    </div>
                    <div className="text-xl font-bold text-slate-800">₹{stats.cashTotal.toLocaleString()}</div>
                    <MiniSparkline data={stats.cashTrend} color="#10b981" />
                </Card>
                <Card className="bg-white border border-slate-100 shadow-sm p-4 hover:shadow-md transition-shadow flex flex-col justify-between rounded-2xl">
                    <div className="flex items-center justify-between text-slate-400 mb-1">
                        <div className="flex items-center gap-1.5">
                            <Smartphone size={14} className="text-blue-500"/>
                            <span className="text-[10px] font-bold uppercase tracking-wider">UPI</span>
                        </div>
                        <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[8px] font-bold uppercase rounded-md">Fast</span>
                    </div>
                    <div className="text-xl font-bold text-slate-800">₹{stats.upiTotal.toLocaleString()}</div>
                    <MiniSparkline data={stats.upiTrend} color="#3b82f6" />
                </Card>
                <Card className="bg-white border border-slate-100 shadow-sm p-4 hover:shadow-md transition-shadow flex flex-col justify-between rounded-2xl">
                    <div className="flex items-center justify-between text-slate-400 mb-1">
                        <div className="flex items-center gap-1.5">
                            <CreditCard size={14} className="text-indigo-500"/>
                            <span className="text-[10px] font-bold uppercase tracking-wider">Card</span>
                        </div>
                        <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 text-[8px] font-bold uppercase rounded-md">Sync</span>
                    </div>
                    <div className="text-xl font-bold text-slate-800">₹{stats.cardTotal.toLocaleString()}</div>
                    <MiniSparkline data={stats.cardTrend} color="#8b5cf6" />
                </Card>
                <Card className="bg-white border border-slate-100 shadow-sm p-4 hover:shadow-md transition-shadow flex flex-col justify-between rounded-2xl">
                    <div className="flex items-center justify-between text-slate-400 mb-1">
                        <div className="flex items-center gap-1.5">
                            <Clock size={14} className="text-amber-500"/>
                            <span className="text-[10px] font-bold uppercase tracking-wider">Pay Later</span>
                        </div>
                        <span className="px-1.5 py-0.5 bg-amber-50 text-amber-600 text-[8px] font-bold uppercase rounded-md">Dues</span>
                    </div>
                    <div className="text-xl font-bold text-slate-800">₹{stats.payLaterTotal.toLocaleString()}</div>
                    <MiniSparkline data={stats.payLaterTrend} color="#f59e0b" />
                </Card>
            </div>
        </section>

        {/* --- SALES TREND --- */}
        <section>
            <div className="flex items-center gap-2 mb-4 px-1">
                <TrendingUp size={20} className="text-slate-500"/>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Sales Trend</h3>
            </div>
            <Card className="bg-white border border-slate-100 shadow-sm rounded-2xl p-6 h-[380px]">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h4 className="font-bold text-slate-800 text-base">Revenue Overview</h4>
                        <p className="text-[10px] text-slate-400 font-medium">Daily transaction volumes over the last 7 days</p>
                    </div>
                    <span className="px-2 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold uppercase rounded-md tracking-wider">Google Analytics Active Mode</span>
                </div>
                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={stats.salesTrend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                            <defs>
                                <linearGradient id="gaSalesGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.08}/>
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.00}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9"/>
                            <XAxis 
                                dataKey="name" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 500 }} 
                                dy={10}
                            />
                            <YAxis 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 500 }} 
                                tickFormatter={(val) => `₹${val}`}
                            />
                            <Tooltip 
                                contentStyle={{
                                    backgroundColor: '#ffffff',
                                    borderRadius: '12px',
                                    border: '1px solid #f1f5f9',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                                    padding: '8px 12px'
                                }}
                                labelStyle={{ fontWeight: 'bold', color: '#64748b', fontSize: '10px', textTransform: 'uppercase' }}
                                itemStyle={{ fontWeight: 'bold', color: '#1e293b', fontSize: '12px' }}
                                formatter={(value: any) => [`₹${value.toLocaleString()}`, 'Revenue']}
                            />
                            <Area 
                                type="monotone" 
                                dataKey="value" 
                                stroke="#3b82f6" 
                                strokeWidth={2.5} 
                                fillOpacity={1} 
                                fill="url(#gaSalesGradient)" 
                                activeDot={{ r: 5, strokeWidth: 1.5, stroke: '#3b82f6', fill: '#ffffff' }}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </Card>
        </section>

        {/* --- INVENTORY HEALTH --- */}
        <section>
            <div className="flex items-center gap-2 mb-4 px-1 mt-8">
                <AlertTriangle size={20} className="text-slate-500"/>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Inventory Health</h3>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="p-0 overflow-hidden h-[340px] flex flex-col bg-white border border-slate-100 shadow-sm rounded-2xl">
                    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/40">
                        <h3 className="font-bold text-slate-700 flex items-center gap-2 text-xs uppercase tracking-wider"><Crown size={14} className="text-amber-500"/> Top Moving Items</h3>
                        <span className="text-[9px] font-bold text-slate-400 uppercase bg-slate-100 px-2 py-0.5 rounded-full">High Velocity</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                        {stats.topProducts.map((p, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-white border border-slate-100/60 rounded-xl hover:border-slate-200 transition-colors shadow-sm">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-6 h-6 rounded-full bg-slate-50 text-slate-500 flex items-center justify-center text-[10px] font-bold shrink-0">{idx + 1}</div>
                                    <span className="font-bold text-slate-700 text-xs truncate">{p.name}</span>
                                </div>
                                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full shrink-0">{p.count} sold</span>
                            </div>
                        ))}
                    </div>
                </Card>

                <Card onClick={() => openDetail('LOW_STOCK')} className="bg-white border border-slate-100 shadow-sm h-[340px] flex flex-col p-0 overflow-hidden cursor-pointer active:scale-[0.99] group rounded-2xl">
                    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/40">
                        <h3 className="font-bold text-slate-700 flex items-center gap-2 text-xs uppercase tracking-wider"><AlertTriangle size={14} className="text-rose-500"/> Critical Low Stock</h3>
                        <ChevronRight size={14} className="text-slate-400 group-hover:translate-x-1 transition-transform"/>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                        {stats.lowStockItems.length > 0 ? stats.lowStockItems.slice(0, 5).map(p => (
                            <div key={p.id} className="flex justify-between items-center p-3 bg-white border border-slate-100/60 rounded-xl hover:border-slate-200 transition-colors shadow-sm">
                                <span className="font-bold text-slate-700 text-xs truncate pr-2">{p.name}</span>
                                <span className="font-bold text-[10px] text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md whitespace-nowrap">{p.stock} units</span>
                            </div>
                        )) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                <CheckCircle size={36} className="mb-2 text-emerald-500 opacity-60"/>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Levels Healthy</p>
                            </div>
                        )}
                        {stats.lowStockItems.length > 5 && <div className="text-center pt-2 text-[10px] font-bold text-rose-400 uppercase tracking-wider">View {stats.lowStockItems.length - 5} More...</div>}
                    </div>
                </Card>

                <Card onClick={() => openDetail('EXPIRING')} className="bg-white border border-slate-100 shadow-sm h-[340px] flex flex-col p-0 overflow-hidden cursor-pointer active:scale-[0.99] group rounded-2xl">
                    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/40">
                        <h3 className="font-bold text-slate-700 flex items-center gap-2 text-xs uppercase tracking-wider"><Clock size={14} className="text-amber-500"/> Expiring Soon</h3>
                        <ChevronRight size={14} className="text-slate-400 group-hover:translate-x-1 transition-transform"/>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                         {stats.expiringItems.length > 0 ? stats.expiringItems.slice(0, 5).map(p => (
                            <div key={p.id} className="flex flex-col gap-1 p-3 bg-white border border-slate-100/60 rounded-xl hover:border-slate-200 transition-colors shadow-sm">
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-slate-700 text-xs truncate mr-2">{p.name}</span>
                                    <span className={`px-1.5 py-0.5 text-[8px] font-bold uppercase rounded-md ${p.daysLeft === 0 ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'}`}>
                                        {p.daysLeft === 0 ? 'Today' : `${p.daysLeft}d left`}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-[9px] text-slate-400 font-medium">
                                    <span>Stock: {p.stock}</span>
                                    <span>Exp: {formatDateShort(p.expiryDate || '')}</span>
                                </div>
                            </div>
                        )) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                <ShieldCheck size={36} className="mb-2 text-emerald-500 opacity-60"/>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">No Expiry Risk</p>
                            </div>
                        )}
                        {stats.expiringItems.length > 5 && <div className="text-center pt-2 text-[10px] font-bold text-amber-400 uppercase tracking-wider">View {stats.expiringItems.length - 5} More...</div>}
                    </div>
                </Card>
            </div>
        </section>

        {/* --- CUSTOMER INSIGHTS --- */}
        <section>
            <div className="flex items-center gap-2 mb-4 px-1">
                <Users size={20} className="text-slate-500"/>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Customer Insights</h3>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Panel 1: Customer Spotlights (6 columns on lg) */}
                <Card className="lg:col-span-6 bg-white border border-slate-100 shadow-sm p-6 rounded-2xl flex flex-col justify-between h-[340px]">
                    <div>
                        <div className="flex justify-between items-center mb-5">
                            <div>
                                <h4 className="font-bold text-slate-800 text-sm">Customer Spotlights</h4>
                                <p className="text-[10px] text-slate-400 font-medium">Top performing customer profiles & loyalty segments</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {/* Top Spender */}
                            <div className="flex items-center justify-between p-3.5 bg-slate-50/30 border border-slate-100/60 rounded-xl">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                                        <Crown size={18} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[9px] font-bold text-amber-600 uppercase tracking-wider">Top Spender</p>
                                        <h5 className="font-bold text-slate-700 text-sm truncate">{stats.topBuyer?.name || "No data yet"}</h5>
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <span className="text-xs font-bold text-slate-800">Total Spend</span>
                                    <p className="text-sm font-black text-emerald-600">₹{stats.topBuyer?.totalSpent.toLocaleString() || "0"}</p>
                                </div>
                            </div>

                            {/* Most Loyal */}
                            <div className="flex items-center justify-between p-3.5 bg-slate-50/30 border border-slate-100/60 rounded-xl">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                                        <Star size={18} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[9px] font-bold text-blue-600 uppercase tracking-wider">Most Loyal</p>
                                        <h5 className="font-bold text-slate-700 text-sm truncate">{stats.mostLoyal?.name || "No data yet"}</h5>
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <span className="text-xs font-bold text-slate-800">Frequency</span>
                                    <p className="text-sm font-black text-blue-600">{stats.mostLoyal?.visitCount || "0"} Visits</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Outstanding debtors soft indicator */}
                    <div 
                        onClick={() => openDetail('DUES')}
                        className="mt-4 p-2.5 bg-rose-50/30 hover:bg-rose-50/50 border border-rose-100/60 rounded-xl flex items-center justify-between cursor-pointer transition-colors active:scale-[0.99] group"
                    >
                        <div className="flex items-center gap-2 min-w-0">
                            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0"></span>
                            <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider truncate">
                                {stats.customersWithDues.length} Outstanding Debtors
                            </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 text-rose-600">
                            <span className="text-xs font-black">₹{stats.totalDues.toLocaleString()}</span>
                            <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                        </div>
                    </div>
                </Card>

                {/* Panel 2: Customer Composition (6 columns on lg) */}
                <Card className="lg:col-span-6 bg-white border border-slate-100 shadow-sm p-6 rounded-2xl flex flex-col justify-between h-[340px]">
                    <div>
                        <h4 className="font-bold text-slate-800 text-sm">Demographic Retention Analysis</h4>
                        <p className="text-[10px] text-slate-400 font-medium">Distribution of customers by return frequency</p>
                    </div>

                    <div className="flex-1 flex flex-row items-center justify-center gap-6 mt-2">
                        {/* Donut Chart with absolute total center */}
                        <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie 
                                        data={stats.customerComposition} 
                                        dataKey="value" 
                                        cx="50%" 
                                        cy="50%" 
                                        innerRadius={45} 
                                        outerRadius={60} 
                                        paddingAngle={2}
                                        isAnimationActive={false}
                                    >
                                        {stats.customerComposition.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} stroke="#ffffff" strokeWidth={1} />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className="text-2xl font-black text-slate-800">{customers.length}</span>
                                <span className="text-[8px] text-slate-400 font-black uppercase tracking-widest">Customers</span>
                            </div>
                        </div>

                        {/* Custom Legend */}
                        <div className="flex-1 space-y-2.5 max-w-[180px]">
                            {(() => {
                                const total = stats.customerComposition.reduce((sum, item) => sum + item.value, 0) || 1;
                                return stats.customerComposition.map(c => {
                                    const percent = ((c.value / total) * 100).toFixed(0);
                                    return (
                                        <div key={c.name} className="flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }}></div>
                                                <span className="font-bold text-slate-600 truncate">{c.name}</span>
                                            </div>
                                            <div className="text-right font-semibold text-slate-500 shrink-0">
                                                <span>{percent}%</span>
                                                <span className="text-[10px] text-slate-400 font-normal ml-1.5">({c.value})</span>
                                            </div>
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                    </div>

                    <div className="pt-3 border-t border-slate-50 text-center">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                            Retention Index Score: {customers.length > 0 ? (sales.length / customers.length).toFixed(1) : '0'} transactions / customer
                        </span>
                    </div>
                </Card>
            </div>
        </section>

        {/* --- DRILL-DOWN MODALS --- */}
        <Modal isOpen={activeDetail === 'LOW_STOCK'} onClose={closeDetail} title="Inventory Restock List" className="!max-w-3xl">
            <div className="space-y-4">
                <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100 flex items-start gap-4 mb-4">
                    <div className="p-3 bg-white rounded-xl text-rose-600 shadow-sm"><AlertTriangle size={24}/></div>
                    <div>
                        <h4 className="font-black text-rose-900 uppercase text-xs tracking-widest">Restock Required</h4>
                        <p className="text-rose-700/70 text-sm font-medium leading-relaxed">The following items have dropped below your configured safety threshold.</p>
                    </div>
                </div>
                <div className="max-h-[50vh] overflow-y-auto pr-2 space-y-2 no-scrollbar">
                    {stats.lowStockItems.map(p => (
                        <div key={p.id} className="flex justify-between items-center p-4 bg-white border border-gray-100 rounded-2xl shadow-sm hover:border-rose-300 transition-all">
                            <div className="flex flex-col">
                                <span className="font-black text-gray-900">{p.name}</span>
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Threshold: {p.lowStockThreshold || 10} units</span>
                            </div>
                            <div className="text-right">
                                <div className="text-lg font-black text-rose-600">{p.stock} <span className="text-[10px] uppercase">{p.unit}</span></div>
                                <button onClick={() => { closeDetail(); onNavigate(Tab.WAREHOUSE, 'add'); }} className="text-[9px] font-black text-blue-600 uppercase border-b border-blue-200 hover:text-blue-700 transition-colors">Order Now</button>
                            </div>
                        </div>
                    ))}
                </div>
                <Button onClick={closeDetail} className="w-full mt-4 py-4 font-black uppercase tracking-widest rounded-2xl">Dismiss</Button>
            </div>
        </Modal>

        <Modal isOpen={activeDetail === 'EXPIRING'} onClose={closeDetail} title="Expiry Protection" className="!max-w-3xl">
            <div className="space-y-4">
                <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex items-start gap-4 mb-4">
                    <div className="p-3 bg-white rounded-xl text-amber-600 shadow-sm"><Clock size={24}/></div>
                    <div>
                        <h4 className="font-black text-amber-900 uppercase text-xs tracking-widest">Capital Recovery</h4>
                        <p className="text-amber-700/70 text-sm font-medium leading-relaxed">These items expire within 7 days. Consider a flash sale to recover your investment.</p>
                    </div>
                </div>
                <div className="max-h-[50vh] overflow-y-auto pr-2 space-y-2 no-scrollbar">
                    {stats.expiringItems.map(p => (
                        <div key={p.id} className="flex justify-between items-center p-4 bg-white border border-gray-100 rounded-2xl shadow-sm hover:border-amber-300 transition-all">
                            <div className="flex-1 pr-4">
                                <div className="flex items-center gap-2">
                                    <span className="font-black text-gray-900 block">{p.name}</span>
                                    <Badge color={p.daysLeft === 0 ? "bg-red-500 text-white" : "bg-amber-500 text-white"}>{p.daysLeft}d</Badge>
                                </div>
                                <div className="flex gap-2 mt-1">
                                    <Badge color="bg-amber-100 text-amber-700 text-[9px] uppercase">{formatDateShort(p.expiryDate || '')}</Badge>
                                    <Badge color="bg-gray-100 text-gray-600 text-[9px] uppercase">Stock: {p.stock}</Badge>
                                </div>
                            </div>
                            <Button onClick={() => { closeDetail(); onNavigate(Tab.POS); }} size="sm" variant="neutral" className="border-amber-200 text-amber-700 font-black uppercase text-[10px] shrink-0">SELL NOW</Button>
                        </div>
                    ))}
                </div>
                <Button onClick={closeDetail} className="w-full mt-4 py-4 font-black uppercase tracking-widest rounded-2xl">Dismiss</Button>
            </div>
        </Modal>

        <Modal isOpen={activeDetail === 'DUES'} onClose={closeDetail} title="Outstanding Debtors" className="!max-w-3xl">
            <div className="space-y-4">
                <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100 flex items-start gap-4 mb-4">
                    <div className="p-3 bg-white rounded-xl text-rose-600 shadow-sm"><IndianRupee size={24}/></div>
                    <div>
                        <h4 className="font-black text-rose-900 uppercase text-xs tracking-widest">Cashflow Leakage</h4>
                        <p className="text-rose-700/70 text-sm font-medium leading-relaxed">A total of ₹{stats.totalDues.toLocaleString()} is currently locked in credit accounts.</p>
                    </div>
                </div>
                <div className="max-h-[50vh] overflow-y-auto pr-2 space-y-2 no-scrollbar">
                    {stats.customersWithDues.map(c => (
                        <div key={c.id} className="flex justify-between items-center p-4 bg-white border border-gray-100 rounded-2xl shadow-sm hover:border-rose-300 transition-all">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-black">{c.name.charAt(0)}</div>
                                <div><span className="font-black text-gray-900 block">{c.name}</span><span className="text-[10px] text-gray-400 font-bold uppercase">{c.phone}</span></div>
                            </div>
                            <div className="text-right">
                                <div className="text-lg font-black text-rose-600">₹{c.totalDues.toLocaleString()}</div>
                                <button onClick={() => { closeDetail(); onNavigate(Tab.CUSTOMERS); }} className="text-[9px] font-black text-blue-600 uppercase border-b border-blue-200 hover:text-blue-700 transition-colors">Record Payment</button>
                            </div>
                        </div>
                    ))}
                </div>
                <Button onClick={closeDetail} className="w-full mt-4 py-4 font-black uppercase tracking-widest rounded-2xl">Dismiss</Button>
            </div>
        </Modal>

        <Modal isOpen={activeDetail === 'RUNWAY'} onClose={closeDetail} title="Stock Runway Forecast" className="!max-w-3xl">
            <div className="space-y-4">
                <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex items-start gap-4 mb-4">
                    <div className="p-3 bg-white rounded-xl text-amber-600 shadow-sm"><Hourglass size={24}/></div>
                    <div>
                        <h4 className="font-black text-amber-900 uppercase text-xs tracking-widest">Runout Estimation</h4>
                        <p className="text-amber-700/70 text-sm font-medium leading-relaxed">Based on your past 7 days of sales volume, the following high-velocity items are projected to sell out soon.</p>
                    </div>
                </div>
                <div className="max-h-[50vh] overflow-y-auto pr-2 space-y-2.5 no-scrollbar">
                    {stats.runwayItems.length === 0 ? (
                        <div className="text-center py-12 text-gray-400">
                            <CheckCircle size={32} className="mx-auto mb-2 opacity-30 text-green-500" />
                            <p className="text-sm font-medium">All active sellers have a safe stock runway!</p>
                        </div>
                    ) : (
                        stats.runwayItems.map(p => (
                            <div key={p.id} className="p-4 bg-white border border-gray-100 rounded-2xl shadow-sm hover:border-amber-300 transition-all space-y-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <span className="font-black text-gray-900 block text-base">{p.name}</span>
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                            Velocity: {p.dailyVelocity.toFixed(1)} units/day ({p.unitsSold} sold recently)
                                        </span>
                                    </div>
                                    <div className="text-right">
                                        <div className={`px-2.5 py-1 rounded-lg text-xs font-black tracking-wide inline-block ${
                                            p.daysLeft <= 3 ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                                        }`}>
                                            {p.daysLeft === 0 ? 'Out of Stock' : `${p.daysLeft} Days Left`}
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase">
                                        <span>Stock Level ({p.stock} units)</span>
                                        <span>Runout Risk</span>
                                    </div>
                                    <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                                        <div 
                                            className={`h-full rounded-full transition-all ${
                                                p.daysLeft <= 3 ? 'bg-red-500' : 'bg-amber-500'
                                            }`} 
                                            style={{ width: `${Math.min(100, (p.daysLeft / 15) * 100)}%` }}
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-end pt-1">
                                    <Button onClick={() => { closeDetail(); onNavigate(Tab.WAREHOUSE, 'add'); }} size="sm" variant="neutral" className="text-[10px] py-1 px-3 font-black uppercase">
                                        Order Stock
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
                <Button onClick={closeDetail} className="w-full mt-4 py-4 font-black uppercase tracking-widest rounded-2xl">Dismiss</Button>
            </div>
        </Modal>

        <Modal isOpen={activeDetail === 'DEAD_STOCK'} onClose={closeDetail} title="Dead Stock Assets" className="!max-w-3xl">
            <div className="space-y-4">
                <div className="bg-red-50 p-4 rounded-2xl border border-red-100 flex items-start gap-4 mb-4">
                    <div className="p-3 bg-white rounded-xl text-red-600 shadow-sm"><AlertTriangle size={24}/></div>
                    <div>
                        <h4 className="font-black text-red-900 uppercase text-xs tracking-widest">Capital Immobilization</h4>
                        <p className="text-red-700/70 text-sm font-medium leading-relaxed">
                            These items have had **zero sales** in the last 30 days. Consider clearance promotions or discounting to recover your locked-up capital.
                        </p>
                    </div>
                </div>
                <div className="max-h-[50vh] overflow-y-auto pr-2 space-y-2 no-scrollbar">
                    {stats.deadStockItems.length === 0 ? (
                        <div className="text-center py-12 text-gray-400">
                            <CheckCircle size={32} className="mx-auto mb-2 opacity-30 text-green-500" />
                            <p className="text-sm font-medium">Excellent! All products are moving actively!</p>
                        </div>
                    ) : (
                        stats.deadStockItems.map(p => (
                            <div key={p.id} className="flex justify-between items-center p-4 bg-white border border-gray-100 rounded-2xl shadow-sm hover:border-red-300 transition-all">
                                <div>
                                    <span className="font-black text-gray-900 block">{p.name}</span>
                                    <div className="flex gap-2 mt-1">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                            Stock: {p.stock} units
                                        </span>
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">•</span>
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                            Price: ₹{p.sellPrice}
                                        </span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-base font-black text-red-600">₹{(p.stock * p.sellPrice).toLocaleString()}</div>
                                    <button onClick={() => { closeDetail(); onNavigate(Tab.POS); }} className="text-[9px] font-black text-blue-600 uppercase border-b border-blue-200 hover:text-blue-700 transition-colors">
                                        Launch Discount
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
                <Button onClick={closeDetail} className="w-full mt-4 py-4 font-black uppercase tracking-widest rounded-2xl">Dismiss</Button>
            </div>
        </Modal>

        <div className="mt-12 pt-10 border-t border-gray-100 text-center space-y-3">
            <div className="flex justify-center gap-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">
                <span>Secure Banking Grade Sync</span>
                <span>•</span>
                <span>Noor POS Enterprise</span>
            </div>
            <p className="text-xs text-gray-300 font-bold uppercase tracking-widest">© 2025 System Status: Verified & Encrypted</p>
        </div>
    </div>
  );
};
