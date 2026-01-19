'use client';

import { useRef, useEffect, useState } from 'react';
import { LibraryIcon, FileIcon } from './Icons';
import { toast } from 'react-toastify';

export function Canvas() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ name: string; type: string; size: number; uploadedAt: Date }>>([]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const validFiles = Array.from(files).filter(file => {
      const isValid = file.type === 'application/pdf' || 
                     file.type === 'text/csv' || 
                     file.name.endsWith('.pdf') || 
                     file.name.endsWith('.csv');
      if (!isValid) {
        toast.error(`${file.name} is not a valid PDF or CSV file`);
      }
      return isValid;
    });

    if (validFiles.length === 0) return;

    setUploading(true);
    try {
      for (const file of validFiles) {
        await uploadFile(file);
      }
      toast.success(`Successfully uploaded ${validFiles.length} file(s)`);
    } catch (error: any) {
      console.error('Error uploading files:', error);
      toast.error(`Failed to upload files: ${error.message}`);
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('fileName', file.name);
    formData.append('fileType', file.type);

    const response = await fetch('/api/ai-library/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(error.error || 'Upload failed');
    }

    const result = await response.json();
    setUploadedFiles(prev => [...prev, {
      name: file.name,
      type: file.type,
      size: file.size,
      uploadedAt: new Date(),
    }]);
    return result;
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const fileArray = Array.from(files);
      const event = {
        target: { files: fileArray as any },
      } as React.ChangeEvent<HTMLInputElement>;
      handleFileSelect(event);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div className="flex-1 bg-dark-bg relative overflow-hidden p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <LibraryIcon className="w-8 h-8 text-sage-400" />
          <h1 className="heading-inter heading-inter-lg">AI Library</h1>
        </div>
        <p className="text-gray-400 text-sm">
          Upload PDF and CSV files to add them to your knowledge base. The AI will be able to answer questions based on these documents.
        </p>
      </div>

      {/* File Upload Area */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className="bg-dark-panel border-2 border-dashed border-dark-border rounded-lg p-8 mb-6 hover:border-sage-500/50 transition-colors"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.csv"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          disabled={uploading}
        />
        
        <div className="flex flex-col items-center justify-center text-center">
          <FileIcon className="w-12 h-12 text-gray-400 mb-4" />
          <p className="text-gray-300 mb-2">
            {uploading ? 'Uploading files...' : 'Drag and drop PDF or CSV files here'}
          </p>
          <p className="text-gray-500 text-sm mb-4">
            or click to browse
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="bg-sage-500 hover:bg-sage-600 text-white px-6 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? 'Uploading...' : 'Select Files'}
          </button>
          <p className="text-gray-500 text-xs mt-3">
            Supported formats: PDF, CSV
          </p>
        </div>
      </div>

      {/* Uploaded Files List */}
      {uploadedFiles.length > 0 && (
        <div className="bg-dark-panel border border-dark-border rounded-lg p-6">
          <h3 className="text-gray-300 mb-4">Uploaded Files</h3>
          <div className="space-y-2">
            {uploadedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-midnight-200/20 rounded-lg border border-dark-border"
              >
                <div className="flex items-center gap-3">
                  <FileIcon className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-white text-sm">{file.name}</p>
                    <p className="text-gray-500 text-xs">
                      {(file.size / 1024).toFixed(2)} KB • {file.uploadedAt.toLocaleString()}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-sage-400 bg-sage-500/20 px-2 py-1 rounded">
                  {file.type.includes('pdf') ? 'PDF' : 'CSV'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

