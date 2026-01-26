'use client';

import { ServiceControls } from './ServiceControls';
import { CloseIcon } from './Icons';

interface ServiceControlsModalProps {
  isOpen: boolean;
  onClose: () => void;
  machineId: string;
}

export function ServiceControlsModal({ isOpen, onClose, machineId }: ServiceControlsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-dark-panel rounded-lg border border-dark-border max-w-2xl w-full max-h-[90vh] flex flex-col my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-dark-border flex-shrink-0">
          <h3 className="heading-inter heading-inter-md">Service Controls</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-dark-border rounded transition-colors"
          >
            <CloseIcon className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <ServiceControls machineId={machineId} />
        </div>
      </div>
    </div>
  );
}
