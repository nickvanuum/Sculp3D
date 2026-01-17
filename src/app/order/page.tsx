'use client';

import { useState } from 'react';

export default function OrderPage() {
  const [email, setEmail] = useState('');
  const [bustSize, setBustSize] = useState('');
  const [style, setStyle] = useState('');
  const [notes, setNotes] = useState('');
  const [images, setImages] = useState<FileList | null>(null);
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: string[] = [];

    if (!email) newErrors.push('Email is required.');
    if (!bustSize) newErrors.push('Bust size is required.');
    if (!style) newErrors.push('Style is required.');
    if (!consent) newErrors.push('You must consent to proceed.');
    if (!images || images.length < 3 || images.length > 12) {
      newErrors.push('Please upload between 3 and 12 images.');
    }

    if (newErrors.length > 0) {
      setErrors(newErrors);
      return;
    }

    const formData = new FormData();
    formData.append('email', email);
    formData.append('bustSize', bustSize);
    formData.append('style', style);
    formData.append('notes', notes);
    for (let i = 0; i < images!.length; i++) {
      formData.append('images', images![i]);
    }

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        // Now create checkout session
        const checkoutResponse = await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: data.orderId }),
        });

        if (checkoutResponse.ok) {
          const checkoutData = await checkoutResponse.json();
          window.location.href = checkoutData.url;
        } else {
          const error = await checkoutResponse.json();
          setErrors([error.error]);
        }
      } else {
        const error = await response.json();
        setErrors([error.error]);
      }
    } catch (error) {
      setErrors(['Failed to submit order.']);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-6">Place Your Order</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Bust Size</label>
          <select
            value={bustSize}
            onChange={(e) => setBustSize(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">Select size</option>
            <option value="100">100mm</option>
            <option value="150">150mm</option>
            <option value="200">200mm</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Style</label>
          <select
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">Select style</option>
            <option value="realistic">Realistic</option>
            <option value="stylized">Stylized</option>
            <option value="abstract">Abstract</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Upload Images (3-12)</label>
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={(e) => setImages(e.target.files)}
            className="mt-1 block w-full"
          />
        </div>
        <div className="flex items-center">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
          />
          <label className="ml-2 block text-sm text-gray-900">
            I consent to the processing of my data for this order.
          </label>
        </div>
        {errors.length > 0 && (
          <div className="text-red-600 text-sm">
            {errors.map((error, index) => (
              <p key={index}>{error}</p>
            ))}
          </div>
        )}
        <button
          type="submit"
          className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          Submit Order
        </button>
      </form>
    </div>
  );
}