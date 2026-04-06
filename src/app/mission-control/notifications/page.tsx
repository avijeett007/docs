'use client';

import { useState, useEffect } from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAdminAuth } from '@/components/admin/AdminAuthProvider';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Edit2, Trash2, Eye, EyeOff, Send, Users, Clock, Bell, AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error' | 'migration';
  targetAudience: 'partners' | 'customers' | 'all';
  priority: number;
  isActive: boolean;
  expiresAt?: string;
  actionUrl?: string;
  actionText?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export default function NotificationsManagement() {
  const { user } = useAdminAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingNotification, setEditingNotification] = useState<Notification | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    type: 'info' as 'info' | 'warning' | 'success' | 'error' | 'migration',
    targetAudience: 'all' as 'all' | 'partners' | 'customers',
    priority: 1,
    expiresAt: '',
    actionUrl: '',
    actionText: ''
  });

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      setLoading(true);
      // For now, we'll use a simple admin endpoint
      // In production, this would require proper admin authentication
      const response = await fetch('/api/admin/notifications');
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  // Create or update notification
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    try {
      const url = editingNotification
        ? `/api/admin/notifications/${editingNotification.id}`
        : '/api/admin/notifications';

      const method = editingNotification ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          expiresAt: formData.expiresAt || null,
          createdBy: user?.email || 'admin'
        })
      });

      if (response.ok) {
        await fetchNotifications();
        setShowCreateModal(false);
        setEditingNotification(null);
        resetForm();
        toast({
          title: editingNotification ? 'Notification Updated' : 'Notification Created',
          description: `The notification has been ${editingNotification ? 'updated' : 'created'} successfully.`,
        });
      } else {
        throw new Error('Failed to save notification');
      }
    } catch (error) {
      console.error('Error saving notification:', error);
      toast({
        title: 'Error',
        description: 'Failed to save notification. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Delete notification
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this notification?')) return;

    try {
      const response = await fetch(`/api/admin/notifications/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await fetchNotifications();
        toast({
          title: 'Notification Deleted',
          description: 'The notification has been deleted successfully.',
        });
      } else {
        throw new Error('Failed to delete notification');
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete notification. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Toggle active status
  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/admin/notifications/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isActive: !isActive })
      });

      if (response.ok) {
        await fetchNotifications();
        toast({
          title: `Notification ${!isActive ? 'Activated' : 'Deactivated'}`,
          description: `The notification has been ${!isActive ? 'activated' : 'deactivated'} successfully.`,
        });
      } else {
        throw new Error('Failed to toggle notification status');
      }
    } catch (error) {
      console.error('Error toggling notification status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update notification status. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      title: '',
      message: '',
      type: 'info' as 'info' | 'warning' | 'success' | 'error' | 'migration',
      targetAudience: 'all' as 'all' | 'partners' | 'customers',
      priority: 1,
      expiresAt: '',
      actionUrl: '',
      actionText: ''
    });
  };

  // Edit notification
  const handleEdit = (notification: Notification) => {
    setEditingNotification(notification);
    setFormData({
      title: notification.title,
      message: notification.message,
      type: notification.type,
      targetAudience: notification.targetAudience,
      priority: notification.priority,
      expiresAt: notification.expiresAt ? notification.expiresAt.split('T')[0] : '',
      actionUrl: notification.actionUrl || '',
      actionText: notification.actionText || ''
    });
    setShowCreateModal(true);
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const getTypeBadgeVariant = (type: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (type) {
      case 'warning': return 'default';
      case 'error': return 'destructive';
      case 'success': return 'default';
      case 'migration': return 'default';
      default: return 'secondary';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'warning': return <AlertTriangle className="w-3 h-3 mr-1" />;
      case 'error': return <XCircle className="w-3 h-3 mr-1" />;
      case 'success': return <CheckCircle className="w-3 h-3 mr-1" />;
      case 'migration': return <Bell className="w-3 h-3 mr-1" />;
      default: return <Info className="w-3 h-3 mr-1" />;
    }
  };

  const getAudienceIcon = (audience: string) => {
    switch (audience) {
      case 'partners': return <Users className="w-3 h-3 mr-1" />;
      case 'customers': return <Users className="w-3 h-3 mr-1" />;
      default: return <Users className="w-3 h-3 mr-1" />;
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen">
      <AdminSidebar />
      <div className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Platform Notifications</h1>
              <p className="text-gray-500 mt-2">Manage notifications for partners and customers</p>
            </div>
            <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
              <DialogTrigger asChild>
                <Button
                  onClick={() => {
                    resetForm();
                    setEditingNotification(null);
                  }}
                  className="flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Create Notification
                </Button>
              </DialogTrigger>

              {/* Create/Edit Modal */}
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingNotification ? 'Edit Notification' : 'Create New Notification'}
                  </DialogTitle>
                  <DialogDescription>
                    {editingNotification
                      ? 'Update the notification details below.'
                      : 'Create a new platform notification for partners and customers.'
                    }
                  </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Title */}
                  <div className="space-y-2">
                    <Label htmlFor="title">Title *</Label>
                    <Input
                      id="title"
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      required
                      placeholder="Enter notification title"
                    />
                  </div>

                  {/* Message */}
                  <div className="space-y-2">
                    <Label htmlFor="message">Message *</Label>
                    <Textarea
                      id="message"
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      rows={4}
                      required
                      placeholder="Enter notification message"
                    />
                  </div>

                  {/* Type and Audience */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="type">Type</Label>
                      <Select
                        value={formData.type}
                        onValueChange={(value) => setFormData({ ...formData, type: value as any })}
                      >
                        <SelectTrigger id="type">
                          <SelectValue placeholder="Select notification type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="info">Info</SelectItem>
                          <SelectItem value="warning">Warning</SelectItem>
                          <SelectItem value="success">Success</SelectItem>
                          <SelectItem value="error">Error</SelectItem>
                          <SelectItem value="migration">Migration</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="audience">Target Audience</Label>
                      <Select
                        value={formData.targetAudience}
                        onValueChange={(value) => setFormData({ ...formData, targetAudience: value as any })}
                      >
                        <SelectTrigger id="audience">
                          <SelectValue placeholder="Select target audience" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Users</SelectItem>
                          <SelectItem value="partners">Partners Only</SelectItem>
                          <SelectItem value="customers">Customers Only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Priority and Expiry */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="priority">Priority (1-4)</Label>
                      <Input
                        id="priority"
                        type="number"
                        min="1"
                        max="4"
                        value={formData.priority}
                        onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="expires">Expires At (optional)</Label>
                      <Input
                        id="expires"
                        type="date"
                        value={formData.expiresAt}
                        onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Action URL and Text */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="actionUrl">Action URL (optional)</Label>
                      <Input
                        id="actionUrl"
                        type="url"
                        value={formData.actionUrl}
                        onChange={(e) => setFormData({ ...formData, actionUrl: e.target.value })}
                        placeholder="https://..."
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="actionText">Action Text (optional)</Label>
                      <Input
                        id="actionText"
                        type="text"
                        value={formData.actionText}
                        onChange={(e) => setFormData({ ...formData, actionText: e.target.value })}
                        placeholder="Learn More"
                      />
                    </div>
                  </div>
                </form>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowCreateModal(false);
                      setEditingNotification(null);
                      resetForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    onClick={handleSubmit}
                  >
                    {editingNotification ? 'Update' : 'Create'} Notification
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Notifications List */}
          <Card>
            <CardHeader>
              <CardTitle>Platform Notifications</CardTitle>
              <CardDescription>
                Manage system-wide notifications for partners and customers
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin h-8 w-8 border-4 border-gray-300 rounded-full border-t-blue-600"></div>
                </div>
              ) : notifications.length === 0 ? (
                <div className="text-center py-8">
                  <Send className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No notifications yet</h3>
                  <p className="text-gray-500">Create your first platform notification to get started.</p>
                </div>
              ) : (
                <div className="space-y-4">
                {notifications.map((notification) => (
                  <Card key={notification.id} className="relative">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold">{notification.title}</h3>
                            <Badge variant={getTypeBadgeVariant(notification.type)}>
                              {getTypeIcon(notification.type)}
                              {notification.type}
                            </Badge>
                            <Badge variant="outline">
                              {getAudienceIcon(notification.targetAudience)}
                              {notification.targetAudience}
                            </Badge>
                            <Badge variant="secondary">
                              Priority {notification.priority}
                            </Badge>
                            {notification.isActive ? (
                              <Badge variant="default" className="bg-green-100 text-green-800">
                                <Eye className="w-3 h-3 mr-1" />
                                Active
                              </Badge>
                            ) : (
                              <Badge variant="secondary">
                                <EyeOff className="w-3 h-3 mr-1" />
                                Inactive
                              </Badge>
                            )}
                          </div>

                          <p className="text-gray-600 mb-3">{notification.message}</p>

                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              Created {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                            </span>
                            {notification.expiresAt && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                Expires {formatDistanceToNow(new Date(notification.expiresAt), { addSuffix: true })}
                              </span>
                            )}
                            {notification.actionUrl && (
                              <a
                                href={notification.actionUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800"
                              >
                                {notification.actionText || 'View'}
                              </a>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 ml-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleActive(notification.id, notification.isActive)}
                            title={notification.isActive ? 'Deactivate' : 'Activate'}
                          >
                            {notification.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(notification)}
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(notification.id)}
                            title="Delete"
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  );
}
