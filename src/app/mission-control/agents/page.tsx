'use client';

import { useState, useEffect } from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useAdminAuth } from '@/components/admin/AdminAuthProvider';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  MoreHorizontal,
  Headphones,
  Plus,
  Edit,
  Trash,
  Play,
  Pause,
  Copy,
  AlertCircle,
  Volume2,
  Mic,
  RefreshCw,
  Loader
} from 'lucide-react';
import { format } from 'date-fns';

// Define interface for AI agents
interface AIAgent {
  id: string;
  name: string;
  description: string;
  status: string;
  createdAt: string;
  lastModified: string;
  voiceType: string;
  language: string;
  usageCount: number;
}

// Define interface for Voice configurations
interface VoiceConfig {
  id: string;
  name: string;
  displayName: string;
  provider: string;
  voiceModelId: string;
  sampleUrl?: string;
  sex: string;
  voiceType: string;
  language: string;
  accent?: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function AIAgentsPage() {
  const { user } = useAdminAuth();
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [voices, setVoices] = useState<VoiceConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [voicesLoading, setVoicesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [voicesError, setVoicesError] = useState<string | null>(null);
  const [syncingVoices, setSyncingVoices] = useState(false);
  
  // Fetch agents from API
  useEffect(() => {
    const fetchAgents = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/admin/ai-agents');
        if (!response.ok) {
          throw new Error('Failed to fetch AI agents');
        }
        const data = await response.json();
        // Handle both formats: direct array or {agents: [...]} object
        const agentsData = Array.isArray(data) ? data : (data.agents || []);
        setAgents(agentsData);
      } catch (err) {
        console.error('Error fetching AI agents:', err);
        const errorMessage = err instanceof Error ? err.message : 'An error occurred while fetching AI agents';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchAgents();
    }
  }, [user]);

  // Fetch voices from API
  useEffect(() => {
    const fetchVoices = async () => {
      try {
        setVoicesLoading(true);
        const response = await fetch('/api/admin/voices');
        if (!response.ok) {
          throw new Error('Failed to fetch voice configurations');
        }
        const data = await response.json();
        const voicesData = Array.isArray(data) ? data : (data.voices || []);
        setVoices(voicesData);
      } catch (err) {
        console.error('Error fetching voices:', err);
        const errorMessage = err instanceof Error ? err.message : 'An error occurred while fetching voice configurations';
        setVoicesError(errorMessage);
      } finally {
        setVoicesLoading(false);
      }
    };

    if (user) {
      fetchVoices();
    }
  }, [user]);
  const [activeTab, setActiveTab] = useState('existing');
  const [newAgent, setNewAgent] = useState({
    name: '',
    description: '',
    voiceType: 'female',
    language: 'English',
    initialPrompt: ''
  });
  const [newVoice, setNewVoice] = useState({
    voiceId: '',
    providerId: 'elevenlabs',
    voiceName: '',
    sampleVoiceUrl: '',
    sex: 'female',
    voiceType: 'standard',
    language: 'en',
    accent: '',
    description: ''
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewAgent(prev => ({ ...prev, [name]: value }));
  };

  const handleVoiceInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewVoice(prev => ({ ...prev, [name]: value }));
  };

  const handleSwitchChange = (name: string, checked: boolean) => {
    if (name === 'voiceType') {
      setNewAgent(prev => ({ ...prev, voiceType: checked ? 'female' : 'male' }));
    }
  };

  const handleCreateAgent = () => {
    // In a real implementation, this would send a request to create the agent
    const newAgentData = {
      id: `${agents.length + 1}`,
      ...newAgent,
      status: 'active',
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      usageCount: 0
    };

    setAgents([...agents, newAgentData]);
    setNewAgent({
      name: '',
      description: '',
      voiceType: 'female',
      language: 'English',
      initialPrompt: ''
    });
    setActiveTab('existing');
  };

  const handleCreateVoice = async () => {
    try {
      const response = await fetch('/api/admin/voices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newVoice),
      });

      if (!response.ok) {
        throw new Error('Failed to create voice configuration');
      }

      const createdVoice = await response.json();
      setVoices([...voices, createdVoice]);
      setNewVoice({
        voiceId: '',
        providerId: 'elevenlabs',
        voiceName: '',
        sampleVoiceUrl: '',
        sex: 'female',
        voiceType: 'standard',
        language: 'en',
        accent: '',
        description: ''
      });
    } catch (err) {
      console.error('Error creating voice:', err);
      setVoicesError(err instanceof Error ? err.message : 'Failed to create voice configuration');
    }
  };

  const handleSyncVapiVoices = async () => {
    try {
      setSyncingVoices(true);
      const response = await fetch('/api/admin/vapi-voices', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const vapiVoices = await response.json();
        console.log('Fetched VAPI voices:', vapiVoices);
        // Optionally refresh the voices list
        // You could add these voices to the local database here
        alert(`Successfully fetched ${vapiVoices.length} voices from VAPI`);
      } else {
        console.error('Failed to sync VAPI voices');
        alert('Failed to sync VAPI voices');
      }
    } catch (error) {
      console.error('Error syncing VAPI voices:', error);
      alert('Error syncing VAPI voices');
    } finally {
      setSyncingVoices(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800">Active</Badge>;
      case 'inactive':
        return <Badge className="bg-gray-100 text-gray-800">Inactive</Badge>;
      default:
        return <Badge className="bg-blue-100 text-blue-800">{status}</Badge>;
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen">
      <AdminSidebar />
      <div className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold tracking-tight">AI Agents</h1>
            <Button onClick={() => setActiveTab('create')}>
              <Plus className="mr-2 h-4 w-4" />
              Create New Agent
            </Button>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList>
              <TabsTrigger value="existing">Existing Agents</TabsTrigger>
              <TabsTrigger value="voices">Voice Management</TabsTrigger>
              <TabsTrigger value="create">Create New Agent</TabsTrigger>
              <TabsTrigger value="settings">Global Settings</TabsTrigger>
            </TabsList>
            
            <TabsContent value="existing" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>AI Voice Agents</CardTitle>
                  <CardDescription>
                    Manage your AI voice agents for customer interactions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {error && (
                    <Alert variant="destructive" className="mb-4">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  
                  {loading ? (
                    <div className="flex items-center justify-center h-64">
                      <div className="animate-spin h-8 w-8 border-4 border-gray-300 rounded-full border-t-blue-600"></div>
                    </div>
                  ) : agents.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Headphones className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                      <h3 className="text-lg font-medium">No AI agents found</h3>
                      <p>Create your first AI agent to get started</p>
                      <Button className="mt-4" onClick={() => setActiveTab('create')}>
                        <Plus className="mr-2 h-4 w-4" />
                        Create New Agent
                      </Button>
                    </div>
                  ) : (
                    <div className="border rounded-md">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Voice Type</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Usage</TableHead>
                            <TableHead>Last Modified</TableHead>
                            <TableHead className="w-[80px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {agents.map((agent) => (
                            <TableRow key={agent.id}>
                              <TableCell className="font-medium">{agent.name}</TableCell>
                              <TableCell className="max-w-xs truncate">{agent.description}</TableCell>
                              <TableCell>{agent.voiceType}</TableCell>
                              <TableCell>{getStatusBadge(agent.status)}</TableCell>
                              <TableCell>{agent.usageCount.toLocaleString()} calls</TableCell>
                              <TableCell>
                                {format(new Date(agent.lastModified), 'MMM d, yyyy')}
                              </TableCell>
                              <TableCell>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                      <span className="sr-only">Open menu</span>
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem>
                                      <Edit className="mr-2 h-4 w-4" />
                                      <span>Edit</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem>
                                      <Copy className="mr-2 h-4 w-4" />
                                      <span>Duplicate</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem>
                                      {agent.status === 'active' ? (
                                        <>
                                          <Pause className="mr-2 h-4 w-4" />
                                          <span>Deactivate</span>
                                        </>
                                      ) : (
                                        <>
                                          <Play className="mr-2 h-4 w-4" />
                                          <span>Activate</span>
                                        </>
                                      )}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="text-red-600">
                                      <Trash className="mr-2 h-4 w-4" />
                                      <span>Delete</span>
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="voices" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Volume2 className="h-5 w-5" />
                    Voice Configurations
                  </CardTitle>
                  <CardDescription>
                    Manage voice configurations for VAPI agents. Partners can select from these voices when creating agents.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {voicesError && (
                    <Alert variant="destructive" className="mb-4">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{voicesError}</AlertDescription>
                    </Alert>
                  )}

                  {voicesLoading ? (
                    <div className="flex items-center justify-center h-64">
                      <div className="animate-spin h-8 w-8 border-4 border-gray-300 rounded-full border-t-blue-600"></div>
                    </div>
                  ) : voices.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Mic className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                      <h3 className="text-lg font-medium">No voice configurations found</h3>
                      <p>Create your first voice configuration to get started</p>
                      <Button className="mt-4" onClick={() => setActiveTab('create-voice')}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Voice Configuration
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex justify-end gap-3">
                        <Button
                          onClick={handleSyncVapiVoices}
                          disabled={syncingVoices}
                          variant="outline"
                        >
                          {syncingVoices ? (
                            <>
                              <Loader className="mr-2 h-4 w-4 animate-spin" />
                              Syncing...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="mr-2 h-4 w-4" />
                              Sync VAPI Voices
                            </>
                          )}
                        </Button>
                        <Button onClick={() => setActiveTab('create-voice')}>
                          <Plus className="mr-2 h-4 w-4" />
                          Add Voice Configuration
                        </Button>
                      </div>
                      <div className="border rounded-md">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Voice Name</TableHead>
                              <TableHead>Voice ID</TableHead>
                              <TableHead>Provider</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Sample</TableHead>
                              <TableHead>Created</TableHead>
                              <TableHead className="w-[80px]"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {voices.map((voice) => (
                              <TableRow key={voice.id}>
                                <TableCell className="font-medium">{voice.displayName}</TableCell>
                                <TableCell className="font-mono text-sm">{voice.voiceModelId}</TableCell>
                                <TableCell className="capitalize">{voice.provider}</TableCell>
                                <TableCell>
                                  {voice.isActive ? (
                                    <Badge className="bg-green-100 text-green-800">Active</Badge>
                                  ) : (
                                    <Badge className="bg-gray-100 text-gray-800">Inactive</Badge>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {voice.sampleUrl ? (
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                      <Play className="h-4 w-4" />
                                    </Button>
                                  ) : (
                                    <span className="text-gray-400 text-sm">No sample</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {format(new Date(voice.createdAt), 'MMM d, yyyy')}
                                </TableCell>
                                <TableCell>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" className="h-8 w-8 p-0">
                                        <span className="sr-only">Open menu</span>
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem>
                                        <Edit className="mr-2 h-4 w-4" />
                                        <span>Edit</span>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem>
                                        {voice.isActive ? (
                                          <>
                                            <Pause className="mr-2 h-4 w-4" />
                                            <span>Deactivate</span>
                                          </>
                                        ) : (
                                          <>
                                            <Play className="mr-2 h-4 w-4" />
                                            <span>Activate</span>
                                          </>
                                        )}
                                      </DropdownMenuItem>
                                      <DropdownMenuItem className="text-red-600">
                                        <Trash className="mr-2 h-4 w-4" />
                                        <span>Delete</span>
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="create-voice" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Add Voice Configuration</CardTitle>
                  <CardDescription>
                    Configure a new voice that partners can use for their VAPI agents
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="voice-name">Voice Name</Label>
                      <Input
                        id="voice-name"
                        name="voiceName"
                        placeholder="e.g., Sarah - Professional Female"
                        value={newVoice.voiceName}
                        onChange={handleVoiceInputChange}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="provider">Voice Provider</Label>
                      <select
                        id="provider"
                        name="providerId"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={newVoice.providerId}
                        onChange={handleVoiceInputChange}
                      >
                        <option value="elevenlabs">ElevenLabs</option>
                        <option value="openai">OpenAI</option>
                        <option value="playht">PlayHT</option>
                        <option value="azure">Azure</option>
                        <option value="deepgram">Deepgram</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="voice-id">Voice ID</Label>
                    <Input
                      id="voice-id"
                      name="voiceId"
                      placeholder="e.g., 21m00Tcm4TlvDq8ikWAM (ElevenLabs format)"
                      value={newVoice.voiceId}
                      onChange={handleVoiceInputChange}
                    />
                    <p className="text-sm text-gray-500">
                      The unique identifier for this voice from the provider's API
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sample-url">Sample Voice URL (Optional)</Label>
                    <Input
                      id="sample-url"
                      name="sampleVoiceUrl"
                      placeholder="https://example.com/voice-sample.mp3"
                      value={newVoice.sampleVoiceUrl}
                      onChange={handleVoiceInputChange}
                    />
                    <p className="text-sm text-gray-500">
                      URL to a sample audio file for voice preview
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="sex">Gender</Label>
                      <select
                        id="sex"
                        name="sex"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={newVoice.sex}
                        onChange={handleVoiceInputChange}
                      >
                        <option value="female">Female</option>
                        <option value="male">Male</option>
                        <option value="unknown">Unknown</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="voice-type">Voice Type</Label>
                      <select
                        id="voice-type"
                        name="voiceType"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={newVoice.voiceType}
                        onChange={handleVoiceInputChange}
                      >
                        <option value="standard">Standard</option>
                        <option value="neural">Neural</option>
                        <option value="premium">Premium</option>
                        <option value="custom">Custom</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="language">Language</Label>
                      <Input
                        id="language"
                        name="language"
                        placeholder="e.g., en, es, fr"
                        value={newVoice.language}
                        onChange={handleVoiceInputChange}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="accent">Accent (Optional)</Label>
                      <Input
                        id="accent"
                        name="accent"
                        placeholder="e.g., American, British, Australian"
                        value={newVoice.accent}
                        onChange={handleVoiceInputChange}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">Description (Optional)</Label>
                      <Input
                        id="description"
                        name="description"
                        placeholder="Brief description of the voice characteristics"
                        value={newVoice.description}
                        onChange={handleVoiceInputChange}
                      />
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button variant="outline" onClick={() => setActiveTab('voices')}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateVoice}
                    disabled={!newVoice.voiceName || !newVoice.voiceId}
                  >
                    Add Voice Configuration
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>

            <TabsContent value="create" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Create New AI Agent</CardTitle>
                  <CardDescription>
                    Configure a new AI voice agent for your customers
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Agent Name</Label>
                    <Input 
                      id="name" 
                      name="name" 
                      placeholder="e.g., Customer Service Agent" 
                      value={newAgent.name}
                      onChange={handleInputChange}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea 
                      id="description" 
                      name="description" 
                      placeholder="Describe what this agent does" 
                      value={newAgent.description}
                      onChange={handleInputChange}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="voice-type">Voice Type</Label>
                      <div className="flex items-center space-x-2">
                        <span className={newAgent.voiceType === 'male' ? 'text-gray-900' : 'text-gray-500'}>Male</span>
                        <Switch 
                          id="voice-type" 
                          checked={newAgent.voiceType === 'female'} 
                          onCheckedChange={(checked) => handleSwitchChange('voiceType', checked)}
                        />
                        <span className={newAgent.voiceType === 'female' ? 'text-gray-900' : 'text-gray-500'}>Female</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="language">Language</Label>
                    <Input 
                      id="language" 
                      name="language" 
                      placeholder="e.g., English" 
                      value={newAgent.language}
                      onChange={handleInputChange}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="initialPrompt">Initial Prompt</Label>
                    <Textarea 
                      id="initialPrompt" 
                      name="initialPrompt" 
                      placeholder="Enter the initial prompt for the AI agent" 
                      className="min-h-[150px]"
                      value={newAgent.initialPrompt}
                      onChange={handleInputChange}
                    />
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button variant="outline" onClick={() => setActiveTab('existing')}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateAgent} disabled={!newAgent.name || !newAgent.description}>
                    Create Agent
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>
            
            <TabsContent value="settings" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Global AI Agent Settings</CardTitle>
                  <CardDescription>
                    Configure global settings for all AI agents
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="enable-logging">Call Logging</Label>
                        <p className="text-sm text-gray-500">Record and store all AI agent conversations</p>
                      </div>
                      <Switch id="enable-logging" defaultChecked={true} />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="enable-analytics">Usage Analytics</Label>
                        <p className="text-sm text-gray-500">Collect detailed usage analytics for all agents</p>
                      </div>
                      <Switch id="enable-analytics" defaultChecked={true} />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="enable-feedback">Customer Feedback</Label>
                        <p className="text-sm text-gray-500">Allow customers to provide feedback after calls</p>
                      </div>
                      <Switch id="enable-feedback" defaultChecked={true} />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="enable-handoff">Human Handoff</Label>
                        <p className="text-sm text-gray-500">Enable option for calls to be transferred to human agents</p>
                      </div>
                      <Switch id="enable-handoff" defaultChecked={true} />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="default-fallback">Default Fallback Message</Label>
                    <Textarea 
                      id="default-fallback" 
                      placeholder="Message to use when AI agent cannot understand the request" 
                      defaultValue="I'm sorry, I didn't understand that. Could you please rephrase your question or request?"
                    />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button className="ml-auto">
                    Save Settings
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
