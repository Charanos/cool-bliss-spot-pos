import { redirect } from 'next/navigation';

/** Bills moved into History, which opens on this counter's day. docs/16 section 9. */
export default function CounterBillsPage() {
  redirect('/counter/history');
}
