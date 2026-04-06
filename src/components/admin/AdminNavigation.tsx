'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import '@/styles/admin.css';

const AdminNavigation: React.FC = () => {
  const pathname = usePathname();

  const navItems = [
    { name: 'Dashboard', path: '/admin' },
    { name: 'Newsletter', path: '/admin/newsletter' },
    { name: 'Email Campaigns', path: '/admin/email-campaigns' },
    { name: 'Partners', path: '/admin/partners' },
    { name: 'Waitlist', path: '/admin/waitlist' },
    { name: 'Settings', path: '/admin/settings' }
  ];

  return (
    <nav className="admin-navigation">
      <div className="logo-container">
        <Link href="/admin">
          <span className="logo">Knotie-AI Admin</span>
        </Link>
      </div>
      
      <ul className="nav-items">
        {navItems.map((item) => (
          <li key={item.path} className={pathname === item.path ? 'active' : ''}>
            <Link href={item.path}>
              <span className="nav-link">{item.name}</span>
            </Link>
          </li>
        ))}
      </ul>
      
      <style jsx>{`
        .admin-navigation {
          display: flex;
          flex-direction: column;
          background-color: #111827;
          border-right: 1px solid #1f2937;
          width: 240px;
          height: 100vh;
          position: fixed;
          top: 0;
          left: 0;
          padding: 1.5rem 0;
        }
        
        .logo-container {
          padding: 0 1.5rem 1.5rem;
          border-bottom: 1px solid #1f2937;
          margin-bottom: 1.5rem;
        }
        
        .logo {
          font-size: 1.25rem;
          font-weight: 600;
          color: #f9fafb;
        }
        
        .nav-items {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        
        .nav-items li {
          margin-bottom: 0.25rem;
        }
        
        .nav-items li a {
          display: block;
          padding: 0.75rem 1.5rem;
          color: #9ca3af;
          text-decoration: none;
          transition: all 0.2s ease;
        }
        
        .nav-items li:hover a {
          background-color: #1f2937;
          color: #f9fafb;
        }
        
        .nav-items li.active a {
          background-color: #2563eb;
          color: #ffffff;
          font-weight: 500;
        }
        
        .nav-link {
          display: block;
        }
      `}</style>
    </nav>
  );
};

export default AdminNavigation;
