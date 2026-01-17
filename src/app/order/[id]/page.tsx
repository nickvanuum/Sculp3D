interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-6">Order Details</h1>
      <p className="text-gray-700">Order ID: {id}</p>
      <p className="text-gray-700 mt-4">Status: Pending</p>
      {/* Placeholder for more details */}
    </div>
  );
}