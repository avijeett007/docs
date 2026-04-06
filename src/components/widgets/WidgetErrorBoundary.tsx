'use client';

import React from 'react';

interface WidgetErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface WidgetErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

class WidgetErrorBoundary extends React.Component<
  WidgetErrorBoundaryProps,
  WidgetErrorBoundaryState
> {
  constructor(props: WidgetErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): WidgetErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error for debugging but don't show to users in production
    console.error('[Widget Error Boundary]', error, errorInfo);
    
    // Only log to external services in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Widget error details:', {
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack
      });
    }
  }

  render() {
    if (this.state.hasError) {
      // In production, show the fallback or nothing
      if (process.env.NODE_ENV === 'production') {
        return this.props.fallback || (
          <div style={{
            width: '100%',
            height: '200px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#666',
            fontSize: '14px'
          }}>
            Widget temporarily unavailable
          </div>
        );
      }
      
      // In development, show error details
      return (
        <div style={{
          padding: '20px',
          border: '1px solid #ff6b6b',
          borderRadius: '8px',
          backgroundColor: '#ffe0e0',
          color: '#d63031'
        }}>
          <h3>Widget Error (Development)</h3>
          <p>{this.state.error?.message}</p>
          <details style={{ marginTop: '10px' }}>
            <summary>Stack trace</summary>
            <pre style={{ fontSize: '12px', overflow: 'auto' }}>
              {this.state.error?.stack}
            </pre>
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}

export default WidgetErrorBoundary;
