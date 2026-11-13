import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, Send, MessageCircle } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const Chatbot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // API configuration
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || ""; // API Key from environment variables
  const apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent';

  const systemInstructionText = `
    You are a friendly, professional, and highly helpful AI assistant built on the Gemini model, designed to assist with various queries.
    Your responses must adhere to the following rules:
    1.  *Clarity and Conciseness:* Be clear, concise, and easy to understand. Structure complex explanations with simple, step-by-step guidance.
    2.  *Context-Awareness:* Utilize the full conversation history to provide relevant, contextual responses.
    3.  *Tone:* Maintain a friendly, professional, and helpful tone at all times.
    4.  *Out of Knowledge:* If a question is outside your knowledge or requires real-time information not available through search grounding, admit it politely (e.g., "I don't have that specific real-time information, but I can suggest...") and offer alternatives.
    5.  *Simplicity:* Use simple, non-jargon language for technical topics whenever possible.
    6.  *Assets:* Provide code snippets, examples, or references if the user requests them.
    7.  *Emojis:* Use emojis sparingly (e.g., at the start/end of a turn, or to highlight a key point) to enhance engagement.
  `;

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const welcomeMessage: ChatMessage = {
        role: 'assistant',
        content: apiKey
          ? "Hi there! 👋 Welcome to **Mindful Cognitive Lens** - your trusted companion for dyslexia assessment and cognitive testing.\n\nI'm here to guide you through understanding your assessment results, answer questions about dyslexia, and help you navigate our comprehensive testing tools. Whether you're curious about handwriting analysis, cognitive benchmarks, or speech patterns, I've got you covered!\n\n✨ **Feel free to ask me:**\n• How to interpret your test results\n• What each assessment measures\n• Tips for supporting dyslexia\n• General questions about cognitive testing\n\nWhat would you like to explore today? 🌟"
          : "Hi there! 👋 Welcome to **Mindful Cognitive Lens**!\n\nI'm your dyslexia assessment guide. While I'm currently in offline mode, I can still help you understand dyslexia assessment procedures, interpret results, and explain our testing methodology.\n\nWhat can I help you with today? 📚"
      };
      setMessages([welcomeMessage]);
    }
  }, [isOpen, messages.length, apiKey]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatMarkdown = (text: string): string => {
    let html = text.trim();

    // Convert code blocks
    html = html.replace(/```([\s\S]*?)```/g, (match, code) => {
      return `<pre class="mt-2 mb-2 p-3 bg-gray-700 text-white text-sm rounded-lg overflow-x-auto"><code>${code.trim()}</code></pre>`;
    });

    // Convert new lines to <br>
    html = html.replace(/\n/g, '<br>');

    // Convert bold text
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Convert inline code
    html = html.replace(/`(.*?)`/g, '<code class="bg-gray-200 text-red-700 px-1 rounded">$1</code>');

    return html;
  };

  const getFallbackResponse = (userInput: string): ChatMessage => {
    const input = userInput.toLowerCase();

    // API configuration message
    if (input.includes('api') || input.includes('key') || input.includes('connect') || input.includes('error')) {
      return {
        role: 'assistant',
        content: "🔧 **API Configuration Required**\n\nI'm currently not connected to my AI service. To enable the full chatbot:\n\n1. Get a Gemini API key from: https://makersuite.google.com/app/apikey\n2. Create a `.env` file in your project root\n3. Add: `VITE_GEMINI_API_KEY=your_api_key_here`\n4. Restart the development server\n\nFor now, I can provide basic information about dyslexia assessment. What would you like to know?"
      };
    }

    // Dyslexia information
    if (input.includes('dyslexia') || input.includes('what is')) {
      return {
        role: 'assistant',
        content: "**Dyslexia** is a learning difference that affects reading, writing, and spelling abilities. It's not related to intelligence but rather how the brain processes language.\n\n**Common signs include:**\n• Difficulty with reading fluency\n• Problems with spelling and writing\n• Challenges with phonological awareness\n• Slow processing speed\n\n**This assessment tool helps identify:**\n• Handwriting patterns\n• Cognitive processing abilities\n• Speech and reading skills\n\nWould you like to know more about any specific aspect?"
      };
    }

    // Assessment information
    if (input.includes('assessment') || input.includes('test') || input.includes('evaluate')) {
      return {
        role: 'assistant',
        content: "**Our Dyslexia Assessment includes:**\n\n**1. Handwriting Assessment**\n• Analyzes letter formation and spacing\n• Identifies motor coordination issues\n• Measures writing speed and accuracy\n\n**2. Cognitive Assessment**\n• Memory tests\n• Attention and focus evaluation\n• Problem-solving abilities\n\n**3. Speech & Reading Assessment**\n• Fluency evaluation\n• Pronunciation analysis\n• Reading comprehension\n\n**The results provide:**\n• Risk index calculation\n• Personalized recommendations\n• Detailed progress tracking\n\nReady to start an assessment?"
      };
    }

    // Help or general questions
    if (input.includes('help') || input.includes('how') || input.includes('what can')) {
      return {
        role: 'assistant',
        content: "**I can help you with:**\n\n• **Dyslexia information** - Understanding signs, symptoms, and characteristics\n• **Assessment guidance** - Explaining our testing procedures\n• **Results interpretation** - Understanding your assessment outcomes\n• **Recommendations** - Suggesting next steps and interventions\n\n**To get started:**\n1. Complete the assessments (Handwriting, Cognitive, Speech)\n2. Review your results on the Dashboard\n3. Follow personalized recommendations\n\nWhat specific information would you like?"
      };
    }

    // Default response
    return {
      role: 'assistant',
      content: "I'm currently operating in offline mode. I can provide basic information about:\n\n• **Dyslexia assessment** and testing\n• **Cognitive evaluation** procedures\n• **Handwriting analysis** methods\n• **Speech and reading** assessments\n\nTo enable full AI assistance, please configure the Gemini API key as mentioned in the setup instructions.\n\nWhat would you like to know about dyslexia assessment?"
    };
  };

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: inputValue.trim()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    // Check if API key is available
    if (!apiKey) {
      // Provide fallback responses for common questions
      const fallbackResponse = getFallbackResponse(userMessage.content);
      setMessages(prev => [...prev, fallbackResponse]);
      setIsLoading(false);
      return;
    }

    try {
      // Convert messages to Gemini API format
      const chatHistory = messages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }));

      // Add the new user message
      chatHistory.push({
        role: 'user',
        parts: [{ text: userMessage.content }]
      });

      const payload = {
        contents: chatHistory,
        tools: [{ "google_search": {} }],
        systemInstruction: {
          parts: [{ text: systemInstructionText }]
        },
      };

      const response = await fetch(`${apiUrl}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const result = await response.json();
        const candidate = result.candidates?.[0];

        if (candidate && candidate.content?.parts?.[0]?.text) {
          const assistantMessage: ChatMessage = {
            role: 'assistant',
            content: candidate.content.parts[0].text
          };
          setMessages(prev => [...prev, assistantMessage]);
        } else {
          throw new Error('API response missing content.');
        }
      } else {
        const errorData = await response.json();
        throw new Error(`API Error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: "I'm currently unable to connect with my core systems. Please try again in a moment."
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const toggleChatbot = () => {
    setIsOpen(!isOpen);
  };

  return (
    <>
      {/* Chatbot Toggle Button */}
      <Button
        onClick={toggleChatbot}
        className="fixed bottom-6 right-6 z-50 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full p-4 shadow-lg hover:shadow-xl transition-all duration-300"
        size="lg"
      >
        <MessageCircle size={24} />
      </Button>

      {/* Chatbot Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col">
            {/* Header */}
            <div className="p-4 bg-indigo-700 text-white rounded-t-2xl flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">🧠 Mindful Cognitive Lens Assistant</h2>
                <p className="text-sm opacity-80">Your guide to dyslexia assessment & cognitive testing insights</p>
              </div>
              <Button
                onClick={toggleChatbot}
                variant="ghost"
                size="sm"
                className="text-white hover:bg-indigo-600"
              >
                <X size={20} />
              </Button>
            </div>

            {/* Messages */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] p-3 rounded-2xl ${message.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-br-md'
                        : 'bg-gray-200 text-gray-800 rounded-bl-md'
                      }`}
                  >
                    <div
                      dangerouslySetInnerHTML={{
                        __html: formatMarkdown(message.content)
                      }}
                    />
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-200 text-gray-800 p-3 rounded-2xl rounded-bl-md flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-400 border-t-transparent"></div>
                    <span className="text-sm">Thinking...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-gray-200 flex space-x-3">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message here..."
                className="flex-1 p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-150"
                disabled={isLoading}
              />
              <Button
                onClick={sendMessage}
                disabled={!inputValue.trim() || isLoading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6"
              >
                <Send size={20} />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Chatbot;

