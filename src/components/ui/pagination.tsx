'use client';

import React from 'react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  showPageSizeSelector?: boolean;
  showInfo?: boolean;
  className?: string;
  disabled?: boolean;
}

export function Pagination({
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  showPageSizeSelector = true,
  showInfo = true,
  className = '',
  disabled = false,
}: PaginationProps) {
  // Calculate the range of items being displayed
  const startItem = Math.min((currentPage - 1) * pageSize + 1, totalCount);
  const endItem = Math.min(currentPage * pageSize, totalCount);

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxPagesToShow = 5;

    if (totalPages <= maxPagesToShow) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      if (currentPage <= 3) {
        // Near the start
        for (let i = 2; i <= Math.min(4, totalPages - 1); i++) {
          pages.push(i);
        }
        if (totalPages > 4) pages.push('...');
      } else if (currentPage >= totalPages - 2) {
        // Near the end
        pages.push('...');
        for (let i = Math.max(totalPages - 3, 2); i < totalPages; i++) {
          pages.push(i);
        }
      } else {
        // In the middle
        pages.push('...');
        pages.push(currentPage - 1);
        pages.push(currentPage);
        pages.push(currentPage + 1);
        pages.push('...');
      }

      // Always show last page
      pages.push(totalPages);
    }

    return pages;
  };

  const handlePrevious = () => {
    if (currentPage > 1 && !disabled) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages && !disabled) {
      onPageChange(currentPage + 1);
    }
  };

  const handlePageClick = (page: number) => {
    if (!disabled && page !== currentPage) {
      onPageChange(page);
    }
  };

  const handlePageSizeChange = (newSize: number) => {
    if (onPageSizeChange && !disabled) {
      onPageSizeChange(newSize);
    }
  };

  if (totalPages <= 1 && !showPageSizeSelector) {
    return null;
  }

  return (
    <div className={`flex items-center justify-between ${className}`}>
      {/* Info section */}
      {showInfo && (
        <div className="text-sm text-gray-400">
          {totalCount > 0 ? (
            <>
              Showing {startItem} to {endItem} of {totalCount.toLocaleString()}
            </>
          ) : (
            'No items'
          )}
        </div>
      )}

      {/* Page navigation */}
      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevious}
            disabled={currentPage === 1 || disabled}
            className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            aria-label="Previous page"
          >
            <FiChevronLeft className="w-4 h-4" />
            Previous
          </button>

          <div className="flex items-center gap-1">
            {getPageNumbers().map((page, index) => {
              if (page === '...') {
                return (
                  <span
                    key={`ellipsis-${index}`}
                    className="px-3 py-2 text-gray-400"
                  >
                    ...
                  </span>
                );
              }

              const pageNum = page as number;
              return (
                <button
                  key={pageNum}
                  onClick={() => handlePageClick(pageNum)}
                  disabled={disabled}
                  className={`px-3 py-2 rounded-lg transition-colors ${
                    currentPage === pageNum
                      ? 'bg-blue-500 text-white font-medium'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  aria-label={`Page ${pageNum}`}
                  aria-current={currentPage === pageNum ? 'page' : undefined}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <button
            onClick={handleNext}
            disabled={currentPage === totalPages || disabled}
            className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            aria-label="Next page"
          >
            Next
            <FiChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Page size selector */}
      {showPageSizeSelector && onPageSizeChange && (
        <select
          value={pageSize}
          onChange={(e) => handlePageSizeChange(parseInt(e.target.value))}
          disabled={disabled}
          className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Items per page"
        >
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>
              {size} per page
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

export default Pagination;
