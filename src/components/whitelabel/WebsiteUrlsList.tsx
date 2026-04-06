'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { 
  Globe, 
  Clock, 
  Trash2, 
  Settings, 
  ExternalLink,
  Calendar,
  CheckCircle2,
  XCircle,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

interface WebsitePage {
  id: string;
  url: string;
  title?: string;
  lastScrapedAt?: string;
  scrapingStatus: string;
  scrapingError?: string;
}

interface WebsiteUrl {
  id: string;
  baseUrl: string;
  scrapingFrequency: string;
  isActive: boolean;
  lastScrapedAt?: string;
  nextScrapeAt?: string;
  createdAt: string;
  pages: WebsitePage[];
}

interface WebsiteUrlsListProps {
  websiteUrls: WebsiteUrl[];
  onUpdate: () => void;
  primaryColor?: string;
}

export default function WebsiteUrlsList({ websiteUrls, onUpdate, primaryColor = '#3B82F6' }: WebsiteUrlsListProps) {
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());

  const handleUpdateFrequency = async (id: string, frequency: string) => {
    setUpdatingIds(prev => new Set(prev).add(id));
    
    try {
      const response = await fetch('/api/whitelabel/knowledge-base/website-urls', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id,
          scrapingFrequency: frequency,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update frequency');
      }

      toast.success('Scraping frequency updated');
      onUpdate();
    } catch (error: any) {
      console.error('Error updating frequency:', error);
      toast.error(error.message || 'Failed to update frequency');
    } finally {
      setUpdatingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    setUpdatingIds(prev => new Set(prev).add(id));
    
    try {
      const response = await fetch('/api/whitelabel/knowledge-base/website-urls', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id,
          isActive,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update status');
      }

      toast.success(isActive ? 'Website URL activated' : 'Website URL deactivated');
      onUpdate();
    } catch (error: any) {
      console.error('Error updating status:', error);
      toast.error(error.message || 'Failed to update status');
    } finally {
      setUpdatingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  const handleDelete = async (id: string, baseUrl: string) => {
    if (!confirm(`Are you sure you want to remove ${baseUrl} from this knowledge base?`)) {
      return;
    }

    setUpdatingIds(prev => new Set(prev).add(id));
    
    try {
      const response = await fetch(`/api/whitelabel/knowledge-base/website-urls?id=${id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete website URL');
      }

      toast.success('Website URL removed');
      onUpdate();
    } catch (error: any) {
      console.error('Error deleting website URL:', error);
      toast.error(error.message || 'Failed to delete website URL');
    } finally {
      setUpdatingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  const getFrequencyLabel = (frequency: string) => {
    switch (frequency) {
      case '24h': return 'Every 24 hours';
      case 'weekly': return 'Weekly';
      case 'monthly': return 'Monthly';
      default: return frequency;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge
            variant="default"
            style={{ backgroundColor: primaryColor }}
            className="text-white"
          >
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      case 'failed':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (websiteUrls.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No website URLs added yet</p>
        <p className="text-sm">Add website URLs to include web content in your knowledge base</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {websiteUrls.map((websiteUrl) => (
        <Card key={websiteUrl.id} className={!websiteUrl.isActive ? 'opacity-60' : ''}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-base flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  {websiteUrl.baseUrl}
                  <a
                    href={websiteUrl.baseUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </CardTitle>
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {getFrequencyLabel(websiteUrl.scrapingFrequency)}
                  </span>
                  <span>{websiteUrl.pages.length} pages</span>
                  {websiteUrl.lastScrapedAt && (
                    <span>
                      Last scraped: {new Date(websiteUrl.lastScrapedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={websiteUrl.isActive}
                  onCheckedChange={(checked) => handleToggleActive(websiteUrl.id, checked)}
                  disabled={updatingIds.has(websiteUrl.id)}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(websiteUrl.id, websiteUrl.baseUrl)}
                  disabled={updatingIds.has(websiteUrl.id)}
                >
                  {updatingIds.has(websiteUrl.id) ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="pt-0">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Scraping Frequency:</span>
              </div>
              <Select
                value={websiteUrl.scrapingFrequency}
                onValueChange={(value) => handleUpdateFrequency(websiteUrl.id, value)}
                disabled={updatingIds.has(websiteUrl.id)}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24h">Every 24 hours</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {websiteUrl.pages.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Pages ({websiteUrl.pages.length})</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {websiteUrl.pages.slice(0, 10).map((page) => (
                    <div key={page.id} className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded">
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium">{page.title || 'Untitled Page'}</p>
                        <p className="truncate text-muted-foreground text-xs">{page.url}</p>
                      </div>
                      <div className="ml-2">
                        {getStatusBadge(page.scrapingStatus)}
                      </div>
                    </div>
                  ))}
                  {websiteUrl.pages.length > 10 && (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      ... and {websiteUrl.pages.length - 10} more pages
                    </p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
