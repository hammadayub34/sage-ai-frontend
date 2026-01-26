'use client';

import { useState } from 'react';
import { WrenchIcon } from './Icons';
import { ServiceControlsModal } from './ServiceControlsModal';

interface ServiceControlsButtonProps {
  machineId: string;
}

export function ServiceControlsButton({ machineId }: ServiceControlsButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 bg-midnight-300 hover:bg-midnight-400 text-dark-text border border-dark-border p-2 rounded-full transition-colors shadow-lg hover:shadow-xl z-40 flex items-center justify-center"
        title="Service Controls"
      >
        <WrenchIcon className="w-4 h-4" />
      </button>
      <ServiceControlsModal 
        isOpen={isOpen} 
        onClose={() => setIsOpen(false)} 
        machineId={machineId}
      />
    </>
  );
}
