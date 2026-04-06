'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FiPlus, FiLoader, FiSearch, FiEdit2, FiTrash2, FiEye, FiMail } from 'react-icons/fi';
import PartnerLayout from '@/components/partner/PartnerLayout';
import { toast } from 'react-hot-toast';

interface CustomerCredential {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  companyName: string;
  createdAt: string;
  lastLoginAt: string | null;
}

export default function ManageCustomers() {
  const router = useRouter();
  const [customers, setCustomers] = useState<CustomerCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [partnerName, setPartnerName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    companyName: '',
    password: '',
    confirmPassword: ''
  });
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch partner details and customer list
  useEffect(() => {
    const token = localStorage.getItem('partner_token');
    if (!token) {
      router.push('/partner/login');
      return;
    }

    const fetchPartnerInfo = async () => {
      try {
        const response = await fetch('/api/partner/profile', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (!response.ok) {
          if (response.status === 401) {
            localStorage.removeItem('partner_token');
            router.push('/partner/login');
            return;
          }
          throw new Error('Failed to fetch partner info');
        }

        const data = await response.json();
        setPartnerId(data.id);
        setPartnerName(data.businessName || 'Partner');
        
        // Now fetch customers for this partner
        fetchCustomers(data.id, token);
      } catch (error) {
        console.error('Error fetching partner info:', error);
        setLoading(false);
      }
    };

    fetchPartnerInfo();
  }, [router]);

  const fetchCustomers = async (pid: string, token: string) => {
    try {
      const response = await fetch(`/api/partner/customers?partnerId=${pid}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch customers');
      }

      const data = await response.json();
      setCustomers(data);
    } catch (error) {
      console.error('Error fetching customers:', error);
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error for this field when user starts typing
    if (formErrors[name]) {
      setFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validateForm = () => {
    const errors: {[key: string]: string} = {};
    
    if (!formData.email) errors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) errors.email = 'Invalid email format';
    
    if (!formData.firstName) errors.firstName = 'First name is required';
    if (!formData.lastName) errors.lastName = 'Last name is required';
    if (!formData.companyName) errors.companyName = 'Company name is required';
    
    if (!formData.password) errors.password = 'Password is required';
    else if (formData.password.length < 8) errors.password = 'Password must be at least 8 characters';
    
    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }
    
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const token = localStorage.getItem('partner_token');
      const response = await fetch('/api/partner/customers/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          email: formData.email,
          firstName: formData.firstName,
          lastName: formData.lastName,
          companyName: formData.companyName,
          password: formData.password,
          partnerId
        })
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create customer');
      }
      
      // Reset form and close modal
      setFormData({
        email: '',
        firstName: '',
        lastName: '',
        companyName: '',
        password: '',
        confirmPassword: ''
      });
      setShowAddModal(false);
      
      // Refresh customer list
      if (partnerId) {
        fetchCustomers(partnerId, token || '');
      }
      
      toast.success('Customer added successfully');
    } catch (error: any) {
      console.error('Error creating customer:', error);
      toast.error(error.message || 'Failed to create customer');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCustomer = async (customerId: string) => {
    if (!confirm('Are you sure you want to delete this customer? This action cannot be undone.')) {
      return;
    }
    
    try {
      const token = localStorage.getItem('partner_token');
      const response = await fetch(`/api/partner/customers/${customerId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete customer');
      }
      
      // Remove from local state
      setCustomers(prev => prev.filter(c => c.id !== customerId));
      toast.success('Customer deleted successfully');
    } catch (error) {
      console.error('Error deleting customer:', error);
      toast.error('Failed to delete customer');
    }
  };

  const handleSendInvite = async (email: string) => {
    try {
      const token = localStorage.getItem('partner_token');
      const response = await fetch('/api/partner/customers/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          email,
          partnerId
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to send invitation');
      }
      
      toast.success('Invitation sent successfully');
    } catch (error) {
      console.error('Error sending invitation:', error);
      toast.error('Failed to send invitation');
    }
  };

  const filteredCustomers = customers.filter(customer => 
    customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.companyName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <PartnerLayout partnerName={partnerName} onLogout={() => {
        localStorage.removeItem('partner_token');
        router.push('/partner/login');
      }}>
        <div className="flex items-center justify-center h-96">
          <FiLoader className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      </PartnerLayout>
    );
  }

  return (
    <PartnerLayout partnerName={partnerName} onLogout={() => {
      localStorage.removeItem('partner_token');
      router.push('/partner/login');
    }}>
      <div className="mb-6">
        <nav className="flex mb-4">
          <a href="/partner/dashboard" className="text-blue-400 hover:text-blue-300">Dashboard</a>
          <span className="mx-2 text-gray-500">/</span>
          <a href="/partner/customers" className="text-blue-400 hover:text-blue-300">Customers</a>
          <span className="mx-2 text-gray-500">/</span>
          <span className="text-gray-300">Customer Portal Management</span>
        </nav>
        <h1 className="text-2xl font-bold text-white">Customer Portal Management</h1>
        <p className="text-gray-400 mt-1">
          Create and manage customer accounts for your white-label portal.
        </p>
      </div>
      
      <div className="bg-gray-800 rounded-lg p-6 mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
          <h2 className="text-xl font-semibold text-white mb-4 sm:mb-0">Portal Customers</h2>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                placeholder="Search customers..."
                className="bg-gray-700 text-white rounded-lg pl-10 pr-4 py-2 w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <FiSearch className="absolute left-3 top-3 text-gray-400" />
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg flex items-center justify-center transition-colors"
            >
              <FiPlus className="mr-2" />
              Add Customer
            </button>
          </div>
        </div>
        
        {customers.length === 0 ? (
          <div className="bg-gray-700/50 rounded-lg p-10 text-center">
            <p className="text-gray-400 mb-4">No customers found for your white-label portal.</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg inline-flex items-center"
            >
              <FiPlus className="mr-2" />
              Add Your First Customer
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-700/50 text-gray-300 text-sm">
                <tr>
                  <th className="px-4 py-3 rounded-tl-lg">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Last Login</th>
                  <th className="px-4 py-3 rounded-tr-lg">Actions</th>
                </tr>
              </thead>
              <tbody className="text-gray-200">
                {filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="border-t border-gray-700/30 hover:bg-gray-700/30">
                    <td className="px-4 py-3">{customer.firstName} {customer.lastName}</td>
                    <td className="px-4 py-3">{customer.email}</td>
                    <td className="px-4 py-3">{customer.companyName}</td>
                    <td className="px-4 py-3">
                      {new Date(customer.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      {customer.lastLoginAt 
                        ? new Date(customer.lastLoginAt).toLocaleDateString() 
                        : 'Never'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => handleSendInvite(customer.email)}
                          className="p-1.5 text-blue-400 hover:text-blue-300 rounded"
                          title="Send Invitation Email"
                        >
                          <FiMail />
                        </button>
                        <button 
                          className="p-1.5 text-amber-400 hover:text-amber-300 rounded"
                          title="Edit Customer"
                        >
                          <FiEdit2 />
                        </button>
                        <button 
                          onClick={() => handleDeleteCustomer(customer.id)}
                          className="p-1.5 text-red-400 hover:text-red-300 rounded"
                          title="Delete Customer"
                        >
                          <FiTrash2 />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      {/* Add Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-900 opacity-75"></div>
            </div>
            
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            
            <div className="inline-block align-bottom bg-gray-800 rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div className="absolute top-0 right-0 pt-4 pr-4">
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <span className="sr-only">Close</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="mt-3 text-center sm:mt-0 sm:text-left">
                <h3 className="text-lg leading-6 font-medium text-white mb-4">
                  Add New Customer
                </h3>
                
                <form onSubmit={handleSubmit} className="mt-2 space-y-4">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-300">
                      Email Address
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className={`mt-1 block w-full py-2 px-3 border ${formErrors.email ? 'border-red-500' : 'border-gray-600'} bg-gray-700 rounded-md shadow-sm text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500`}
                    />
                    {formErrors.email && (
                      <p className="mt-1 text-sm text-red-500">{formErrors.email}</p>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="firstName" className="block text-sm font-medium text-gray-300">
                        First Name
                      </label>
                      <input
                        type="text"
                        id="firstName"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleInputChange}
                        className={`mt-1 block w-full py-2 px-3 border ${formErrors.firstName ? 'border-red-500' : 'border-gray-600'} bg-gray-700 rounded-md shadow-sm text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500`}
                      />
                      {formErrors.firstName && (
                        <p className="mt-1 text-sm text-red-500">{formErrors.firstName}</p>
                      )}
                    </div>
                    
                    <div>
                      <label htmlFor="lastName" className="block text-sm font-medium text-gray-300">
                        Last Name
                      </label>
                      <input
                        type="text"
                        id="lastName"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleInputChange}
                        className={`mt-1 block w-full py-2 px-3 border ${formErrors.lastName ? 'border-red-500' : 'border-gray-600'} bg-gray-700 rounded-md shadow-sm text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500`}
                      />
                      {formErrors.lastName && (
                        <p className="mt-1 text-sm text-red-500">{formErrors.lastName}</p>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <label htmlFor="companyName" className="block text-sm font-medium text-gray-300">
                      Company Name
                    </label>
                    <input
                      type="text"
                      id="companyName"
                      name="companyName"
                      value={formData.companyName}
                      onChange={handleInputChange}
                      className={`mt-1 block w-full py-2 px-3 border ${formErrors.companyName ? 'border-red-500' : 'border-gray-600'} bg-gray-700 rounded-md shadow-sm text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500`}
                    />
                    {formErrors.companyName && (
                      <p className="mt-1 text-sm text-red-500">{formErrors.companyName}</p>
                    )}
                  </div>
                  
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-300">
                      Password
                    </label>
                    <input
                      type="password"
                      id="password"
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      className={`mt-1 block w-full py-2 px-3 border ${formErrors.password ? 'border-red-500' : 'border-gray-600'} bg-gray-700 rounded-md shadow-sm text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500`}
                    />
                    {formErrors.password && (
                      <p className="mt-1 text-sm text-red-500">{formErrors.password}</p>
                    )}
                  </div>
                  
                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      id="confirmPassword"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      className={`mt-1 block w-full py-2 px-3 border ${formErrors.confirmPassword ? 'border-red-500' : 'border-gray-600'} bg-gray-700 rounded-md shadow-sm text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500`}
                    />
                    {formErrors.confirmPassword && (
                      <p className="mt-1 text-sm text-red-500">{formErrors.confirmPassword}</p>
                    )}
                  </div>
                  
                  <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                    <button
                      type="submit"
                      className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <FiLoader className="animate-spin mr-2" />
                          Creating...
                        </>
                      ) : 'Create Customer'}
                    </button>
                    <button
                      type="button"
                      className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-600 shadow-sm px-4 py-2 bg-gray-700 text-base font-medium text-gray-300 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 sm:mt-0 sm:w-auto sm:text-sm"
                      onClick={() => setShowAddModal(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </PartnerLayout>
  );
}
