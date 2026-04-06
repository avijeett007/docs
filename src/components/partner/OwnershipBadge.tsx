import { FiHome, FiUser } from 'react-icons/fi';

interface OwnershipBadgeProps {
  ownership: 'partner' | 'customer';
  customerName?: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export function OwnershipBadge({ 
  ownership, 
  customerName, 
  size = 'sm',
  showIcon = true 
}: OwnershipBadgeProps) {
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base'
  };
  
  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };
  
  if (ownership === 'partner') {
    return (
      <span className={`inline-flex items-center rounded-full font-medium bg-blue-900 text-blue-200 border border-blue-700 ${sizeClasses[size]}`}>
        {showIcon && <FiHome className={`${iconSizes[size]} mr-1`} />}
        Partner
      </span>
    );
  }
  
  return (
    <span className={`inline-flex items-center rounded-full font-medium bg-green-900 text-green-200 border border-green-700 ${sizeClasses[size]}`}>
      {showIcon && <FiUser className={`${iconSizes[size]} mr-1`} />}
      {customerName ? (
        <span className="truncate max-w-24" title={customerName}>
          {customerName}
        </span>
      ) : (
        'Customer'
      )}
    </span>
  );
}

// Utility component for showing ownership with customer details
interface OwnershipInfoProps {
  ownership: 'partner' | 'customer';
  customer?: {
    id: string;
    name: string;
    email: string;
    subaccountStatus?: string;
  } | null;
  showDetails?: boolean;
}

export function OwnershipInfo({ ownership, customer, showDetails = false }: OwnershipInfoProps) {
  return (
    <div className="flex flex-col space-y-1">
      <OwnershipBadge 
        ownership={ownership} 
        customerName={customer?.name}
      />
      
      {showDetails && customer && (
        <div className="text-xs text-gray-400 space-y-0.5">
          <div className="truncate" title={customer.email}>
            {customer.email}
          </div>
          {customer.subaccountStatus && (
            <div className="flex items-center space-x-1">
              <span>Subaccount:</span>
              <span className={`capitalize ${
                customer.subaccountStatus === 'active' 
                  ? 'text-green-400' 
                  : customer.subaccountStatus === 'suspended'
                  ? 'text-red-400'
                  : 'text-yellow-400'
              }`}>
                {customer.subaccountStatus}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
