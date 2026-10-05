/** Seed data for demo mode (and as a starting point for Firebase). */

const SIZES = ['S', 'M', 'L', 'XL']
/** Responsive WebP (made by `npm run images`). */
const pic = (name, w = 896) => ({ src: `/images/${name}-full.webp`, srcset: `/images/${name}-480.webp 480w, /images/${name}-full.webp ${w}w` })
const variants = (color, stocks) => SIZES.map((size, i) => ({ sku: `${color.slice(0, 3).toUpperCase()}-${size}`, color, size, stock: stocks[i] }))

export const seedMoods = [
  { id: 'happy', slug: 'happy', name: 'The Happy Mood', tagline: "Don't ask. I'm happy.", story: 'Some days just land right. Nothing to prove, nothing to fix. Wear it loud or wear it quiet.', accentColor: '#D9C48A', order: 1, visible: true },
  { id: 'sad', slug: 'sad', name: 'The Sad Mood', tagline: 'It is allowed to hurt.', story: "For the days you feel everything and say nothing. Soft fabric, honest words.", accentColor: '#8A97A3', order: 2, visible: true },
  { id: 'love', slug: 'love', name: 'The Love Mood', tagline: 'Soft hearts, steady eyes.', story: 'Not overly romantic. Just the quiet kind of love you carry around.', accentColor: '#C79B97', order: 3, visible: true, dropDate: '2026-11-14' },
  { id: 'party', slug: 'party', name: 'The Party Mood', tagline: 'Maybe tonight.', story: "The night hasn't decided yet. Neither have you. Dress like it could go either way.", accentColor: '#B8A07E', order: 4, visible: true },
  { id: 'chaotic', slug: 'chaotic', name: 'The Chaotic Mood', tagline: 'Organised mess.', story: 'Too many thoughts, one hoodie. Coming soon.', accentColor: '#B5805F', order: 5, visible: true, dropDate: '2026-12-01' },
  { id: 'calm', slug: 'calm', name: 'The Calm Mood', tagline: 'Let it be.', story: 'Slow mornings. Quiet rooms. Nothing needs fixing right now.', accentColor: '#A5B1A0', order: 6, visible: true },
  { id: 'birthday', slug: 'birthday', name: 'The Birthday Mood', tagline: 'Another year, same me. Better.', story: 'A new number deserves its own sentence.', accentColor: '#D6B8A0', order: 7, visible: true },
  { id: 'single', slug: 'single', name: 'The Single Mood', tagline: 'Not everything needs an explanation.', story: 'Nobody asked. You do not owe an answer.', accentColor: '#9A9189', order: 8, visible: true },
  { id: 'after', slug: 'after', name: 'The After Mood', tagline: 'After the storm, the quiet.', story: "You got through it. That's the whole story.", accentColor: '#6F6A66', order: 9, visible: true },
  { id: 'new', slug: 'new-beginning', name: 'The New Beginning Mood', tagline: 'Clean page. Same you.', story: 'A fresh start, without making a speech about it. Coming soon.', accentColor: '#BFC8B5', order: 10, visible: true, dropDate: '2027-01-01' },
]

const description = 'A heavyweight hoodie with a relaxed, flattering fit. One sentence on the chest. Nothing else.'
const details = ['450 GSM brushed cotton fleece', 'Relaxed, slightly cropped fit', 'Embroidered-style print, one line', 'Washed to feel lived-in']

export const seedProducts = [
  { id: 'maybe-tonight', slug: 'maybe-tonight', name: 'Maybe Tonight', statement: 'maybe tonight.', moodId: 'party', price: 1450, compareAtPrice: 0, images: [pic('hoodie-black'), pic('hero')], colors: [{ name: 'Black', hex: '#111111' }], variants: variants('Black', [8, 12, 10, 4]), status: 'active', featured: true, isNew: true, description, details, createdAt: 1790000000000 },
  { id: 'let-it-be', slug: 'let-it-be', name: 'Let It Be', statement: 'let it be.', moodId: 'calm', price: 1350, compareAtPrice: 0, images: [pic('hoodie-cream')], colors: [{ name: 'Cream', hex: '#EFE7D6' }], variants: variants('Cream', [6, 9, 7, 0]), status: 'active', featured: true, isNew: true, description, details, createdAt: 1790000001000 },
  { id: 'dont-ask-im-happy', slug: 'dont-ask-im-happy', name: "Don't Ask. I'm Happy.", statement: "don't ask. i'm happy.", moodId: 'happy', price: 1400, compareAtPrice: 1650, images: [pic('hoodie-charcoal')], colors: [{ name: 'Charcoal', hex: '#3A3A39' }], variants: variants('Charcoal', [5, 10, 8, 6]), status: 'active', featured: true, isNew: false, description, details, createdAt: 1790000002000 },
  { id: 'actually-doing-okay', slug: 'actually-doing-okay', name: "I'm Actually Doing Okay", statement: "i'm actually doing okay.", moodId: 'after', price: 1400, compareAtPrice: 0, images: [pic('hoodie-okay')], colors: [{ name: 'Washed Grey', hex: '#B9B8B4' }], variants: variants('Washed Grey', [7, 11, 9, 5]), status: 'active', featured: true, isNew: true, description, details, createdAt: 1790000003000 },
  { id: 'miss-you-wont-text', slug: 'miss-you-wont-text', name: "I Miss You, But I Won't Text", statement: "i miss you, but i won't text.", moodId: 'sad', price: 1450, compareAtPrice: 0, images: [pic('hoodie-miss')], colors: [{ name: 'Dusty Rose', hex: '#B98A7B' }], variants: variants('Dusty Rose', [4, 8, 6, 2]), status: 'active', featured: true, isNew: false, description, details, createdAt: 1790000004000 },
  { id: 'not-everything', slug: 'not-everything', name: 'Not Everything Needs An Explanation', statement: 'not everything needs an explanation.', moodId: 'single', price: 1450, compareAtPrice: 0, images: [pic('hoodie-stone')], colors: [{ name: 'Stone', hex: '#A79C8E' }], variants: variants('Stone', [6, 10, 8, 3]), status: 'active', featured: false, isNew: false, description, details, createdAt: 1790000005000 },
  { id: 'thirty-looks-good', slug: 'thirty-looks-good', name: '30 Looks Good On Me', statement: '30 looks good on me.', moodId: 'birthday', price: 1500, compareAtPrice: 0, images: [pic('hoodie-thirty')], colors: [{ name: 'Oatmeal', hex: '#D8CFBF' }], variants: variants('Oatmeal', [5, 9, 9, 4]), status: 'active', featured: false, isNew: false, description, details, createdAt: 1790000006000 },
]

export const seedPromos = [
  { id: 'MOOD10', code: 'MOOD10', type: 'percent', value: 10, minOrder: 0, maxDiscount: 0, usageLimit: 0, usedCount: 0, perCustomerLimit: 0, firstOrderOnly: false, scope: { type: 'all' }, active: true },
  { id: 'FREESHIP', code: 'FREESHIP', type: 'shipping', value: 0, minOrder: 1400, usageLimit: 0, usedCount: 0, perCustomerLimit: 0, scope: { type: 'all' }, active: true },
  { id: 'TWOFORMOOD', code: 'TWOFORMOOD', type: 'bogo', buyQty: 1, getQty: 1, value: 0, minOrder: 0, usageLimit: 0, usedCount: 0, perCustomerLimit: 0, scope: { type: 'all' }, active: false },
]

export const seedSales = []

export const seedSettings = {
  id: 'store',
  storeName: 'THE MOOD',
  tagline: 'Wear what you feel.',
  announcements: ["Made for the mood you're in.", 'Free shipping over 2,000 EGP', 'Some days deserve their own hoodie.', 'Cash on delivery across Egypt'],
  social: { instagram: 'https://www.instagram.com/the.mood_co', facebook: 'https://www.facebook.com/The.moodclothing' },
  contact: { email: 'hello@themood.co', phone: '' },
  shipping: {
    defaultFee: 85,
    freeThreshold: 2000,
    zones: [
      ...['Cairo', 'Giza'].map((governorate) => ({ governorate, fee: 55 })),
      ...['Alexandria', 'Qalyubia', 'Dakahlia', 'Sharqia', 'Gharbia', 'Monufia', 'Beheira', 'Kafr El Sheikh', 'Damietta', 'Port Said', 'Ismailia', 'Suez'].map((governorate) => ({ governorate, fee: 70 })),
    ],
  },
  payments: { cod: true, card: false },
  couriers: [
    { name: 'Bosta', url: 'https://bosta.co/tracking-shipment/?track_num={number}' },
    { name: 'Aramex', url: 'https://www.aramex.com/track/results?ShipmentNumber={number}' },
  ],
  notifications: { email: true, whatsapp: false, adminEmail: '', adminWhatsapp: '', lowStockDigest: true },
  lowStock: 3,
}

export const seedBanners = []
