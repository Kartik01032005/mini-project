import { useState, useRef, useEffect } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";

const ChatWithGemini = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const messagesRef = useRef(null);

  const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const speakText = (text) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.speak(utterance);
    }
  };

  const sendMessage = async (text = input, isFromMic = false) => {
    if (!text.trim()) return;

    // Add user message
    setMessages((prev) => [...prev, { role: "user", text }]);
    setInput("");
    setIsTyping(true);

    // Check if the input is asking for the bot's name
    const lowerInput = text.toLowerCase();
    if (lowerInput.includes("what is your name") || lowerInput.includes("who are you") || lowerInput.includes("what's your name")) {
      setTimeout(() => {
        const responseText = "my name is nova";
        setMessages((prev) => [...prev, { role: "assistant", text: responseText }]);
        if (isFromMic) speakText(responseText);
        setIsTyping(false);
      }, 1000);
      return;
    }

    // Check if the user is asking who developed the assistant
    if (lowerInput.includes("who developed you") || lowerInput.includes("who made you") || lowerInput.includes("who built you") || lowerInput.includes("who created you")) {
      setTimeout(() => {
        const responseText = "I was developed by Kartik, Rahul, Manjunath and Prathyaksha.";
        setMessages((prev) => [...prev, { role: "assistant", text: responseText }]);
        if (isFromMic) speakText(responseText);
        setIsTyping(false);
      }, 500);
      return;
    }

    // Quick local handler: date/time queries — use local system for accurate current information
    const timeDatePattern = /\b(current time|what time|what's the time|what is the time|current date|what date|what's the date|what is the date|what day is it|date and time|time now)\b/;
    const timeMatch = timeDatePattern.test(lowerInput);
    if (timeMatch) {
      // Special case for "what day is it" - show day of the week
      if (lowerInput.includes("what day is it")) {
        const now = new Date();
        const dayOfWeek = now.toLocaleDateString(undefined, { weekday: 'long' });
        const responseText = `Today is ${dayOfWeek}.`;
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: responseText,
          },
        ]);
        if (isFromMic) speakText(responseText);
        setIsTyping(false);
        return;
      }

      // try to detect a requested timezone or location: phrases like "in Tokyo", "in PST", "for New York"
      const locMatch = lowerInput.match(/(?:\bin\b|\bfor\b|\bat\b)\s+([a-zA-Z0-9_\-\/\s]+)/i);
      let timeZone;
      if (locMatch && locMatch[1]) {
        const tzMap = {
          'new york': 'America/New_York',
          'nyc': 'America/New_York',
          'los angeles': 'America/Los_Angeles',
          'la': 'America/Los_Angeles',
          'san francisco': 'America/Los_Angeles',
          'london': 'Europe/London',
          'tokyo': 'Asia/Tokyo',
          'paris': 'Europe/Paris',
          'sydney': 'Australia/Sydney',
          'delhi': 'Asia/Kolkata',
          'india': 'Asia/Kolkata',
          'utc': 'UTC',
          'gmt': 'UTC',
          'pst': 'America/Los_Angeles',
          'est': 'America/New_York',
          'cet': 'Europe/Paris',
          'ist': 'Asia/Kolkata'
        };

        const rawLoc = locMatch[1].trim().toLowerCase();
        // prefer a mapped IANA timezone, otherwise assume user provided a valid IANA zone
        timeZone = tzMap[rawLoc] || rawLoc;
      }

      const now = new Date();
      let formatted;
      // Determine what to show: time, date, or both
      const isTimeQuery = lowerInput.includes('time') || lowerInput.includes('now');
      const isDateQuery = lowerInput.includes('date');

      let opts;
      if (isTimeQuery && !isDateQuery) {
        // Show only time in 12-hour format with AM/PM
        opts = {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          timeZoneName: timeZone ? 'short' : undefined,
        };
      } else if (isDateQuery && !isTimeQuery) {
        // Show only date in readable format
        opts = {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        };
      } else {
        // Show both date and time
        opts = {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          timeZoneName: 'short',
        };
      }

      try {
        if (timeZone) {
          formatted = now.toLocaleString(undefined, { ...opts, timeZone });
        } else {
          formatted = now.toLocaleString(undefined, opts);
        }
      } catch (e) {
        // fallback if an invalid timezone was provided
        formatted = now.toLocaleString();
      }

      let responseText;
      if (isTimeQuery && !isDateQuery) {
        responseText = `Current time: ${formatted}`;
      } else if (isDateQuery && !isTimeQuery) {
        responseText = `Current date: ${formatted}`;
      } else {
        responseText = `Current date and time: ${formatted}`;
      }

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: responseText,
        },
      ]);
      if (isFromMic) speakText(responseText);
      setIsTyping(false);
      return;
    }

    try {
      const prompt = `Please provide a concise and genuine answer to the following question. Keep your response brief and to the point: ${text}`;
      const result = await model.generateContent(prompt);
      const response = result.response.text();

      setMessages((prev) => [...prev, { role: "assistant", text: response }]);
      if (isFromMic) speakText(response);
      setIsTyping(false);
    } catch (error) {
      console.error(error);
      setIsTyping(false);
    }
  };

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Speech recognition not supported in this browser.');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = false;
    recognitionRef.current.interimResults = false;
    recognitionRef.current.lang = 'en-US';

    recognitionRef.current.onstart = () => {
      setIsListening(true);
    };

    recognitionRef.current.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      sendMessage(transcript, true);
    };

    recognitionRef.current.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognitionRef.current.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  // auto-scroll to bottom when messages change
  useEffect(() => {
    const el = messagesRef.current;
    if (el) {
      // small timeout to allow new message node to render
      setTimeout(() => {
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      }, 50);
    }
  }, [messages, isTyping]);

  return (
    <div className="nova-container">
      <header className="nova-header p-4 text-center text-white">
        <h1 className="text-2xl font-bold drop-shadow-md">Nova</h1>
        <p className="text-sm opacity-90">Chat with your local assistant</p>
      </header>

      {/* Messages */}
      <div ref={messagesRef} className="messages" aria-live="polite">
        {messages.map((msg, index) => (
          <div key={index} className={msg.role === 'user' ? 'message-user' : 'message-assistant'}>
            {msg.text}
          </div>
        ))}

        {isTyping && (
          <div className="message-assistant inline-flex items-center gap-2">
            <div className="typing-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <span className="opacity-80">Nova is typing...</span>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="input-area">
        <textarea
          value={input}
          placeholder="Write your message here..."
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
          className="compose"
        />

        <button
          onClick={isListening ? stopListening : startListening}
          className={`btn btn-mic ${isListening ? 'bg-red-500' : ''}`}
          title={isListening ? 'Stop listening' : 'Start listening'}
        >
          🎤
        </button>

        <button
          onClick={() => sendMessage()}
          className="btn btn-send"
          aria-label="Send message"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
          Send
        </button>
      </div>
    </div>
  );
};

export default ChatWithGemini;
