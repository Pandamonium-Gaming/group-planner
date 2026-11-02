'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Package, Search } from 'lucide-react';
import { Modal, ModalFooter } from '@/components/ui/Modal';
import { useLanguage } from '@/contexts/LanguageContext';
import { ResourceCatalog, ResourceCategory, RESOURCE_CATEGORY_CONFIG } from '@/lib/types';

type TransactionType = 'deposit' | 'withdraw';

interface BankTransactionFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (resourceId: string, quantity: number, notes?: string) => Promise<void>;
  transactionType: TransactionType;
  resourceCatalog: ResourceCatalog[];
  inventoryQuantity?: (resourceId: string) => number; // For withdraw limits
}

/**
 * Form modal for depositing or withdrawing resources from guild bank
 */
export function BankTransactionForm({
  isOpen,
  onClose,
  onSubmit,
  transactionType,
  resourceCatalog,
  inventoryQuantity,
}: BankTransactionFormProps) {
  const { t } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedResource, setSelectedResource] = useState<ResourceCatalog | null>(null);
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ResourceCategory | 'all'>('all');

  // Reset form when opening
  useEffect(() => {
    if (!isOpen) return;

    const timerId = setTimeout(() => {
      setSearchQuery('');
      setSelectedResource(null);
      setQuantity('');
      setNotes('');
      setError(null);
    }, 0);

    return () => clearTimeout(timerId);
  }, [isOpen]);

  // Filter resources
  const filteredResources = resourceCatalog.filter((resource) => {
    const matchesSearch = resource.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || resource.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Get available quantity for withdrawals
  const availableQty = selectedResource && inventoryQuantity 
    ? inventoryQuantity(selectedResource.id) 
    : Infinity;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedResource) {
      setError(t('bank.errorSelectResource'));
      return;
    }

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) {
      setError(t('bank.errorInvalidQuantity'));
      return;
    }

    if (transactionType === 'withdraw' && qty > availableQty) {
      setError(t('bank.errorInsufficientResources'));
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(selectedResource.id, qty, notes.trim() || undefined);
      onClose();
    } catch (err) {
      console.error('Transaction error:', err);
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const isDeposit = transactionType === 'deposit';
  const Icon = isDeposit ? TrendingUp : TrendingDown;
  const bgClass = isDeposit ? 'bg-green-500' : 'bg-red-500';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isDeposit ? t('bank.deposit') : t('bank.withdraw')}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Resource Selection */}
        {!selectedResource ? (
          <div className="space-y-3">
            {/* Search & Filter */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('bank.searchResources')}
                  aria-label={t('bank.searchResources')}
                  className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as ResourceCategory | 'all')}
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500"
                aria-label={t('bank.allCategories')}
              >
                <option value="all">{t('bank.allCategories')}</option>
                {Object.entries(RESOURCE_CATEGORY_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>
                    {config.icon} {t(`bank.categories.${key}`)}
                  </option>
                ))}
              </select>
            </div>

            {/* Resource List */}
            <div className="max-h-64 overflow-y-auto space-y-1">
              {filteredResources.length === 0 ? (
                <div className="text-center py-4 text-slate-500 text-sm">
                  {t('loot.noMatchingItems')}
                </div>
              ) : (
                filteredResources.slice(0, 20).map((resource) => (
                  <button
                    key={resource.id}
                    type="button"
                    onClick={() => setSelectedResource(resource)}
                    className="w-full flex items-center justify-between p-3 bg-slate-800 hover:bg-slate-700 rounded-lg text-left transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span>{RESOURCE_CATEGORY_CONFIG[resource.category].icon}</span>
                      <span className="text-white">{resource.name}</span>
                    </div>
                    {inventoryQuantity && transactionType === 'withdraw' && (
                      <span className="text-sm text-slate-400">
                        {inventoryQuantity(resource.id)} {t('common.available')}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Selected Resource */}
            <div className="flex items-center justify-between p-3 bg-slate-800 border border-amber-500/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/20 rounded-lg">
                  <Package className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <div className="font-medium text-white">{selectedResource.name}</div>
                  <div className="text-xs text-slate-500">
                    {RESOURCE_CATEGORY_CONFIG[selectedResource.category].icon} {t(`bank.categories.${selectedResource.category}`)}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedResource(null)}
                className="text-sm text-slate-400 hover:text-white"
              >
                {t('common.change')}
              </button>
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                {t('loot.amount')} *
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="bank-transaction-amount"
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  min="1"
                  max={transactionType === 'withdraw' ? availableQty : undefined}
                  placeholder="0"
                  className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
                {transactionType === 'withdraw' && availableQty < Infinity && (
                  <button
                    type="button"
                    onClick={() => setQuantity(availableQty.toString())}
                    className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm"
                  >
                    Max ({availableQty})
                  </button>
                )}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="bank-transaction-notes" className="block text-sm font-medium text-slate-300 mb-1">
                {t('loot.reason')} ({t('common.optional')})
              </label>
              <input
                id="bank-transaction-notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={isDeposit ? t('bank.depositNotesPlaceholder') : t('bank.withdrawNotesPlaceholder')}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <ModalFooter>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-slate-300 hover:text-white transition-colors disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !selectedResource || !quantity}
            className={`px-6 py-2 ${bgClass} hover:opacity-90 disabled:opacity-50 text-white rounded-lg font-medium transition-colors flex items-center gap-2`}
          >
            <Icon className="w-4 h-4" />
            {isSubmitting ? t('common.loading') : isDeposit ? t('bank.deposit') : t('bank.withdraw')}
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

