import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FiDatabase, FiAlertCircle } from 'react-icons/fi';

interface Knowledgebase {
  id: string;
  name: string;
  description: string;
  _count: {
    knowledge_base_documents: number;
  };
}

interface KnowledgebaseSelectorProps {
  value?: string;
  onChange: (value: string) => void;
}

export const KnowledgebaseSelector: React.FC<KnowledgebaseSelectorProps> = ({
  value,
  onChange
}) => {
  const [knowledgebases, setKnowledgebases] = useState<Knowledgebase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchKnowledgebases = async () => {
      try {
        const response = await fetch('/api/knowledgebase/eligible');
        if (!response.ok) {
          throw new Error('Failed to fetch knowledgebases');
        }
        const data = await response.json();
        setKnowledgebases(data);
      } catch (error) {
        console.error('Error fetching knowledgebases:', error);
        setError('Failed to load knowledgebases');
      } finally {
        setLoading(false);
      }
    };

    fetchKnowledgebases();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-b-transparent border-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-32 text-red-500">
        <FiAlertCircle className="h-5 w-5 mr-2" />
        {error}
      </div>
    );
  }

  if (knowledgebases.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 text-center">
        <FiDatabase className="h-8 w-8 mx-auto text-gray-400 mb-3" />
        <h3 className="text-lg font-medium text-gray-200 mb-2">No Eligible Knowledgebases</h3>
        <p className="text-sm text-gray-400">
          You haven't created any knowledgebases yet, or they are still being processed. 
          Make sure to upload knowledge and wait for embedding to finish.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {knowledgebases.map((kb) => (
        <motion.button
          key={kb.id}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onChange(kb.id)}
          className={`flex flex-col p-4 rounded-lg border-2 transition-colors ${
            value === kb.id
              ? 'border-blue-500 bg-blue-500/10'
              : 'border-gray-700 bg-gray-800 hover:border-gray-600'
          }`}
        >
          <div className="flex items-center mb-2">
            <FiDatabase className={`h-5 w-5 ${value === kb.id ? 'text-blue-400' : 'text-gray-400'}`} />
            <h3 className="ml-2 font-medium text-gray-200">{kb.name}</h3>
          </div>
          <p className="text-sm text-gray-400 mb-2">{kb.description}</p>
          <div className="text-xs text-gray-500">
            {kb._count.knowledge_base_documents} document{kb._count.knowledge_base_documents !== 1 ? 's' : ''}
          </div>
        </motion.button>
      ))}
    </div>
  );
};
