import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="mt-auto py-8 text-center text-xs text-neutral-600 space-y-1">
      <div>&copy; 2026 ZePlay. All Rights Reserved.</div>
      <div className="text-[10px]">
        <a href="https://zeploy.tech" target="_blank" rel="noopener noreferrer" className="hover:underline">
          Powered by Zeploy Tech
        </a>
      </div>
    </footer>
  );
};

export default Footer;
