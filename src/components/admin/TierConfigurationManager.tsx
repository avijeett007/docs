'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, RefreshCw, Settings } from 'lucide-react';

interface TierLimits {
  maxCustomers: number | null;
  maxVapiAgents: number | null;
  maxRetellAgents: number | null;
  maxUltravoxAgents: number | null;
  maxElevenlabsAgents: number | null;
  maxGhlAgents: number | null;
  maxKnovaAgents: number | null;
  maxNumberPools: number | null;
  saasMode: boolean;
}

interface TierConfig {
  tier: string;
  displayName: string;
  limits: TierLimits;
  isMarketing: boolean;
}

export default function TierConfigurationManager() {
  const [configs, setConfigs] = useState<TierConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchTierConfigs = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/tier-configurations');
      if (!response.ok) {
        throw new Error('Failed to fetch tier configurations');
      }
      const data = await response.json();
      setConfigs(data.configurations || []);
    } catch (err: any) {
      toast({
        title: 'Error',
        description: 'Failed to load tier configurations',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void fetchTierConfigs();
  }, [fetchTierConfigs]);

  const updateTierConfig = (tierIndex: number, field: keyof TierLimits, value: any) => {
    setConfigs(prev => prev.map((config, index) => {
      if (index === tierIndex) {
        return {
          ...config,
          limits: {
            ...config.limits,
            [field]: value
          }
        };
      }
      return config;
    }));
  };

  const saveTierConfigs = async () => {
    try {
      setSaving(true);
      const response = await fetch('/api/admin/tier-configurations', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ configurations: configs }),
      });

      if (!response.ok) {
        throw new Error('Failed to save tier configurations');
      }

      toast({
        title: 'Success',
        description: 'Tier configurations saved successfully',
      });
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to save tier configurations',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const renderLimitInput = (
    tierIndex: number,
    field: keyof TierLimits,
    label: string,
    config: TierConfig
  ) => {
    if (field === 'saasMode') {
      return (
        <div className="flex items-center space-x-2">
          <Switch
            id={`${config.tier}-${field}`}
            checked={config.limits[field] as boolean}
            onCheckedChange={(checked) => updateTierConfig(tierIndex, field, checked)}
          />
          <Label htmlFor={`${config.tier}-${field}`}>{label}</Label>
        </div>
      );
    }

    const value = config.limits[field] as number | null;
    
    return (
      <div className="space-y-2">
        <Label htmlFor={`${config.tier}-${field}`}>{label}</Label>
        <div className="flex items-center space-x-2">
          <Input
            id={`${config.tier}-${field}`}
            type="number"
            min="0"
            value={value === null ? '' : value.toString()}
            onChange={(e) => {
              const newValue = e.target.value === '' ? null : parseInt(e.target.value);
              updateTierConfig(tierIndex, field, newValue);
            }}
            placeholder="Unlimited"
            className="w-32"
          />
          <Badge variant={value === null ? 'secondary' : 'outline'}>
            {value === null ? 'Unlimited' : value.toString()}
          </Badge>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Tier Configuration Manager
          </CardTitle>
          <CardDescription>
            Configure limits for different partner tiers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Tier Configuration Manager
            </CardTitle>
            <CardDescription>
              Configure limits for different partner tiers. Marketing tiers have configurable limits, 
              while standard tiers (Starter, Pro, Ultimate, Unlimited) currently have unlimited access.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchTierConfigs}
              disabled={loading}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button
              onClick={saveTierConfigs}
              disabled={saving}
              size="sm"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="marketing_offer" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            {configs.map((config) => (
              <TabsTrigger key={config.tier} value={config.tier}>
                {config.displayName}
                {config.isMarketing && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    Marketing
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {configs.map((config, tierIndex) => (
            <TabsContent key={config.tier} value={config.tier} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Customer Limits</h3>
                  {renderLimitInput(tierIndex, 'maxCustomers', 'Max Customers', config)}
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Agent Limits</h3>
                  {renderLimitInput(tierIndex, 'maxVapiAgents', 'VAPI Agents', config)}
                  {renderLimitInput(tierIndex, 'maxRetellAgents', 'Retell Agents', config)}
                  {renderLimitInput(tierIndex, 'maxUltravoxAgents', 'Ultravox Agents', config)}
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">More Agent Types</h3>
                  {renderLimitInput(tierIndex, 'maxElevenlabsAgents', 'ElevenLabs Agents', config)}
                  {renderLimitInput(tierIndex, 'maxGhlAgents', 'GHL Agents', config)}
                  {renderLimitInput(tierIndex, 'maxKnovaAgents', 'Knova Agents', config)}
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Features</h3>
                  {renderLimitInput(tierIndex, 'maxNumberPools', 'Number Pools', config)}
                  {renderLimitInput(tierIndex, 'saasMode', 'SaaS Mode Enabled', config)}
                </div>
              </div>

              {!config.isMarketing && (
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> This tier currently has unlimited access to all features. 
                    Limits can be configured here if needed for future restrictions.
                  </p>
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
