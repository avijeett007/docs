'use client';

import { useState } from 'react';
import { NewsletterSubscriber } from '@prisma/client';

interface NewsletterSubscriberListProps {
  initialSubscribers: NewsletterSubscriber[];
}

export default function NewsletterSubscriberList({
  initialSubscribers,
}: NewsletterSubscriberListProps) {
  const [subscribers, setSubscribers] = useState(initialSubscribers);
  const [filter, setFilter] = useState('all'); // all, active, unsubscribed
  const [search, setSearch] = useState('');

  const filteredSubscribers = subscribers.filter((subscriber) => {
    const matchesFilter =
      filter === 'all' || subscriber.status.toLowerCase() === filter;
    const matchesSearch = subscriber.email
      .toLowerCase()
      .includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const handleStatusChange = async (email: string, newStatus: string) => {
    try {
      const response = await fetch('/api/newsletter/update-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, status: newStatus }),
      });

      if (response.ok) {
        setSubscribers((prev) =>
          prev.map((sub) =>
            sub.email === email ? { ...sub, status: newStatus } : sub
          )
        );
      } else {
        console.error('Failed to update subscriber status');
      }
    } catch (error) {
      console.error('Error updating subscriber status:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex gap-4">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-gray-300 focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Subscribers</option>
            <option value="active">Active</option>
            <option value="unsubscribed">Unsubscribed</option>
          </select>
        </div>
        <div className="relative">
          <input
            type="text"
            placeholder="Search by email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-64 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-gray-300 focus:outline-none focus:border-blue-500"
          />
          <svg
            className="absolute right-3 top-2.5 h-4 w-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </div>

      {/* Subscribers Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left border-b border-gray-700">
              <th className="px-6 py-3 text-sm font-semibold text-gray-300">Email</th>
              <th className="px-6 py-3 text-sm font-semibold text-gray-300">Status</th>
              <th className="px-6 py-3 text-sm font-semibold text-gray-300">Subscribed On</th>
              <th className="px-6 py-3 text-sm font-semibold text-gray-300">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {filteredSubscribers.map((subscriber) => (
              <tr key={subscriber.id} className="hover:bg-gray-800/50">
                <td className="px-6 py-4 text-sm text-gray-300">
                  {subscriber.email}
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      subscriber.status === 'active'
                        ? 'bg-green-900/30 text-green-400'
                        : 'bg-red-900/30 text-red-400'
                    }`}
                  >
                    {subscriber.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-400">
                  {new Date(subscriber.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() =>
                      handleStatusChange(
                        subscriber.email,
                        subscriber.status === 'active' ? 'unsubscribed' : 'active'
                      )
                    }
                    className="text-sm text-blue-400 hover:text-blue-300"
                  >
                    {subscriber.status === 'active' ? 'Unsubscribe' : 'Reactivate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredSubscribers.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            No subscribers found.
          </div>
        )}
      </div>
    </div>
  );
}
