// Skeleton loading card
export function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-cream-dark">
      <div className="skeleton aspect-square w-full" />
      <div className="p-4 space-y-3">
        <div className="skeleton h-3 w-1/3 rounded" />
        <div className="skeleton h-4 w-3/4 rounded" />
        <div className="skeleton h-3 w-1/2 rounded" />
        <div className="flex justify-between items-center mt-2">
          <div className="skeleton h-5 w-16 rounded" />
          <div className="skeleton h-8 w-16 rounded-lg" />
        </div>
      </div>
    </div>
  )
}

// Skeleton for category tile
export function SkeletonCategoryTile() {
  return (
    <div className="skeleton rounded-2xl aspect-[3/4]" />
  )
}

// Skeleton for product page
export function SkeletonProduct() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
      <div className="skeleton aspect-square rounded-2xl" />
      <div className="space-y-4">
        <div className="skeleton h-8 w-3/4 rounded" />
        <div className="skeleton h-4 w-1/2 rounded" />
        <div className="skeleton h-6 w-1/3 rounded" />
        <div className="skeleton h-24 w-full rounded-lg" />
        <div className="skeleton h-12 w-full rounded-lg" />
      </div>
    </div>
  )
}
