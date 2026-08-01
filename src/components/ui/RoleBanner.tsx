import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/utils/helpers';

interface RoleBannerProps {
  className?: string;
  children?: React.ReactNode;
}

export const RoleBanner = ({ className, children }: RoleBannerProps) => {
  const { role, profile } = useAuthStore();
  
  const getBannerImage = () => {
    if (role === 'family') {
      return profile?.patient_category === 'maman_bebe' 
        ? '/assets/images/banners/maman-banner.webp'
        : '/assets/images/banners/senior-banner.webp';
    }
    if (role === 'aidant') {
      return '/assets/images/banners/aidant-banner.webp';
    }
    if (role === 'coordinator' || role === 'admin') {
      return '/assets/images/banners/coord-banner.webp';
    }
    return '/assets/images/banners/senior-banner.webp';
  };

  return (
    <div className={cn('relative overflow-hidden rounded-2xl', className)}>
      {/* Image de fond */}
      <img 
        src={getBannerImage()} 
        alt="Banner" 
        className="w-full h-32 sm:h-40 object-cover"
      />
      {/* Overlay pour lisibilité */}
      <div className="absolute inset-0 bg-black/30" />
      {/* Contenu */}
      {children && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
          {children}
        </div>
      )}
    </div>
  );
};