import { NextResponse } from 'next/server';

// Define the onboarding questions
const onboardingQuestions = [
  {
    section: 'business',
    title: 'Business Profile',
    subtitle: 'Tell us about your organization',
    fields: [
      {
        id: 'companyName',
        type: 'text',
        label: 'Organization Name',
        required: true,
        placeholder: 'Enter your business name',
        tooltip: 'The name your customers know you by'
      },
      {
        id: 'businessPhone',
        type: 'tel',
        label: 'Primary Contact Number',
        required: true,
        placeholder: '+1 (555) 123-4567',
        description: 'This number will be whitelisted for priority support'
      }
    ]
  },
  {
    section: 'callVolume',
    title: 'Call Management',
    subtitle: 'Help us optimize your AI Assistant\'s availability',
    fields: [
      {
        id: 'monthlyCallVolume',
        type: 'radio',
        label: 'Expected Monthly Call Volume',
        required: true,
        description: 'This helps us recommend the most suitable plan for your needs',
        tooltip: 'Choose based on your typical monthly inbound call volume',
        options: [
          'Up to 100 calls',
          '101-500 calls',
          '501-1000 calls',
          '1001-5000 calls',
          'Over 5000 calls'
        ]
      },
      {
        id: 'peakHours',
        type: 'radio',
        label: 'Primary Operating Hours',
        required: true,
        description: 'When do you need your AI Assistant to be most active?',
        options: [
          'Standard Business Hours (9 AM - 6 PM)',
          'Extended Hours (6 PM - 12 AM)',
          '24/7 Coverage',
          'Custom Schedule (We\'ll help you configure)'
        ]
      }
    ]
  },
  {
    section: 'useCase',
    title: 'Primary Objectives',
    subtitle: 'Define your AI Assistant\'s core functions',
    fields: [
      {
        id: 'primaryUseCase',
        type: 'radio',
        label: 'Main Purpose',
        required: true,
        description: 'This helps us optimize the AI\'s conversational flow',
        options: [
          'Lead Qualification & Capture',
          'Appointment Scheduling & Management',
          'Customer Support & Service',
          'Order Processing & Management',
          'Information Collection & Distribution',
          'Custom Solution (Specify in next step)'
        ]
      },
      {
        id: 'callComplexity',
        type: 'radio',
        label: 'Interaction Complexity',
        required: true,
        description: 'How complex are your typical customer interactions?',
        options: [
          'Basic (Simple Q&A, information collection)',
          'Moderate (Multi-step processes, basic problem solving)',
          'Complex (Advanced troubleshooting, multiple decision points)'
        ]
      }
    ]
  },
  {
    section: 'scriptConfig',
    title: 'Script Configuration',
    subtitle: 'Define your scripting preferences',
    fields: [
      {
        id: 'scriptComplexity',
        type: 'radio',
        label: 'Script Complexity',
        required: true,
        description: 'What level of script complexity do you require?',
        options: [
          'I have detailed call scripts to follow',
          'I need help creating call scripts',
          'I want AI to handle conversations naturally'
        ]
      }
    ]
  },
  {
    section: 'workflowAutomation',
    title: 'Workflow Automation',
    subtitle: 'Enhance your AI Assistant\'s capabilities',
    fields: [
      {
        id: 'customAutomation',
        type: 'radio',
        label: 'Custom Automation Requirements',
        required: true,
        description: 'What level of workflow automation do you need?',
        options: [
          'Basic (Email notifications, calendar updates)',
          'Intermediate (CRM integration, task management)',
          'Advanced (Custom API integrations, complex workflows)',
          'Not sure (Our team will help you decide)'
        ]
      }
    ]
  }
];

export async function GET() {
  try {
    return NextResponse.json({ onboardingQuestions });
  } catch (error) {
    console.error('Error in onboarding-questions GET:', error);
    return NextResponse.json({ error }, { status: 500 });
  }
}
