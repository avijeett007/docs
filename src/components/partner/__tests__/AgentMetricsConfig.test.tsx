import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { jest } from '@jest/globals';
import AgentMetricsConfig from '../AgentMetricsConfig';

// Mock react-hot-toast
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

describe('AgentMetricsConfig', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    agentId: 'test-agent-123',
    agentName: 'Test Agent',
    provider: 'vapi',
    onSaved: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue('mock-token');
  });

  it('renders the modal when open', () => {
    render(<AgentMetricsConfig {...defaultProps} />);
    
    expect(screen.getByText('Configure Custom Metrics')).toBeInTheDocument();
    expect(screen.getByText('Agent: Test Agent (VAPI)')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<AgentMetricsConfig {...defaultProps} isOpen={false} />);
    
    expect(screen.queryByText('Configure Custom Metrics')).not.toBeInTheDocument();
  });

  it('loads existing metrics configuration on open', async () => {
    const mockMetrics = {
      success: true,
      metrics: [
        {
          metricName: 'qualified_leads',
          metricType: 'boolean',
          description: 'Lead qualification success',
          enabled: true,
          keywords: ['qualified', 'interested'],
          priority: 1,
        },
      ],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockMetrics,
    });

    render(<AgentMetricsConfig {...defaultProps} />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/analytics/agents/test-agent-123/metrics?provider=vapi',
        {
          headers: {
            Authorization: 'Bearer mock-token',
          },
        }
      );
    });
  });

  it('allows adding a new metric', async () => {
    render(<AgentMetricsConfig {...defaultProps} />);

    // Click "Add Metric" button
    const addButton = screen.getByText('Add Metric');
    fireEvent.click(addButton);

    // Check that a new metric form appears
    expect(screen.getByText('Metric #1')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g., qualified_leads')).toBeInTheDocument();
  });

  it('allows removing a metric', async () => {
    render(<AgentMetricsConfig {...defaultProps} />);

    // Add a metric first
    const addButton = screen.getByText('Add Metric');
    fireEvent.click(addButton);

    // Find and click the remove button
    const removeButton = screen.getByRole('button', { name: /delete/i });
    fireEvent.click(removeButton);

    // Check that the metric is removed
    expect(screen.queryByText('Metric #1')).not.toBeInTheDocument();
  });

  it('validates required fields', async () => {
    render(<AgentMetricsConfig {...defaultProps} />);

    // Add a metric
    const addButton = screen.getByText('Add Metric');
    fireEvent.click(addButton);

    // Try to save without filling required fields
    const saveButton = screen.getByText('Save Configuration');
    fireEvent.click(saveButton);

    // Check for validation errors
    await waitFor(() => {
      expect(screen.getByText('Metric name is required')).toBeInTheDocument();
      expect(screen.getByText('Description is required')).toBeInTheDocument();
    });
  });

  it('allows adding and removing keywords', async () => {
    render(<AgentMetricsConfig {...defaultProps} />);

    // Add a metric
    const addButton = screen.getByText('Add Metric');
    fireEvent.click(addButton);

    // Add a keyword
    const keywordInput = screen.getByPlaceholderText('Enter keyword and press Enter');
    fireEvent.change(keywordInput, { target: { value: 'qualified' } });
    fireEvent.keyPress(keywordInput, { key: 'Enter', code: 'Enter' });

    // Check that keyword was added
    expect(screen.getByText('qualified')).toBeInTheDocument();

    // Remove the keyword
    const removeKeywordButton = screen.getByRole('button', { name: /remove keyword/i });
    fireEvent.click(removeKeywordButton);

    // Check that keyword was removed
    expect(screen.queryByText('qualified')).not.toBeInTheDocument();
  });

  it('saves metrics configuration successfully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    render(<AgentMetricsConfig {...defaultProps} />);

    // Add a metric with valid data
    const addButton = screen.getByText('Add Metric');
    fireEvent.click(addButton);

    const nameInput = screen.getByPlaceholderText('e.g., qualified_leads');
    const descriptionInput = screen.getByPlaceholderText('Describe what this metric measures...');

    fireEvent.change(nameInput, { target: { value: 'test_metric' } });
    fireEvent.change(descriptionInput, { target: { value: 'Test metric description' } });

    // Save the configuration
    const saveButton = screen.getByText('Save Configuration');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/analytics/agents/test-agent-123/metrics?provider=vapi',
        expect.objectContaining({
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer mock-token',
          },
          body: expect.stringContaining('test_metric'),
        })
      );
    });

    expect(defaultProps.onSaved).toHaveBeenCalled();
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('handles save errors gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Save failed' }),
    });

    render(<AgentMetricsConfig {...defaultProps} />);

    // Add a metric with valid data
    const addButton = screen.getByText('Add Metric');
    fireEvent.click(addButton);

    const nameInput = screen.getByPlaceholderText('e.g., qualified_leads');
    const descriptionInput = screen.getByPlaceholderText('Describe what this metric measures...');

    fireEvent.change(nameInput, { target: { value: 'test_metric' } });
    fireEvent.change(descriptionInput, { target: { value: 'Test metric description' } });

    // Try to save
    const saveButton = screen.getByText('Save Configuration');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    // Should not call onSaved or onClose on error
    expect(defaultProps.onSaved).not.toHaveBeenCalled();
    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });

  it('closes modal when cancel is clicked', () => {
    render(<AgentMetricsConfig {...defaultProps} />);

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('closes modal when X button is clicked', () => {
    render(<AgentMetricsConfig {...defaultProps} />);

    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);

    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});
