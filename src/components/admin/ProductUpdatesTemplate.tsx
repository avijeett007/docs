'use client';

import React, { useState } from 'react';
import { ProductUpdateSection, ProductUpdatesEmailData } from '@/lib/emailTemplates';

interface ProductUpdatesTemplateProps {
  onDataChange: (data: ProductUpdatesEmailData) => void;
  initialData?: Partial<ProductUpdatesEmailData>;
}

const ProductUpdatesTemplate: React.FC<ProductUpdatesTemplateProps> = ({
  onDataChange,
  initialData = {}
}) => {
  const [data, setData] = useState<Partial<ProductUpdatesEmailData>>({
    mainTitle: initialData.mainTitle || '',
    introduction: initialData.introduction || '',
    partnerFeatures: initialData.partnerFeatures || [],
    customerFeatures: initialData.customerFeatures || [],
    platformUpdates: initialData.platformUpdates || [],
    adminUpdates: initialData.adminUpdates || [],
    events: initialData.events || [],
    conclusion: initialData.conclusion || ''
  });

  const updateData = (newData: Partial<ProductUpdatesEmailData>) => {
    const updatedData = { ...data, ...newData };
    setData(updatedData);
    onDataChange(updatedData as ProductUpdatesEmailData);
  };

  const addSection = (sectionType: keyof ProductUpdatesEmailData) => {
    if (!Array.isArray(data[sectionType])) return;
    
    const newSection: ProductUpdateSection = {
      title: '',
      details: ''
    };
    
    updateData({
      [sectionType]: [...(data[sectionType] as ProductUpdateSection[]), newSection]
    });
  };

  const updateSection = (
    sectionType: keyof ProductUpdatesEmailData,
    index: number,
    field: keyof ProductUpdateSection,
    value: string
  ) => {
    if (!Array.isArray(data[sectionType])) return;
    
    const sections = [...(data[sectionType] as ProductUpdateSection[])];
    sections[index] = { ...sections[index], [field]: value };
    
    updateData({
      [sectionType]: sections
    });
  };

  const removeSection = (sectionType: keyof ProductUpdatesEmailData, index: number) => {
    if (!Array.isArray(data[sectionType])) return;
    
    const sections = [...(data[sectionType] as ProductUpdateSection[])];
    sections.splice(index, 1);
    
    updateData({
      [sectionType]: sections
    });
  };

  const renderSectionEditor = (
    sectionType: keyof ProductUpdatesEmailData,
    title: string
  ) => {
    if (!Array.isArray(data[sectionType])) return null;
    
    const sections = data[sectionType] as ProductUpdateSection[];
    
    return (
      <div className="section-editor">
        <div className="section-header">
          <h3>{title}</h3>
          <button 
            type="button" 
            className="btn btn-sm btn-outline-primary"
            onClick={() => addSection(sectionType)}
          >
            Add {title.replace(/s$/, '')}
          </button>
        </div>
        
        {sections.length === 0 ? (
          <p className="text-muted">No {title.toLowerCase()} added yet.</p>
        ) : (
          <div className="section-items">
            {sections.map((section, index) => (
              <div key={index} className="section-item">
                <div className="section-item-header">
                  <h4>Item {index + 1}</h4>
                  <button 
                    type="button" 
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => removeSection(sectionType, index)}
                  >
                    Remove
                  </button>
                </div>
                
                <div className="form-group">
                  <label>Title</label>
                  <input
                    type="text"
                    className="form-control"
                    value={section.title}
                    onChange={(e) => updateSection(sectionType, index, 'title', e.target.value)}
                    placeholder="Feature/Update Title"
                  />
                </div>
                
                <div className="form-group">
                  <label>Details</label>
                  <textarea
                    className="form-control"
                    value={section.details}
                    onChange={(e) => updateSection(sectionType, index, 'details', e.target.value)}
                    placeholder="Describe this feature or update in detail"
                    rows={3}
                  />
                </div>
                
                <div className="form-group">
                  <label>Image URL (optional)</label>
                  <input
                    type="text"
                    className="form-control"
                    value={section.imageUrl || ''}
                    onChange={(e) => updateSection(sectionType, index, 'imageUrl', e.target.value)}
                    placeholder="https://example.com/image.jpg"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="product-updates-template">
      <div className="form-group">
        <label>Main Title</label>
        <input
          type="text"
          className="form-control"
          value={data.mainTitle || ''}
          onChange={(e) => updateData({ mainTitle: e.target.value })}
          placeholder="Email Main Title"
        />
      </div>
      
      <div className="form-group">
        <label>Introduction</label>
        <textarea
          className="form-control"
          value={data.introduction || ''}
          onChange={(e) => updateData({ introduction: e.target.value })}
          placeholder="Write an introduction for your product updates email"
          rows={3}
        />
      </div>
      
      {renderSectionEditor('partnerFeatures', 'Partner Features')}
      {renderSectionEditor('customerFeatures', 'Customer Features')}
      {renderSectionEditor('platformUpdates', 'Platform Updates')}
      {renderSectionEditor('adminUpdates', 'Admin Updates')}
      {renderSectionEditor('events', 'Interesting Events')}
      
      <div className="form-group">
        <label>Conclusion</label>
        <textarea
          className="form-control"
          value={data.conclusion || ''}
          onChange={(e) => updateData({ conclusion: e.target.value })}
          placeholder="Write a conclusion for your product updates email"
          rows={3}
        />
      </div>
      
      <style jsx>{`
        .product-updates-template {
          width: 100%;
        }
        
        .form-group {
          margin-bottom: 1rem;
        }
        
        .form-group label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 500;
          color: #f9fafb;
        }
        
        .form-control {
          width: 100%;
          padding: 0.5rem 0.75rem;
          border: 1px solid #374151;
          border-radius: 0.375rem;
          background-color: #111827;
          color: #f9fafb;
          font-size: 0.875rem;
        }
        
        .text-muted {
          color: #9ca3af;
        }
        
        .section-editor {
          margin-bottom: 2rem;
          padding: 1rem;
          border: 1px solid #374151;
          border-radius: 0.5rem;
          background-color: rgba(31, 41, 55, 0.5);
        }
        
        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }
        
        .section-header h3 {
          margin: 0;
          color: #f9fafb;
        }
        
        .section-items {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        
        .section-item {
          padding: 1rem;
          border: 1px solid #374151;
          border-radius: 0.375rem;
          background-color: #1f2937;
        }
        
        .section-item-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }
        
        .section-item-header h4 {
          margin: 0;
          color: #f9fafb;
        }
        
        .btn {
          display: inline-flex;
          align-items: center;
          padding: 0.5rem 1rem;
          border-radius: 0.375rem;
          font-weight: 500;
          cursor: pointer;
        }
        
        .btn-sm {
          padding: 0.25rem 0.5rem;
          font-size: 0.875rem;
        }
        
        .btn-outline-primary {
          background-color: transparent;
          color: #3b82f6;
          border: 1px solid #3b82f6;
        }
        
        .btn-outline-danger {
          background-color: transparent;
          color: #ef4444;
          border: 1px solid #ef4444;
        }
      `}</style>
    </div>
  );
};

export default ProductUpdatesTemplate;
