'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, X, Upload, FileText } from 'lucide-react';
import { createWorkflowProductSchema, type CreateWorkflowProductInput } from '@/lib/validations/n8n';

interface CreateWorkflowProductFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  initialData?: any; // For editing existing products
}

export default function CreateWorkflowProductForm({
  onSuccess,
  onCancel,
  initialData
}: CreateWorkflowProductFormProps) {
  const [loading, setLoading] = useState(false);
  const [currentTag, setCurrentTag] = useState('');
  const [uploadMethod, setUploadMethod] = useState<'paste' | 'upload'>('paste');

  const form = useForm<CreateWorkflowProductInput>({
    resolver: zodResolver(createWorkflowProductSchema),
    defaultValues: initialData ? {
      name: initialData.name || '',
      description: initialData.description || '',
      category: initialData.category || 'general',
      difficulty: initialData.difficulty || 'beginner',
      tags: initialData.tags || [],
      estimatedSetupTime: initialData.estimatedSetupTime || undefined,
      setupVideoUrl: initialData.setupVideoUrl || '',
      documentationUrl: initialData.documentationUrl || '',
      blogArticleUrl: initialData.blogArticleUrl || '',
      autoActivate: initialData.isActive ?? true,
      workflowJson: initialData.workflowJson || {},
    } : {
      category: 'general',
      difficulty: 'beginner',
      tags: [],
      autoActivate: true,
    },
  });

  const { register, handleSubmit, formState: { errors }, setValue, watch } = form;
  const tags = watch('tags');
  const workflowJson = watch('workflowJson');
  const category = watch('category');
  const difficulty = watch('difficulty');

  // Handle tag management
  const addTag = () => {
    if (!currentTag.trim()) return;
    if (tags.includes(currentTag.trim())) {
      toast.error('Tag already exists');
      return;
    }
    
    setValue('tags', [...tags, currentTag.trim()]);
    setCurrentTag('');
  };

  const removeTag = (tagToRemove: string) => {
    setValue('tags', tags.filter(tag => tag !== tagToRemove));
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      toast.error('Please select a JSON file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const json = JSON.parse(content);
        setValue('workflowJson', json);
        toast.success('Workflow JSON uploaded successfully');
      } catch (error) {
        toast.error('Invalid JSON file');
        // Reset to empty workflow structure instead of undefined
        setValue('workflowJson', { nodes: [], connections: {} });
      }
    };
    reader.readAsText(file);
  };

  const onSubmit = async (data: CreateWorkflowProductInput) => {
    console.log('Form submission started with data:', data);
    setLoading(true);

    try {
      const isEditing = !!initialData;
      const url = isEditing
        ? `/api/admin/n8n-workflow-products/${initialData.id}`
        : '/api/admin/n8n-workflow-products';
      const method = isEditing ? 'PUT' : 'POST';

      console.log(`Making API request to ${url} with method ${method}`);
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      console.log('API response status:', response.status);
      const result = await response.json();
      console.log('API response result:', result);

      if (result.success) {
        toast.success(`Workflow product ${isEditing ? 'updated' : 'created'} successfully`);
        onSuccess?.();
      } else {
        toast.error(result.error || `Failed to ${isEditing ? 'update' : 'create'} workflow product`);
      }
    } catch (error) {
      console.error(`Error ${initialData ? 'updating' : 'creating'} workflow product:`, error);
      toast.error(`Failed to ${initialData ? 'update' : 'create'} workflow product`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="name" className="text-gray-300">
              Product Name <span className="text-blue-400">*</span>
            </Label>
            <Input
              id="name"
              {...register('name')}
              placeholder="Enter product name"
              className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
            />
            {errors.name && (
              <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="description" className="text-gray-300">
              Description
            </Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder="Brief description of the workflow product"
              rows={3}
              className="bg-gray-700 border-gray-600 text-white placeholder-gray-400 resize-none"
            />
            {errors.description && (
              <p className="text-red-400 text-xs mt-1">{errors.description.message}</p>
            )}
          </div>

          {/* Category and Difficulty */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-300">Category</Label>
              <Select value={category} onValueChange={(value) => setValue('category', value as any)}>
                <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent className="bg-gray-700 border-gray-600">
                  <SelectItem value="email">Email Marketing</SelectItem>
                  <SelectItem value="crm">CRM Integration</SelectItem>
                  <SelectItem value="social">Social Media</SelectItem>
                  <SelectItem value="automation">Business Automation</SelectItem>
                  <SelectItem value="general">General</SelectItem>
                </SelectContent>
              </Select>
              {errors.category && (
                <p className="text-red-400 text-xs mt-1">{errors.category.message}</p>
              )}
            </div>

            <div>
              <Label className="text-gray-300">Difficulty</Label>
              <Select value={difficulty} onValueChange={(value) => setValue('difficulty', value as any)}>
                <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                  <SelectValue placeholder="Select difficulty" />
                </SelectTrigger>
                <SelectContent className="bg-gray-700 border-gray-600">
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
              {errors.difficulty && (
                <p className="text-red-400 text-xs mt-1">{errors.difficulty.message}</p>
              )}
            </div>
          </div>

          {/* Tag Management */}
          <div>
            <Label className="text-gray-300">Tags</Label>
            <div className="flex space-x-2 mb-2">
              <Input
                value={currentTag}
                onChange={(e) => setCurrentTag(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder="Add a tag"
                className="bg-gray-700 border-gray-600 text-white placeholder-gray-400 flex-1"
              />
              <Button
                type="button"
                onClick={addTag}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="bg-gray-600 text-gray-200 hover:bg-gray-500"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="ml-1 hover:text-red-400"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          {/* Workflow JSON Section */}
          <div>
            <Label className="text-gray-300">
              Workflow JSON <span className="text-blue-400">*</span>
            </Label>

            {/* Upload Method Toggle */}
            <div className="flex space-x-4 mb-3 mt-2">
              <button
                type="button"
                onClick={() => setUploadMethod('paste')}
                className={`flex items-center space-x-2 px-3 py-2 rounded text-sm ${
                  uploadMethod === 'paste'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                <FileText className="h-4 w-4" />
                <span>Paste JSON</span>
              </button>
              <button
                type="button"
                onClick={() => setUploadMethod('upload')}
                className={`flex items-center space-x-2 px-3 py-2 rounded text-sm ${
                  uploadMethod === 'upload'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                <Upload className="h-4 w-4" />
                <span>Upload File</span>
              </button>
            </div>

            {uploadMethod === 'paste' ? (
              <Textarea
                placeholder="Paste your N8N workflow JSON here..."
                rows={4}
                className="bg-gray-700 border-gray-600 text-white placeholder-gray-400 resize-none font-mono text-xs"
                onChange={(e) => {
                  try {
                    const json = JSON.parse(e.target.value);
                    setValue('workflowJson', json);
                  } catch (error) {
                    // Reset to empty workflow structure instead of undefined
                    setValue('workflowJson', { nodes: [], connections: {} });
                  }
                }}
              />
            ) : (
              <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center">
                <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-400 mb-2">Upload your N8N workflow JSON file</p>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="workflow-upload"
                />
                <label
                  htmlFor="workflow-upload"
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Choose File
                </label>
              </div>
            )}

            <p className="text-xs text-gray-500 mt-1">
              {uploadMethod === 'paste'
                ? 'Paste the JSON export from your N8N workflow'
                : 'Select a .json file exported from your N8N workflow'
              }
            </p>

            {workflowJson && (
              <div className="mt-2 p-2 bg-green-900/20 border border-green-600 rounded text-xs text-green-400">
                ✓ Valid workflow JSON detected ({workflowJson.nodes?.length || 0} nodes)
                {workflowJson.name ? <span> - "{workflowJson.name}"</span> : <span> - Workflow uploaded successfully</span>}
              </div>
            )}
          </div>

          {/* Media & Documentation Section */}
          <div className="space-y-4">
            <h4 className="text-lg font-medium text-white border-b border-gray-600 pb-2">
              Media & Documentation (Optional)
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-300">Setup Video URL</Label>
                <Input
                  {...register('setupVideoUrl')}
                  placeholder="https://youtube.com/watch?v=..."
                  className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                />
                {errors.setupVideoUrl && (
                  <p className="text-red-400 text-xs mt-1">{errors.setupVideoUrl.message}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  YouTube or Vimeo video showing how to set up this workflow
                </p>
              </div>

              <div>
                <Label className="text-gray-300">Documentation URL</Label>
                <Input
                  {...register('documentationUrl')}
                  placeholder="https://docs.example.com/..."
                  className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                />
                {errors.documentationUrl && (
                  <p className="text-red-400 text-xs mt-1">{errors.documentationUrl.message}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Link to detailed documentation or setup guide
                </p>
              </div>
            </div>

            <div>
              <Label className="text-gray-300">Blog Article URL</Label>
              <Input
                {...register('blogArticleUrl')}
                placeholder="https://blog.example.com/..."
                className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
              />
              {errors.blogArticleUrl && (
                <p className="text-red-400 text-xs mt-1">{errors.blogArticleUrl.message}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Blog post or article explaining the workflow and its benefits
              </p>
            </div>
          </div>

          {/* Settings Section */}
          <div className="space-y-4">
            <h4 className="text-lg font-medium text-white border-b border-gray-600 pb-2">
              Settings
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-300">Estimated Setup Time (minutes)</Label>
                <Input
                  type="number"
                  min="1"
                  max="300"
                  {...register('estimatedSetupTime', { valueAsNumber: true })}
                  placeholder="15"
                  className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                />
                {errors.estimatedSetupTime && (
                  <p className="text-red-400 text-xs mt-1">{errors.estimatedSetupTime.message}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  How long it typically takes to set up this workflow
                </p>
              </div>

              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  {...register('autoActivate')}
                  className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                />
                <div>
                  <Label className="text-gray-300">Auto-activate workflow</Label>
                  <p className="text-xs text-gray-500">
                    Automatically activate the workflow after deployment
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex justify-end space-x-4 pt-6 border-t border-gray-600">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="border-gray-600 text-gray-300 hover:bg-gray-600"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading || !workflowJson}
            className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
            onClick={() => {
              console.log('Submit button clicked');
              console.log('workflowJson:', workflowJson);
              console.log('Form errors:', errors);
              console.log('Loading:', loading);
            }}
          >
            {loading
              ? (initialData ? 'Updating...' : 'Creating...')
              : (initialData ? 'Update Product' : 'Create Product')
            }
          </Button>
        </div>

        {!workflowJson && (
          <div className="text-center text-sm text-gray-400 mt-2">
            Please provide workflow JSON data to create the product
          </div>
        )}
      </form>
    </div>
  );
}
