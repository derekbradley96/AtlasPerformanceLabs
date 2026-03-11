import React from 'react';
import { Pin } from 'lucide-react';

export default function MessageBubble({ message, isOwn }) {
  const timestamp = new Date(message.created_date).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`max-w-[75%] ${isOwn ? 'order-2' : 'order-1'}`}>
        {message.pinned && (
          <div className="flex items-center gap-1 text-xs text-blue-400 mb-1">
            <Pin className="w-3 h-3" />
            <span>Pinned</span>
          </div>
        )}
        <div
          className={`rounded-2xl px-4 py-2.5 ${
            isOwn
              ? 'bg-blue-500 text-white rounded-tr-sm'
              : 'bg-slate-800 text-white rounded-tl-sm'
          }`}
        >
          <p className="text-sm whitespace-pre-wrap break-words">{message.text}</p>
          {message.attachments?.length > 0 && (
            <div className="mt-2 space-y-2">
              {message.attachments.map((url, idx) => (
                <img
                  key={idx}
                  src={url}
                  alt="Attachment"
                  className="rounded-lg max-w-full"
                />
              ))}
            </div>
          )}
        </div>
        <div className={`flex items-center gap-2 mt-1 text-xs text-slate-500 ${isOwn ? 'justify-end' : 'justify-start'}`}>
          <span>{timestamp}</span>
          {isOwn && message.read_at && <span>Read</span>}
        </div>
      </div>
    </div>
  );
}