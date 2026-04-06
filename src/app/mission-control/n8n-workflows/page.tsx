'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
// import { Tabs, TabsContent, TabsList, TabsTrigger } // Unused from '@/components/ui/tabs';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';

import { 
  Plus, 
  Search, 
  // Filter, // Unused 
  MoreHorizontal, 
  Eye, 
  Edit, 
  Trash2, 
  // Upload, // Unused 
  // Download, // Unused
  Play,
  Pause,
  BarChart3,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import CreateWorkflowProductForm from '@/components/admin/CreateWorkflowProductForm';
import { useAdminAuth } from '@/components/admin/AdminAuthProvider';

interface WorkflowProduct {
  id: string;
  name: string;
  description: string;
  category: string;
  difficulty: string;
  tags: string[];
  isActive: boolean;
  isPublished: boolean;
  publishedAt: string | null;
  downloadCount: number;
  deploymentCount: number;
  estimatedSetupTime: number | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    deployments: number;
  };
}

interface DeploymentStats {
  totalDeployments: number;
  successfulDeployments: number;
  failedDeployments: number;
  pendingDeployments: number;
  inProgressDeployments: number;
  successRate: number;
}

export default function N8nWorkflowsPage() {
  const { user } = useAdminAuth();
  const [products, setProducts] = useState<WorkflowProduct[]>([]);
  const [deploymentStats, setDeploymentStats] = useState<DeploymentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewProduct, setViewProduct] = useState<WorkflowProduct | null>(null);
  const [editProduct, setEditProduct] = useState<WorkflowProduct | null>(null);

  // Debug: Log initial render
  console.log('Component rendered, showCreateModal initial state:', showCreateModal);

  // Debug modal state changes
  useEffect(() => {
    console.log('showCreateModal state changed:', showCreateModal);
  }, [showCreateModal]);

  // Test JavaScript execution
  useEffect(() => {
    console.log('N8N Workflows page loaded successfully');
  }, []);

  // Fetch workflow products
  const fetchProducts = async () => {
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (categoryFilter !== 'all') params.append('category', categoryFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);

      const response = await fetch(`/api/admin/n8n-workflow-products?${params}`);
      const data = await response.json();

      if (data.success) {
        setProducts(data.data);
      } else {
        toast.error(data.error || 'Failed to fetch products');
      }
    } catch (error) {
      toast.error('Failed to fetch products');
    }
  };

  // Fetch deployment stats
  const fetchDeploymentStats = async () => {
    try {
      const response = await fetch('/api/admin/n8n-workflow-products/stats');
      const data = await response.json();

      if (data.success) {
        setDeploymentStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch deployment stats:', error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchProducts(), fetchDeploymentStats()]);
      setLoading(false);
    };

    loadData();
  }, [searchTerm, categoryFilter, statusFilter]);

  const handlePublish = async (productId: string) => {
    try {
      const response = await fetch(`/api/admin/n8n-workflow-products/${productId}/publish`, {
        method: 'POST',
      });
      const data = await response.json();

      if (data.success) {
        toast.success('Product published successfully');
        fetchProducts();
      } else {
        toast.error(data.error || 'Failed to publish product');
      }
    } catch (error) {
      toast.error('Failed to publish product');
    }
  };

  const handleUnpublish = async (productId: string) => {
    try {
      const response = await fetch(`/api/admin/n8n-workflow-products/${productId}/publish`, {
        method: 'DELETE',
      });
      const data = await response.json();

      if (data.success) {
        toast.success('Product unpublished successfully');
        fetchProducts();
      } else {
        toast.error(data.error || 'Failed to unpublish product');
      }
    } catch (error) {
      toast.error('Failed to unpublish product');
    }
  };

  const handleDelete = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
      const response = await fetch(`/api/admin/n8n-workflow-products/${productId}`, {
        method: 'DELETE',
      });
      const data = await response.json();

      if (data.success) {
        toast.success('Product deleted successfully');
        fetchProducts();
      } else {
        toast.error(data.error || 'Failed to delete product');
      }
    } catch (error) {
      toast.error('Failed to delete product');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedProducts.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedProducts.length} products?`)) return;

    try {
      const response = await fetch('/api/admin/n8n-workflow-products/bulk-delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds: selectedProducts }),
      });
      const data = await response.json();

      if (data.success) {
        toast.success(`${selectedProducts.length} products deleted successfully`);
        setSelectedProducts([]);
        fetchProducts();
      } else {
        toast.error(data.error || 'Failed to delete products');
      }
    } catch (error) {
      toast.error('Failed to delete products');
    }
  };

  const handleView = async (productId: string) => {
    try {
      const response = await fetch(`/api/admin/n8n-workflow-products/${productId}`);
      const data = await response.json();

      if (data.success) {
        setViewProduct(data.data);
      } else {
        toast.error(data.error || 'Failed to fetch product details');
      }
    } catch (error) {
      toast.error('Failed to fetch product details');
    }
  };

  const handleEdit = async (productId: string) => {
    try {
      const response = await fetch(`/api/admin/n8n-workflow-products/${productId}`);
      const data = await response.json();

      if (data.success) {
        setEditProduct(data.data);
      } else {
        toast.error(data.error || 'Failed to fetch product details');
      }
    } catch (error) {
      toast.error('Failed to fetch product details');
    }
  };

  const getStatusBadge = (product: WorkflowProduct) => {
    if (!product.isActive) {
      return <Badge variant="secondary">Inactive</Badge>;
    }
    if (product.isPublished) {
      return <Badge variant="default">Published</Badge>;
    }
    return <Badge variant="outline">Draft</Badge>;
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800';
      case 'advanced': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex h-screen">
        <AdminSidebar />
        <div className="flex-1 overflow-auto">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <AdminSidebar />
      <div className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">N8N Workflow Products</h1>
              <p className="text-muted-foreground">
                Manage workflow templates that partners can deploy to their customers
              </p>
            </div>
            <Button onClick={() => {
              console.log('Create Product button clicked');
              console.log('Current showCreateModal state:', showCreateModal);
              setShowCreateModal(true);
              console.log('setShowCreateModal(true) called');
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Create Product
            </Button>
          </div>

          {/* Stats Cards */}
          {deploymentStats && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Products</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{products?.length || 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Deployments</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{deploymentStats.totalDeployments}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{deploymentStats.successRate}%</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Failed Deployments</CardTitle>
                  <XCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{deploymentStats.failedDeployments}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pending</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {deploymentStats.pendingDeployments + deploymentStats.inProgressDeployments}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search products..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="crm">CRM</SelectItem>
                    <SelectItem value="social">Social Media</SelectItem>
                    <SelectItem value="automation">Automation</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
                {selectedProducts.length > 0 && (
                  <Button variant="destructive" onClick={handleBulkDelete}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete ({selectedProducts.length})
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Products Table */}
          <Card>
            <CardHeader>
              <CardTitle>Workflow Products</CardTitle>
              <CardDescription>
                {products?.length || 0} products found
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <input
                        type="checkbox"
                        checked={selectedProducts.length === (products?.length || 0) && (products?.length || 0) > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedProducts(products?.map(p => p.id) || []);
                          } else {
                            setSelectedProducts([]);
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Difficulty</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Downloads</TableHead>
                    <TableHead>Deployments</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products?.length > 0 ? (
                    products.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedProducts.includes(product.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedProducts([...selectedProducts, product.id]);
                              } else {
                                setSelectedProducts(selectedProducts.filter(id => id !== product.id));
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          <div>
                            <div className="font-semibold">{product.name}</div>
                            <div className="text-sm text-muted-foreground line-clamp-1">
                              {product.description}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {product.category}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-xs ${getDifficultyColor(product.difficulty)}`}>
                            {product.difficulty}
                          </Badge>
                        </TableCell>
                        <TableCell>{getStatusBadge(product)}</TableCell>
                        <TableCell>{product.downloadCount}</TableCell>
                        <TableCell>{product.deploymentCount}</TableCell>
                        <TableCell>
                          {new Date(product.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleView(product.id)}>
                                <Eye className="h-4 w-4 mr-2" />
                                View
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEdit(product.id)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              {product.isPublished ? (
                                <DropdownMenuItem onClick={() => handleUnpublish(product.id)}>
                                  <Pause className="h-4 w-4 mr-2" />
                                  Unpublish
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onClick={() => handlePublish(product.id)}>
                                  <Play className="h-4 w-4 mr-2" />
                                  Publish
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => handleDelete(product.id)}
                                className="text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        No workflow products found. Create your first product to get started.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Create Product Modal */}
          {showCreateModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/50" onClick={() => setShowCreateModal(false)} />
              <div className="relative bg-gray-800 rounded-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-gray-700">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-semibold text-white">Create New Workflow Product</h3>
                    <p className="text-gray-400 mt-1">
                      Create a new N8N workflow product that partners can deploy to their customers.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      console.log('Close button clicked');
                      setShowCreateModal(false);
                      console.log('setShowCreateModal(false) called');
                    }}
                    className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700"
                  >
                    <XCircle className="h-5 w-5" />
                  </button>
                </div>
                <CreateWorkflowProductForm
                  onSuccess={() => {
                    setShowCreateModal(false);
                    fetchProducts();
                  }}
                  onCancel={() => setShowCreateModal(false)}
                />
              </div>
            </div>
          )}

          {/* View Product Modal */}
          {viewProduct && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/50" onClick={() => setViewProduct(null)} />
              <div className="relative bg-gray-800 rounded-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-gray-700">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-semibold text-white">View Workflow Product</h3>
                    <p className="text-gray-400 mt-1">
                      Detailed information about the workflow product.
                    </p>
                  </div>
                  <button
                    onClick={() => setViewProduct(null)}
                    className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700"
                  >
                    <XCircle className="h-5 w-5" />
                  </button>
                </div>
                <div className="space-y-6 text-white">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Name</label>
                      <p className="text-white">{viewProduct.name}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Category</label>
                      <p className="text-white capitalize">{viewProduct.category}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Difficulty</label>
                      <p className="text-white capitalize">{viewProduct.difficulty}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Status</label>
                      <div>{getStatusBadge(viewProduct)}</div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                    <p className="text-white">{viewProduct.description}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Tags</label>
                    <div className="flex flex-wrap gap-2">
                      {viewProduct.tags.map((tag, index) => (
                        <Badge key={index} variant="outline">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                  {viewProduct.estimatedSetupTime && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Estimated Setup Time</label>
                      <p className="text-white">{viewProduct.estimatedSetupTime} minutes</p>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Downloads</label>
                      <p className="text-white">{viewProduct.downloadCount}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Deployments</label>
                      <p className="text-white">{viewProduct.deploymentCount}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Created</label>
                      <p className="text-white">{new Date(viewProduct.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Edit Product Modal */}
          {editProduct && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/50" onClick={() => setEditProduct(null)} />
              <div className="relative bg-gray-800 rounded-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-gray-700">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-semibold text-white">Edit Workflow Product</h3>
                    <p className="text-gray-400 mt-1">
                      Update the workflow product information.
                    </p>
                  </div>
                  <button
                    onClick={() => setEditProduct(null)}
                    className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700"
                  >
                    <XCircle className="h-5 w-5" />
                  </button>
                </div>
                <CreateWorkflowProductForm
                  initialData={editProduct}
                  onSuccess={() => {
                    setEditProduct(null);
                    fetchProducts();
                  }}
                  onCancel={() => setEditProduct(null)}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
