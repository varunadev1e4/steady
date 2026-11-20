import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { EmptyState } from '@/components/ui/States';
import { buttonClasses } from '@/components/ui/buttonStyles';

export function NotFoundPage() {
  return (
    <>
    <h1 className="sr-only">Page not found</h1>
    <EmptyState
      icon={Compass}
      title="This page doesn't exist"
      action={
        <Link to="/" className={buttonClasses('secondary')}>
          Go to Today
        </Link>
      }
    >
      The link may be old or mistyped.
    </EmptyState>
    </>
  );
}
