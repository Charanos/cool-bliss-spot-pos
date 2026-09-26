import type { Metadata } from 'next';
import { ButtonLink } from '@bliss/ui/components/button-link';
import { IconArrowLeft } from '@tabler/icons-react';

export const metadata: Metadata = { title: 'New Product' };

export default function NewProductPage() {
  return (
    <>
      <div className="mb-16 flex flex-wrap items-center justify-between gap-16">
        <ButtonLink href="/console/catalogue/products" variant="ghost" icon={IconArrowLeft} className="-ml-12">
          Products
        </ButtonLink>
      </div>

      <div className="flex flex-col items-center justify-center py-40 min-h-[400px]">
        <div className="flex size-[64px] items-center justify-center rounded-full bg-accent-wash text-accent-text mb-16">
          <IconArrowLeft size={32} stroke={1.5} className="rotate-180" />
        </div>
        <h2 className="text-title-lg font-medium text-ink tracking-tight mb-8">Add new product</h2>
        <p className="text-body text-ink-muted text-center max-w-sm mb-24">
          This feature is currently rolling out. Please import via CSV or contact support to add new products.
        </p>
      </div>
    </>
  );
}
