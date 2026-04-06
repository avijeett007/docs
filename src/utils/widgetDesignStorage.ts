import type { WidgetConfig } from '@/types/widget';

const STORAGE_KEY = 'knotie_widget_design_draft';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const generateEmbedCode = (agentId: string, _config: WidgetConfig): string => {
  const widgetUrl = process.env.NEXT_PUBLIC_WIDGET_URL || 'https://your-domain.com';
  const embedCode = `<script src="${widgetUrl}/widget.js" data-agent-id="${agentId}"></script>`;
  return embedCode;
};

export const saveWidgetDesign = (agentId: string, design: WidgetConfig): WidgetConfig => {
  try {
    console.log(' [widgetDesignStorage] Saving widget design for agent:', agentId);
    console.log(' [widgetDesignStorage] Design config:', design);
    
    const existingData = getWidgetDesigns();
    const embedCode = generateEmbedCode(agentId, design);
    console.log(' [widgetDesignStorage] Generated embed code:', embedCode);

    const designWithId: WidgetConfig = {
      ...design,
      id: agentId,
      agentId,
      embedCode,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...existingData,
      [agentId]: designWithId
    }));
    console.log(' [widgetDesignStorage] Successfully saved widget design to localStorage');

    return designWithId;
  } catch (error) {
    console.error(' [widgetDesignStorage] Error saving widget design:', error);
    throw error;
  }
};

export const getWidgetDesigns = (): Record<string, WidgetConfig> => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error('Error getting widget designs:', error);
    return {};
  }
};

export const getWidgetDesign = (agentId: string): WidgetConfig | null => {
  try {
    console.log(' [widgetDesignStorage] Getting widget design for agent:', agentId);
    const designs = getWidgetDesigns();
    const design = designs[agentId] || null;
    console.log(' [widgetDesignStorage] Retrieved design:', design);
    return design;
  } catch (error) {
    console.error(' [widgetDesignStorage] Error getting widget design:', error);
    return null;
  }
};

export const clearWidgetDesign = (agentId: string) => {
  try {
    const designs = getWidgetDesigns();
    const { [agentId]: removed, ...rest } = designs;
    console.log('Removed design for agent:', agentId, removed);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
  } catch (error) {
    console.error('Error clearing widget design:', error);
    throw error;
  }
};
