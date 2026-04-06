import type { WidgetConfig } from '@/types/widget';

const STORAGE_KEY = 'knotie_ai_widgets';

export const saveWidgetConfig = async (config: WidgetConfig): Promise<boolean> => {
  try {
    // Save to API
    const response = await fetch('/api/widgets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      throw new Error('Failed to save widget configuration');
    }

    // Also save to local storage for immediate access
    const existingData = await getWidgets();
    const updatedData = {
      ...existingData,
      [config.id]: config,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedData));

    return true;
  } catch (error) {
    console.error('Error saving widget config:', error);
    return false;
  }
};

export const getWidgets = async (): Promise<Record<string, WidgetConfig>> => {
  try {
    // Try to get from API first
    const response = await fetch('/api/widgets');
    if (response.ok) {
      const data = await response.json();
      // Update local storage with latest data
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return data;
    }
  } catch (error) {
    console.error('Error fetching widgets from API:', error);
  }

  // Fallback to local storage if API fails
  const localData = localStorage.getItem(STORAGE_KEY);
  return localData ? JSON.parse(localData) : {};
};

export const getWidgetByAgentId = async (agentId: string): Promise<WidgetConfig | null> => {
  const widgets = await getWidgets();
  return Object.values(widgets).find(widget => widget.agentId === agentId) || null;
};

export const deleteWidget = async (id: string): Promise<boolean> => {
  try {
    // Delete from API
    const response = await fetch(`/api/widgets/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Failed to delete widget');
    }

    // Also remove from local storage
    const existingData = await getWidgets();
    delete existingData[id];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existingData));

    return true;
  } catch (error) {
    console.error('Error deleting widget:', error);
    return false;
  }
};
