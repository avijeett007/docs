'use client';

import { useAdminAuth } from '@/components/admin/AdminAuthProvider';
import AdminSidebar from '@/components/admin/AdminSidebar';
import CouponManager from '@/components/admin/CouponManager';

export default function CouponsPage() {
  const { user } = useAdminAuth();

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen">
      <AdminSidebar />
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          <div className="mb-6">
            <h1 className="text-3xl font-bold tracking-tight">Coupon Management</h1>
            <p className="text-gray-600 mt-2">
              Create and manage promotional coupons for marketing campaigns and lifetime offers.
            </p>
          </div>
          
          <CouponManager />
        </div>
      </div>
    </div>
  );
}
