import React, { useState } from 'react';
import { FiPlus, FiTrash2, FiEye, FiEyeOff } from 'react-icons/fi';

interface ParameterField {
  name: string;
  in: 'query' | 'path' | 'header' | 'cookie';
  required: boolean;
  schema: {
    type: string;
    format?: string;
  };
  description?: string;
  example?: any;
}

interface ResponseField {
  statusCode: string;
  description: string;
  contentType: string;
  schema: any;
}

interface BodyField {
  name: string;
  description: string;
  type: string;
  format?: string;
  required: boolean;
  example?: any;
}

type BodyType = 'none' | 'json' | 'multipart' | 'urlencoded';

interface SimpleToolFormProps {
  onSubmit: (spec: any) => void;
  onCancel: () => void;
}

export default function SimpleToolForm({ onSubmit, onCancel }: SimpleToolFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [version, setVersion] = useState('1.0.0');
  const [endpoint, setEndpoint] = useState('');
  const [method, setMethod] = useState<'GET' | 'POST' | 'PUT' | 'DELETE'>('GET');
  const [baseUrl, setBaseUrl] = useState('');

  // Security
  const [securityType, setSecurityType] = useState<'none' | 'bearer' | 'apiKey'>('none');
  const [apiKeyName, setApiKeyName] = useState('');
  const [apiKeyIn, setApiKeyIn] = useState<'header' | 'query'>('header');

  // Parameters
  const [parameters, setParameters] = useState<ParameterField[]>([]);

  // Response
  const [responses, setResponses] = useState<ResponseField[]>([
    { statusCode: '200', description: 'Successful response', contentType: 'application/json', schema: {} }
  ]);

  // Body
  const [bodyType, setBodyType] = useState<BodyType>('none');
  const [bodyFields, setBodyFields] = useState<BodyField[]>([]);
  const [headers, setHeaders] = useState<ParameterField[]>([]);

  const addParameter = () => {
    setParameters([...parameters, {
      name: '',
      in: 'query',
      required: false,
      schema: { type: 'string' }
    }]);
  };

  const updateParameter = (index: number, updates: Partial<ParameterField>) => {
    const newParameters = [...parameters];
    newParameters[index] = { ...newParameters[index], ...updates };
    setParameters(newParameters);
  };

  const removeParameter = (index: number) => {
    setParameters(parameters.filter((_, i) => i !== index));
  };

  const addResponse = () => {
    setResponses([...responses, {
      statusCode: '',
      description: '',
      contentType: 'application/json',
      schema: {}
    }]);
  };

  const addBodyField = () => {
    setBodyFields([...bodyFields, {
      name: '',
      description: '',
      type: 'string',
      required: false
    }]);
  };

  const updateBodyField = (index: number, updates: Partial<BodyField>) => {
    const newFields = [...bodyFields];
    newFields[index] = { ...newFields[index], ...updates };
    setBodyFields(newFields);
  };

  const removeBodyField = (index: number) => {
    setBodyFields(bodyFields.filter((_, i) => i !== index));
  };

  const addHeader = () => {
    setHeaders([...headers, {
      name: '',
      in: 'header',
      required: false,
      schema: { type: 'string' }
    }]);
  };

  const handleSubmit = () => {
    // Generate OpenAPI spec
    const spec = {
      openapi: '3.0.0',
      info: {
        title: name,
        version,
        description
      },
      servers: baseUrl ? [{ url: baseUrl }] : undefined,
      paths: {
        [endpoint]: {
          [method.toLowerCase()]: {
            summary: description,
            ...(securityType !== 'none' && {
              security: [{
                [securityType === 'bearer' ? 'BearerAuth' : 'ApiKeyAuth']: []
              }]
            }),
            parameters: [...parameters, ...headers],
            ...(bodyType !== 'none' && {
              requestBody: {
                required: true,
                content: {
                  [bodyType === 'json' ? 'application/json' : 
                   bodyType === 'multipart' ? 'multipart/form-data' : 
                   'application/x-www-form-urlencoded']: {
                    schema: {
                      type: 'object',
                      required: bodyFields.filter(f => f.required).map(f => f.name),
                      properties: bodyFields.reduce((acc, field) => ({
                        ...acc,
                        [field.name]: {
                          type: field.type,
                          ...(field.format && { format: field.format }),
                          description: field.description,
                          ...(field.example !== undefined && { example: field.example })
                        }
                      }), {})
                    }
                  }
                }
              }
            }),
            responses: responses.reduce((acc, resp) => ({
              ...acc,
              [resp.statusCode]: {
                description: resp.description,
                content: {
                  [resp.contentType]: {
                    schema: resp.schema
                  }
                }
              }
            }), {})
          }
        }
      },
      components: {
        securitySchemes: securityType === 'none' ? undefined : {
          ...(securityType === 'bearer' && {
            BearerAuth: {
              type: 'http',
              scheme: 'bearer'
            }
          }),
          ...(securityType === 'apiKey' && {
            ApiKeyAuth: {
              type: 'apiKey',
              name: apiKeyName,
              in: apiKeyIn
            }
          })
        }
      }
    };

    onSubmit(spec);
  };

  return (
    <div className="space-y-6">
      {/* Basic Info */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Tool Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
            placeholder="e.g., Appointments API"
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

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Base URL</label>
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
            placeholder="e.g., https://api.example.com/v1"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Endpoint *</label>
          <input
            type="text"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
            placeholder="e.g., /appointments/slots"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Method</label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as any)}
            className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="DELETE">DELETE</option>
          </select>
        </div>
      </div>

      {/* Security */}
      <div className="space-y-4">
        <label className="block text-sm font-medium text-gray-300 mb-1">Authentication</label>
        <select
          value={securityType}
          onChange={(e) => setSecurityType(e.target.value as any)}
          className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
        >
          <option value="none">None</option>
          <option value="bearer">Bearer Token</option>
          <option value="apiKey">API Key</option>
        </select>

        {securityType === 'apiKey' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">API Key Name</label>
              <input
                type="text"
                value={apiKeyName}
                onChange={(e) => setApiKeyName(e.target.value)}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                placeholder="e.g., X-API-Key"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">API Key Location</label>
              <select
                value={apiKeyIn}
                onChange={(e) => setApiKeyIn(e.target.value as any)}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              >
                <option value="header">Header</option>
                <option value="query">Query Parameter</option>
              </select>
            </div>
          </>
        )}
      </div>

      {/* Headers Section */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <label className="block text-sm font-medium text-gray-300">Headers</label>
          <button
            onClick={addHeader}
            className="text-blue-400 hover:text-blue-300 flex items-center"
          >
            <FiPlus className="mr-1" /> Add Header
          </button>
        </div>
        {headers.map((header, index) => (
          <div key={index} className="space-y-2 p-4 border border-gray-600 rounded-lg">
            <div className="flex justify-between">
              <div className="flex-1 mr-2">
                <label className="block text-sm font-medium text-gray-300 mb-1">Name</label>
                <input
                  type="text"
                  value={header.name}
                  onChange={(e) => {
                    const newHeaders = [...headers];
                    newHeaders[index] = { ...header, name: e.target.value };
                    setHeaders(newHeaders);
                  }}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                />
              </div>
              <div className="flex items-center mt-6">
                <input
                  type="checkbox"
                  checked={header.required}
                  onChange={(e) => {
                    const newHeaders = [...headers];
                    newHeaders[index] = { ...header, required: e.target.checked };
                    setHeaders(newHeaders);
                  }}
                  className="mr-2"
                />
                <span className="text-sm text-gray-300">Required</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
              <input
                type="text"
                value={header.description || ''}
                onChange={(e) => {
                  const newHeaders = [...headers];
                  newHeaders[index] = { ...header, description: e.target.value };
                  setHeaders(newHeaders);
                }}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              />
            </div>
            <button
              onClick={() => setHeaders(headers.filter((_, i) => i !== index))}
              className="text-red-400 hover:text-red-300"
            >
              <FiTrash2 />
            </button>
          </div>
        ))}
      </div>

      {/* Body Type Selection */}
      <div className="space-y-4">
        <label className="block text-sm font-medium text-gray-300 mb-1">Request Body Type</label>
        <select
          value={bodyType}
          onChange={(e) => setBodyType(e.target.value as BodyType)}
          className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
        >
          <option value="none">None</option>
          <option value="json">JSON</option>
          <option value="multipart">Multipart Form</option>
          <option value="urlencoded">URL Encoded</option>
        </select>
      </div>

      {/* Body Fields */}
      {bodyType !== 'none' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <label className="block text-sm font-medium text-gray-300">Body Fields</label>
            <button
              onClick={addBodyField}
              className="text-blue-400 hover:text-blue-300 flex items-center"
            >
              <FiPlus className="mr-1" /> Add Field
            </button>
          </div>
          {bodyFields.map((field, index) => (
            <div key={index} className="space-y-2 p-4 border border-gray-600 rounded-lg">
              <div className="flex justify-between">
                <div className="flex-1 mr-2">
                  <label className="block text-sm font-medium text-gray-300 mb-1">Name</label>
                  <input
                    type="text"
                    value={field.name}
                    onChange={(e) => updateBodyField(index, { name: e.target.value })}
                    className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  />
                </div>
                <div className="flex-1 ml-2">
                  <label className="block text-sm font-medium text-gray-300 mb-1">Type</label>
                  <select
                    value={field.type}
                    onChange={(e) => updateBodyField(index, { type: e.target.value })}
                    className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  >
                    <option value="string">String</option>
                    <option value="integer">Integer</option>
                    <option value="number">Number</option>
                    <option value="boolean">Boolean</option>
                    <option value="object">Object</option>
                    <option value="array">Array</option>
                  </select>
                </div>
              </div>

              {(field.type === 'integer' || field.type === 'number') && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Format</label>
                  <select
                    value={field.format || ''}
                    onChange={(e) => updateBodyField(index, { format: e.target.value || undefined })}
                    className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  >
                    <option value="">None</option>
                    <option value="int32">int32</option>
                    <option value="int64">int64</option>
                    <option value="float">float</option>
                    <option value="double">double</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
                <input
                  type="text"
                  value={field.description}
                  onChange={(e) => updateBodyField(index, { description: e.target.value })}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Example</label>
                <input
                  type="text"
                  value={field.example || ''}
                  onChange={(e) => updateBodyField(index, { example: e.target.value })}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(e) => updateBodyField(index, { required: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-300">Required</span>
                </div>
                <button
                  onClick={() => removeBodyField(index)}
                  className="text-red-400 hover:text-red-300"
                >
                  <FiTrash2 />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Parameters */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <label className="block text-sm font-medium text-gray-300">Parameters</label>
          <button
            onClick={addParameter}
            className="text-blue-400 hover:text-blue-300 flex items-center"
          >
            <FiPlus className="mr-1" /> Add Parameter
          </button>
        </div>

        {parameters.map((param, index) => (
          <div key={index} className="space-y-2 p-4 border border-gray-600 rounded-lg">
            <div className="flex justify-between">
              <div className="flex-1 mr-2">
                <label className="block text-sm font-medium text-gray-300 mb-1">Name</label>
                <input
                  type="text"
                  value={param.name}
                  onChange={(e) => updateParameter(index, { name: e.target.value })}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                />
              </div>
              <div className="flex-1 ml-2">
                <label className="block text-sm font-medium text-gray-300 mb-1">Location</label>
                <select
                  value={param.in}
                  onChange={(e) => updateParameter(index, { in: e.target.value as any })}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                >
                  <option value="query">Query</option>
                  <option value="path">Path</option>
                  <option value="header">Header</option>
                  <option value="cookie">Cookie</option>
                </select>
              </div>
            </div>

            <div className="flex justify-between">
              <div className="flex-1 mr-2">
                <label className="block text-sm font-medium text-gray-300 mb-1">Type</label>
                <select
                  value={param.schema.type}
                  onChange={(e) => updateParameter(index, { 
                    schema: { ...param.schema, type: e.target.value }
                  })}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                >
                  <option value="string">String</option>
                  <option value="integer">Integer</option>
                  <option value="number">Number</option>
                  <option value="boolean">Boolean</option>
                </select>
              </div>
              <div className="flex-1 ml-2">
                <label className="block text-sm font-medium text-gray-300 mb-1">Format</label>
                <select
                  value={param.schema.format || ''}
                  onChange={(e) => updateParameter(index, {
                    schema: { ...param.schema, format: e.target.value || undefined }
                  })}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                >
                  <option value="">None</option>
                  <option value="int32">int32</option>
                  <option value="int64">int64</option>
                  <option value="float">float</option>
                  <option value="double">double</option>
                  <option value="date">date</option>
                  <option value="date-time">date-time</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
              <input
                type="text"
                value={param.description || ''}
                onChange={(e) => updateParameter(index, { description: e.target.value })}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Example</label>
              <input
                type="text"
                value={param.example || ''}
                onChange={(e) => updateParameter(index, { example: e.target.value })}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={param.required}
                  onChange={(e) => updateParameter(index, { required: e.target.checked })}
                  className="mr-2"
                />
                <span className="text-sm text-gray-300">Required</span>
              </div>
              <button
                onClick={() => removeParameter(index)}
                className="text-red-400 hover:text-red-300"
              >
                <FiTrash2 />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Response Schema */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <label className="block text-sm font-medium text-gray-300">Responses</label>
          <button
            onClick={addResponse}
            className="text-blue-400 hover:text-blue-300 flex items-center"
          >
            <FiPlus className="mr-1" /> Add Response
          </button>
        </div>

        {responses.map((response, index) => (
          <div key={index} className="space-y-2 p-4 border border-gray-600 rounded-lg">
            <div className="flex gap-4">
              <div className="w-24">
                <label className="block text-sm font-medium text-gray-300 mb-1">Status</label>
                <input
                  type="text"
                  value={response.statusCode}
                  onChange={(e) => {
                    const newResponses = [...responses];
                    newResponses[index] = { ...response, statusCode: e.target.value };
                    setResponses(newResponses);
                  }}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  placeholder="200"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
                <input
                  type="text"
                  value={response.description}
                  onChange={(e) => {
                    const newResponses = [...responses];
                    newResponses[index] = { ...response, description: e.target.value };
                    setResponses(newResponses);
                  }}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Response Schema (JSON)</label>
              <textarea
                value={JSON.stringify(response.schema, null, 2)}
                onChange={(e) => {
                  try {
                    const schema = JSON.parse(e.target.value);
                    const newResponses = [...responses];
                    newResponses[index] = { ...response, schema };
                    setResponses(newResponses);
                  } catch (error) {
                    // Handle invalid JSON
                  }
                }}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-white font-mono"
                rows={6}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-gray-300 hover:text-white"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Create Tool
        </button>
      </div>
    </div>
  );
}
