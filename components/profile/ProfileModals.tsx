import React from 'react';
import { Button, Modal } from '../UI';
import { Trash2, RotateCcw, AlertTriangle, Scale, Users, Box, Receipt } from 'lucide-react';
import { DeletedItem } from '../../types';

interface ProfileModalsProps {
    // Recycle Bin
    showRecycleBin: boolean;
    setShowRecycleBin: (val: boolean) => void;
    recycleRetention: number;
    deletedItems: DeletedItem[];
    groupedDeletedItems: Record<string, DeletedItem[]>;
    handleEmptyBin: () => void;
    handleRestoreItem: (id: string) => void;
    handlePermanentDelete: (id: string) => void;
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: () => void;

    // Factory Reset
    showResetConfirm: boolean;
    setShowResetConfirm: (val: boolean) => void;
    handleReset: () => void;

    // Shift Log
    showShiftLogModal: boolean;
    setShowShiftLogModal: (val: boolean) => void;
    openingCash: string;
    setOpeningCash: (val: string) => void;
    closingCash: string;
    setClosingCash: (val: string) => void;
    shiftNotes: string;
    setShiftNotes: (val: string) => void;
    totalRevenue: number;
    handleSaveShiftLog: () => void;

    // Staff Modal
    showStaffModal: boolean;
    setShowStaffModal: (val: boolean) => void;
    editingStaffId: string | null;
    staffForm: { id: string; name: string; pin: string; role: 'pos' | 'inventory' };
    setStaffForm: React.Dispatch<React.SetStateAction<{ id: string; name: string; pin: string; role: 'pos' | 'inventory' }>>;
    handleSaveStaff: (e: React.FormEvent) => void;

    // Confirmation Modal
    confirmDialog: { isOpen: boolean; title: string; message: string; onConfirm: () => void } | null;
    setConfirmDialog: (val: any) => void;
}

export const ProfileModals: React.FC<ProfileModalsProps> = ({
    showRecycleBin,
    setShowRecycleBin,
    recycleRetention,
    deletedItems,
    groupedDeletedItems,
    handleEmptyBin,
    handleRestoreItem,
    handlePermanentDelete,
    onTouchStart,
    onTouchMove,
    onTouchEnd,

    showResetConfirm,
    setShowResetConfirm,
    handleReset,

    showShiftLogModal,
    setShowShiftLogModal,
    openingCash,
    setOpeningCash,
    closingCash,
    setClosingCash,
    shiftNotes,
    setShiftNotes,
    totalRevenue,
    handleSaveShiftLog,

    showStaffModal,
    setShowStaffModal,
    editingStaffId,
    staffForm,
    setStaffForm,
    handleSaveStaff,

    confirmDialog,
    setConfirmDialog,
}) => {
    return (
        <>
            {/* --- RECYCLE BIN MODAL --- */}
            <Modal isOpen={showRecycleBin} onClose={() => { setShowRecycleBin(false); window.history.back(); }} title="Recycle Bin" className="!max-w-4xl h-[80vh] flex flex-col p-0">
                <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
                    <div className="px-6 py-4 bg-white border-b border-slate-100 flex justify-between items-center shrink-0">
                        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Auto-purge configured for {recycleRetention} days</span>
                        {deletedItems.length > 0 && (
                            <Button size="sm" variant="danger" onClick={handleEmptyBin} className="bg-red-50 hover:bg-red-100 text-red-600 font-bold px-3 py-1.5 rounded-full border-0 text-xs">
                                Purge All Items
                            </Button>
                        )}
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {deletedItems.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 py-16">
                                <Trash2 size={48} className="mb-3 opacity-20 text-slate-500"/>
                                <p className="font-semibold text-xs">Your recycle bin is completely empty.</p>
                            </div>
                        ) : (
                            Object.entries(groupedDeletedItems).map(([dateLabel, items]) => (
                                <div key={dateLabel} className="space-y-3">
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{dateLabel}</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {(items as DeletedItem[]).map(item => {
                                            let Icon = Box; let name = "Unknown"; let detail = "";
                                            if (item.type === 'product') { Icon = Box; name = item.data.name; detail = `Stock: ${item.data.stock}`; }
                                            else if (item.type === 'customer') { Icon = Users; name = item.data.name; detail = item.data.phone; }
                                            else if (item.type === 'sale') { Icon = Receipt; name = `Invoice #${item.data.id.slice(0,6).toUpperCase()}`; detail = `₹${item.data.total}`; }
                                            return (
                                                <div key={item.id} className="bg-white p-3.5 rounded-2xl border border-slate-150/40 shadow-sm flex justify-between items-center group transition-all hover:border-slate-200">
                                                    <div className="flex items-center gap-3 overflow-hidden">
                                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-slate-50 text-slate-600 border border-slate-100/60">
                                                            <Icon size={18}/>
                                                        </div>
                                                        <div className="min-w-0 text-left">
                                                            <div className="font-bold text-slate-800 text-xs truncate">{name}</div>
                                                            <div className="text-[10px] text-slate-400 font-semibold truncate">{detail}</div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 shrink-0 pl-1">
                                                        <button onClick={() => handleRestoreItem(item.id)} className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg border-0 cursor-pointer transition-colors" title="Restore Item"><RotateCcw size={14}/></button>
                                                        <button onClick={() => handlePermanentDelete(item.id)} className="p-2 bg-red-50 text-red-500 hover:bg-red-100 rounded-lg border-0 cursor-pointer transition-colors" title="Delete Permanently"><Trash2 size={14}/></button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </Modal>

            {/* --- FACTORY RESET CONFIRM MODAL --- */}
            <Modal isOpen={showResetConfirm} onClose={() => { setShowResetConfirm(false); window.history.back(); }} title="Confirm Factory Reset">
                <div className="text-center py-4 space-y-4">
                    <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-1 border border-red-100/40">
                        <AlertTriangle size={32} />
                    </div>
                    <h3 className="text-base font-black text-gray-950">Erase System Data?</h3>
                    <p className="text-xs text-slate-500 leading-relaxed font-semibold max-w-xs mx-auto">This will delete ALL local cache data, logs, database pointers, and disconnect the cloud sync on this browser permanently.</p>
                    <div className="flex gap-2.5 pt-4">
                        <Button variant="neutral" className="flex-1 font-bold uppercase text-xs" onClick={() => { setShowResetConfirm(false); window.history.back(); }}>Cancel</Button>
                        <Button variant="danger" className="flex-1 font-bold uppercase text-xs" onClick={handleReset}>Yes, Reset</Button>
                    </div>
                </div>
            </Modal>

            {/* --- SHIFT CASH LOG RECONCILIATION MODAL --- */}
            <Modal isOpen={showShiftLogModal} onClose={() => setShowShiftLogModal(false)} title="Shift Cash Reconciliation Log" className="!max-w-lg">
                <div className="space-y-4">
                    <div className="p-3.5 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-start gap-3">
                        <Scale size={20} className="text-indigo-600 shrink-0 mt-0.5" />
                        <div className="text-left">
                            <h4 className="font-black text-indigo-900 text-xs uppercase tracking-widest">Active Cash Audit</h4>
                            <p className="text-indigo-800/80 text-[10px] leading-relaxed font-semibold">
                                Audit drawer cash balances to find shortages or overages against the overall POS transactions.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-3.5">
                        <div className="text-left">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1 px-1">Opening Cash Balance (₹)</label>
                            <input 
                                type="number"
                                placeholder="0.00"
                                value={openingCash}
                                onChange={(e) => setOpeningCash(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-150 focus:border-indigo-500 focus:bg-white rounded-2xl font-bold outline-none text-xs text-gray-900 transition-all"
                            />
                        </div>

                        <div className="text-left">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1 px-1">Closing Cash Balance (₹)</label>
                            <input 
                                type="number"
                                placeholder="0.00"
                                value={closingCash}
                                onChange={(e) => setClosingCash(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-150 focus:border-indigo-500 focus:bg-white rounded-2xl font-bold outline-none text-xs text-gray-900 transition-all"
                            />
                        </div>

                        <div className="text-left">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1 px-1">Reconciliation Notes</label>
                            <textarea 
                                placeholder="e.g. Discrepancy due to custom discount or physical change mismatch"
                                value={shiftNotes}
                                onChange={(e) => setShiftNotes(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-150 focus:border-indigo-500 focus:bg-white rounded-2xl font-semibold outline-none text-xs text-gray-900 h-20 resize-none transition-all"
                            />
                        </div>
                    </div>

                    {openingCash && closingCash && (
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-150 space-y-2.5 text-left">
                            <h5 className="text-[9px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-200 pb-1.5">Live Reconciliation Matrix</h5>
                            
                            <div className="flex justify-between text-xs font-bold text-slate-600">
                                <span>Register cash transactions:</span>
                                <span className="text-slate-900">+ ₹{totalRevenue.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-xs font-bold text-slate-600">
                                <span>Expected closing cash:</span>
                                <span className="text-slate-900">₹{((parseFloat(openingCash) || 0) + totalRevenue).toLocaleString()}</span>
                            </div>
                            
                            {(() => {
                                const open = parseFloat(openingCash) || 0;
                                const close = parseFloat(closingCash) || 0;
                                const expected = open + totalRevenue;
                                const diff = close - expected;
                                const isBalanced = Math.abs(diff) < 0.1;

                                return (
                                    <div className="pt-2 border-t border-dashed border-slate-200 flex justify-between items-center">
                                        <span className="text-[10px] font-black text-slate-800 uppercase">Audit Variance:</span>
                                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide border ${
                                            isBalanced 
                                            ? 'bg-green-50 text-green-700 border-green-200' 
                                            : diff > 0 
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                                : 'bg-rose-50 text-rose-700 border-rose-200'
                                        }`}>
                                            {isBalanced 
                                                ? 'Perfect Balance' 
                                                : diff > 0 
                                                    ? `Overage (+ ₹${diff.toLocaleString()})` 
                                                    : `Shortage (- ₹${Math.abs(diff).toLocaleString()})`}
                                        </span>
                                    </div>
                                );
                            })()}
                        </div>
                    )}

                    <div className="flex gap-2.5 pt-2">
                        <Button variant="neutral" className="flex-1 py-3.5 font-bold uppercase text-xs" onClick={() => setShowShiftLogModal(false)}>
                            Cancel
                        </Button>
                        <Button className="flex-1 py-3.5 font-bold uppercase text-xs shadow-lg shadow-indigo-100 bg-indigo-600 border-0 text-white" onClick={handleSaveShiftLog}>
                            Submit Audit
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* --- REGISTER STAFF MODAL --- */}
            <Modal isOpen={showStaffModal} onClose={() => setShowStaffModal(false)} title={editingStaffId ? "Edit Staff Credentials" : "Register New Staff Member"}>
                <form onSubmit={(e) => { e.preventDefault(); handleSaveStaff(e); }} className="space-y-4 text-left">
                    <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-start gap-3">
                        <Users size={20} className="text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                            <h4 className="font-black text-emerald-900 text-xs uppercase tracking-widest">Staff Access Control</h4>
                            <p className="text-emerald-800/80 text-[10px] leading-relaxed font-semibold">
                                Assign roles and secure PIN codes to allow staff members to login and manage POS or warehouse modules.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-3.5">
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1 px-1">Staff ID (Username)</label>
                            <input 
                                type="text"
                                placeholder="e.g. johndoe"
                                disabled={!!editingStaffId}
                                value={staffForm.id}
                                onChange={(e) => setStaffForm({ ...staffForm, id: e.target.value.toLowerCase().replace(/\s+/g, '') })}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-150 focus:border-indigo-500 rounded-2xl font-bold outline-none text-xs text-slate-900 disabled:opacity-50 transition-all"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1 px-1">Staff Name</label>
                            <input 
                                type="text"
                                placeholder="e.g. John Doe"
                                value={staffForm.name}
                                onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-150 focus:border-indigo-500 rounded-2xl font-bold outline-none text-xs text-slate-900 transition-all"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1 px-1">Secure Sign-In PIN</label>
                            <input 
                                type="password"
                                placeholder="Min 4 digits"
                                maxLength={6}
                                value={staffForm.pin}
                                onChange={(e) => setStaffForm({ ...staffForm, pin: e.target.value.replace(/\D/g, '') })}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-150 focus:border-indigo-500 rounded-2xl font-bold outline-none text-xs text-slate-900 tracking-widest transition-all"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1 px-1">Assigned Role & Privilege</label>
                            <select
                                value={staffForm.role}
                                onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value as 'pos' | 'inventory' })}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-150 focus:border-indigo-500 rounded-2xl font-bold outline-none text-xs text-slate-900 cursor-pointer transition-all"
                            >
                                <option value="pos">POS Terminal (Sales & Invoicing)</option>
                                <option value="inventory">Warehouse Manager (Stock & Deliveries)</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex gap-2.5 pt-2">
                        <Button type="button" variant="neutral" className="flex-1 py-3.5 font-bold uppercase text-xs" onClick={() => setShowStaffModal(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" className="flex-1 py-3.5 font-bold uppercase text-xs shadow-lg shadow-emerald-100 bg-emerald-600 hover:bg-emerald-700 text-white border-0">
                            {editingStaffId ? "Save Changes" : "Register Staff"}
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* --- CUSTOM CONFIRMATION MODAL --- */}
            <Modal 
                isOpen={confirmDialog?.isOpen || false} 
                onClose={() => setConfirmDialog(null)} 
                title={confirmDialog?.title || "Confirm Action"}
            >
                <div className="space-y-6 text-left">
                    <p className="text-xs text-slate-600 leading-relaxed font-bold">
                        {confirmDialog?.message}
                    </p>
                    <div className="flex gap-2.5">
                        <Button 
                            variant="neutral" 
                            className="flex-1 py-3 font-bold uppercase text-xs" 
                            onClick={() => setConfirmDialog(null)}
                        >
                            Cancel
                        </Button>
                        <Button 
                            className="flex-1 py-3 font-bold uppercase text-xs bg-indigo-600 hover:bg-indigo-700 text-white border-0" 
                            onClick={() => {
                                if (confirmDialog?.onConfirm) {
                                    confirmDialog.onConfirm();
                                }
                            }}
                        >
                            Confirm
                        </Button>
                    </div>
                </div>
            </Modal>
        </>
    );
};
