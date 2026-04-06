import type { AgentData } from '@/types/agent';

const STORAGE_KEY = 'knotie_ai_agents';

export const saveAgentData = async (data: AgentData): Promise<boolean> => {
  try {
    // Save to API
    const response = await fetch('/api/agents', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('Failed to save agent data');
    }

    // Also save to local storage for immediate access
    const existingData = await getAgents();
    const updatedData = {
      ...existingData,
      [data.id]: data
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedData));
    
    return true;
  } catch (error) {
    console.error('Error saving agent data:', error);
    return false;
  }
};

export const getAgents = async (): Promise<Record<string, AgentData>> => {
  try {
    // Try to get from API first
    const response = await fetch('/api/agents');
    if (response.ok) {
      const agents = await response.json();
      // Convert array to record
      const agentsRecord = agents.reduce((acc: Record<string, AgentData>, agent: AgentData) => {
        acc[agent.id] = agent;
        return acc;
      }, {});
      
      // Update local storage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(agentsRecord));
      return agentsRecord;
    }

    // Fallback to local storage
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error('Error getting agents:', error);
    // Fallback to local storage
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  }
};

export const getAgentById = async (id: string): Promise<AgentData | null> => {
  try {
    const agents = await getAgents();
    return agents[id] || null;
  } catch (error) {
    console.error('Error getting agent by ID:', error);
    return null;
  }
};

export const deleteAgent = async (id: string): Promise<boolean> => {
  try {
    // Delete from API
    const response = await fetch(`/api/agents?id=${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Failed to delete agent');
    }

    // Also delete from local storage
    const existingData = await getAgents();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { [id]: _removed, ...updatedData } = existingData;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedData));
    
    return true;
  } catch (error) {
    console.error('Error deleting agent:', error);
    return false;
  }
};

export const generateSystemPrompt = (data: Partial<AgentData>): string => {
  return `You are an AI assistant for ${data.businessName || 'the business'}. 
Your purpose is to ${data.purpose || 'assist users'}. 
${data.warmupMessage || ''}`;
};

// Local-only storage for form drafts
export const saveDraftAgent = (data: AgentData): void => {
  try {
    const existingData = getDraftAgents();
    const updatedData = {
      ...existingData,
      [data.id]: data
    };
    localStorage.setItem('knotie_ai_agent_drafts', JSON.stringify(updatedData));
  } catch (error) {
    console.error('Error saving draft agent:', error);
  }
};

export const getDraftAgents = (): Record<string, AgentData> => {
  try {
    const data = localStorage.getItem('knotie_ai_agent_drafts');
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error('Error getting draft agents:', error);
    return {};
  }
};

export const clearDraftAgent = (id: string): void => {
  try {
    const drafts = getDraftAgents();
    delete drafts[id];
    localStorage.setItem('knotie_ai_agent_drafts', JSON.stringify(drafts));
  } catch (error) {
    console.error('Error clearing draft agent:', error);
  }
};
