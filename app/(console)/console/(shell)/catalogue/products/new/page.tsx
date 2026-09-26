import { redirect } from 'next/navigation';

/** Adding a product happens in the products view's dialog; this address opens it. */
export default function NewProductPage(): never {
  redirect('/console/catalogue/products?new=1');
}
