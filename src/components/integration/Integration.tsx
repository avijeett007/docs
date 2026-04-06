'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiUpload, FiLink, FiPlus, FiRefreshCw, FiCode, FiEdit2, FiTrash2, FiHelpCircle, FiEye, FiEyeOff } from 'react-icons/fi';
import { useUser } from '@clerk/nextjs';
import { toast } from 'react-hot-toast';
import Tooltip from '@/components/ui/Tooltip';
import { parse as parseYaml } from 'yaml';
import SwaggerParser from '@apidevtools/swagger-parser';
import SimpleToolForm from './SimpleToolForm';
import { ToolCard } from './ToolCard';
import { ToolMetadata } from '@/types/plugin';
import { usePartnerBranding } from '@/lib/partnerBranding';

// Temporary mock data for official tools
const officialTools: ToolMetadata[] = [
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    description: 'Seamlessly integrate with Google Calendar to manage events, meetings, and schedules.',
    version: '1.0.0',
    icon: 'https://www.gstatic.com/images/branding/product/2x/calendar_48dp.png',
    category: 'Calendar',
    provider: 'official',
    publisher: {
      name: 'Knotie AI',
      website: 'https://knotie.ai'
    },
    documentation: 'https://docs.knotie.ai/tools/google-calendar',
    tags: ['calendar', 'scheduling', 'google']
  },
  {
    id: 'calendly',
    name: 'Calendly',
    description: 'Automate your meeting scheduling with Calendly integration.',
    version: '1.0.0',
    icon: 'https://assets.calendly.com/assets/frontend/media/logo-square-cd364a3c33976d32792a.png',
    category: 'Calendar',
    provider: 'official',
    publisher: {
      name: 'Knotie AI',
      website: 'https://knotie.ai'
    },
    documentation: 'https://docs.knotie.ai/tools/calendly',
    tags: ['calendar', 'scheduling']
  },
  {
    id: 'ghl-calendar',
    name: 'Go High Level Calendar',
    description: 'Connect with Go High Level to manage your business calendar and appointments.',
    version: '1.0.0',
    icon: '/images/default-tool-icon.svg', // Using default icon for GHL
    category: 'Calendar',
    provider: 'official',
    publisher: {
      name: 'Knotie AI',
      website: 'https://knotie.ai'
    },
    documentation: 'https://docs.knotie.ai/tools/ghl-calendar',
    tags: ['calendar', 'scheduling', 'ghl']
  }
];

// Define OpenAPI types
interface OpenAPIInfo {
  title: string;
  version: string;
  description?: string;
}

interface OpenAPIParameter {
  name: string;
  in: string;
  required?: boolean;
  description?: string;
  schema?: {
    type: string;
    enum?: string[];
    default?: string;
  };
}

interface OpenAPISecurityScheme {
  type: string;
  in: string;
  name: string;
  description?: string;
}

interface OpenAPIComponents {
  securitySchemes?: {
    [key: string]: OpenAPISecurityScheme;
  };
}

interface OpenAPISpec {
  openapi: string;
  info: OpenAPIInfo;
  components?: OpenAPIComponents;
  paths?: {
    [path: string]: {
      [method: string]: {
        parameters?: OpenAPIParameter[];
        security?: Array<Record<string, string[]>>;
      };
    };
  };
}

interface Tool {
  id: string;
  name: string;
  description: string;
  version: string;
  spec: string;
  specType: 'json' | 'yaml' | 'url';
  config: ConfigField[];
  createdAt: Date;
  updatedAt: Date;
}

interface ConfigField {
  key: string;
  value: string;
  isSecret: boolean;
  description?: string;
  customKey?: string;  // For custom key name when key === 'custom'
}

interface ExistingKey {
  id: string;
  name: string;
  description: string;
}

interface Parameter {
  name: string;
  in: string;
  required?: boolean;
  description?: string;
}

const Integration: React.FC = () => {
  const { user } = useUser();
  const [tools, setTools] = useState<Tool[]>([]);
  const [existingKeys, setExistingKeys] = useState<ExistingKey[]>([]);
  const [isAddingTool, setIsAddingTool] = useState(false);
  const [isEditingTool, setIsEditingTool] = useState<string | null>(null);
  const [specInput, setSpecInput] = useState('');
  const [specUrlInput, setSpecUrlInput] = useState('');
  const [configFields, setConfigFields] = useState<ConfigField[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [version, setVersion] = useState('');
  const [loading, setLoading] = useState(false);
  const [validatedSpec, setValidatedSpec] = useState<OpenAPISpec | null>(null);
  const [availableParameters, setAvailableParameters] = useState<Parameter[]>([]);
  const [addMethod, setAddMethod] = useState<'spec' | 'curl' | 'form'>('spec');
  const [curlCommand, setCurlCommand] = useState('');
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const { branding, getButtonStyles, getGradientTextStyles, getGradientBackgroundStyles, getBorderStyles } = usePartnerBranding();

  useEffect(() => {
    fetchTools();
    fetchExistingKeys();
  }, []);

  const fetchTools = async () => {
    try {
      const response = await fetch('/api/tools');
      if (!response.ok) throw new Error('Failed to fetch tools');
      const data = await response.json();
      setTools(data.tools);
    } catch (error) {
      console.error('Error fetching tools:', error);
      toast.error('Failed to fetch tools');
    }
  };

  const fetchExistingKeys = async () => {
    try {
      const response = await fetch('/api/keys');
      if (!response.ok) throw new Error('Failed to fetch keys');
      const data = await response.json();
      setExistingKeys(data.keys);
    } catch (error) {
      console.error('Error fetching keys:', error);
      toast.error('Failed to fetch existing keys');
    }
  };

  const validateSpec = async (spec: string): Promise<{ 
    isValid: boolean; 
    format: 'json' | 'yaml';
    parsed: any;
    error?: string;
  }> => {
    try {
      // Try parsing as JSON first
      try {
        const parsed = JSON.parse(spec);
        const validated = await SwaggerParser.validate(parsed);
        return { isValid: true, format: 'json', parsed: validated };
      } catch (e) {
        // If JSON parsing fails, try YAML
        const parsed = parseYaml(spec);
        const validated = await SwaggerParser.validate(parsed);
        return { isValid: true, format: 'yaml', parsed: validated };
      }
    } catch (error) {
      console.error('Validation error:', error);
      return { 
        isValid: false, 
        format: 'json', 
        parsed: null,
        error: error instanceof Error ? error.message : 'Invalid OpenAPI specification' 
      };
    }
  };

  const validateOpenAPISpec = async () => {
    setLoading(true);
    try {
      console.log('Starting validation...');
      if (!specInput) {
        toast.error('Please enter an OpenAPI specification');
        return;
      }

      console.log('Validating spec...');
      const validation = await validateSpec(specInput);
      console.log('Validation result:', validation);

      if (!validation.isValid) {
        console.error('Validation failed:', validation.error);
        toast.error(validation.error || 'Invalid OpenAPI specification');
        return;
      }

      const parsed = validation.parsed;
      console.log('Parsed spec:', parsed);
      
      // Auto-fill tool information
      if (parsed.info) {
        console.log('Setting tool info:', parsed.info);
        setName(parsed.info.title || name);
        setVersion(parsed.info.version || version);
        setDescription(parsed.info.description || description);
      }

      // Extract available parameters
      const params = extractParameters(parsed);
      console.log('Extracted parameters:', params);
      setAvailableParameters(params);
      setValidatedSpec(parsed);

      // Auto-populate metadata from the spec
      if (validation.parsed.info) {
        setName(validation.parsed.info.title || '');
        setDescription(validation.parsed.info.description || '');
        setVersion(validation.parsed.info.version || '');
      }

      // Extract available parameters
      const params2 = extractParameters(validation.parsed);
      setAvailableParameters(params2);

      // Auto-populate required parameters as config fields
      const requiredParams = params2.filter(param => param.required);
      if (requiredParams.length > 0) {
        const newConfigFields = requiredParams.map(param => ({
          key: param.name,
          value: '',
          isSecret: param.in === 'header' && param.name.toLowerCase().includes('key'),
          description: param.description,
          customKey: '',
          required: param.required
        }));
        setConfigFields(prevFields => [...prevFields, ...newConfigFields]);
      }

      // Handle security schemes
      if (validation.parsed.components?.securitySchemes) {
        const schemes = validation.parsed.components.securitySchemes;
        Object.entries(schemes).forEach(([name, scheme]: [string, any]) => {
          if (scheme.type === 'apiKey' || scheme.type === 'http') {
            const isBearer = scheme.scheme === 'bearer';
            const newField = {
              key: isBearer ? 'Authorization' : scheme.name || name,
              value: '',
              isSecret: true,
              description: `${isBearer ? 'Bearer token' : 'API key'} for authentication`,
              customKey: '',
              required: true
            };
            setConfigFields(prevFields => {
              // Check if field already exists
              const exists = prevFields.some(f => f.key === newField.key);
              return exists ? prevFields : [...prevFields, newField];
            });
          }
        });
      }

      // Show validation success with details
      const message = `Validation successful!\n${params.length} parameters found`;
      console.log(message);
      toast.success(message);

      // Show parameter details in console
      params.forEach(param => {
        console.log(`- ${param.name} (${param.in})${param.required ? ' *' : ''}: ${param.description || 'No description'}`);
      });

    } catch (error) {
      console.error('Error during validation:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to validate OpenAPI specification');
    } finally {
      setLoading(false);
    }
  };

  const extractParameters = (spec: any): Parameter[] => {
    const parameters: Parameter[] = [];
    
    // Extract security schemes
    if (spec.components?.securitySchemes) {
      Object.entries(spec.components.securitySchemes).forEach(([name, scheme]: [string, any]) => {
        parameters.push({
          name: scheme.name || name,
          in: scheme.in,
          description: scheme.description,
          required: true
        });
      });
    }

    // Extract path parameters
    if (spec.paths) {
      Object.values(spec.paths).forEach((path: any) => {
        Object.values(path).forEach((method: any) => {
          if (method.parameters) {
            method.parameters.forEach((param: any) => {
              if (!parameters.find(p => p.name === param.name)) {
                parameters.push({
                  name: param.name,
                  in: param.in,
                  required: param.required,
                  description: param.description
                });
              }
            });
          }
        });
      });
    }

    return parameters;
  };

  const handleCurlImport = async () => {
    try {
      // Call the server-side API for cURL conversion
      const response = await fetch('/api/tools/curl-to-openapi', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ curlCommand })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to convert cURL command');
      }

      const spec = await response.json();
      const validation = await validateSpec(JSON.stringify(spec));
      if (validation.isValid) {
        setSpecInput(JSON.stringify(spec, null, 2));
        setValidatedSpec(validation.parsed);

        // Auto-populate metadata
        setName(spec.info.title || '');
        setDescription(spec.info.description || '');
        setVersion(spec.info.version || '');

        // Extract parameters and populate config fields
        const params = extractParameters(validation.parsed);
        setAvailableParameters(params);

        // Add required parameters as config fields
        const requiredParams = params.filter(param => param.required);
        const newConfigFields = requiredParams.map(param => ({
          key: param.name,
          value: '',
          isSecret: param.in === 'header' && param.name.toLowerCase().includes('key'),
          description: param.description,
          customKey: '',
          required: param.required
        }));

        // Add security fields if present
        if (spec.components?.securitySchemes) {
          Object.entries(spec.components.securitySchemes).forEach(([name, scheme]: [string, any]) => {
            newConfigFields.push({
              key: scheme.type === 'http' && scheme.scheme === 'bearer' ? 'Authorization' : name,
              value: '',
              isSecret: true,
              description: `${scheme.type === 'http' ? 'Bearer token' : 'API key'} for authentication`,
              customKey: '',
              required: true
            });
          });
        }

        setConfigFields(prevFields => {
          const existingKeys = new Set(prevFields.map(f => f.key));
          return [
            ...prevFields,
            ...newConfigFields.filter(f => !existingKeys.has(f.key))
          ];
        });

        toast.success('cURL command converted and validated successfully');
      }
    } catch (error: any) {
      console.error('cURL conversion error:', error);
      toast.error(error.message || 'Failed to convert cURL command');
    }
  };

  const handleSpecChange = (value: string) => {
    setSpecInput(value);
  };

  const handleAddConfigField = () => {
    if (!validatedSpec) {
      toast.error('Please validate your OpenAPI specification first');
      return;
    }
    
    const newField: ConfigField = { 
      key: '', // Empty key to show dropdown
      value: '', 
      isSecret: false,
      description: ''
    };
    setConfigFields([...configFields, newField]);
  };

  const handleUpdateConfigField = (index: number, updates: Partial<ConfigField>) => {
    setConfigFields(configFields.map((field, i) => {
      if (i !== index) return field;

      // If selecting a parameter from the dropdown
      if (updates.key) {
        const param = availableParameters.find(p => p.name === updates.key);
        if (param) {
          return {
            ...field,
            ...updates,
            description: param.description || field.description,
            isSecret: param.in === 'header' || field.isSecret // Automatically mark header params as secret
          };
        }
      }

      return { ...field, ...updates };
    }));
  };

  const handleRemoveConfigField = (index: number) => {
    setConfigFields(configFields.filter((_, i) => i !== index));
  };

  const handleSaveTool = async () => {
    if (!name || (!specInput && !specUrlInput)) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (specInput) {
      const validation = await validateSpec(specInput);
      if (!validation.isValid) {
        toast.error(validation.error || 'Invalid OpenAPI specification');
        return;
      }
    }

    setLoading(true);
    try {
      const toolData = {
        name,
        description,
        version,
        spec: specInput || specUrlInput,
        specType: specInput ? 
          (await validateSpec(specInput)).format : 
          'url',
        config: configFields.map(field => ({
          ...field,
          key: field.key === 'custom' ? field.value : field.key
        })),
      };

      const url = isEditingTool ? `/api/tools/${isEditingTool}` : '/api/tools';
      const method = isEditingTool ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toolData),
      });

      if (!response.ok) throw new Error(`Failed to ${isEditingTool ? 'update' : 'save'} tool`);

      toast.success(`Tool ${isEditingTool ? 'updated' : 'saved'} successfully`);
      fetchTools();
      resetForm();
    } catch (error) {
      console.error('Error saving tool:', error);
      toast.error('Failed to save tool');
    } finally {
      setLoading(false);
    }
  };

  const handleEditTool = (tool: Tool) => {
    setName(tool.name);
    setDescription(tool.description);
    setVersion(tool.version);
    setSpecInput(tool.specType === 'url' ? '' : tool.spec);
    setSpecUrlInput(tool.specType === 'url' ? tool.spec : '');
    setConfigFields(tool.config.map(field => ({
      key: field.key,
      value: field.value,
      isSecret: field.isSecret,
      description: field.description || ''
    })));
    setIsEditingTool(tool.id);
    setIsAddingTool(true);
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setVersion('');
    setSpecInput('');
    setSpecUrlInput('');
    setConfigFields([]);
    setIsAddingTool(false);
    setIsEditingTool(null);
  };

  const handleDeleteTool = async (id: string) => {
    if (!confirm('Are you sure you want to delete this tool?')) return;

    try {
      const response = await fetch(`/api/tools/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete tool');

      toast.success('Tool deleted successfully');
      fetchTools();
    } catch (error) {
      console.error('Error deleting tool:', error);
      toast.error('Failed to delete tool');
    }
  };

  const validateSpecUrl = async () => {
    setIsLoadingUrl(true);
    try {
      const response = await fetch(specUrlInput);
      const contentType = response.headers.get('content-type');
      let specData;
      
      if (contentType?.includes('yaml') || contentType?.includes('yml')) {
        specData = parseYaml(await response.text());
      } else {
        specData = await response.json();
      }
      
      const validation = await validateSpec(JSON.stringify(specData));
      if (validation.isValid) {
        setSpecInput(JSON.stringify(specData, null, 2));
        setValidatedSpec(validation.parsed);

        // Auto-populate metadata from the spec
        if (validation.parsed.info) {
          setName(validation.parsed.info.title || '');
          setDescription(validation.parsed.info.description || '');
          setVersion(validation.parsed.info.version || '');
        }

        // Extract available parameters
        const params = extractParameters(validation.parsed);
        setAvailableParameters(params);

        // Auto-populate required parameters as config fields
        const requiredParams = params.filter(param => param.required);
        if (requiredParams.length > 0) {
          const newConfigFields = requiredParams.map(param => ({
            key: param.name,
            value: '',
            isSecret: param.in === 'header' && param.name.toLowerCase().includes('key'),
            description: param.description,
            customKey: '',
            required: param.required
          }));
          setConfigFields(prevFields => [...prevFields, ...newConfigFields]);
        }

        // Handle security schemes
        if (validation.parsed.components?.securitySchemes) {
          const schemes = validation.parsed.components.securitySchemes;
          Object.entries(schemes).forEach(([name, scheme]: [string, any]) => {
            if (scheme.type === 'apiKey' || scheme.type === 'http') {
              const isBearer = scheme.scheme === 'bearer';
              const newField = {
                key: isBearer ? 'Authorization' : scheme.name || name,
                value: '',
                isSecret: true,
                description: `${isBearer ? 'Bearer token' : 'API key'} for authentication`,
                customKey: '',
                required: true
              };
              setConfigFields(prevFields => {
                // Check if field already exists
                const exists = prevFields.some(f => f.key === newField.key);
                return exists ? prevFields : [...prevFields, newField];
              });
            }
          });
        }

        toast.success('OpenAPI specification validated successfully');
      }
    } catch (error) {
      toast.error('Failed to load or validate OpenAPI specification from URL');
      console.error('Error validating spec URL:', error);
    } finally {
      setIsLoadingUrl(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold" style={getGradientTextStyles()}>Integration Management</h1>
        {!isAddingTool && (
          <button
            onClick={() => setIsAddingTool(true)}
            className="flex items-center px-4 py-2 rounded-lg text-white"
            style={getButtonStyles()}
          >
            <FiPlus className="mr-2" />
            Add New Tool
          </button>
        )}
      </div>

      {isAddingTool && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-800 rounded-lg p-6 mb-6"
        >
          <h2 className="text-xl font-semibold mb-4" style={getGradientTextStyles()}>
            {isEditingTool ? 'Edit Tool' : 'Add New Tool'}
          </h2>

          {/* Tool Addition Method Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">How would you like to add your tool?</label>
            <div className="grid grid-cols-3 gap-4">
              <button
                type="button"
                onClick={() => setAddMethod('spec')}
                className={`p-4 rounded-lg border ${
                  addMethod === 'spec'
                    ? 'border-blue-500 bg-blue-500/20'
                    : 'border-gray-600 hover:border-gray-500'
                } text-center`}
                style={addMethod === 'spec' ? getBorderStyles() : undefined}
              >
                <div className="text-lg mb-2">
                  <FiUpload className="inline-block" />
                </div>
                <div className="text-sm font-medium text-white">OpenAPI Spec</div>
                <div className="text-xs text-gray-400 mt-1">Paste or import your OpenAPI specification</div>
              </button>

              <button
                type="button"
                onClick={() => setAddMethod('curl')}
                className={`p-4 rounded-lg border ${
                  addMethod === 'curl'
                    ? 'border-blue-500 bg-blue-500/20'
                    : 'border-gray-600 hover:border-gray-500'
                } text-center`}
                style={addMethod === 'curl' ? getBorderStyles() : undefined}
              >
                <div className="text-lg mb-2">
                  <FiCode className="inline-block" />
                </div>
                <div className="text-sm font-medium text-white">cURL Import</div>
                <div className="text-xs text-gray-400 mt-1">Generate from cURL command</div>
              </button>

              <button
                type="button"
                onClick={() => setAddMethod('form')}
                className={`p-4 rounded-lg border ${
                  addMethod === 'form'
                    ? 'border-blue-500 bg-blue-500/20'
                    : 'border-gray-600 hover:border-gray-500'
                } text-center`}
                style={addMethod === 'form' ? getBorderStyles() : undefined}
              >
                <div className="text-lg mb-2">
                  <FiPlus className="inline-block" />
                </div>
                <div className="text-sm font-medium text-white">Simple Form</div>
                <div className="text-xs text-gray-400 mt-1">Create tool using a simple form</div>
              </button>
            </div>
          </div>

          {/* Form Content */}
          {addMethod === 'form' ? (
            <SimpleToolForm
              onSubmit={handleSaveTool}
              onCancel={() => {
                setIsAddingTool(false);
                setAddMethod('spec');
              }}
            />
          ) : addMethod === 'curl' ? (
            <div className="space-y-4">
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
                <p className="text-sm text-white">
                  <strong>Note:</strong> After importing a cURL command, please switch to the OpenAPI Spec tab to:
                  <ul className="list-disc ml-5 mt-2">
                    <li>Review the generated specification</li>
                    <li>Fill in required tool details (name, description, version)</li>
                    <li>Verify all headers and parameters are correctly imported</li>
                  </ul>
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">cURL Command</label>
                <div className="relative">
                  <textarea
                    value={curlCommand}
                    onChange={(e) => setCurlCommand(e.target.value)}
                    className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-white font-mono text-sm"
                    placeholder="Paste your cURL command here"
                    rows={5}
                  />
                  <button
                    onClick={handleCurlImport}
                    className="absolute top-2 right-2 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                    disabled={!curlCommand}
                  >
                    Import
                  </button>
                </div>
              </div>

              {validatedSpec && (
                <div className="mt-2 p-2 bg-gray-800 rounded-lg">
                  <h3 className="text-sm font-medium text-green-400 mb-1">
                    cURL Imported Successfully
                  </h3>
                  <div className="text-sm text-gray-300">
                    <div>Generated OpenAPI specification:</div>
                    <pre className="mt-2 p-2 bg-gray-900 rounded overflow-auto">
                      {JSON.stringify(validatedSpec, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Tool Metadata */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  placeholder="Tool name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  placeholder="Tool description"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Version</label>
                <input
                  type="text"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  placeholder="e.g., 1.0.0"
                />
              </div>

              {/* OpenAPI Spec Input */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  OpenAPI Specification *
                  <Tooltip content="Paste your OpenAPI JSON/YAML and click Validate to detect available parameters">
                    <FiHelpCircle className="inline-block ml-1 text-gray-400" />
                  </Tooltip>
                </label>
                <div className="space-y-2">
                  <div className="relative">
                    <textarea
                      value={specInput}
                      onChange={(e) => setSpecInput(e.target.value)}
                      className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-white font-mono text-sm"
                      placeholder="Paste OpenAPI JSON/YAML here"
                      rows={10}
                    />
                    <button
                      onClick={() => validateOpenAPISpec()}
                      className="absolute top-2 right-2 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                      disabled={!specInput || loading}
                    >
                      {loading ? (
                        <>
                          <FiRefreshCw className="inline-block mr-1 animate-spin" />
                          Validating...
                        </>
                      ) : (
                        'Validate'
                      )}
                    </button>
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      value={specUrlInput}
                      onChange={(e) => setSpecUrlInput(e.target.value)}
                      className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                      placeholder="Or enter OpenAPI specification URL"
                    />
                    <button
                      onClick={validateSpecUrl}
                      disabled={!specUrlInput || isLoadingUrl}
                      className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {isLoadingUrl ? (
                        <>
                          <FiRefreshCw className="inline-block mr-1 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        'Load & Validate'
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {validatedSpec && (
                <div className="mt-2 p-2 bg-gray-800 rounded-lg">
                  <h3 className="text-sm font-medium text-green-400 mb-1">Validation Successful</h3>
                  <div className="text-sm text-gray-300">
                    <div>Title: {validatedSpec.info?.title}</div>
                    <div>Version: {validatedSpec.info?.version}</div>
                    <div>Parameters found: {availableParameters.length}</div>
                  </div>
                </div>
              )}

              {/* Configuration Fields */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium text-gray-300">
                    Configuration
                    <Tooltip content="Add configuration fields from your OpenAPI spec or custom fields">
                      <FiHelpCircle className="inline-block ml-1 text-gray-400" />
                    </Tooltip>
                  </label>
                  <button
                    onClick={handleAddConfigField}
                    className="text-blue-400 hover:text-blue-300 flex items-center"
                  >
                    <FiPlus className="mr-1" /> Add Field
                  </button>
                </div>
                <div className="space-y-2">
                  {configFields.map((field, index) => (
                    <div key={index} className="flex gap-2 items-start">
                      <div className="flex-1 space-y-1">
                        <div className="flex gap-2">
                          <select
                            value={field.key}
                            onChange={(e) => handleUpdateConfigField(index, { 
                              key: e.target.value,
                              description: availableParameters.find(p => p.name === e.target.value)?.description
                            })}
                            className="flex-1 p-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                          >
                            <option value="">Select parameter</option>
                            {availableParameters.map((param) => (
                              <option key={param.name} value={param.name}>
                                {param.name} ({param.in}) {param.required ? '*' : ''}
                              </option>
                            ))}
                            <option value="custom">Add custom field</option>
                          </select>
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              checked={field.isSecret}
                              onChange={(e) => handleUpdateConfigField(index, { isSecret: e.target.checked })}
                              className="mr-2"
                            />
                            <span className="text-sm text-gray-300">Secret</span>
                          </div>
                        </div>
                        {field.key === 'custom' && (
                          <input
                            type="text"
                            placeholder="Custom key name"
                            value={field.customKey || ''}
                            onChange={(e) => handleUpdateConfigField(index, { customKey: e.target.value })}
                            className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                          />
                        )}
                        <input
                          type={field.isSecret ? 'password' : 'text'}
                          value={field.value}
                          onChange={(e) => handleUpdateConfigField(index, { value: e.target.value })}
                          className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                          placeholder="Value"
                        />
                        {field.description && (
                          <div className="text-sm text-gray-400">{field.description}</div>
                        )}
                      </div>
                      <div className="flex items-start pt-2">
                        {field.isSecret && (
                          <button
                            onClick={() => handleUpdateConfigField(index, { isSecret: !field.isSecret })}
                            className="p-2 text-gray-400 hover:text-gray-300"
                            title={field.isSecret ? 'Show value' : 'Hide value'}
                          >
                            {field.isSecret ? <FiEyeOff /> : <FiEye />}
                          </button>
                        )}
                        <button
                          onClick={() => handleRemoveConfigField(index)}
                          className="p-2 text-red-400 hover:text-red-300"
                          title="Remove field"
                        >
                          <FiTrash2 />
                        </button>
                      </div>
                    </div>
                  ))}
                  {configFields.length === 0 && (
                    <div className="text-gray-400 text-center py-4">
                      No configuration fields yet. Click "Add Field" to add fields from your API spec or custom fields.
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={resetForm}
                  className="px-4 py-2 text-gray-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveTool}
                  disabled={loading}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {loading && <FiRefreshCw className="animate-spin mr-2" />}
                  Save Tool
                </button>
              </div>
            </div>
          )}
        </motion.div>
      )}

      <div className="space-y-8">
        {/* Pre-integrated Tools Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold" style={getGradientTextStyles()}>Pre-integrated Tools</h2>
            <div className="flex items-center space-x-2">
              <span className="flex items-center text-sm text-gray-400">
                <span className="w-2 h-2 rounded-full bg-green-400 mr-2" />
                Official
              </span>
              <span className="flex items-center text-sm text-gray-400">
                <span className="w-2 h-2 rounded-full bg-yellow-400 mr-2" />
                Community
              </span>
            </div>
          </div>

          {/* Official Tools */}
          <div className="mb-8">
            <h3 className="text-lg font-medium text-gray-300 mb-4">Official Tools</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {officialTools.map((tool) => (
                <ToolCard
                  key={tool.id}
                  tool={tool}
                  onConnect={() => {
                    toast('Tool connection feature coming soon!', {
                      icon: 'ℹ️',
                      duration: 3000,
                    });
                  }}
                />
              ))}
            </div>
          </div>

          {/* Community Tools - Empty State */}
          <div>
            <h3 className="text-lg font-medium text-gray-300 mb-4">Community Tools</h3>
            <div className="bg-gray-800 rounded-lg p-8 text-center">
              <p className="text-gray-400 mb-2">
                Community tools marketplace coming soon!
              </p>
              <p className="text-sm text-gray-500">
                Build and share your own tools with the community.
              </p>
            </div>
          </div>
        </div>

        {/* Saved Tools */}
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <div className="p-6">
            <h2 className="text-xl font-semibold mb-4" style={getGradientTextStyles()}>Saved Tools</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-700">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Description</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Version</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {tools.map((tool) => (
                    <tr key={tool.id} className="hover:bg-gray-700/50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{tool.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-300">{tool.description}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{tool.version}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{tool.specType}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleEditTool(tool)}
                            className="text-blue-400 hover:text-blue-300"
                          >
                            <FiEdit2 />
                          </button>
                          <button
                            onClick={() => handleDeleteTool(tool.id)}
                            className="text-red-400 hover:text-red-300"
                          >
                            <FiTrash2 />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Integration;
