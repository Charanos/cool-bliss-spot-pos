'use client';

import type { Cents } from '@bliss/shared/money';
import { sum } from '@bliss/shared/money';
import { Card, CardBody, CardHeader } from '@bliss/ui/components/console/card';
import { Totals } from '@bliss/ui/components/console/section';
import { ImageLightbox } from '@bliss/ui/components/console/lightbox';
import { Money } from '@bliss/ui/components/money';
import { useState } from 'react';
import { EntityLink } from '../../../_components/entity-link';

export interface ReceiptDetailLine {
  id: string;
  productId: string | null;
  name: string;
  qtyExpected: number;
  qtyReceived: number;
  qtyRejected: number;
  rejectionReason: string | null;
  batchNumber: string | null;
  expiry: string | null;
  unitCostCents: Cents;
  lineTotalCents: Cents;
}

const head = 'px-12 py-12 text-label text-ink-subtle';

/** The delivery's lines as a real table: expected, accepted, sent back, the batch, the cost. */
export function ReceiptLines({ lines }: { lines: ReceiptDetailLine[] }) {
  return (
    <Card aria-labelledby="receipt-lines">
      <CardHeader band level="h2" titleId="receipt-lines" title="Lines" subtitle={`${lines.length} ${lines.length === 1 ? 'item' : 'items'}`} />
      <div className="scroll-x">
        <table className="w-full border-collapse">
          <caption className="sr-only">Lines on this delivery</caption>
          <thead>
            <tr className="border-b border-rule">
              <th scope="col" className={`${head} pl-20 text-left`}>
                Item
              </th>
              <th scope="col" className={`${head} text-right`}>
                Accepted
              </th>
              <th scope="col" className={`${head} text-right`}>
                Sent back
              </th>
              <th scope="col" className={`${head} text-left`}>
                Batch
              </th>
              <th scope="col" className={`${head} text-right`}>
                Each
              </th>
              <th scope="col" className={`${head} pr-20 text-right`}>
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const short = l.qtyExpected > 0 && l.qtyReceived < l.qtyExpected;
              return (
                <tr key={l.id} className="border-b border-rule align-top last:border-b-0">
                  <td className="py-12 pl-20 pr-12">
                    <EntityLink kind="product" id={l.productId} className="block text-ui">
                      {l.name}
                    </EntityLink>
                    {l.qtyExpected > 0 && l.qtyExpected !== l.qtyReceived ? (
                      <span className={short ? 'text-body-sm text-low' : 'text-body-sm text-ink-muted'}>
                        {l.qtyExpected} expected{short ? `, ${l.qtyExpected - l.qtyReceived} short` : ''}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-12 py-12 text-right font-mono tabular text-num-md text-ink">{l.qtyReceived}</td>
                  <td className="px-12 py-12 text-right">
                    {l.qtyRejected > 0 ? (
                      <span className="flex flex-col items-end">
                        <span className="font-mono tabular text-num-md text-stop">{l.qtyRejected}</span>
                        {l.rejectionReason ? <span className="text-body-sm text-ink-muted">{l.rejectionReason}</span> : null}
                      </span>
                    ) : (
                      <span className="text-body-sm text-ink-subtle">None</span>
                    )}
                  </td>
                  <td className="px-12 py-12">
                    {l.batchNumber || l.expiry ? (
                      <span className="flex flex-col">
                        {l.batchNumber ? <span className="font-mono tabular text-num-md text-ink">{l.batchNumber}</span> : null}
                        {l.expiry ? <span className="text-body-sm text-ink-muted">Expires {l.expiry}</span> : null}
                      </span>
                    ) : (
                      <span className="text-body-sm text-ink-subtle">Not recorded</span>
                    )}
                  </td>
                  <td className="px-12 py-12 text-right">
                    <Money value={l.unitCostCents} currency={false} size="num-md" tone="muted" />
                  </td>
                  <td className="py-12 pl-12 pr-20 text-right">
                    <Money value={l.lineTotalCents} currency={false} size="num-md" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <footer className="flex justify-end border-t border-edge px-20 py-16 card-band">
        <Totals className="w-full max-w-totals" items={[]} total={{ label: 'Value at cost', value: <Money value={sum(lines.map((l) => l.lineTotalCents))} size="num-lg" /> }} />
      </footer>
    </Card>
  );
}

/** The delivery note, invoice and crate photos, each opening full size; a PDF opens in its own tab. */
export function ReceiptPhotos({ urls }: { urls: string[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <Card aria-labelledby="receipt-photos">
      <CardHeader band level="h2" titleId="receipt-photos" title="Photos and scans" subtitle={urls.length > 0 ? `${urls.length} attached` : undefined} />
      <CardBody className="pt-16">
        {urls.length === 0 ? (
          <p className="text-body-sm text-ink-muted">Nothing was attached to this delivery.</p>
        ) : (
          <ul className="grid grid-cols-3 gap-8">
            {urls.map((url, i) => (
              <li key={url}>
                <button
                  type="button"
                  onClick={() => (url.endsWith('.pdf') ? window.open(url, '_blank', 'noopener') : setOpen(i))}
                  aria-label={url.endsWith('.pdf') ? `Open scan ${i + 1} in a new tab` : `Open photo ${i + 1} full size`}
                  className="block aspect-square w-full overflow-hidden rounded-md bg-thumb transition-hover hover:opacity-90"
                >
                  {url.endsWith('.pdf') ? (
                    <span className="flex size-full items-center justify-center text-label text-ink-muted">PDF</span>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element -- an upload served by the Console
                    <img src={url} alt="" className="size-full object-cover" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
      <ImageLightbox src={open === null ? null : (urls[open] ?? null)} alt={`Delivery photo ${(open ?? 0) + 1}`} title={`Photo ${(open ?? 0) + 1} of ${urls.length}`} onClose={() => setOpen(null)} />
    </Card>
  );
}
