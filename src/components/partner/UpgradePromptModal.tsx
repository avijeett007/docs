'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Crown, Zap, Users, Bot, Settings, Layers } from 'lucide-react';
import { MarketingTier, TIER_CONFIGURATIONS } from '@/lib/services/clientTierValidationService';

interface UpgradePromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTier: MarketingTier;
  suggestedTier: MarketingTier;
  feature: string;
  title: string;
  message: string;
}

const TIER_COLORS = {
  marketing_offer: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  free_forever: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  starter: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  pro: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  ultimate: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  unlimited: 'bg-green-500/20 text-green-300 border-green-500/30',
};

const TIER_ICONS = {
  marketing_offer: Zap,
  free_forever: Settings,
  starter: Users,
  pro: Bot,
  ultimate: Crown,
  unlimited: Crown,
};

export default function UpgradePromptModal({
  isOpen,
  onClose,
  currentTier,
  suggestedTier,
  feature,
  title,
  message,
}: UpgradePromptModalProps) {
  const [isLoading, setIsLoading] = useState(false);

  const currentLimits = TIER_CONFIGURATIONS[currentTier] || TIER_CONFIGURATIONS['marketing_offer'];
  const suggestedLimits = TIER_CONFIGURATIONS[suggestedTier] || TIER_CONFIGURATIONS['starter'];

  const CurrentIcon = TIER_ICONS[currentTier] || TIER_ICONS['marketing_offer'];
  const SuggestedIcon = TIER_ICONS[suggestedTier];

  const handleUpgrade = async () => {
    setIsLoading(true);
    // TODO: Implement upgrade flow - redirect to pricing page or Stripe checkout
    // For now, just close the modal
    setTimeout(() => {
      setIsLoading(false);
      onClose();
    }, 1000);
  };

  const formatLimit = (limit: number | null) => {
    return limit === null ? 'Unlimited' : limit.toString();
  };

  const getFeatureIcon = (feature: string) => {
    if (feature.includes('customers')) return Users;
    if (feature.includes('agents')) return Bot;
    if (feature.includes('pool')) return Layers;
    if (feature.includes('saas')) return Settings;
    return Zap;
  };

  const FeatureIcon = getFeatureIcon(feature);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-gray-900 border-gray-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl text-white">
            <FeatureIcon className="h-6 w-6 text-orange-400" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Situation */}
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
            <p className="text-gray-300 mb-2">{message}</p>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Current Plan:</span>
              <Badge className={TIER_COLORS[currentTier]}>
                <CurrentIcon className="h-3 w-3 mr-1" />
                {currentTier.replace('_', ' ').toUpperCase()}
              </Badge>
            </div>
          </div>

          {/* Comparison */}
          <div className="grid grid-cols-2 gap-4">
            {/* Current Tier */}
            <div className="border border-gray-600 rounded-lg p-4 bg-gray-800/50">
              <div className="flex items-center gap-2 mb-3">
                <CurrentIcon className="h-5 w-5 text-gray-400" />
                <h3 className="font-semibold text-gray-200">
                  {currentTier.replace('_', ' ').toUpperCase()}
                </h3>
                <Badge variant="outline" className="text-xs border-gray-500 text-gray-300">Current</Badge>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Customers:</span>
                  <span className="font-medium text-gray-200">{formatLimit(currentLimits.maxCustomers)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">VAPI Agents:</span>
                  <span className="font-medium text-gray-200">{formatLimit(currentLimits.maxVapiAgents)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Retell Agents:</span>
                  <span className="font-medium text-gray-200">{formatLimit(currentLimits.maxRetellAgents)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Number Pools:</span>
                  <span className="font-medium text-gray-200">{formatLimit(currentLimits.maxNumberPools)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">SaaS Mode:</span>
                  <span className={`font-medium ${currentLimits.saasMode ? 'text-green-400' : 'text-red-400'}`}>
                    {currentLimits.saasMode ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
            </div>

            {/* Suggested Tier */}
            <div className="border-2 border-blue-500/50 rounded-lg p-4 bg-blue-500/10">
              <div className="flex items-center gap-2 mb-3">
                <SuggestedIcon className="h-5 w-5 text-blue-400" />
                <h3 className="font-semibold text-blue-300">
                  {suggestedTier.replace('_', ' ').toUpperCase()}
                </h3>
                <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs">
                  Recommended
                </Badge>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Customers:</span>
                  <span className="font-medium text-blue-300">{formatLimit(suggestedLimits.maxCustomers)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">VAPI Agents:</span>
                  <span className="font-medium text-blue-300">{formatLimit(suggestedLimits.maxVapiAgents)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Retell Agents:</span>
                  <span className="font-medium text-blue-300">{formatLimit(suggestedLimits.maxRetellAgents)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Number Pools:</span>
                  <span className="font-medium text-blue-300">{formatLimit(suggestedLimits.maxNumberPools)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">SaaS Mode:</span>
                  <span className={`font-medium ${suggestedLimits.saasMode ? 'text-green-400' : 'text-red-400'}`}>
                    {suggestedLimits.saasMode ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Benefits */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <h4 className="font-semibold text-blue-300 mb-2">What you'll get with {suggestedTier.replace('_', ' ').toUpperCase()}:</h4>
            <ul className="space-y-1 text-sm text-blue-200">
              {suggestedLimits.maxCustomers && currentLimits.maxCustomers && suggestedLimits.maxCustomers > currentLimits.maxCustomers && (
                <li>• {suggestedLimits.maxCustomers - currentLimits.maxCustomers} customers</li>
              )}
              {suggestedLimits.maxVapiAgents && currentLimits.maxVapiAgents && suggestedLimits.maxVapiAgents > currentLimits.maxVapiAgents && (
                <li>• {suggestedLimits.maxVapiAgents - currentLimits.maxVapiAgents} VAPI agents</li>
              )}
              {suggestedLimits.maxRetellAgents && currentLimits.maxRetellAgents && suggestedLimits.maxRetellAgents > currentLimits.maxRetellAgents && (
                <li>• {suggestedLimits.maxRetellAgents - currentLimits.maxRetellAgents} Retell agents</li>
              )}
              {suggestedLimits.maxNumberPools && currentLimits.maxNumberPools && suggestedLimits.maxNumberPools > currentLimits.maxNumberPools && (
                <li>• {suggestedLimits.maxNumberPools - currentLimits.maxNumberPools} number pools</li>
              )}
              {suggestedLimits.maxNumberPools === null && currentLimits.maxNumberPools !== null && (
                <li>• Unlimited number pools</li>
              )}
              {suggestedLimits.saasMode && !currentLimits.saasMode && (
                <li>• SaaS mode with subscription plan creation</li>
              )}
              {suggestedTier === 'ultimate' && (
                <li>• Unlimited everything - no more limits!</li>
              )}
            </ul>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleUpgrade}
              disabled={isLoading}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              {isLoading ? (
                'Processing...'
              ) : (
                <>
                  Upgrade to {suggestedTier.replace('_', ' ').toUpperCase()}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="px-6"
            >
              Maybe Later
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
