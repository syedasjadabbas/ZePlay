import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="mt-auto py-12 px-8 max-w-7xl mx-auto w-full border-t border-white/5 text-neutral-500 font-sans text-xs">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pb-8 text-[11px] font-medium">
        <div className="flex flex-col gap-3">
          <a href="#" className="hover:text-neutral-350 transition-colors">Audio Description</a>
          <a href="#" className="hover:text-neutral-350 transition-colors">Investor Relations</a>
          <a href="#" className="hover:text-neutral-350 transition-colors">Legal Notices</a>
        </div>
        <div className="flex flex-col gap-3">
          <a href="#" className="hover:text-neutral-350 transition-colors">Help Center</a>
          <a href="#" className="hover:text-neutral-350 transition-colors">Jobs</a>
          <a href="#" className="hover:text-neutral-350 transition-colors">Cookie Preferences</a>
        </div>
        <div className="flex flex-col gap-3">
          <a href="#" className="hover:text-neutral-350 transition-colors">Gift Cards</a>
          <a href="#" className="hover:text-neutral-350 transition-colors">Terms of Use</a>
          <a href="#" className="hover:text-neutral-350 transition-colors">Corporate Information</a>
        </div>
        <div className="flex flex-col gap-3">
          <a href="#" className="hover:text-neutral-350 transition-colors">Media Center</a>
          <a href="#" className="hover:text-neutral-350 transition-colors">Privacy</a>
          <a href="#" className="hover:text-neutral-350 transition-colors">Contact Us</a>
        </div>
      </div>
      <div className="flex flex-col md:flex-row md:items-center justify-between pt-6 border-t border-white/5 text-[10px] text-neutral-600 font-semibold tracking-wider uppercase">
        <span>&copy; {new Date().getFullYear()} ZePlay. All rights reserved.</span>
        <span className="mt-2 md:mt-0 text-brand-accent">Production-Grade Streaming Service</span>
      </div>
    </footer>
  );
};

export default Footer;
