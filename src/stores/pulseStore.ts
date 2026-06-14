import { create } from 'zustand';
import { PulseMessage } from '../types';

interface PulseStore {
  messages: PulseMessage[];
  isOpen: boolean;
  togglePulse: () => void;
  addMessage: (content: string, type: 'user' | 'pulse') => void;
  clearMessages: () => void;
}

export const usePulseStore = create<PulseStore>((set) => ({
  messages: [
    {
      id: '1',
      type: 'pulse',
      content: "Hey! I'm Pulse, your creative assistant. Ask me anything about music production or let me help you generate beats!",
      timestamp: new Date().toISOString()
    }
  ],
  isOpen: false,
  
  togglePulse: () => set((state) => ({ isOpen: !state.isOpen })),
  
  addMessage: (content, type) => set((state) => ({
    messages: [
      ...state.messages,
      {
        id: Date.now().toString(),
        type,
        content,
        timestamp: new Date().toISOString()
      }
    ]
  })),
  
  clearMessages: () => set({
    messages: [
      {
        id: '1',
        type: 'pulse',
        content: "Hey! I'm Pulse, your creative assistant. Ask me anything about music production or let me help you generate beats!",
        timestamp: new Date().toISOString()
      }
    ]
  })
}));
