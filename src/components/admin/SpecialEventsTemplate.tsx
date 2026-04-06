'use client';

import React, { useState } from 'react';
import { EventDetails, SpecialEventsEmailData } from '@/lib/emailTemplates';

interface SpecialEventsTemplateProps {
  onDataChange: (data: SpecialEventsEmailData) => void;
  initialData?: Partial<SpecialEventsEmailData>;
}

const SpecialEventsTemplate: React.FC<SpecialEventsTemplateProps> = ({
  onDataChange,
  initialData = {}
}) => {
  const [data, setData] = useState<Partial<SpecialEventsEmailData>>({
    mainTitle: initialData.mainTitle || '',
    introduction: initialData.introduction || '',
    events: initialData.events || [],
    conclusion: initialData.conclusion || ''
  });

  const updateData = (newData: Partial<SpecialEventsEmailData>) => {
    const updatedData = { ...data, ...newData };
    setData(updatedData);
    onDataChange(updatedData as SpecialEventsEmailData);
  };

  const addEvent = () => {
    const newEvent: EventDetails = {
      title: '',
      date: '',
      description: ''
    };
    
    updateData({
      events: [...(data.events || []), newEvent]
    });
  };

  const updateEvent = (
    index: number,
    field: keyof EventDetails,
    value: string
  ) => {
    const events = [...(data.events || [])];
    events[index] = { ...events[index], [field]: value };
    
    updateData({ events });
  };

  const removeEvent = (index: number) => {
    const events = [...(data.events || [])];
    events.splice(index, 1);
    
    updateData({ events });
  };

  return (
    <div className="special-events-template">
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
          placeholder="Write an introduction for your special events email"
          rows={3}
        />
      </div>
      
      <div className="events-section">
        <div className="section-header">
          <h3>Events</h3>
          <button 
            type="button" 
            className="btn btn-sm btn-outline-primary"
            onClick={addEvent}
          >
            Add Event
          </button>
        </div>
        
        {(data.events || []).length === 0 ? (
          <p className="text-muted">No events added yet.</p>
        ) : (
          <div className="events-list">
            {(data.events || []).map((event, index) => (
              <div key={index} className="event-item">
                <div className="event-item-header">
                  <h4>Event {index + 1}</h4>
                  <button 
                    type="button" 
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => removeEvent(index)}
                  >
                    Remove
                  </button>
                </div>
                
                <div className="form-group">
                  <label>Title</label>
                  <input
                    type="text"
                    className="form-control"
                    value={event.title}
                    onChange={(e) => updateEvent(index, 'title', e.target.value)}
                    placeholder="Event Title"
                  />
                </div>
                
                <div className="form-row">
                  <div className="form-group half">
                    <label>Date</label>
                    <input
                      type="text"
                      className="form-control"
                      value={event.date}
                      onChange={(e) => updateEvent(index, 'date', e.target.value)}
                      placeholder="April 15, 2025"
                    />
                  </div>
                  
                  <div className="form-group half">
                    <label>Time (optional)</label>
                    <input
                      type="text"
                      className="form-control"
                      value={event.time || ''}
                      onChange={(e) => updateEvent(index, 'time', e.target.value)}
                      placeholder="2:00 PM EST"
                    />
                  </div>
                </div>
                
                <div className="form-group">
                  <label>Location (optional)</label>
                  <input
                    type="text"
                    className="form-control"
                    value={event.location || ''}
                    onChange={(e) => updateEvent(index, 'location', e.target.value)}
                    placeholder="Virtual or Physical Location"
                  />
                </div>
                
                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    className="form-control"
                    value={event.description}
                    onChange={(e) => updateEvent(index, 'description', e.target.value)}
                    placeholder="Describe this event in detail"
                    rows={3}
                  />
                </div>
                
                <div className="form-group">
                  <label>Registration Link (optional)</label>
                  <input
                    type="text"
                    className="form-control"
                    value={event.registrationLink || ''}
                    onChange={(e) => updateEvent(index, 'registrationLink', e.target.value)}
                    placeholder="https://example.com/register"
                  />
                </div>
                
                <div className="form-group">
                  <label>Image URL (optional)</label>
                  <input
                    type="text"
                    className="form-control"
                    value={event.imageUrl || ''}
                    onChange={(e) => updateEvent(index, 'imageUrl', e.target.value)}
                    placeholder="https://example.com/image.jpg"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="form-group">
        <label>Conclusion</label>
        <textarea
          className="form-control"
          value={data.conclusion || ''}
          onChange={(e) => updateData({ conclusion: e.target.value })}
          placeholder="Write a conclusion for your special events email"
          rows={3}
        />
      </div>
      
      <style jsx>{`
        .special-events-template {
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
        
        .form-row {
          display: flex;
          gap: 1rem;
          margin-bottom: 1rem;
        }
        
        .half {
          flex: 1;
          margin-bottom: 0;
        }
        
        .text-muted {
          color: #9ca3af;
        }
        
        .events-section {
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
        
        .events-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        
        .event-item {
          padding: 1rem;
          border: 1px solid #374151;
          border-radius: 0.375rem;
          background-color: #1f2937;
        }
        
        .event-item-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }
        
        .event-item-header h4 {
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

export default SpecialEventsTemplate;
