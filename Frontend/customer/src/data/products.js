// Products data — 24 items across 12 categories
// To add a product: copy one entry, change the id, fill in the fields.
// tags: any combination of "best", "new", "sale"
// salePrice: set to null if not on sale

export const products = [
  // ── GANESHA ──
  {
    id: 'gan-001',
    name: 'Panchadhatu Ganesh Murti — 12 Inch',
    slug: 'panchadhatu-ganesh-murti-12-inch',
    category: 'ganesha',
    tags: ['best', 'sale'],
    price: 2499,
    salePrice: 1899,
    material: 'Panchadhatu',
    size: '12 inch',
    weight: '1.2 kg',
    description:
      'This exquisite Panchadhatu Ganesh Murti is crafted by master artisans using five sacred metals — copper, brass, zinc, tin and lead — in perfect proportion. The idol features Lord Ganesha in a seated pose with intricate detailing on the crown, trunk and ornaments. Ideal for home temples, office desks and gifting on auspicious occasions.',
    images: [
      'https://placehold.co/600x700/E8741A/FFF8EC?text=Ganesh+Murti',
      'https://placehold.co/600x700/C45E0E/FFF8EC?text=Ganesh+Side+View',
      'https://placehold.co/600x700/7A1F2B/FFF8EC?text=Ganesh+Detail',
    ],
    stock: 12,
    rating: 4.8,
    reviewCount: 56,
    featured: true,
  },
  {
    id: 'gan-002',
    name: 'Marble Ganesh Idol — 6 Inch',
    slug: 'marble-ganesh-idol-6-inch',
    category: 'ganesha',
    tags: ['new'],
    price: 1299,
    salePrice: null,
    material: 'White Marble',
    size: '6 inch',
    weight: '600 g',
    description:
      'Hand-carved from premium white Makrana marble, this Ganesh idol radiates divine purity. The smooth finish and intricate carvings make it a perfect centrepiece for your pooja ghar.',
    images: [
      'https://placehold.co/600x700/F5EDDA/7A1F2B?text=Marble+Ganesh',
      'https://placehold.co/600x700/EDE0C4/7A1F2B?text=Marble+Ganesh+2',
    ],
    stock: 8,
    rating: 4.6,
    reviewCount: 31,
    featured: false,
  },

  // ── SHRI RAM ──
  {
    id: 'ram-001',
    name: 'Ram Darbar Brass Murti — 10 Inch',
    slug: 'ram-darbar-brass-murti-10-inch',
    category: 'shri-ram',
    tags: ['best'],
    price: 3499,
    salePrice: null,
    material: 'Brass',
    size: '10 inch',
    weight: '1.8 kg',
    description:
      'The complete Ram Darbar featuring Lord Ram, Sita, Lakshman and Hanuman in a single breathtaking composition. Cast in solid brass with gold-like finish, this murti is a statement piece for any home temple.',
    images: [
      'https://placehold.co/600x700/5C1620/FFF8EC?text=Ram+Darbar',
      'https://placehold.co/600x700/7A1F2B/FFF8EC?text=Ram+Darbar+2',
    ],
    stock: 5,
    rating: 4.9,
    reviewCount: 44,
    featured: true,
  },
  {
    id: 'ram-002',
    name: 'Lord Ram Idol with Bow — 8 Inch',
    slug: 'lord-ram-idol-with-bow-8-inch',
    category: 'shri-ram',
    tags: ['sale'],
    price: 1799,
    salePrice: 1399,
    material: 'Resin, Gold Finish',
    size: '8 inch',
    weight: '700 g',
    description:
      'A beautifully detailed idol of Lord Ram in his warrior pose holding the divine bow. The gold finish gives it an antique yet regal look.',
    images: [
      'https://placehold.co/600x700/9B2D3C/FFF8EC?text=Lord+Ram',
    ],
    stock: 15,
    rating: 4.5,
    reviewCount: 22,
    featured: false,
  },

  // ── HANUMAN ──
  {
    id: 'han-001',
    name: 'Hanuman Ji Brass Statue — Standing 14 Inch',
    slug: 'hanuman-ji-brass-statue-standing-14-inch',
    category: 'hanuman',
    tags: ['best', 'sale'],
    price: 2799,
    salePrice: 2199,
    material: 'Brass',
    size: '14 inch',
    weight: '2.1 kg',
    description:
      'A majestic standing Hanuman Ji statue in solid brass, depicted with the Gada (mace) and Meru Parvat. The fine craftsmanship captures the power and devotion of Pawanputra Hanuman.',
    images: [
      'https://placehold.co/600x700/C45E0E/FFF8EC?text=Hanuman+Brass',
      'https://placehold.co/600x700/E8741A/FFF8EC?text=Hanuman+Detail',
    ],
    stock: 7,
    rating: 4.9,
    reviewCount: 68,
    featured: true,
  },

  // ── BALAJI ──
  {
    id: 'bal-001',
    name: 'Lord Balaji (Venkateswara) Idol — 10 Inch',
    slug: 'lord-balaji-venkateswara-idol-10-inch',
    category: 'balaji',
    tags: ['best'],
    price: 2199,
    salePrice: null,
    material: 'Brass, Antique Finish',
    size: '10 inch',
    weight: '1.4 kg',
    description:
      'An authentic representation of Lord Venkateswara (Balaji) in his divine form adorned with crown, ornaments and four hands holding Shankha and Chakra. A treasured idol for Vishnu devotees.',
    images: [
      'https://placehold.co/600x700/2B1A14/FFF8EC?text=Balaji+Idol',
    ],
    stock: 9,
    rating: 4.7,
    reviewCount: 39,
    featured: true,
  },

  // ── BUDDHA ──
  {
    id: 'bud-001',
    name: 'Meditating Buddha Statue — 8 Inch',
    slug: 'meditating-buddha-statue-8-inch',
    category: 'buddha',
    tags: ['new', 'sale'],
    price: 1499,
    salePrice: 1199,
    material: 'Polyresin',
    size: '8 inch',
    weight: '800 g',
    description:
      'A serene meditating Buddha statue with a smooth stone-effect finish. Perfect for creating a peaceful atmosphere in your meditation space, living room or garden.',
    images: [
      'https://placehold.co/600x700/4A7C59/FFF8EC?text=Buddha+Statue',
    ],
    stock: 20,
    rating: 4.6,
    reviewCount: 29,
    featured: false,
  },

  // ── DURGA ──
  {
    id: 'dur-001',
    name: 'Maa Durga Idol on Lion — 12 Inch',
    slug: 'maa-durga-idol-on-lion-12-inch',
    category: 'durga',
    tags: ['best'],
    price: 2999,
    salePrice: null,
    material: 'Brass',
    size: '12 inch',
    weight: '1.6 kg',
    description:
      'The mighty Maa Durga astride her lion, holding weapons in her eight arms — a powerful and auspicious murti for your home shrine. The detailed brass casting captures her divine ferocity and grace.',
    images: [
      'https://placehold.co/600x700/8B1A4A/FFF8EC?text=Maa+Durga',
      'https://placehold.co/600x700/6B0E38/FFF8EC?text=Durga+Detail',
    ],
    stock: 6,
    rating: 4.8,
    reviewCount: 51,
    featured: true,
  },

  // ── KRISHNA ──
  {
    id: 'kri-001',
    name: 'Bal Krishna Makhan Chor Idol — 8 Inch',
    slug: 'bal-krishna-makhan-chor-idol-8-inch',
    category: 'krishna',
    tags: ['new', 'best'],
    price: 1899,
    salePrice: null,
    material: 'Brass',
    size: '8 inch',
    weight: '900 g',
    description:
      'A delightful Bal Krishna in his famous Makhan Chor (butter-thief) pose. This endearing idol brings joy and playfulness to any pooja space, capturing the innocence of the divine child.',
    images: [
      'https://placehold.co/600x700/1A3A6B/FFF8EC?text=Bal+Krishna',
    ],
    stock: 14,
    rating: 4.7,
    reviewCount: 37,
    featured: true,
  },
  {
    id: 'kri-002',
    name: 'Radha Krishna Murti — 10 Inch',
    slug: 'radha-krishna-murti-10-inch',
    category: 'krishna',
    tags: ['sale'],
    price: 2599,
    salePrice: 1999,
    material: 'Panchadhatu',
    size: '10 inch',
    weight: '1.3 kg',
    description:
      'The divine couple Radha Krishna in an eternal embrace — a symbol of pure love and devotion. Crafted in Panchadhatu with intricate ornamental detailing.',
    images: [
      'https://placehold.co/600x700/2B3A8B/FFF8EC?text=Radha+Krishna',
    ],
    stock: 10,
    rating: 4.9,
    reviewCount: 62,
    featured: false,
  },

  // ── LAXMIJI ──
  {
    id: 'lax-001',
    name: 'Maa Lakshmi Brass Idol — Seated 10 Inch',
    slug: 'maa-lakshmi-brass-idol-seated-10-inch',
    category: 'laxmiji',
    tags: ['best', 'sale'],
    price: 2299,
    salePrice: 1799,
    material: 'Brass',
    size: '10 inch',
    weight: '1.2 kg',
    description:
      'Maa Lakshmi seated on a lotus throne, showering gold coins — the eternal bestower of prosperity. This brass murti is consecrated by pundits and comes with a wooden base.',
    images: [
      'https://placehold.co/600x700/C9962B/2B1A14?text=Lakshmi+Idol',
      'https://placehold.co/600x700/DEB554/2B1A14?text=Lakshmi+Detail',
    ],
    stock: 11,
    rating: 4.8,
    reviewCount: 73,
    featured: true,
  },
  {
    id: 'lax-002',
    name: 'Laxmi Ganesh Silver-Plated Set — 6 Inch',
    slug: 'laxmi-ganesh-silver-plated-set-6-inch',
    category: 'laxmiji',
    tags: ['new'],
    price: 1599,
    salePrice: null,
    material: 'German Silver',
    size: '6 inch each',
    weight: '500 g each',
    description:
      'A classic Laxmi-Ganesh pair in silver-plated German silver — the ideal Diwali gift. These murtis are traditionally worshipped together for wealth and wisdom.',
    images: [
      'https://placehold.co/600x700/B8B8B8/2B1A14?text=Laxmi+Ganesh+Set',
    ],
    stock: 18,
    rating: 4.5,
    reviewCount: 28,
    featured: false,
  },

  // ── SHIVA ──
  {
    id: 'shi-001',
    name: 'Lord Shiva Nataraja Brass Idol — 12 Inch',
    slug: 'lord-shiva-nataraja-brass-idol-12-inch',
    category: 'shiva',
    tags: ['best'],
    price: 3199,
    salePrice: null,
    material: 'Brass',
    size: '12 inch',
    weight: '2.0 kg',
    description:
      'The cosmic dance of Lord Shiva (Nataraja) captured in exquisite brass. The ring of fire (Prabhamandala), the dancing posture and every detail are masterfully crafted — a collector\'s piece.',
    images: [
      'https://placehold.co/600x700/2B4A7A/FFF8EC?text=Nataraja',
      'https://placehold.co/600x700/1A3560/FFF8EC?text=Nataraja+Detail',
    ],
    stock: 4,
    rating: 4.9,
    reviewCount: 55,
    featured: true,
  },
  {
    id: 'shi-002',
    name: 'Shivling with Nandi — 6 Inch',
    slug: 'shivling-with-nandi-6-inch',
    category: 'shiva',
    tags: ['sale'],
    price: 1199,
    salePrice: 899,
    material: 'Black Stone',
    size: '6 inch',
    weight: '900 g',
    description:
      'A natural black stone Shivling accompanied by the sacred Nandi bull. The set radiates spiritual energy and is perfect for daily Shiv Puja.',
    images: [
      'https://placehold.co/600x700/2B2B2B/FFF8EC?text=Shivling+Nandi',
    ],
    stock: 16,
    rating: 4.7,
    reviewCount: 42,
    featured: false,
  },

  // ── DAILY POOJA ITEMS ──
  {
    id: 'poo-001',
    name: 'Brass Pooja Thali Set — 7 Piece',
    slug: 'brass-pooja-thali-set-7-piece',
    category: 'daily-pooja',
    tags: ['best', 'sale'],
    price: 1099,
    salePrice: 849,
    material: 'Brass',
    size: '10 inch thali',
    weight: '1.1 kg',
    description:
      'Complete 7-piece brass pooja thali set including thali (plate), diya, aarti bell, kumkum box, agarbatti stand, kalash and gangajali. Everything you need for a complete aarti.',
    images: [
      'https://placehold.co/600x700/C9962B/FFF8EC?text=Pooja+Thali',
    ],
    stock: 25,
    rating: 4.6,
    reviewCount: 89,
    featured: false,
  },
  {
    id: 'poo-002',
    name: 'Silver-Plated Panchamrit Kalash',
    slug: 'silver-plated-panchamrit-kalash',
    category: 'daily-pooja',
    tags: ['new'],
    price: 799,
    salePrice: null,
    material: 'German Silver',
    size: '5 inch height',
    weight: '300 g',
    description:
      'A beautiful silver-plated kalash used for storing Panchamrit during Abhishekam. Engraved with traditional motifs and a secure lid.',
    images: [
      'https://placehold.co/600x700/B8B8B8/2B1A14?text=Kalash',
    ],
    stock: 30,
    rating: 4.4,
    reviewCount: 19,
    featured: false,
  },

  // ── DIYA & LAMPS ──
  {
    id: 'diy-001',
    name: 'Brass Diyas Set of 5 — Deepak',
    slug: 'brass-diyas-set-of-5-deepak',
    category: 'diya',
    tags: ['best', 'sale'],
    price: 699,
    salePrice: 499,
    material: 'Brass',
    size: '3 inch each',
    weight: '400 g',
    description:
      'Classic brass oil diyas in a set of 5. Perfect for daily aarti, Diwali decoration and festival celebrations. The wide base prevents tipping and ensures safe use.',
    images: [
      'https://placehold.co/600x700/C9962B/2B1A14?text=Brass+Diyas',
    ],
    stock: 40,
    rating: 4.7,
    reviewCount: 114,
    featured: false,
  },
  {
    id: 'diy-002',
    name: 'Decorative Akhand Diya — 8 Inch',
    slug: 'decorative-akhand-diya-8-inch',
    category: 'diya',
    tags: ['new'],
    price: 1299,
    salePrice: null,
    material: 'Brass, Hand-Engraved',
    size: '8 inch',
    weight: '700 g',
    description:
      'A grand Akhand (continuous) Diya with hand-engraved floral motifs. Designed to burn for extended periods during Akhand Aarti and festive occasions.',
    images: [
      'https://placehold.co/600x700/DEB554/2B1A14?text=Akhand+Diya',
    ],
    stock: 12,
    rating: 4.5,
    reviewCount: 27,
    featured: false,
  },
  {
    id: 'diy-003',
    name: 'Decorative Clay Diya Set — 12 Pieces',
    slug: 'decorative-clay-diya-set-12-pieces',
    category: 'diya',
    tags: ['sale'],
    price: 399,
    salePrice: 299,
    material: 'Terracotta',
    size: '2.5 inch each',
    weight: '600 g',
    description:
      'Handmade terracotta diyas painted with natural colours, perfect for Diwali and daily devotion. Each diya is unique due to hand-crafting.',
    images: [
      'https://placehold.co/600x700/E8741A/FFF8EC?text=Clay+Diyas',
    ],
    stock: 60,
    rating: 4.3,
    reviewCount: 145,
    featured: false,
  },

  // ── INCENSE ──
  {
    id: 'inc-001',
    name: 'Chandan Agarbatti — 100 Sticks',
    slug: 'chandan-agarbatti-100-sticks',
    category: 'incense',
    tags: ['best'],
    price: 299,
    salePrice: null,
    material: 'Natural Sandalwood',
    size: '9 inch sticks',
    weight: '150 g',
    description:
      'Premium natural sandalwood (Chandan) incense sticks with a long burn time of 45 minutes each. Free from harmful chemicals, made using traditional masala method.',
    images: [
      'https://placehold.co/600x700/7A4A2B/FFF8EC?text=Chandan+Agarbatti',
    ],
    stock: 80,
    rating: 4.8,
    reviewCount: 203,
    featured: false,
  },
  {
    id: 'inc-002',
    name: 'Sambrani Dhoop Cups — 40 Pieces',
    slug: 'sambrani-dhoop-cups-40-pieces',
    category: 'incense',
    tags: ['new', 'sale'],
    price: 249,
    salePrice: 199,
    material: 'Natural Resins & Herbs',
    size: 'Standard',
    weight: '120 g',
    description:
      'Traditional Sambrani (Benzoin resin) dhoop cups that produce rich, purifying smoke. Used in South Indian and Marathi traditions for home purification and negative energy removal.',
    images: [
      'https://placehold.co/600x700/6B3A1A/FFF8EC?text=Sambrani+Dhoop',
    ],
    stock: 100,
    rating: 4.7,
    reviewCount: 87,
    featured: false,
  },
  {
    id: 'inc-003',
    name: 'Rose & Jasmine Agarbatti Gift Box',
    slug: 'rose-jasmine-agarbatti-gift-box',
    category: 'incense',
    tags: ['new'],
    price: 449,
    salePrice: null,
    material: 'Natural Florals',
    size: '3 packs × 30 sticks',
    weight: '200 g',
    description:
      'A beautifully presented gift box with three fragrances — Rose, Jasmine and Mogra. Perfect as a devotional gift or for daily pooja.',
    images: [
      'https://placehold.co/600x700/8B1A4A/FFF8EC?text=Gift+Box+Agarbatti',
    ],
    stock: 35,
    rating: 4.5,
    reviewCount: 41,
    featured: false,
  },
]

// Helpers
export const getProductById = (id) => products.find((p) => p.id === id)
export const getProductBySlug = (slug) => products.find((p) => p.slug === slug)
export const getProductsByCategory = (categorySlug) =>
  products.filter((p) => p.category === categorySlug)
export const getFeaturedProducts = () => products.filter((p) => p.featured)
export const getBestSellers = () => products.filter((p) => p.tags.includes('best'))
export const getNewArrivals = () => products.filter((p) => p.tags.includes('new'))
export const getOnSale = () => products.filter((p) => p.tags.includes('sale') && p.salePrice)
export const getRelatedProducts = (productId, categorySlug, limit = 4) =>
  products
    .filter((p) => p.category === categorySlug && p.id !== productId)
    .slice(0, limit)

export const materials = [...new Set(products.map((p) => p.material))]

export default products
