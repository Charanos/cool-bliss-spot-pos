import { redirect } from 'next/navigation';

export default function CounterIndex() {
  redirect('/counter/orders');
}
